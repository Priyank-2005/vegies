import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { audit } from "../../audit";
import { assertCan } from "../../auth/permissions";
import { schema, type Db, type DbOrTx } from "../../db/client";
import { istDate, istInstant } from "../delivery";
import { AdminError, type StaffActor } from "./common";

// ---------------------------------------------------------------------------------------------
// Cash: money riders collect at the door and must hand over
// ---------------------------------------------------------------------------------------------

export interface CashHeld {
  riderId: string;
  riderName: string;
  receipts: number;
  amountPaise: number;
  oldest: Date;
}

/** Cash each rider has collected and not yet handed in. (UPI goes straight to the business account, so it is not "held".) */
export async function cashHeldByRider(db: DbOrTx): Promise<CashHeld[]> {
  return db
    .select({
      riderId: schema.cashReceipt.collectedBy,
      riderName: schema.staffUser.name,
      receipts: sql<number>`count(*)::int`,
      amountPaise: sql<number>`sum(${schema.cashReceipt.amountPaise})::int`,
      oldest: sql<Date>`min(${schema.cashReceipt.createdAt})`,
    })
    .from(schema.cashReceipt)
    .innerJoin(schema.staffUser, eq(schema.staffUser.id, schema.cashReceipt.collectedBy))
    .where(and(eq(schema.cashReceipt.method, "CASH"), isNull(schema.cashReceipt.depositedAt)))
    .groupBy(schema.cashReceipt.collectedBy, schema.staffUser.name)
    .orderBy(asc(schema.staffUser.name));
}

/** The rider hands in their cash: every open cash receipt of theirs is marked deposited. Returns the amount. */
export async function markCashDeposited(db: Db, args: { riderId: string; actor: StaffActor }): Promise<{ amountPaise: number; receipts: number }> {
  assertCan(args.actor.roles, "delivery.manage");
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.cashReceipt)
      .set({ depositedAt: new Date() })
      .where(and(eq(schema.cashReceipt.collectedBy, args.riderId), eq(schema.cashReceipt.method, "CASH"), isNull(schema.cashReceipt.depositedAt)))
      .returning({ amountPaise: schema.cashReceipt.amountPaise });
    if (rows.length === 0) throw new AdminError("NOT_FOUND", "This rider has no cash to hand in");
    const amountPaise = rows.reduce((s, r) => s + r.amountPaise, 0);
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "cash.deposit", entity: "staff_user", entityId: args.riderId, after: { amountPaise, receipts: rows.length } });
    return { amountPaise, receipts: rows.length };
  });
}

// ---------------------------------------------------------------------------------------------
// Today: the owner's morning-to-night overview
// ---------------------------------------------------------------------------------------------

export interface TodaySummary {
  byStatus: Record<string, number>;
  late: number;
  dueSoon: number;
  needAttention: number;
  waitingForRider: number;
  deliveredToday: number;
  goodsTodayPaise: number;
  cashHeldPaise: number;
  nextDue: Array<{ id: string; publicCode: string; status: string; optionName: string; promisedAt: Date }>;
}

export async function todaySummary(db: DbOrTx, now = new Date()): Promise<TodaySummary> {
  const active = await db
    .select({ id: schema.order.id, publicCode: schema.order.publicCode, status: schema.order.status, promisedAt: schema.order.promisedAt, riderId: schema.order.riderId, optionName: schema.deliveryOption.name })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(inArray(schema.order.status, ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"]))
    .orderBy(asc(schema.order.promisedAt));
  const byStatus: Record<string, number> = {};
  for (const o of active) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

  const dayStart = istInstant(istDate(now), 0);
  const [done] = await db
    .select({
      n: sql<number>`count(*)::int`,
      goods: sql<number>`coalesce(sum(${schema.order.subtotalPaise} - coalesce((select sum(l.refunded_paise) from order_line l where l.order_id = ${schema.order.id}), 0)), 0)::int`,
    })
    .from(schema.order)
    .where(and(eq(schema.order.status, "DELIVERED"), gte(schema.order.deliveredAt, dayStart)));
  const held = await cashHeldByRider(db);

  const soon = now.getTime() + 10 * 60_000;
  return {
    byStatus,
    late: active.filter((o) => o.promisedAt.getTime() < now.getTime()).length,
    dueSoon: active.filter((o) => o.promisedAt.getTime() >= now.getTime() && o.promisedAt.getTime() < soon).length,
    needAttention: (byStatus.ATTENTION ?? 0) + (byStatus.DELIVERY_FAILED ?? 0),
    waitingForRider: active.filter((o) => o.status === "PACKED" && !o.riderId).length,
    deliveredToday: done?.n ?? 0,
    goodsTodayPaise: done?.goods ?? 0,
    cashHeldPaise: held.reduce((s, h) => s + h.amountPaise, 0),
    nextDue: active.slice(0, 6).map((o) => ({ id: o.id, publicCode: o.publicCode, status: o.status, optionName: o.optionName, promisedAt: o.promisedAt })),
  };
}

// ---------------------------------------------------------------------------------------------
// Rider screen
// ---------------------------------------------------------------------------------------------

export interface RiderOrder {
  id: string;
  publicCode: string;
  status: string;
  optionName: string;
  promisedAt: Date;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  landmark: string | null;
  deliveryNote: string | null;
  customerNote: string | null;
  lat: number;
  lng: number;
  paymentMode: "PREPAID" | "PAY_ON_DELIVERY";
  amountDuePaise: number;
  items: Array<{ name: string; nameHi: string; qtyBase: number; baseUnit: string; status: string }>;
}

export interface RiderView {
  mine: RiderOrder[];
  /** Packed orders nobody has taken yet: only non-personal details are shown until the rider takes one. */
  open: Array<{ id: string; publicCode: string; optionName: string; promisedAt: Date; distanceM: number; itemCount: number }>;
  deliveredToday: number;
  cashHeldPaise: number;
}

export async function riderView(db: DbOrTx, riderId: string, now = new Date()): Promise<RiderView> {
  const mine = await db
    .select({ o: schema.order, optionName: schema.deliveryOption.name })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(and(eq(schema.order.riderId, riderId), inArray(schema.order.status, ["PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"])))
    .orderBy(asc(schema.order.promisedAt));
  const ids = mine.map((m) => m.o.id);
  const lines = ids.length ? await db.select().from(schema.orderLine).where(and(inArray(schema.orderLine.orderId, ids), sql`${schema.orderLine.status} <> 'CANCELLED'`)).orderBy(asc(schema.orderLine.nameEn)) : [];
  const orders: RiderOrder[] = mine.map(({ o, optionName }) => {
    const ls = lines.filter((l) => l.orderId === o.id);
    const refunded = ls.reduce((s, l) => s + l.refundedPaise, 0);
    return {
      id: o.id,
      publicCode: o.publicCode,
      status: o.status,
      optionName,
      promisedAt: o.promisedAt,
      recipientName: o.recipientName,
      recipientPhone: o.recipientPhone,
      addressLine: o.addressLine,
      landmark: o.landmark,
      deliveryNote: o.deliveryNote,
      customerNote: o.customerNote,
      lat: o.lat,
      lng: o.lng,
      paymentMode: o.paymentMode,
      amountDuePaise: o.paymentMode === "PAY_ON_DELIVERY" ? Math.max(0, o.totalPaise - refunded) : 0,
      items: ls.map((l) => ({ name: l.nameEn, nameHi: l.nameHi, qtyBase: l.qtyPackedBase ?? l.qtyOrderedBase, baseUnit: l.baseUnit, status: l.status })),
    };
  });
  const open = await db
    .select({
      id: schema.order.id,
      publicCode: schema.order.publicCode,
      optionName: schema.deliveryOption.name,
      promisedAt: schema.order.promisedAt,
      distanceM: schema.order.distanceM,
      itemCount: sql<number>`(select count(*) from order_line l where l.order_id = ${schema.order.id} and l.status <> 'CANCELLED')::int`,
    })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(and(eq(schema.order.status, "PACKED"), isNull(schema.order.riderId)))
    .orderBy(asc(schema.order.promisedAt));
  const dayStart = istInstant(istDate(now), 0);
  const [done] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.deliveryRecord)
    .where(and(eq(schema.deliveryRecord.riderId, riderId), inArray(schema.deliveryRecord.result, ["DELIVERED", "PARTIAL"]), gte(schema.deliveryRecord.createdAt, dayStart)));
  const [cash] = await db
    .select({ amount: sql<number>`coalesce(sum(${schema.cashReceipt.amountPaise}), 0)::int` })
    .from(schema.cashReceipt)
    .where(and(eq(schema.cashReceipt.collectedBy, riderId), eq(schema.cashReceipt.method, "CASH"), isNull(schema.cashReceipt.depositedAt)));
  return { mine: orders, open, deliveredToday: done?.n ?? 0, cashHeldPaise: cash?.amount ?? 0 };
}
