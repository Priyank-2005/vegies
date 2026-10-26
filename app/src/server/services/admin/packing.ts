import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { evaluatePackedWeight, FREE_OVERPACK_PCT, type BaseUnit, type WeightModel } from "@/lib/units";
import { audit } from "../../audit";
import { assertCan } from "../../auth/permissions";
import { schema, type Db, type DbOrTx } from "../../db/client";
import { consumeReservation } from "../../domain/inventory";
import { transitionOrder, type OrderStatus } from "../../domain/order-state";
import { AdminError, type StaffActor } from "./common";

const asActor = (a: StaffActor) => ({ type: "staff" as const, userId: a.userId, roles: a.roles });

export interface PackingLine {
  id: string;
  nameEn: string;
  nameHi: string;
  baseUnit: BaseUnit;
  weightModel: WeightModel;
  tolerancePct: number;
  qtyOrderedBase: number;
  qtyPackedBase: number | null;
  lineTotalPaise: number;
  refundedPaise: number;
  status: string;
  /** Heaviest weight that is still a free give-away (loose weight only). */
  maxFreeBase: number;
  /** Lightest weight that needs no price adjustment. */
  minOkBase: number;
}

export interface PackingOrder {
  id: string;
  publicCode: string;
  status: OrderStatus;
  optionName: string;
  promisedAt: Date;
  customerNote: string | null;
  staffNote: string | null;
  lines: PackingLine[];
}

function toLine(l: typeof schema.orderLine.$inferSelect): PackingLine {
  const model = l.weightModel as WeightModel;
  const minOk = model === "LOOSE_WEIGHT" ? l.qtyOrderedBase : Math.ceil((l.qtyOrderedBase * (100 - l.tolerancePct)) / 100);
  const maxFree = model === "LOOSE_WEIGHT" ? l.qtyOrderedBase + Math.floor((l.qtyOrderedBase * FREE_OVERPACK_PCT) / 100) : l.qtyOrderedBase + Math.ceil((l.qtyOrderedBase * l.tolerancePct) / 100);
  return {
    id: l.id,
    nameEn: l.nameEn,
    nameHi: l.nameHi,
    baseUnit: l.baseUnit as BaseUnit,
    weightModel: model,
    tolerancePct: l.tolerancePct,
    qtyOrderedBase: l.qtyOrderedBase,
    qtyPackedBase: l.qtyPackedBase,
    lineTotalPaise: l.lineTotalPaise,
    refundedPaise: l.refundedPaise,
    status: l.status,
    maxFreeBase: maxFree,
    minOkBase: minOk,
  };
}

const PACKING_STATUSES: OrderStatus[] = ["CONFIRMED", "PACKING", "ATTENTION"];

/** The packing queue: orders that still need to be put together, most urgent first. */
export async function packingQueue(db: DbOrTx): Promise<Array<{ id: string; publicCode: string; status: OrderStatus; optionName: string; promisedAt: Date; itemCount: number; customerNote: string | null }>> {
  return db
    .select({
      id: schema.order.id,
      publicCode: schema.order.publicCode,
      status: schema.order.status,
      optionName: schema.deliveryOption.name,
      promisedAt: schema.order.promisedAt,
      itemCount: sql<number>`(select count(*) from order_line l where l.order_id = ${schema.order.id} and l.status <> 'CANCELLED')::int`,
      customerNote: schema.order.customerNote,
    })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(inArray(schema.order.status, PACKING_STATUSES))
    .orderBy(asc(schema.order.promisedAt));
}

export async function getPackingOrder(db: DbOrTx, orderId: string): Promise<PackingOrder | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const [o] = await db
    .select({ o: schema.order, optionName: schema.deliveryOption.name })
    .from(schema.order)
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(eq(schema.order.id, orderId))
    .limit(1);
  if (!o) return null;
  const lines = await db.select().from(schema.orderLine).where(and(eq(schema.orderLine.orderId, orderId), sql`${schema.orderLine.status} <> 'CANCELLED'`)).orderBy(asc(schema.orderLine.nameEn));
  return { id: o.o.id, publicCode: o.o.publicCode, status: o.o.status, optionName: o.optionName, promisedAt: o.o.promisedAt, customerNote: o.o.customerNote, staffNote: o.o.staffNote, lines: lines.map(toLine) };
}

export type PackedOutcome = { kind: "OK"; giveawayBase: number } | { kind: "SHORT"; shortBase: number; refundPaise: number };

/**
 * Record what actually went into the bag for one line. Weight rules (BR-03): at least what was ordered, up to 5% extra
 * is free, more than that must be repacked; below the band the customer is refunded pro-rata. Can be re-recorded
 * while the order is still being packed.
 */
export async function recordPackedLine(db: Db, args: { orderId: string; lineId: string; packedBase: number; actor: StaffActor }): Promise<PackedOutcome> {
  assertCan(args.actor.roles, "order.pack");
  if (!Number.isSafeInteger(args.packedBase) || args.packedBase < 0) throw new AdminError("INVALID", "Enter the packed weight or count as a whole number");
  return db.transaction(async (tx) => {
    const [o] = await tx.select({ status: schema.order.status }).from(schema.order).where(eq(schema.order.id, args.orderId)).for("update").limit(1);
    if (!o) throw new AdminError("NOT_FOUND", "Order not found");
    if (o.status !== "PACKING") throw new AdminError("WRONG_STATE", o.status === "CONFIRMED" ? "Start packing this order first" : `This order is ${o.status.toLowerCase().replace(/_/g, " ")}, not being packed`);
    const [l] = await tx.select().from(schema.orderLine).where(and(eq(schema.orderLine.id, args.lineId), eq(schema.orderLine.orderId, args.orderId))).limit(1);
    if (!l || l.status === "CANCELLED") throw new AdminError("NOT_FOUND", "Line not found");

    const out = evaluatePackedWeight({ model: l.weightModel as WeightModel, orderedBase: l.qtyOrderedBase, packedBase: args.packedBase, lineTotalPaise: l.lineTotalPaise, tolerancePct: l.tolerancePct });
    if (out.kind === "OVERPACKED") {
      const max = toLine(l).maxFreeBase;
      throw new AdminError("OVERPACKED", `That is more than the free allowance. Repack at ${max} or less (ordered ${l.qtyOrderedBase}).`);
    }
    if (out.kind === "SHORT") {
      await tx
        .update(schema.orderLine)
        .set({ qtyPackedBase: args.packedBase, refundedPaise: out.refundPaise, status: args.packedBase === 0 ? "REFUNDED" : "SHORT" })
        .where(eq(schema.orderLine.id, l.id));
      await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "packing.short", entity: "order_line", entityId: l.id, before: { packed: l.qtyPackedBase }, after: { packed: args.packedBase, refundPaise: out.refundPaise } });
      return { kind: "SHORT", shortBase: out.shortBase, refundPaise: out.refundPaise };
    }
    await tx.update(schema.orderLine).set({ qtyPackedBase: args.packedBase, refundedPaise: 0, status: "ACTIVE" }).where(eq(schema.orderLine.id, l.id));
    return { kind: "OK", giveawayBase: out.giveawayBase };
  });
}

/** Put the order on hold with a reason (item missing, doubt about quality). A manager decides what happens next. */
export async function flagAttention(db: Db, args: { orderId: string; note: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "order.pack");
  if (!args.note.trim()) throw new AdminError("INVALID", "Say what the problem is");
  await db.transaction(async (tx) => {
    await transitionOrder(tx, { orderId: args.orderId, to: "ATTENTION", actor: asActor(args.actor), note: args.note.trim() });
  });
}

/** The problem is sorted out: back to packing. */
export async function resolveAttention(db: Db, args: { orderId: string; note?: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "order.pack");
  await db.transaction(async (tx) => {
    await transitionOrder(tx, { orderId: args.orderId, to: "PACKING", actor: asActor(args.actor), note: args.note?.trim() || undefined });
  });
}

/**
 * Packing is done: every line has its packed quantity. The order becomes PACKED, reservations are consumed (the stock is
 * out of the shelf), and short-weight refunds on prepaid orders are queued. Pay-on-delivery orders simply collect less.
 */
export async function finishPacking(db: Db, args: { orderId: string; actor: StaffActor }): Promise<{ refundedPaise: number }> {
  assertCan(args.actor.roles, "order.pack");
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.order).where(eq(schema.order.id, args.orderId)).for("update").limit(1);
    if (!o) throw new AdminError("NOT_FOUND", "Order not found");
    if (o.status !== "PACKING") throw new AdminError("WRONG_STATE", "Only an order that is being packed can be finished");
    const lines = await tx.select().from(schema.orderLine).where(and(eq(schema.orderLine.orderId, o.id), sql`${schema.orderLine.status} <> 'CANCELLED'`));
    const missing = lines.filter((l) => l.qtyPackedBase === null);
    if (missing.length > 0) throw new AdminError("INCOMPLETE", `Record the packed quantity for ${missing.map((m) => m.nameEn).join(", ")}`);
    if (lines.every((l) => l.status === "REFUNDED")) throw new AdminError("INCOMPLETE", "Every item is unavailable. Cancel this order instead.");

    for (const l of lines) {
      const rs = await tx.select({ id: schema.reservation.id }).from(schema.reservation).where(and(eq(schema.reservation.orderLineId, l.id), eq(schema.reservation.status, "RESERVED")));
      for (const r of rs) await consumeReservation(tx, r.id, l.qtyPackedBase ?? 0, args.actor.userId);
    }
    const refunded = lines.reduce((s, l) => s + l.refundedPaise, 0);
    if (refunded > 0 && o.paymentMode === "PREPAID") {
      const [paid] = await tx.select().from(schema.payment).where(and(eq(schema.payment.orderId, o.id), eq(schema.payment.status, "CAPTURED"))).limit(1);
      if (paid) await tx.insert(schema.refund).values({ orderId: o.id, paymentId: paid.id, amountPaise: refunded, reason: "Short weight or unavailable items", method: "GATEWAY", requestedBy: args.actor.userId, idempotencyKey: `short:${o.id}` }).onConflictDoNothing();
    }
    await transitionOrder(tx, { orderId: o.id, to: "PACKED", actor: asActor(args.actor), note: refunded > 0 ? `adjusted by ${refunded} paise for short or missing items` : undefined });
    await tx.insert(schema.outbox).values({ topic: "order.packed", payload: { orderId: o.id } });
    return { refundedPaise: refunded };
  });
}
