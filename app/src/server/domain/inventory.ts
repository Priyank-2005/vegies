import { and, eq, sql } from "drizzle-orm";
import { schema, type DbOrTx } from "../db/client";

export class OutOfStockError extends Error {
  constructor(public readonly productId: string, public readonly requested: number) {
    super(`Not enough stock for product ${productId} (requested ${requested})`);
    this.name = "OutOfStockError";
  }
}

export class ReservationStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationStateError";
  }
}

/**
 * Atomically reserve stock for one order line. Must run inside the order transaction.
 * The guard lives in the UPDATE's WHERE clause, so concurrent checkouts cannot oversell:
 * Postgres re-evaluates the predicate after waiting for a conflicting row lock.
 */
export async function reserveStock(
  tx: DbOrTx,
  args: { productId: string; serviceDate: string; qtyBase: number; orderLineId: string; expiresAt?: Date | null; actorId?: string | null },
): Promise<string> {
  const { productId, serviceDate, qtyBase, orderLineId } = args;
  if (!Number.isSafeInteger(qtyBase) || qtyBase <= 0) throw new RangeError("qtyBase must be a positive integer");

  const updated = await tx
    .update(schema.stockDay)
    .set({ reservedQty: sql`${schema.stockDay.reservedQty} + ${qtyBase}` })
    .where(
      and(
        eq(schema.stockDay.productId, productId),
        eq(schema.stockDay.serviceDate, serviceDate),
        sql`${schema.stockDay.publishedQty} - ${schema.stockDay.reservedQty} >= ${qtyBase}`,
      ),
    )
    .returning({ productId: schema.stockDay.productId });
  if (updated.length === 0) throw new OutOfStockError(productId, qtyBase);

  const [r] = await tx
    .insert(schema.reservation)
    .values({ orderLineId, productId, serviceDate, qtyBase, expiresAt: args.expiresAt ?? null })
    .returning({ id: schema.reservation.id });
  await tx.insert(schema.stockMovement).values({
    productId,
    serviceDate,
    type: "RESERVED",
    qtyBase,
    refType: "order_line",
    refId: orderLineId,
    actorId: args.actorId ?? null,
  });
  return r.id;
}

/** Release an open reservation (cancellation, expiry, shortage refund). Idempotent: a second call is a no-op. */
export async function releaseReservation(tx: DbOrTx, reservationId: string, reason: string, actorId?: string | null): Promise<boolean> {
  const [r] = await tx
    .update(schema.reservation)
    .set({ status: "RELEASED" })
    .where(and(eq(schema.reservation.id, reservationId), eq(schema.reservation.status, "RESERVED")))
    .returning();
  if (!r) return false; // already released or consumed

  await tx
    .update(schema.stockDay)
    .set({ reservedQty: sql`${schema.stockDay.reservedQty} - ${r.qtyBase}` })
    .where(and(eq(schema.stockDay.productId, r.productId), eq(schema.stockDay.serviceDate, r.serviceDate)));
  await tx.insert(schema.stockMovement).values({
    productId: r.productId,
    serviceDate: r.serviceDate,
    type: "RELEASED",
    qtyBase: -r.qtyBase,
    refType: "order_line",
    refId: r.orderLineId,
    reason,
    actorId: actorId ?? null,
  });
  return true;
}

/** Procurement publishes how much can be sold for a date. Cannot go below what is already reserved. */
export async function setPublishedQty(
  tx: DbOrTx,
  args: { productId: string; serviceDate: string; publishedQty: number; actorId: string },
): Promise<void> {
  const { productId, serviceDate, publishedQty, actorId } = args;
  if (!Number.isSafeInteger(publishedQty) || publishedQty < 0) throw new RangeError("publishedQty must be a non-negative integer");

  await tx
    .insert(schema.stockDay)
    .values({ productId, serviceDate, publishedQty: 0 })
    .onConflictDoNothing();
  const before = await tx
    .select({ published: schema.stockDay.publishedQty, reserved: schema.stockDay.reservedQty })
    .from(schema.stockDay)
    .where(and(eq(schema.stockDay.productId, productId), eq(schema.stockDay.serviceDate, serviceDate)))
    .for("update");
  const prev = before[0];
  if (publishedQty < prev.reserved) {
    throw new ReservationStateError(`Cannot publish ${publishedQty}: ${prev.reserved} is already reserved. Resolve those orders (refund/substitute) first.`);
  }
  await tx
    .update(schema.stockDay)
    .set({ publishedQty })
    .where(and(eq(schema.stockDay.productId, productId), eq(schema.stockDay.serviceDate, serviceDate)));
  await tx.insert(schema.stockMovement).values({
    productId,
    serviceDate,
    type: "PUBLISHED",
    qtyBase: publishedQty - prev.published,
    refType: "stock_day",
    reason: "published quantity changed",
    actorId,
  });
}

/**
 * Packing consumes a reservation: the stock is now physically on its way out. The reserved counter stays
 * (the quantity is sold); the packed counter and the ledger record what actually went into the bag,
 * which may differ slightly from what was ordered (free over-pack, short weight). Idempotent.
 */
export async function consumeReservation(tx: DbOrTx, reservationId: string, packedQty: number, actorId?: string | null): Promise<boolean> {
  const [r] = await tx
    .update(schema.reservation)
    .set({ status: "CONSUMED" })
    .where(and(eq(schema.reservation.id, reservationId), eq(schema.reservation.status, "RESERVED")))
    .returning();
  if (!r) return false;
  await tx
    .update(schema.stockDay)
    .set({ packedQty: sql`${schema.stockDay.packedQty} + ${packedQty}` })
    .where(and(eq(schema.stockDay.productId, r.productId), eq(schema.stockDay.serviceDate, r.serviceDate)));
  await tx.insert(schema.stockMovement).values({
    productId: r.productId,
    serviceDate: r.serviceDate,
    type: "PACKED",
    qtyBase: packedQty,
    refType: "order_line",
    refId: r.orderLineId,
    actorId: actorId ?? null,
  });
  return true;
}
