import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "@/server/db/client";
import { OutOfStockError, ReservationStateError, releaseReservation, reserveStock, setPublishedQty } from "@/server/domain/inventory";
import { makeOrderLine, makeStaff, makeWorld, setupCleanDb, testDb, type World } from "../helpers";

setupCleanDb();

async function stockRow(w: World) {
  const [r] = await testDb().select().from(schema.stockDay).where(eq(schema.stockDay.productId, w.product.id));
  return r;
}

describe("stock reservation (acceptance: concurrent orders cannot oversell)", () => {
  it("50 parallel reservations against 10 units of stock yield exactly 10", async () => {
    const w = await makeWorld({ published: 10_000 }); // 10 kg
    const lines = await Promise.all(Array.from({ length: 50 }, () => makeOrderLine(w, 1000)));

    const results = await Promise.allSettled(
      lines.map((l) =>
        testDb().transaction((tx) => reserveStock(tx, { productId: w.product.id, serviceDate: w.serviceDate, qtyBase: 1000, orderLineId: l.line.id })),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected).toHaveLength(40);
    expect(rejected.every((r) => r.reason instanceof OutOfStockError)).toBe(true);

    const row = await stockRow(w);
    expect(row.reservedQty).toBe(10_000);
    expect(row.reservedQty).toBeLessThanOrEqual(row.publishedQty);

    // The ledger agrees with the counter.
    const moves = await testDb().select().from(schema.stockMovement).where(eq(schema.stockMovement.type, "RESERVED"));
    expect(moves.reduce((s, m) => s + m.qtyBase, 0)).toBe(10_000);
  });

  it("rolls back the reservation when the surrounding transaction fails", async () => {
    const w = await makeWorld({ published: 5000 });
    const l = await makeOrderLine(w, 2000);
    await expect(
      testDb().transaction(async (tx) => {
        await reserveStock(tx, { productId: w.product.id, serviceDate: w.serviceDate, qtyBase: 2000, orderLineId: l.line.id });
        throw new Error("payment gateway down");
      }),
    ).rejects.toThrow("payment gateway down");
    expect((await stockRow(w)).reservedQty).toBe(0);
  });

  it("release is idempotent and restores availability", async () => {
    const w = await makeWorld({ published: 3000 });
    const l = await makeOrderLine(w, 3000);
    const rid = await testDb().transaction((tx) => reserveStock(tx, { productId: w.product.id, serviceDate: w.serviceDate, qtyBase: 3000, orderLineId: l.line.id }));
    expect((await stockRow(w)).reservedQty).toBe(3000);

    expect(await testDb().transaction((tx) => releaseReservation(tx, rid, "cancelled"))).toBe(true);
    expect(await testDb().transaction((tx) => releaseReservation(tx, rid, "cancelled again"))).toBe(false);
    expect((await stockRow(w)).reservedQty).toBe(0);

    const l2 = await makeOrderLine(w, 3000);
    await testDb().transaction((tx) => reserveStock(tx, { productId: w.product.id, serviceDate: w.serviceDate, qtyBase: 3000, orderLineId: l2.line.id }));
    expect((await stockRow(w)).reservedQty).toBe(3000);
  });

  it("refuses non-positive or fractional quantities", async () => {
    const w = await makeWorld();
    const l = await makeOrderLine(w);
    for (const q of [0, -5, 1.5]) {
      await expect(testDb().transaction((tx) => reserveStock(tx, { productId: w.product.id, serviceDate: w.serviceDate, qtyBase: q, orderLineId: l.line.id }))).rejects.toThrow(RangeError);
    }
  });

  it("cannot publish below what is already reserved; ledger records the publish", async () => {
    const w = await makeWorld({ published: 5000 });
    const staff = await makeStaff(["PROCUREMENT"]);
    const l = await makeOrderLine(w, 4000);
    await testDb().transaction((tx) => reserveStock(tx, { productId: w.product.id, serviceDate: w.serviceDate, qtyBase: 4000, orderLineId: l.line.id }));

    await expect(testDb().transaction((tx) => setPublishedQty(tx, { productId: w.product.id, serviceDate: w.serviceDate, publishedQty: 3000, actorId: staff.id }))).rejects.toBeInstanceOf(ReservationStateError);

    await testDb().transaction((tx) => setPublishedQty(tx, { productId: w.product.id, serviceDate: w.serviceDate, publishedQty: 8000, actorId: staff.id }));
    expect((await stockRow(w)).publishedQty).toBe(8000);
    const pub = await testDb().select().from(schema.stockMovement).where(eq(schema.stockMovement.type, "PUBLISHED"));
    expect(pub.map((m) => m.qtyBase)).toEqual([3000]);
  });

  it("the database itself refuses reserved > published", async () => {
    const w = await makeWorld({ published: 1000 });
    await expect(testDb().update(schema.stockDay).set({ reservedQty: 1001 }).where(eq(schema.stockDay.productId, w.product.id))).rejects.toThrow();
  });
});
