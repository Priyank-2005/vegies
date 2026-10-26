import { eq, sql } from "drizzle-orm";
import { safeEqual } from "@/lib/ids";
import { audit } from "../audit";
import { assertCan, can, type Role } from "../auth/permissions";
import { schema, type Db, type Tx } from "../db/client";
import { transitionOrder, type Actor } from "../domain/order-state";
import { rateLimit, rateLimitPeek } from "../security/rate-limit";
import { queueRefundIfPaid, releaseOrderHolds } from "./orders";

/** A signed-in staff member acting on an order. */
export interface StaffActor {
  userId: string;
  roles: Role[];
}
const asActor = (s: StaffActor): Actor => ({ type: "staff", userId: s.userId, roles: s.roles });

export class DeliveryOpError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NO_RIDER" | "NOT_YOUR_ORDER" | "WRONG_STATE" | "BAD_RIDER" | "WRONG_CODE" | "TOO_MANY_ATTEMPTS" | "PAYMENT_REQUIRED" | "NOTE_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "DeliveryOpError";
  }
}

/** What the customer still owes at the door: the order total less anything refunded for short or missing items. */
export async function amountDuePaise(tx: Tx | Db, order: { id: string; totalPaise: number }): Promise<number> {
  const [r] = await tx
    .select({ refunded: sql<number>`coalesce(sum(${schema.orderLine.refundedPaise}), 0)::int` })
    .from(schema.orderLine)
    .where(eq(schema.orderLine.orderId, order.id));
  return Math.max(0, order.totalPaise - (r?.refunded ?? 0));
}

async function lockOrder(tx: Tx, orderId: string) {
  const [o] = await tx.select().from(schema.order).where(eq(schema.order.id, orderId)).for("update").limit(1);
  if (!o) throw new DeliveryOpError("NOT_FOUND", "Order not found");
  return o;
}

/** Riders may only act on orders assigned to them; managers (delivery.manage) may act on any. */
function assertMayHandle(actor: StaffActor, o: { riderId: string | null }) {
  if (can(actor.roles, "delivery.manage")) return;
  if (o.riderId !== actor.userId) throw new DeliveryOpError("NOT_YOUR_ORDER", "This order is assigned to another rider");
}

/** Assign (or re-assign) a rider. Needs delivery.manage. */
export async function assignRider(db: Db, args: { orderId: string; riderId: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "delivery.manage");
  await db.transaction(async (tx) => {
    const o = await lockOrder(tx, args.orderId);
    if (!["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"].includes(o.status)) throw new DeliveryOpError("WRONG_STATE", `Cannot assign a rider to a ${o.status} order`);
    const [rider] = await tx.select().from(schema.staffUser).where(eq(schema.staffUser.id, args.riderId)).limit(1);
    if (!rider || !rider.active || !rider.roles.includes("RIDER")) throw new DeliveryOpError("BAD_RIDER", "That person is not an active rider");
    await tx.update(schema.order).set({ riderId: rider.id }).where(eq(schema.order.id, o.id));
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "delivery.assign_rider", entity: "order", entityId: o.id, before: { riderId: o.riderId }, after: { riderId: rider.id } });
  });
}

/** Hand a packed order to its rider: PACKED (or DELIVERY_FAILED retry) -> OUT_FOR_DELIVERY. A rider dispatching an unassigned order takes it. */
export async function dispatchOrder(db: Db, args: { orderId: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "order.deliver");
  await db.transaction(async (tx) => {
    const o = await lockOrder(tx, args.orderId);
    if (!o.riderId) {
      if (!args.actor.roles.includes("RIDER")) throw new DeliveryOpError("NO_RIDER", "Assign a rider first");
      await tx.update(schema.order).set({ riderId: args.actor.userId }).where(eq(schema.order.id, o.id));
    } else {
      assertMayHandle(args.actor, o);
    }
    await transitionOrder(tx, { orderId: o.id, to: "OUT_FOR_DELIVERY", actor: asActor(args.actor) });
    await tx.insert(schema.outbox).values({ topic: "order.out_for_delivery", payload: { orderId: o.id } });
  });
}

export interface CompleteDeliveryInput {
  orderId: string;
  actor: StaffActor;
  /** The 4-digit code the customer reads out. */
  code?: string;
  /** Manager/rider override when the customer cannot give the code (needs a note). */
  manualOverride?: boolean;
  note?: string;
  /** Cash or UPI collected at the door (required for pay-on-delivery orders). */
  payment?: { method: "CASH" | "UPI"; amountPaise: number; reference?: string };
  /** A partial delivery (customer refused some items); requires a note. */
  partial?: boolean;
}

/**
 * Finish a delivery: verify the customer's code, take payment for pay-on-delivery orders, record proof of delivery.
 * Wrong codes are limited (5 per order per hour); after that a manager must use the manual override with a note.
 */
export async function completeDelivery(db: Db, input: CompleteDeliveryInput): Promise<void> {
  assertCan(input.actor.roles, "order.deliver");
  try {
    await completeDeliveryTx(db, input);
  } catch (e) {
    // A wrong code must be counted even though its transaction rolls back, so count it outside the transaction.
    if (e instanceof DeliveryOpError && e.code === "WRONG_CODE") await rateLimit(db, `handover:${input.orderId}`, 5, 3600);
    throw e;
  }
}

async function completeDeliveryTx(db: Db, input: CompleteDeliveryInput): Promise<void> {
  await db.transaction(async (tx) => {
    const o = await lockOrder(tx, input.orderId);
    assertMayHandle(input.actor, o);
    if (o.status !== "OUT_FOR_DELIVERY") throw new DeliveryOpError("WRONG_STATE", `Order is ${o.status}, not out for delivery`);

    let verifiedBy: "CODE" | "MANUAL";
    if (input.manualOverride) {
      if (!input.note?.trim()) throw new DeliveryOpError("NOTE_REQUIRED", "A note is required when delivering without the customer's code");
      verifiedBy = "MANUAL";
    } else {
      if ((await rateLimitPeek(tx, `handover:${o.id}`, 3600)) >= 5) throw new DeliveryOpError("TOO_MANY_ATTEMPTS", "Too many wrong codes. Ask a manager to complete this delivery.");
      if (!input.code || !/^\d{4}$/.test(input.code) || !safeEqual(input.code, o.handoverCode)) throw new DeliveryOpError("WRONG_CODE", "That code is not correct");
      verifiedBy = "CODE";
    }
    if (input.partial && !input.note?.trim()) throw new DeliveryOpError("NOTE_REQUIRED", "Say which items were not accepted");

    // Pay-on-delivery: the rider must record the money. Full delivery = the full total.
    let receiptId: string | null = null;
    // One proof-of-delivery row per order: a retry after a failed attempt updates the earlier FAILED row.
    const record = await tx
      .insert(schema.deliveryRecord)
      .values({ orderId: o.id, result: input.partial ? "PARTIAL" : "DELIVERED", verifiedBy, note: input.note?.trim() || null, riderId: input.actor.userId })
      .onConflictDoUpdate({ target: schema.deliveryRecord.orderId, set: { result: input.partial ? "PARTIAL" : "DELIVERED", verifiedBy, note: input.note?.trim() || null, riderId: input.actor.userId } })
      .returning({ id: schema.deliveryRecord.id });
    if (o.paymentMode === "PAY_ON_DELIVERY") {
      const pay = input.payment;
      if (!pay || pay.amountPaise <= 0) throw new DeliveryOpError("PAYMENT_REQUIRED", "Record the cash or UPI payment");
      const due = await amountDuePaise(tx, o);
      if (!input.partial && pay.amountPaise !== due) throw new DeliveryOpError("PAYMENT_REQUIRED", `The amount to collect is ₹${(due / 100).toFixed(2)}`);
      if (pay.amountPaise > due) throw new DeliveryOpError("PAYMENT_REQUIRED", "The amount collected is more than the amount due");
      const [rc] = await tx
        .insert(schema.cashReceipt)
        .values({ orderId: o.id, deliveryRecordId: record[0].id, method: pay.method, amountPaise: pay.amountPaise, reference: pay.reference ?? null, collectedBy: input.actor.userId })
        .returning({ id: schema.cashReceipt.id });
      receiptId = rc.id;
    }
    await transitionOrder(tx, { orderId: o.id, to: "DELIVERED", actor: asActor(input.actor), note: input.partial ? `partial: ${input.note}` : undefined });
    await tx.insert(schema.outbox).values({ topic: "order.delivered", payload: { orderId: o.id, receiptId } });
    await audit(tx, { actorType: "staff", actorId: input.actor.userId, action: "delivery.complete", entity: "order", entityId: o.id, after: { verifiedBy, partial: !!input.partial } });
  });
}

/** The rider could not deliver (nobody home, wrong address, refused). The order stays reserved until ops retries or cancels. */
export async function failDelivery(db: Db, args: { orderId: string; actor: StaffActor; reason: string; customerAtFault?: boolean }): Promise<void> {
  assertCan(args.actor.roles, "order.deliver");
  if (!args.reason.trim()) throw new DeliveryOpError("NOTE_REQUIRED", "Say why the delivery failed");
  await db.transaction(async (tx) => {
    const o = await lockOrder(tx, args.orderId);
    assertMayHandle(args.actor, o);
    if (o.status !== "OUT_FOR_DELIVERY") throw new DeliveryOpError("WRONG_STATE", `Order is ${o.status}, not out for delivery`);
    await tx.insert(schema.deliveryRecord).values({ orderId: o.id, result: "FAILED", verifiedBy: "MANUAL", note: args.reason.trim(), riderId: args.actor.userId }).onConflictDoUpdate({ target: schema.deliveryRecord.orderId, set: { result: "FAILED", note: args.reason.trim() } });
    await transitionOrder(tx, { orderId: o.id, to: "DELIVERY_FAILED", actor: asActor(args.actor), note: args.reason.trim() });
    if (args.customerAtFault) await tx.update(schema.customer).set({ noShowCount: sqlInc() }).where(eq(schema.customer.id, o.customerId));
    await tx.insert(schema.outbox).values({ topic: "order.delivery_failed", payload: { orderId: o.id } });
  });
}

const sqlInc = () => sql`${schema.customer.noShowCount} + 1`;

/** Staff cancel (support or ops): any order that has not been delivered. Releases stock and queues a refund if paid. */
export async function cancelOrderByStaff(db: Db, args: { orderId: string; actor: StaffActor; reason: string }): Promise<void> {
  assertCan(args.actor.roles, "order.cancel");
  if (!args.reason.trim()) throw new DeliveryOpError("NOTE_REQUIRED", "A reason is required");
  await db.transaction(async (tx) => {
    const o = await lockOrder(tx, args.orderId);
    await transitionOrder(tx, { orderId: o.id, to: "CANCELLED", actor: asActor(args.actor), note: args.reason.trim() });
    await releaseOrderHolds(tx, o.id, `cancelled by staff: ${args.reason.trim()}`);
    await queueRefundIfPaid(tx, o.id, args.reason.trim());
    await tx.insert(schema.outbox).values({ topic: "order.cancelled", payload: { orderId: o.id } });
  });
}
