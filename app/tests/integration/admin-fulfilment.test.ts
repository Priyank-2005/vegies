import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/permissions";
import { schema } from "@/server/db/client";
import { AdminError } from "@/server/services/admin/common";
import { getOrderDetail, listBoard, listRiders, searchOrders, startPacking } from "@/server/services/admin/orders";
import { cashHeldByRider, markCashDeposited, riderView, todaySummary } from "@/server/services/admin/ops";
import { finishPacking, flagAttention, getPackingOrder, packingQueue, recordPackedLine, resolveAttention } from "@/server/services/admin/packing";
import { assignRider, completeDelivery, dispatchOrder, type StaffActor } from "@/server/services/delivery-ops";
import { createOrder, getOrderForCustomer } from "@/server/services/orders";
import { NEAR, makeCustomer, makeStaff, makeWorld, setupCleanDb, testDb, type World } from "../helpers";

setupCleanDb();

const actor = (s: { id: string }, roles: StaffActor["roles"]): StaffActor => ({ userId: s.id, roles });
let n = 0;

async function setup(qty = 1500, option = "ONE_HOUR") {
  const w = await makeWorld();
  const packer = await makeStaff(["PACKER"], `packer-${++n}@example.test`);
  const rider = await makeStaff(["RIDER"], `rider-${n}@example.test`);
  const ops = await makeStaff(["OPS_MANAGER"], `ops-${n}@example.test`);
  const c = await makeCustomer();
  const o = await createOrder(testDb(), {
    customerId: c.id,
    customerName: "Asha Sharma",
    idempotencyKey: `idem-${n}-abcdefghijkl`,
    deliveryOption: option,
    address: { line: "12 Lake View Apartments, Fatehpura", lat: NEAR.lat, lng: NEAR.lng },
    paymentMode: "PAY_ON_DELIVERY",
    items: [{ saleUnitId: w.unit.id, qtyBase: qty }],
    transactionalConsent: true,
  });
  const [line] = await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.orderId));
  return { w, o, line, packer: actor(packer, ["PACKER"]), rider: actor(rider, ["RIDER"]), ops: actor(ops, ["OPS_MANAGER"]) };
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    return e instanceof AdminError ? e.code : e instanceof ForbiddenError ? "FORBIDDEN" : `OTHER:${(e as Error).message}`;
  }
}
const orderRow = async (id: string) => (await testDb().select().from(schema.order).where(eq(schema.order.id, id)))[0];
const stock = async (w: World) => (await testDb().select().from(schema.stockDay).where(eq(schema.stockDay.productId, w.product.id)))[0];

describe("packing", () => {
  it("shows new orders in the queue and the board, most urgent first", async () => {
    const s = await setup();
    const q = await packingQueue(testDb());
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ id: s.o.orderId, status: "CONFIRMED", itemCount: 1 });
    const board = await listBoard(testDb());
    expect(board[0]).toMatchObject({ id: s.o.orderId, optionName: "1 hour", totalPaise: 7200 + 1000, dueNowPaise: 8200, riderName: null });
  });

  it("must be started before weights can be recorded, and only by someone who may pack", async () => {
    const s = await setup();
    expect(await code(recordPackedLine(testDb(), { orderId: s.o.orderId, lineId: s.line.id, packedBase: 1500, actor: s.packer }))).toBe("WRONG_STATE");
    expect(await code(startPacking(testDb(), { orderId: s.o.orderId, actor: s.rider }))).toBe("FORBIDDEN");
    await startPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    expect((await orderRow(s.o.orderId)).status).toBe("PACKING");
  });

  it("accepts the ordered weight and a free give-away up to 5%, and asks to repack beyond that", async () => {
    const s = await setup(1500);
    await startPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    const rec = (packedBase: number) => recordPackedLine(testDb(), { orderId: s.o.orderId, lineId: s.line.id, packedBase, actor: s.packer });
    expect(await rec(1500)).toEqual({ kind: "OK", giveawayBase: 0 });
    expect(await rec(1575)).toEqual({ kind: "OK", giveawayBase: 75 }); // exactly 5%
    expect(await code(rec(1600))).toBe("OVERPACKED");
    const [l] = await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.id, s.line.id));
    expect(l).toMatchObject({ qtyPackedBase: 1575, refundedPaise: 0, status: "ACTIVE" }); // the rejected attempt changed nothing
    expect(await code(rec(-5))).toBe("INVALID");
    expect(await code(rec(1.5))).toBe("INVALID");
  });

  it("short weight reduces what the customer owes, pro rata, and the rider collects exactly that", async () => {
    const s = await setup(1500);
    await startPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    const out = await recordPackedLine(testDb(), { orderId: s.o.orderId, lineId: s.line.id, packedBase: 1000, actor: s.packer });
    expect(out).toEqual({ kind: "SHORT", shortBase: 500, refundPaise: 2400 }); // one third of Rs 72
    const done = await finishPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    expect(done.refundedPaise).toBe(2400);
    expect((await orderRow(s.o.orderId)).status).toBe("PACKED");
    // the customer sees the adjustment on their own order page
    const view = await getOrderForCustomer(testDb(), (await orderRow(s.o.orderId)).customerId, s.o.orderId);
    expect(view).toMatchObject({ totalPaise: 8200, adjustmentPaise: 2400 });
    expect(view?.lines[0]).toMatchObject({ status: "SHORT", refundedPaise: 2400 });

    // the reservation is consumed, the packed counter shows what really went in the bag
    const [r] = await testDb().select().from(schema.reservation).where(eq(schema.reservation.orderLineId, s.line.id));
    expect(r.status).toBe("CONSUMED");
    expect((await stock(s.w)).packedQty).toBe(1000);
    const moves = await testDb().select().from(schema.stockMovement).where(and(eq(schema.stockMovement.productId, s.w.product.id), eq(schema.stockMovement.type, "PACKED")));
    expect(moves.map((m) => m.qtyBase)).toEqual([1000]);

    await assignRider(testDb(), { orderId: s.o.orderId, riderId: s.rider.userId, actor: s.ops });
    await dispatchOrder(testDb(), { orderId: s.o.orderId, actor: s.rider });
    const rv = await riderView(testDb(), s.rider.userId);
    expect(rv.mine[0]).toMatchObject({ id: s.o.orderId, amountDuePaise: 8200 - 2400 });

    const base = { orderId: s.o.orderId, actor: s.rider, code: s.o.handoverCode };
    expect(await code(completeDelivery(testDb(), { ...base, payment: { method: "CASH", amountPaise: 8200 } }))).toMatch(/OTHER:The amount to collect is/);
    await completeDelivery(testDb(), { ...base, payment: { method: "CASH", amountPaise: 5800 } });
    expect((await orderRow(s.o.orderId)).status).toBe("DELIVERED");
    const detail = await getOrderDetail(testDb(), s.o.orderId);
    expect(detail).toMatchObject({ amountDuePaise: 5800, refundedPaise: 2400 });
    expect(detail?.receipts[0].amountPaise).toBe(5800);
    expect(detail?.events.map((e) => e.toStatus)).toEqual(["CONFIRMED", "PACKING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"]);
  });

  it("will not finish until every line has a packed quantity, and not when nothing can be delivered", async () => {
    const s = await setup();
    await startPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    expect(await code(finishPacking(testDb(), { orderId: s.o.orderId, actor: s.packer }))).toBe("INCOMPLETE");
    await recordPackedLine(testDb(), { orderId: s.o.orderId, lineId: s.line.id, packedBase: 0, actor: s.packer });
    const [l] = await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.id, s.line.id));
    expect(l).toMatchObject({ status: "REFUNDED", refundedPaise: 7200 });
    expect(await code(finishPacking(testDb(), { orderId: s.o.orderId, actor: s.packer }))).toBe("INCOMPLETE");
    expect((await orderRow(s.o.orderId)).status).toBe("PACKING");
  });

  it("a packer can put an order on hold with a reason, and a manager can send it back to packing", async () => {
    const s = await setup();
    await startPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    expect(await code(flagAttention(testDb(), { orderId: s.o.orderId, note: "  ", actor: s.packer }))).toBe("INVALID");
    await flagAttention(testDb(), { orderId: s.o.orderId, note: "Tomatoes look soft", actor: s.packer });
    expect((await orderRow(s.o.orderId)).status).toBe("ATTENTION");
    expect((await listBoard(testDb()))[0].status).toBe("ATTENTION");
    expect((await todaySummary(testDb())).needAttention).toBe(1);
    await resolveAttention(testDb(), { orderId: s.o.orderId, actor: s.ops });
    expect((await orderRow(s.o.orderId)).status).toBe("PACKING");
    const view = await getPackingOrder(testDb(), s.o.orderId);
    expect(view?.lines[0]).toMatchObject({ minOkBase: 1500, maxFreeBase: 1575 });
  });
});

describe("riders and cash", () => {
  async function delivered() {
    const s = await setup(1000, "THREE_HOUR");
    await startPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    await recordPackedLine(testDb(), { orderId: s.o.orderId, lineId: s.line.id, packedBase: 1000, actor: s.packer });
    await finishPacking(testDb(), { orderId: s.o.orderId, actor: s.packer });
    return s;
  }

  it("lists packed, unassigned orders as open work with no personal details, and who is carrying what", async () => {
    const s = await delivered();
    const v = await riderView(testDb(), s.rider.userId);
    expect(v.mine).toHaveLength(0);
    expect(v.open).toHaveLength(1);
    expect(Object.keys(v.open[0]).sort()).toEqual(["distanceM", "id", "itemCount", "optionName", "promisedAt", "publicCode"]);
    expect((await todaySummary(testDb())).waitingForRider).toBe(1);

    await assignRider(testDb(), { orderId: s.o.orderId, riderId: s.rider.userId, actor: s.ops });
    expect((await riderView(testDb(), s.rider.userId)).mine[0]).toMatchObject({ status: "PACKED", recipientName: "Asha Sharma", amountDuePaise: 4800 });
    expect((await listRiders(testDb()))[0]).toMatchObject({ id: s.rider.userId, active: 1 });
  });

  it("tracks cash a rider holds until a manager records the hand-in", async () => {
    const s = await delivered();
    await dispatchOrder(testDb(), { orderId: s.o.orderId, actor: s.rider });
    await completeDelivery(testDb(), { orderId: s.o.orderId, actor: s.rider, code: s.o.handoverCode, payment: { method: "CASH", amountPaise: 4800 } });
    expect(await cashHeldByRider(testDb())).toMatchObject([{ riderId: s.rider.userId, amountPaise: 4800, receipts: 1 }]);
    expect((await riderView(testDb(), s.rider.userId)).cashHeldPaise).toBe(4800);
    expect((await todaySummary(testDb())).cashHeldPaise).toBe(4800);

    expect(await code(markCashDeposited(testDb(), { riderId: s.rider.userId, actor: s.rider }))).toBe("FORBIDDEN");
    expect(await markCashDeposited(testDb(), { riderId: s.rider.userId, actor: s.ops })).toEqual({ amountPaise: 4800, receipts: 1 });
    expect(await cashHeldByRider(testDb())).toEqual([]);
    expect(await code(markCashDeposited(testDb(), { riderId: s.rider.userId, actor: s.ops }))).toBe("NOT_FOUND");
    expect((await testDb().select().from(schema.auditLog)).some((a) => a.action === "cash.deposit")).toBe(true);
  });

  it("counts today's deliveries and finds orders by code, name or phone", async () => {
    const s = await delivered();
    await dispatchOrder(testDb(), { orderId: s.o.orderId, actor: s.rider });
    await completeDelivery(testDb(), { orderId: s.o.orderId, actor: s.rider, code: s.o.handoverCode, payment: { method: "UPI", amountPaise: 4800, reference: "T123" } });
    const t = await todaySummary(testDb());
    expect(t).toMatchObject({ deliveredToday: 1, goodsTodayPaise: 4800, cashHeldPaise: 0, late: 0 });
    expect((await riderView(testDb(), s.rider.userId)).deliveredToday).toBe(1);

    expect(await searchOrders(testDb(), { q: s.o.publicCode.slice(0, 5).toLowerCase() })).toHaveLength(1);
    expect(await searchOrders(testDb(), { q: "asha" })).toHaveLength(1);
    expect(await searchOrders(testDb(), { q: "nobody" })).toHaveLength(0);
    expect(await searchOrders(testDb(), { status: "DELIVERED" })).toHaveLength(1);
    expect(await searchOrders(testDb(), { status: "CANCELLED" })).toHaveLength(0);
    expect(await searchOrders(testDb(), { q: "%" })).toHaveLength(0); // wildcards are literal
  });
});
