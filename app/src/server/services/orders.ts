import { and, asc, eq, sql } from "drizzle-orm";
import { distanceMeters, validCoordinates } from "@/lib/geo";
import { handoverCode, publicOrderCode, randomToken, sha256Hex } from "@/lib/ids";
import { audit } from "../audit";
import { schema, type Db, type DbOrTx, type Tx } from "../db/client";
import { OutOfStockError, releaseReservation, reserveStock } from "../domain/inventory";
import { transitionOrder } from "../domain/order-state";
import { loadSettings } from "../settings";
import { findServingHub, getDeliveryOptions, hubClock, serviceDateFor } from "./delivery";
import { priceCart, type CartItemInput, type PricingIssue } from "./pricing";

export type CheckoutErrorCode =
  | "CUSTOMER_BLOCKED"
  | "INVALID_ADDRESS"
  | "OUT_OF_AREA"
  | "OPTION_UNAVAILABLE"
  | "OPTION_BUSY"
  | "HUB_CLOSED"
  | "CART_INVALID"
  | "OUT_OF_STOCK"
  | "PAYMENT_MODE_UNAVAILABLE"
  | "PAY_ON_DELIVERY_NOT_ALLOWED"
  | "BELOW_MINIMUM_ORDER"
  | "CONSENT_REQUIRED";

export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
    public readonly details?: { issues?: PricingIssue[]; productId?: string; minOrderPaise?: number; capPaise?: number; reason?: string; nextOpensAt?: string },
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface DeliveryAddressInput {
  /** House / flat, building, street: what the rider reads. */
  line: string;
  landmark?: string;
  note?: string;
  lat: number;
  lng: number;
}

export interface CreateOrderInput {
  customerId: string;
  customerName: string;
  idempotencyKey: string;
  deliveryOption: string; // delivery_option.code
  address: DeliveryAddressInput;
  paymentMode: "PREPAID" | "PAY_ON_DELIVERY";
  items: CartItemInput[];
  note?: string;
  /** Customer ticked "send me order updates" (transactional messages). Required. */
  transactionalConsent: boolean;
  ip?: string | null;
}

export interface CreatedOrder {
  orderId: string;
  publicCode: string;
  status: "CONFIRMED" | "PENDING_PAYMENT";
  deliveryOption: string;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  promisedAt: Date;
  handoverCode: string;
  /** Raw tracking token. Only its hash is stored, so this is the one time it can be returned. */
  trackingToken: string | null;
  replayed: boolean;
  holdExpiresAt: Date | null;
}

const CONSENT_TEXT_VERSION = "order-updates-2026-10";

function isUniqueViolation(e: unknown, constraint?: string): boolean {
  let cur: unknown = e;
  while (cur && typeof cur === "object") {
    const c = cur as { code?: string; constraint?: string; cause?: unknown };
    if (c.code === "23505" && (!constraint || c.constraint === constraint)) return true;
    cur = c.cause;
  }
  return false;
}

async function uniquePublicCode(tx: DbOrTx): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = publicOrderCode();
    const taken = await tx.select({ id: schema.order.id }).from(schema.order).where(eq(schema.order.publicCode, code)).limit(1);
    if (taken.length === 0) return code;
  }
  throw new Error("Could not allocate an order code");
}

/**
 * Create an order. One transaction: validate the address and speed, price on the server, check hub capacity,
 * reserve stock, write order + lines + events. Any failure rolls everything back: no half-orders.
 * Idempotent on (customer, idempotencyKey): a retry returns the original order.
 */
export async function createOrder(db: Db, input: CreateOrderInput, now = new Date()): Promise<CreatedOrder> {
  if (!input.transactionalConsent) throw new CheckoutError("CONSENT_REQUIRED", "Order updates consent is required");
  try {
    return await db.transaction((tx) => createOrderTx(tx, input, now));
  } catch (e) {
    // Two identical requests racing: the loser hits the unique index and returns the winner's order.
    if (isUniqueViolation(e, "order_idem_uq")) {
      const existing = await findByIdempotencyKey(db, input.customerId, input.idempotencyKey);
      if (existing) return existing;
    }
    throw e;
  }
}

async function findByIdempotencyKey(db: DbOrTx, customerId: string, key: string): Promise<CreatedOrder | null> {
  const [o] = await db
    .select()
    .from(schema.order)
    .where(and(eq(schema.order.customerId, customerId), eq(schema.order.idempotencyKey, key)))
    .limit(1);
  if (!o) return null;
  return {
    orderId: o.id,
    publicCode: o.publicCode,
    status: o.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "CONFIRMED",
    deliveryOption: o.deliveryOption,
    subtotalPaise: o.subtotalPaise,
    deliveryFeePaise: o.feePaise,
    totalPaise: o.totalPaise,
    promisedAt: o.promisedAt,
    handoverCode: o.handoverCode,
    trackingToken: null,
    replayed: true,
    holdExpiresAt: o.holdExpiresAt,
  };
}

async function createOrderTx(tx: Tx, input: CreateOrderInput, now: Date): Promise<CreatedOrder> {
  // Lock the customer row first: this serialises a customer's concurrent checkouts, so the
  // idempotency check below cannot race with an identical request that is still in flight.
  const [customer] = await tx.select().from(schema.customer).where(eq(schema.customer.id, input.customerId)).for("update").limit(1);
  if (!customer || customer.blocked) throw new CheckoutError("CUSTOMER_BLOCKED", "This account cannot place orders");

  const replay = await findByIdempotencyKey(tx, input.customerId, input.idempotencyKey);
  if (replay) return replay;

  const { address } = input;
  const line = address.line.trim();
  if (line.length < 6 || line.length > 200 || !validCoordinates(address.lat, address.lng)) throw new CheckoutError("INVALID_ADDRESS", "Please enter your full delivery address");

  const found = await findServingHub(tx, { lat: address.lat, lng: address.lng });
  if (!found) throw new CheckoutError("OUT_OF_AREA", "We do not deliver to this location yet");
  const { hub, distanceM } = found;

  // One order at a time per hub: the capacity count below must not race with another checkout.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${hub.id}, 0))`);

  const options = await getDeliveryOptions(tx, hub, distanceM, now);
  const option = options.find((o) => o.code === input.deliveryOption);
  if (!option || option.status === "DISABLED" || option.status === "OUT_OF_RANGE") throw new CheckoutError("OPTION_UNAVAILABLE", "That delivery speed is not available at your location");
  if (option.status === "CLOSED") throw new CheckoutError("HUB_CLOSED", "We are closed right now", { nextOpensAt: hubClock(hub, now).nextAcceptingAt.toISOString() });
  if (option.status === "BUSY") throw new CheckoutError("OPTION_BUSY", "That delivery speed is very busy right now");

  const settings = await loadSettings(tx);
  const serviceDate = serviceDateFor(hub, now);
  const priced = await priceCart(tx, { serviceDate, items: input.items });
  if (!priced.ok) throw new CheckoutError("CART_INVALID", "Some items in your cart need attention", { issues: priced.issues });

  const subtotal = priced.subtotalPaise;
  const minOrder = Math.max(settings.minOrderPaise, option.minOrderPaise);
  if (subtotal < minOrder) throw new CheckoutError("BELOW_MINIMUM_ORDER", "Order is below the minimum for this delivery speed", { minOrderPaise: minOrder });
  const fee = option.feePaise;
  const total = subtotal + fee;

  // Payment-mode rules (BR-09).
  if (input.paymentMode === "PREPAID") {
    if (!settings.prepaidEnabled) throw new CheckoutError("PAYMENT_MODE_UNAVAILABLE", "Online payment is not available yet");
  } else {
    if (total > settings.payOnDeliveryCapPaise) throw new CheckoutError("PAY_ON_DELIVERY_NOT_ALLOWED", "Order is above the pay-on-delivery limit", { reason: "OVER_CAP", capPaise: settings.payOnDeliveryCapPaise });
    if (customer.noShowCount >= settings.maxFailedDeliveriesForCod) throw new CheckoutError("PAY_ON_DELIVERY_NOT_ALLOWED", "Pay-on-delivery is not available for this account", { reason: "FAILED_DELIVERIES" });
    if (settings.prepaidEnabled && settings.firstOrderPrepaidRequired) {
      const prior = await tx.select({ id: schema.order.id }).from(schema.order).where(and(eq(schema.order.customerId, customer.id), eq(schema.order.status, "DELIVERED"))).limit(1);
      if (prior.length === 0) throw new CheckoutError("PAY_ON_DELIVERY_NOT_ALLOWED", "Your first order must be paid online", { reason: "FIRST_ORDER_PREPAID" });
    }
  }

  const prepaid = input.paymentMode === "PREPAID";
  const holdExpiresAt = prepaid ? new Date(now.getTime() + settings.holdMinutes * 60_000) : null;
  const status = prepaid ? "PENDING_PAYMENT" : "CONFIRMED";
  const trackingToken = randomToken(24);
  const code = handoverCode();

  const [order] = await tx
    .insert(schema.order)
    .values({
      publicCode: await uniquePublicCode(tx),
      customerId: customer.id,
      hubId: hub.id,
      deliveryOption: option.code,
      addressLine: line,
      landmark: address.landmark?.trim().slice(0, 120) || null,
      lat: address.lat,
      lng: address.lng,
      distanceM: distanceMeters({ lat: address.lat, lng: address.lng }, { lat: hub.lat, lng: hub.lng }),
      recipientName: input.customerName.trim().slice(0, 80),
      recipientPhone: customer.phone,
      deliveryNote: address.note?.trim().slice(0, 200) || null,
      promisedAt: new Date(option.etaAt),
      status,
      paymentMode: input.paymentMode,
      subtotalPaise: subtotal,
      feePaise: fee,
      totalPaise: total,
      handoverCode: code,
      trackingTokenHash: sha256Hex(trackingToken),
      holdExpiresAt,
      idempotencyKey: input.idempotencyKey,
      policyVersion: settings.policyVersion,
      customerNote: input.note?.trim().slice(0, 300) || null,
      createdAt: now,
    })
    .returning();

  // Lock stock rows in a stable order so concurrent multi-line orders cannot deadlock.
  const lines = [...priced.lines].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const l of lines) {
    const [row] = await tx
      .insert(schema.orderLine)
      .values({
        orderId: order.id,
        productId: l.productId,
        saleUnitId: l.saleUnitId,
        nameEn: l.nameEn,
        nameHi: l.nameHi,
        baseUnit: l.baseUnit,
        weightModel: l.weightModel,
        tolerancePct: l.tolerancePct,
        unitBaseQty: l.unitBaseQty,
        unitPricePaise: l.unitPricePaise,
        qtyOrderedBase: l.qtyBase,
        lineTotalPaise: l.lineTotalPaise,
        serviceDate,
      })
      .returning({ id: schema.orderLine.id });
    try {
      await reserveStock(tx, { productId: l.productId, serviceDate, qtyBase: l.qtyBase, orderLineId: row.id, expiresAt: holdExpiresAt });
    } catch (e) {
      if (e instanceof OutOfStockError) throw new CheckoutError("OUT_OF_STOCK", "An item just sold out", { productId: l.productId });
      throw e;
    }
  }

  await tx.update(schema.customer).set({ name: input.customerName.trim().slice(0, 80) }).where(eq(schema.customer.id, customer.id));
  await tx.insert(schema.orderEvent).values({ orderId: order.id, fromStatus: null, toStatus: status, actorType: "customer", actorId: customer.id, note: "order placed" });
  await tx.insert(schema.consent).values({
    customerId: customer.id,
    phone: customer.phone,
    channel: "WHATSAPP",
    purpose: "TRANSACTIONAL",
    granted: true,
    textVersion: CONSENT_TEXT_VERSION,
    source: "checkout",
    ip: input.ip ?? null,
  });
  await tx.insert(schema.outbox).values({ topic: "order.created", payload: { orderId: order.id, status } });
  await audit(tx, { actorType: "customer", actorId: customer.id, action: "order.create", entity: "order", entityId: order.id, after: { totalPaise: total, deliveryOption: option.code, lines: lines.length, paymentMode: input.paymentMode }, ip: input.ip });

  return {
    orderId: order.id,
    publicCode: order.publicCode,
    status,
    deliveryOption: option.code,
    subtotalPaise: subtotal,
    deliveryFeePaise: fee,
    totalPaise: total,
    promisedAt: order.promisedAt,
    handoverCode: code,
    trackingToken,
    replayed: false,
    holdExpiresAt,
  };
}

// ---------------------------------------------------------------------------------------------
// Cancellation and expiry
// ---------------------------------------------------------------------------------------------

/** Release everything an order holds: its stock reservations. Idempotent. */
export async function releaseOrderHolds(tx: DbOrTx, orderId: string, reason: string): Promise<void> {
  const lines = await tx.select({ id: schema.orderLine.id }).from(schema.orderLine).where(eq(schema.orderLine.orderId, orderId));
  for (const l of lines) {
    const rs = await tx.select({ id: schema.reservation.id }).from(schema.reservation).where(and(eq(schema.reservation.orderLineId, l.id), eq(schema.reservation.status, "RESERVED")));
    for (const r of rs) await releaseReservation(tx, r.id, reason);
  }
  await tx.update(schema.orderLine).set({ status: "CANCELLED" }).where(eq(schema.orderLine.orderId, orderId));
}

/** If the order was paid online, queue a refund for the captured amount (the gateway call is Milestone 4). */
export async function queueRefundIfPaid(tx: DbOrTx, orderId: string, reason: string): Promise<void> {
  const [paid] = await tx.select().from(schema.payment).where(and(eq(schema.payment.orderId, orderId), eq(schema.payment.status, "CAPTURED"))).limit(1);
  if (paid) {
    await tx.insert(schema.refund).values({ orderId, paymentId: paid.id, amountPaise: paid.amountPaise, reason, method: "GATEWAY", idempotencyKey: `cancel:${orderId}` });
  }
}

export type CancelResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_CANCELLABLE" };

/**
 * Customer cancellation: free until packing starts (the order is still CONFIRMED or awaiting payment).
 * There is no clock cut-off any more: with on-demand delivery, "has the hub started on it" is the rule.
 */
export async function cancelOrderByCustomer(db: Db, args: { orderId: string; customerId: string }): Promise<CancelResult> {
  return db.transaction(async (tx) => {
    const [o] = await tx
      .select()
      .from(schema.order)
      .where(and(eq(schema.order.id, args.orderId), eq(schema.order.customerId, args.customerId)))
      .for("update")
      .limit(1);
    if (!o) return { ok: false, reason: "NOT_FOUND" } as const;
    if (o.status !== "CONFIRMED" && o.status !== "PENDING_PAYMENT") return { ok: false, reason: "NOT_CANCELLABLE" } as const;

    await transitionOrder(tx, { orderId: o.id, to: "CANCELLED", actor: { type: "customer", customerId: args.customerId }, note: "cancelled by customer" });
    await releaseOrderHolds(tx, o.id, "cancelled by customer");
    await queueRefundIfPaid(tx, o.id, "Cancelled by customer before packing");
    await tx.insert(schema.outbox).values({ topic: "order.cancelled", payload: { orderId: o.id } });
    return { ok: true } as const;
  });
}

/** Job: unpaid prepaid orders whose hold ran out release their stock. Returns the count expired. */
export async function expirePendingOrders(db: Db, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: schema.order.id })
    .from(schema.order)
    .where(and(eq(schema.order.status, "PENDING_PAYMENT"), sql`${schema.order.holdExpiresAt} < ${now.toISOString()}`))
    .orderBy(asc(schema.order.holdExpiresAt))
    .limit(200);
  let n = 0;
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      // transitionOrder is compare-and-set: if a payment webhook confirmed it meanwhile, this throws and rolls back.
      try {
        await transitionOrder(tx, { orderId: id, to: "EXPIRED", actor: { type: "system" }, note: "payment hold expired" });
      } catch {
        return;
      }
      await releaseOrderHolds(tx, id, "payment hold expired");
      n++;
    });
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Customer-facing order view
// ---------------------------------------------------------------------------------------------

export interface OrderView {
  id: string;
  publicCode: string;
  status: string;
  paymentMode: "PREPAID" | "PAY_ON_DELIVERY";
  paymentStatus: "PAID" | "PAY_ON_DELIVERY" | "AWAITING_PAYMENT" | "UNPAID";
  deliveryOption: { code: string; name: string; nameHi: string | null };
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  /** Taken off the bill for items that were short or unavailable at packing. */
  adjustmentPaise: number;
  handoverCode: string;
  customerFirstName: string | null;
  createdAt: Date;
  holdExpiresAt: Date | null;
  promisedAt: Date;
  deliveredAt: Date | null;
  cancellable: boolean;
  address: { line: string; landmark: string | null; note: string | null };
  hub: { name: string };
  riderFirstName: string | null;
  lines: Array<{ nameEn: string; nameHi: string; baseUnit: string; unitBaseQty: number; unitPricePaise: number; qtyOrderedBase: number; lineTotalPaise: number; refundedPaise: number; status: string; weightModel: string; tolerancePct: number }>;
}

/** Look up an order by its secret tracking token. Returns only what that customer may see. */
export async function getOrderByTrackingToken(db: DbOrTx, token: string): Promise<OrderView | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  return loadOrderView(db, eq(schema.order.trackingTokenHash, sha256Hex(token)));
}

/** A signed-in customer's own order, by id. Another customer's order id returns null. */
export async function getOrderForCustomer(db: DbOrTx, customerId: string, orderId: string): Promise<OrderView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  return loadOrderView(db, and(eq(schema.order.id, orderId), eq(schema.order.customerId, customerId)));
}

async function loadOrderView(db: DbOrTx, condition: ReturnType<typeof eq> | ReturnType<typeof and>): Promise<OrderView | null> {
  const rows = await db
    .select({ o: schema.order, opt: schema.deliveryOption, hub: schema.hub, cust: schema.customer })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .innerJoin(schema.hub, eq(schema.hub.id, schema.order.hubId))
    .innerJoin(schema.customer, eq(schema.customer.id, schema.order.customerId))
    .where(condition)
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const lines = await db.select().from(schema.orderLine).where(eq(schema.orderLine.orderId, r.o.id)).orderBy(asc(schema.orderLine.createdAt), asc(schema.orderLine.nameEn));
  const [captured] = await db.select({ id: schema.payment.id }).from(schema.payment).where(and(eq(schema.payment.orderId, r.o.id), eq(schema.payment.status, "CAPTURED"))).limit(1);

  let riderFirstName: string | null = null;
  if (r.o.riderId && r.o.status === "OUT_FOR_DELIVERY") {
    const [rider] = await db.select({ name: schema.staffUser.name }).from(schema.staffUser).where(eq(schema.staffUser.id, r.o.riderId)).limit(1);
    riderFirstName = rider?.name.split(/\s+/)[0] ?? null;
  }

  const paymentStatus = captured ? "PAID" : r.o.status === "PENDING_PAYMENT" ? "AWAITING_PAYMENT" : r.o.paymentMode === "PAY_ON_DELIVERY" ? "PAY_ON_DELIVERY" : "UNPAID";
  return {
    id: r.o.id,
    publicCode: r.o.publicCode,
    status: r.o.status,
    paymentMode: r.o.paymentMode,
    paymentStatus,
    deliveryOption: { code: r.opt.code, name: r.opt.name, nameHi: r.opt.nameHi },
    subtotalPaise: r.o.subtotalPaise,
    deliveryFeePaise: r.o.feePaise,
    totalPaise: r.o.totalPaise,
    adjustmentPaise: lines.reduce((t, l) => t + l.refundedPaise, 0),
    handoverCode: r.o.handoverCode,
    customerFirstName: r.cust.name?.split(/\s+/)[0] ?? null,
    createdAt: r.o.createdAt,
    holdExpiresAt: r.o.holdExpiresAt,
    promisedAt: r.o.promisedAt,
    deliveredAt: r.o.deliveredAt,
    cancellable: r.o.status === "CONFIRMED" || r.o.status === "PENDING_PAYMENT",
    address: { line: r.o.addressLine, landmark: r.o.landmark, note: r.o.deliveryNote },
    hub: { name: r.hub.name },
    riderFirstName,
    lines: lines.map((l) => ({ nameEn: l.nameEn, nameHi: l.nameHi, baseUnit: l.baseUnit, unitBaseQty: l.unitBaseQty, unitPricePaise: l.unitPricePaise, qtyOrderedBase: l.qtyOrderedBase, lineTotalPaise: l.lineTotalPaise, refundedPaise: l.refundedPaise, status: l.status, weightModel: l.weightModel, tolerancePct: l.tolerancePct })),
  };
}

/** The customer's own orders (for "reorder" and "my orders"), newest first. */
export async function listCustomerOrders(db: DbOrTx, customerId: string, limit = 20) {
  return db
    .select({ id: schema.order.id, publicCode: schema.order.publicCode, status: schema.order.status, totalPaise: schema.order.totalPaise, createdAt: schema.order.createdAt })
    .from(schema.order)
    .where(eq(schema.order.customerId, customerId))
    .orderBy(sql`${schema.order.createdAt} desc`)
    .limit(limit);
}
