import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/permissions";
import { InvalidTransitionError } from "@/server/domain/order-state";
import { DeliveryOpError, assignRider, cancelOrderByStaff, completeDelivery, dispatchOrder, failDelivery, type StaffActor } from "@/server/services/delivery-ops";
import { createOrder } from "@/server/services/orders";
import { NEAR, makeCustomer, makeOrderLine, makeStaff, makeWorld, setupCleanDb, testDb, type World } from "../helpers";

setupCleanDb();

const asActor = (s: { id: string }, roles: StaffActor["roles"]): StaffActor => ({ userId: s.id, roles });

let n = 0;
async function setup(over: Parameters<typeof makeOrderLine>[2] = {}) {
  const w = await makeWorld();
  const rider = await makeStaff(["RIDER"], `rider-main-${++n}@example.test`);
  const ops = await makeStaff(["OPS_MANAGER"], `ops-main-${n}@example.test`);
  const l = await makeOrderLine(w, 1000, { status: "PACKED", ...over });
  return { w, rider, ops, order: l.order, riderActor: asActor(rider, ["RIDER"]), opsActor: asActor(ops, ["OPS_MANAGER"]) };
}
const status = async (id: string) => (await testDb().select().from(schema.order).where(eq(schema.order.id, id)))[0];
const codeOf = (o: { handoverCode: string }) => o.handoverCode;
async function errCode(p: Promise<unknown>) {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    return e instanceof DeliveryOpError ? e.code : e instanceof ForbiddenError ? "FORBIDDEN" : e instanceof InvalidTransitionError ? "INVALID_TRANSITION" : `OTHER:${(e as Error).message}`;
  }
}

describe("dispatch and rider assignment", () => {
  it("a manager assigns a rider, the rider dispatches, and the order is out for delivery", async () => {
    const s = await setup();
    await assignRider(testDb(), { orderId: s.order.id, riderId: s.rider.id, actor: s.opsActor });
    expect((await status(s.order.id)).riderId).toBe(s.rider.id);
    await dispatchOrder(testDb(), { orderId: s.order.id, actor: s.riderActor });
    const o = await status(s.order.id);
    expect(o.status).toBe("OUT_FOR_DELIVERY");
    expect(o.dispatchedAt).not.toBeNull();
    expect((await testDb().select().from(schema.outbox)).map((x) => x.topic)).toContain("order.out_for_delivery");
  });

  it("a rider dispatching an unassigned order takes it; an unassigned order cannot be dispatched by a non-rider", async () => {
    const s = await setup();
    expect(await errCode(dispatchOrder(testDb(), { orderId: s.order.id, actor: s.opsActor }))).toBe("NO_RIDER");
    await dispatchOrder(testDb(), { orderId: s.order.id, actor: s.riderActor });
    expect((await status(s.order.id)).riderId).toBe(s.rider.id);
  });

  it("riders cannot assign riders; only active riders can be assigned", async () => {
    const s = await setup();
    expect(await errCode(assignRider(testDb(), { orderId: s.order.id, riderId: s.rider.id, actor: s.riderActor }))).toBe("FORBIDDEN");
    const packer = await makeStaff(["PACKER"], "packer@example.test");
    expect(await errCode(assignRider(testDb(), { orderId: s.order.id, riderId: packer.id, actor: s.opsActor }))).toBe("BAD_RIDER");
    await testDb().update(schema.staffUser).set({ active: false }).where(eq(schema.staffUser.id, s.rider.id));
    expect(await errCode(assignRider(testDb(), { orderId: s.order.id, riderId: s.rider.id, actor: s.opsActor }))).toBe("BAD_RIDER");
  });

  it("a rider cannot touch another rider's order, but a manager can", async () => {
    const s = await setup();
    const other = await makeStaff(["RIDER"], "rider2@example.test");
    await assignRider(testDb(), { orderId: s.order.id, riderId: s.rider.id, actor: s.opsActor });
    expect(await errCode(dispatchOrder(testDb(), { orderId: s.order.id, actor: asActor(other, ["RIDER"]) }))).toBe("NOT_YOUR_ORDER");
    expect(await errCode(dispatchOrder(testDb(), { orderId: s.order.id, actor: s.opsActor }))).toBe("NO_ERROR");
  });

  it("only a packed order can be dispatched", async () => {
    const s = await setup({ status: "PACKING" });
    expect(await errCode(dispatchOrder(testDb(), { orderId: s.order.id, actor: s.riderActor }))).toBe("INVALID_TRANSITION");
  });
});

describe("proof of delivery (the customer's 4-digit code)", () => {
  async function outForDelivery(over: Parameters<typeof makeOrderLine>[2] = {}) {
    const s = await setup(over);
    await assignRider(testDb(), { orderId: s.order.id, riderId: s.rider.id, actor: s.opsActor });
    await dispatchOrder(testDb(), { orderId: s.order.id, actor: s.riderActor });
    return s;
  }

  it("the right code completes a pay-on-delivery order and records the cash and the delivery", async () => {
    const s = await outForDelivery();
    await completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order), payment: { method: "CASH", amountPaise: 4800 } });
    const o = await status(s.order.id);
    expect(o.status).toBe("DELIVERED");
    expect(o.deliveredAt).not.toBeNull();
    const [rec] = await testDb().select().from(schema.deliveryRecord).where(eq(schema.deliveryRecord.orderId, s.order.id));
    expect(rec).toMatchObject({ result: "DELIVERED", verifiedBy: "CODE", riderId: s.rider.id });
    const [rc] = await testDb().select().from(schema.cashReceipt).where(eq(schema.cashReceipt.orderId, s.order.id));
    expect(rc).toMatchObject({ method: "CASH", amountPaise: 4800, deliveryRecordId: rec.id, collectedBy: s.rider.id });
  });

  it("a wrong code is refused and nothing changes", async () => {
    const s = await outForDelivery();
    const wrong = codeOf(s.order) === "0000" ? "1111" : "0000";
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: wrong, payment: { method: "CASH", amountPaise: 4800 } }))).toBe("WRONG_CODE");
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: undefined, payment: { method: "CASH", amountPaise: 4800 } }))).toBe("WRONG_CODE");
    expect((await status(s.order.id)).status).toBe("OUT_FOR_DELIVERY");
    expect(await testDb().select().from(schema.deliveryRecord)).toHaveLength(0);
    expect(await testDb().select().from(schema.cashReceipt)).toHaveLength(0);
  });

  it("after 5 wrong codes even the right code is refused until a manager overrides with a note", async () => {
    const s = await outForDelivery();
    const wrong = codeOf(s.order) === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i++) await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: wrong }));
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order), payment: { method: "CASH", amountPaise: 4800 } }))).toBe("TOO_MANY_ATTEMPTS");
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: s.opsActor, manualOverride: true, payment: { method: "CASH", amountPaise: 4800 } }))).toBe("NOTE_REQUIRED");
    await completeDelivery(testDb(), { orderId: s.order.id, actor: s.opsActor, manualOverride: true, note: "Customer phone off; spoke to society guard and photo on WhatsApp", payment: { method: "UPI", amountPaise: 4800, reference: "UPI123" } });
    const [rec] = await testDb().select().from(schema.deliveryRecord).where(eq(schema.deliveryRecord.orderId, s.order.id));
    expect(rec.verifiedBy).toBe("MANUAL");
  });

  it("pay-on-delivery needs the exact amount; prepaid orders need no money", async () => {
    const s = await outForDelivery();
    const base = { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order) };
    expect(await errCode(completeDelivery(testDb(), base))).toBe("PAYMENT_REQUIRED");
    expect(await errCode(completeDelivery(testDb(), { ...base, payment: { method: "CASH", amountPaise: 4700 } }))).toBe("PAYMENT_REQUIRED");
    expect(await errCode(completeDelivery(testDb(), { ...base, payment: { method: "CASH", amountPaise: 4900 } }))).toBe("PAYMENT_REQUIRED");
    expect((await status(s.order.id)).status).toBe("OUT_FOR_DELIVERY");

    const p = await outForDelivery({ paymentMode: "PREPAID" });
    await completeDelivery(testDb(), { orderId: p.order.id, actor: p.riderActor, code: codeOf(p.order) });
    expect((await status(p.order.id)).status).toBe("DELIVERED");
    expect(await testDb().select().from(schema.cashReceipt).where(eq(schema.cashReceipt.orderId, p.order.id))).toHaveLength(0);
  });

  it("a partial delivery needs a note and may collect less than the total", async () => {
    const s = await outForDelivery();
    const base = { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order), partial: true, payment: { method: "CASH" as const, amountPaise: 3000 } };
    expect(await errCode(completeDelivery(testDb(), base))).toBe("NOTE_REQUIRED");
    await completeDelivery(testDb(), { ...base, note: "Customer refused the spinach (wilted)" });
    const [rec] = await testDb().select().from(schema.deliveryRecord).where(eq(schema.deliveryRecord.orderId, s.order.id));
    expect(rec).toMatchObject({ result: "PARTIAL", note: "Customer refused the spinach (wilted)" });
  });

  it("another rider cannot complete the order; a delivered order cannot be completed twice", async () => {
    const s = await outForDelivery();
    const other = await makeStaff(["RIDER"], "rider3@example.test");
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: asActor(other, ["RIDER"]), code: codeOf(s.order), payment: { method: "CASH", amountPaise: 4800 } }))).toBe("NOT_YOUR_ORDER");
    await completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order), payment: { method: "CASH", amountPaise: 4800 } });
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order), payment: { method: "CASH", amountPaise: 4800 } }))).toBe("WRONG_STATE");
    expect(await testDb().select().from(schema.cashReceipt)).toHaveLength(1);
  });

  it("people without the permission cannot deliver at all", async () => {
    const s = await outForDelivery();
    const packer = await makeStaff(["PACKER"], "packer2@example.test");
    expect(await errCode(completeDelivery(testDb(), { orderId: s.order.id, actor: asActor(packer, ["PACKER"]), code: codeOf(s.order), payment: { method: "CASH", amountPaise: 4800 } }))).toBe("FORBIDDEN");
  });
});

describe("failed deliveries", () => {
  it("a failed delivery needs a reason, keeps the stock reserved, can be retried and then delivered", async () => {
    const s = await setup();
    await assignRider(testDb(), { orderId: s.order.id, riderId: s.rider.id, actor: s.opsActor });
    await dispatchOrder(testDb(), { orderId: s.order.id, actor: s.riderActor });
    expect(await errCode(failDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, reason: "  " }))).toBe("NOTE_REQUIRED");
    await failDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, reason: "Nobody answered the door", customerAtFault: true });
    expect((await status(s.order.id)).status).toBe("DELIVERY_FAILED");
    expect((await testDb().select().from(schema.customer).where(eq(schema.customer.id, s.order.customerId)))[0].noShowCount).toBe(1);

    await dispatchOrder(testDb(), { orderId: s.order.id, actor: s.riderActor }); // retry
    await completeDelivery(testDb(), { orderId: s.order.id, actor: s.riderActor, code: codeOf(s.order), payment: { method: "UPI", amountPaise: 4800, reference: "U1" } });
    expect((await status(s.order.id)).status).toBe("DELIVERED");
    const recs = await testDb().select().from(schema.deliveryRecord).where(eq(schema.deliveryRecord.orderId, s.order.id));
    expect(recs).toHaveLength(1); // the failed attempt's row was updated, not duplicated
    expect(recs[0].result).toBe("DELIVERED");
  });

  it("only an order that is out for delivery can fail", async () => {
    const s = await setup();
    expect(await errCode(failDelivery(testDb(), { orderId: s.order.id, actor: s.opsActor, reason: "x" }))).toBe("WRONG_STATE");
  });
});

describe("staff cancellation", () => {
  it("support can cancel an unpacked order: stock is released and the reason is audited", async () => {
    const w: World = await makeWorld();
    const support = await makeStaff(["SUPPORT"], "support@example.test");
    const c = await makeCustomer();
    const r = await createOrder(testDb(), { customerId: c.id, customerName: "Asha", idempotencyKey: "staff-cancel-key-123456", deliveryOption: "THREE_HOUR", address: { line: "12 Lake View Apartments", lat: NEAR.lat, lng: NEAR.lng }, paymentMode: "PAY_ON_DELIVERY", items: [{ saleUnitId: w.unit.id, qtyBase: 2000 }], transactionalConsent: true });
    expect(await errCode(cancelOrderByStaff(testDb(), { orderId: r.orderId, actor: asActor(support, ["SUPPORT"]), reason: " " }))).toBe("NOTE_REQUIRED");
    await cancelOrderByStaff(testDb(), { orderId: r.orderId, actor: asActor(support, ["SUPPORT"]), reason: "Customer called to cancel" });
    expect((await status(r.orderId)).status).toBe("CANCELLED");
    const [stock] = await testDb().select().from(schema.stockDay).where(eq(schema.stockDay.productId, w.product.id));
    expect(stock.reservedQty).toBe(0);
    const ev = await testDb().select().from(schema.orderEvent).where(eq(schema.orderEvent.orderId, r.orderId));
    expect(ev.at(-1)).toMatchObject({ toStatus: "CANCELLED", note: "Customer called to cancel", actorType: "staff" });
  });

  it("a rider cannot cancel; nobody can cancel a delivered order", async () => {
    const s = await setup();
    expect(await errCode(cancelOrderByStaff(testDb(), { orderId: s.order.id, actor: s.riderActor, reason: "x" }))).toBe("FORBIDDEN");
    await testDb().update(schema.order).set({ status: "DELIVERED" }).where(eq(schema.order.id, s.order.id));
    expect(await errCode(cancelOrderByStaff(testDb(), { orderId: s.order.id, actor: s.opsActor, reason: "oops" }))).toBe("INVALID_TRANSITION");
  });
});
