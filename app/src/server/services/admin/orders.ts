import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { assertCan } from "../../auth/permissions";
import { schema, type Db, type DbOrTx } from "../../db/client";
import { transitionOrder, type OrderStatus } from "../../domain/order-state";
import { amountDuePaise } from "../delivery-ops";
import { AdminError, type StaffActor } from "./common";

/** Statuses the dispatch board shows (PENDING_PAYMENT is not yet a commitment, so it is left off). */
export const BOARD_STATUSES: readonly OrderStatus[] = ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"];

export interface BoardOrder {
  id: string;
  publicCode: string;
  status: OrderStatus;
  optionCode: string;
  optionName: string;
  promisedAt: Date;
  createdAt: Date;
  recipientName: string;
  addressLine: string;
  itemCount: number;
  totalPaise: number;
  dueNowPaise: number;
  paymentMode: "PREPAID" | "PAY_ON_DELIVERY";
  riderId: string | null;
  riderName: string | null;
  customerNote: string | null;
}

const lineRefunds = sql<number>`coalesce((select sum(l.refunded_paise) from order_line l where l.order_id = ${schema.order.id}), 0)::int`;
const itemCount = sql<number>`(select count(*) from order_line l where l.order_id = ${schema.order.id} and l.status <> 'CANCELLED')::int`;

/** Every order the hub is currently responsible for, most urgent first. */
export async function listBoard(db: DbOrTx): Promise<BoardOrder[]> {
  const rows = await db
    .select({
      id: schema.order.id,
      publicCode: schema.order.publicCode,
      status: schema.order.status,
      optionCode: schema.order.deliveryOption,
      optionName: schema.deliveryOption.name,
      promisedAt: schema.order.promisedAt,
      createdAt: schema.order.createdAt,
      recipientName: schema.order.recipientName,
      addressLine: schema.order.addressLine,
      itemCount,
      totalPaise: schema.order.totalPaise,
      refunded: lineRefunds,
      paymentMode: schema.order.paymentMode,
      riderId: schema.order.riderId,
      riderName: schema.staffUser.name,
      customerNote: schema.order.customerNote,
    })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .leftJoin(schema.staffUser, eq(schema.staffUser.id, schema.order.riderId))
    .where(inArray(schema.order.status, [...BOARD_STATUSES]))
    .orderBy(asc(schema.order.promisedAt));
  return rows.map(({ refunded, ...r }) => ({ ...r, dueNowPaise: Math.max(0, r.totalPaise - refunded) }));
}

export interface RiderLoad {
  id: string;
  name: string;
  phone: string | null;
  active: number;
}

/** Active riders with how many orders each is carrying. */
export async function listRiders(db: DbOrTx): Promise<RiderLoad[]> {
  const riders = await db
    .select({ id: schema.staffUser.id, name: schema.staffUser.name, phone: schema.staffUser.phone })
    .from(schema.staffUser)
    .where(and(eq(schema.staffUser.active, true), sql`'RIDER' = any(${schema.staffUser.roles})`))
    .orderBy(asc(schema.staffUser.name));
  const counts = await db
    .select({ riderId: schema.order.riderId, n: sql<number>`count(*)::int` })
    .from(schema.order)
    .where(and(inArray(schema.order.status, ["PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"]), sql`${schema.order.riderId} is not null`))
    .groupBy(schema.order.riderId);
  const byRider = new Map(counts.map((c) => [c.riderId, c.n]));
  return riders.map((r) => ({ ...r, active: byRider.get(r.id) ?? 0 }));
}

export interface OrderSearch {
  q?: string;
  status?: OrderStatus;
  limit?: number;
}

/** Recent orders for the Orders page: search by order code, customer name or phone. */
export async function searchOrders(db: DbOrTx, s: OrderSearch = {}) {
  const conds = [];
  const q = s.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(schema.order.publicCode, like), ilike(schema.order.recipientName, like), ilike(schema.order.recipientPhone, like)));
  }
  if (s.status) conds.push(eq(schema.order.status, s.status));
  return db
    .select({
      id: schema.order.id,
      publicCode: schema.order.publicCode,
      status: schema.order.status,
      optionName: schema.deliveryOption.name,
      recipientName: schema.order.recipientName,
      totalPaise: schema.order.totalPaise,
      createdAt: schema.order.createdAt,
      promisedAt: schema.order.promisedAt,
      deliveredAt: schema.order.deliveredAt,
    })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.order.createdAt))
    .limit(Math.min(s.limit ?? 60, 200));
}

export interface OrderDetail {
  order: typeof schema.order.$inferSelect;
  optionName: string;
  hubName: string;
  riderName: string | null;
  customer: { id: string; name: string | null; phone: string; noShowCount: number };
  lines: Array<typeof schema.orderLine.$inferSelect>;
  events: Array<{ id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; actorType: string; actorName: string | null; note: string | null; createdAt: Date }>;
  receipts: Array<typeof schema.cashReceipt.$inferSelect>;
  refunds: Array<typeof schema.refund.$inferSelect>;
  delivery: typeof schema.deliveryRecord.$inferSelect | null;
  messages: Array<{ id: string; template: string; channel: string; status: string; error: string | null; attempts: number; body: string | null; createdAt: Date; sentAt: Date | null }>;
  amountDuePaise: number;
  refundedPaise: number;
}

export async function getOrderDetail(db: DbOrTx, orderId: string): Promise<OrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const [r] = await db
    .select({ o: schema.order, optName: schema.deliveryOption.name, hubName: schema.hub.name, c: schema.customer })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .innerJoin(schema.hub, eq(schema.hub.id, schema.order.hubId))
    .innerJoin(schema.customer, eq(schema.customer.id, schema.order.customerId))
    .where(eq(schema.order.id, orderId))
    .limit(1);
  if (!r) return null;
  const [lines, events, receipts, refunds, deliveries, riders, messages] = await Promise.all([
    db.select().from(schema.orderLine).where(eq(schema.orderLine.orderId, orderId)).orderBy(asc(schema.orderLine.createdAt), asc(schema.orderLine.nameEn)),
    db
      .select({ e: schema.orderEvent, staffName: schema.staffUser.name })
      .from(schema.orderEvent)
      .leftJoin(schema.staffUser, eq(schema.staffUser.id, schema.orderEvent.actorId))
      .where(eq(schema.orderEvent.orderId, orderId))
      .orderBy(asc(schema.orderEvent.createdAt)),
    db.select().from(schema.cashReceipt).where(eq(schema.cashReceipt.orderId, orderId)),
    db.select().from(schema.refund).where(eq(schema.refund.orderId, orderId)),
    db.select().from(schema.deliveryRecord).where(eq(schema.deliveryRecord.orderId, orderId)).limit(1),
    r.o.riderId ? db.select({ name: schema.staffUser.name }).from(schema.staffUser).where(eq(schema.staffUser.id, r.o.riderId)).limit(1) : Promise.resolve([]),
    db.select({ id: schema.notification.id, template: schema.notification.template, channel: schema.notification.channel, status: schema.notification.status, error: schema.notification.error, attempts: schema.notification.attempts, body: schema.notification.body, createdAt: schema.notification.createdAt, sentAt: schema.notification.sentAt }).from(schema.notification).where(eq(schema.notification.orderId, orderId)).orderBy(asc(schema.notification.createdAt)),
  ]);
  const refundedPaise = lines.reduce((s, l) => s + l.refundedPaise, 0);
  return {
    order: r.o,
    optionName: r.optName,
    hubName: r.hubName,
    riderName: riders[0]?.name ?? null,
    customer: { id: r.c.id, name: r.c.name, phone: r.c.phone, noShowCount: r.c.noShowCount },
    lines,
    events: events.map(({ e, staffName }) => ({ id: e.id, fromStatus: e.fromStatus, toStatus: e.toStatus, actorType: e.actorType, actorName: staffName, note: e.note, createdAt: e.createdAt })),
    receipts,
    refunds,
    delivery: deliveries[0] ?? null,
    messages,
    amountDuePaise: Math.max(0, r.o.totalPaise - refundedPaise),
    refundedPaise,
  };
}

/** Save a private note on the order (visible to staff only). */
export async function setStaffNote(db: Db, args: { orderId: string; note: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "customer.read");
  const note = args.note.trim().slice(0, 500) || null;
  const res = await db.update(schema.order).set({ staffNote: note }).where(eq(schema.order.id, args.orderId)).returning({ id: schema.order.id });
  if (res.length === 0) throw new AdminError("NOT_FOUND", "Order not found");
}

/** Start packing: CONFIRMED -> PACKING. */
export async function startPacking(db: Db, args: { orderId: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "order.pack");
  await db.transaction(async (tx) => {
    await transitionOrder(tx, { orderId: args.orderId, to: "PACKING", actor: { type: "staff", userId: args.actor.userId, roles: args.actor.roles } });
  });
}

/** Re-exported so screens can show what is due without importing delivery internals. */
export { amountDuePaise };
