import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { loginStaff } from "@/server/auth/staff-auth";
import { ForbiddenError } from "@/server/auth/permissions";
import { schema } from "@/server/db/client";
import { AdminError } from "@/server/services/admin/common";
import { startPacking } from "@/server/services/admin/orders";
import { finishPacking, recordPackedLine } from "@/server/services/admin/packing";
import { buildReport, ordersCsv } from "@/server/services/admin/reports";
import { getSettingsView, updateBusinessSettings, updateDeliveryOption, updateHub } from "@/server/services/admin/settings";
import { changeOwnPassword, createStaff, listStaff, resetStaffPassword, updateStaff } from "@/server/services/admin/staff";
import { completeDelivery, dispatchOrder, type StaffActor } from "@/server/services/delivery-ops";
import { istDate } from "@/server/services/delivery";
import { CheckoutError, createOrder } from "@/server/services/orders";
import { NEAR, TEST_PASSWORD, makeCustomer, makeStaff, makeWorld, setupCleanDb, testDb } from "../helpers";

setupCleanDb();

let n = 0;
const act = (s: { id: string }, roles: StaffActor["roles"]): StaffActor => ({ userId: s.id, roles });
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    return e instanceof AdminError ? e.code : e instanceof ForbiddenError ? "FORBIDDEN" : e instanceof CheckoutError ? e.code : `OTHER:${(e as Error).message}`;
  }
}
async function team() {
  const owner = await makeStaff(["OWNER"], `owner-${++n}@example.test`);
  const ops = await makeStaff(["OPS_MANAGER"], `ops-${n}@example.test`);
  const rider = await makeStaff(["RIDER"], `rider-${n}@example.test`);
  const packer = await makeStaff(["PACKER"], `packer-${n}@example.test`);
  return { owner: act(owner, ["OWNER"]), ops: act(ops, ["OPS_MANAGER"]), rider: act(rider, ["RIDER"]), packer: act(packer, ["PACKER"]), ownerRow: owner };
}

describe("settings", () => {
  it("lets a manager change hours, location and the speeds, with an audit trail", async () => {
    const w = await makeWorld();
    const t = await team();
    const view = await getSettingsView(testDb());
    expect(view.hub?.id).toBe(w.hub.id);
    expect(view.options.map((o) => [o.code, o.feePaise, o.radiusM])).toEqual([["INSTANT", 2000, 3000], ["ONE_HOUR", 1000, 7000], ["THREE_HOUR", 0, 15000]]);

    await updateHub(testDb(), { hub: { ...view.hub!, name: "Hiran Magri Store", opensAtMinute: 8 * 60, closesAtMinute: 21 * 60, lastOrderBufferMinutes: 15, lat: 24.57, lng: 73.7 }, actor: t.ops });
    expect((await testDb().select().from(schema.hub).where(eq(schema.hub.id, w.hub.id)))[0]).toMatchObject({ name: "Hiran Magri Store", opensAtMinute: 480, closesAtMinute: 1260, lastOrderBufferMinutes: 15 });

    const instant = view.options[0];
    await updateDeliveryOption(testDb(), { hubId: w.hub.id, option: { ...instant, feePaise: 3000, radiusM: 2500, maxActiveOrders: 4, promisedMinutes: 20 }, actor: t.ops });
    const after = (await getSettingsView(testDb())).options[0];
    expect(after).toMatchObject({ feePaise: 3000, radiusM: 2500, maxActiveOrders: 4, promisedMinutes: 20 });
    expect((await testDb().select().from(schema.auditLog)).filter((a) => a.action === "hub.update" || a.action === "delivery_option.update")).toHaveLength(2);
  });

  it("a changed fee applies to the next order, and a disabled speed cannot be ordered", async () => {
    const w = await makeWorld();
    const t = await team();
    const c = await makeCustomer();
    const view = await getSettingsView(testDb());
    const order = (option: string, key: string) =>
      createOrder(testDb(), { customerId: c.id, customerName: "A B", idempotencyKey: key, deliveryOption: option, address: { line: "12 Lake View Apartments", lat: NEAR.lat, lng: NEAR.lng }, paymentMode: "PAY_ON_DELIVERY", items: [{ saleUnitId: w.unit.id, qtyBase: 250 }], transactionalConsent: true });
    await updateDeliveryOption(testDb(), { hubId: w.hub.id, option: { ...view.options[1], feePaise: 1500 }, actor: t.ops });
    expect((await order("ONE_HOUR", "idem-fee-abcdefghijkl")).deliveryFeePaise).toBe(1500);
    await updateDeliveryOption(testDb(), { hubId: w.hub.id, option: { ...view.options[0], enabled: false }, actor: t.ops });
    expect(await code(order("INSTANT", "idem-off-abcdefghijkl"))).toBe("OPTION_UNAVAILABLE");
  });

  it("rejects values that would break the shop", async () => {
    const w = await makeWorld();
    const t = await team();
    const { hub, options } = await getSettingsView(testDb());
    const hubEdit = (over: Partial<NonNullable<typeof hub>>) => updateHub(testDb(), { hub: { ...hub!, ...over }, actor: t.ops });
    expect(await code(hubEdit({ opensAtMinute: 1000, closesAtMinute: 600 }))).toBe("INVALID");
    expect(await code(hubEdit({ closesAtMinute: 1500 }))).toBe("INVALID");
    expect(await code(hubEdit({ lastOrderBufferMinutes: 5000 }))).toBe("INVALID");
    expect(await code(hubEdit({ lat: 26.9, lng: 75.78 }))).toBe("INVALID"); // Jaipur
    expect(await code(hubEdit({ name: " " }))).toBe("INVALID");
    const optEdit = (over: Partial<(typeof options)[number]>) => updateDeliveryOption(testDb(), { hubId: w.hub.id, option: { ...options[0], ...over }, actor: t.ops });
    expect(await code(optEdit({ feePaise: -1 }))).toBe("INVALID");
    expect(await code(optEdit({ radiusM: 100 }))).toBe("INVALID");
    expect(await code(optEdit({ promisedMinutes: 1 }))).toBe("INVALID");
    expect(await code(optEdit({ feePaise: 10.5 }))).toBe("INVALID");
    expect(await code(updateDeliveryOption(testDb(), { hubId: w.hub.id, option: { ...options[0], code: "NOPE" }, actor: t.ops }))).toBe("NOT_FOUND");
    expect(await code(hubEdit({ name: "x" }).then(() => updateHub(testDb(), { hub: { ...hub!, name: "y" }, actor: t.rider })))).toBe("FORBIDDEN");
    expect((await testDb().select().from(schema.hub))[0].lat).toBe(w.hub.lat);
  });

  it("business rules are owner-only and validated", async () => {
    await makeWorld();
    const t = await team();
    expect(await code(updateBusinessSettings(testDb(), { patch: { minOrderPaise: 19_900 }, actor: t.ops }))).toBe("FORBIDDEN");
    await updateBusinessSettings(testDb(), { patch: { minOrderPaise: 19_900, payOnDeliveryCapPaise: 80_000 }, actor: t.owner });
    expect((await getSettingsView(testDb())).business).toMatchObject({ minOrderPaise: 19_900, payOnDeliveryCapPaise: 80_000 });
    expect(await code(updateBusinessSettings(testDb(), { patch: { holdMinutes: 0 }, actor: t.owner }))).toBe("INVALID");
    expect(await code(updateBusinessSettings(testDb(), { patch: { minOrderPaise: -5 }, actor: t.owner }))).toBe("INVALID");
    expect((await getSettingsView(testDb())).business.holdMinutes).toBe(15);
  });
});

describe("staff", () => {
  it("adds staff with a one-time password that works, and forces a change", async () => {
    await makeWorld();
    const t = await team();
    expect(await code(createStaff(testDb(), { name: "Bob", email: "bob@example.test", roles: ["RIDER"], actor: t.ops }))).toBe("FORBIDDEN");
    const created = await createStaff(testDb(), { name: "Bob", email: "Bob@Example.test", phone: "+919811111111", roles: ["RIDER"], actor: t.owner });
    expect(created.password).toHaveLength(14);
    const login = await loginStaff(testDb(), { email: "bob@example.test", password: created.password });
    expect(login.ok).toBe(true);
    const row = (await listStaff(testDb())).find((s) => s.id === created.id)!;
    expect(row).toMatchObject({ email: "bob@example.test", roles: ["RIDER"], mustChangePassword: true, active: true });

    expect(await code(createStaff(testDb(), { name: "Bob 2", email: "bob@example.test", roles: ["RIDER"], actor: t.owner }))).toBe("CONFLICT");
    expect(await code(createStaff(testDb(), { name: "X", email: "not-an-email", roles: ["RIDER"], actor: t.owner }))).toBe("INVALID");
    expect(await code(createStaff(testDb(), { name: "X", email: "x@example.test", roles: [], actor: t.owner }))).toBe("INVALID");

    const [s] = await testDb().select().from(schema.staffSession).where(eq(schema.staffSession.userId, created.id));
    expect(await code(changeOwnPassword(testDb(), { userId: created.id, sessionId: s.id, current: "wrong-password-123", next: "a brand new password" }))).toBe("INVALID");
    expect(await code(changeOwnPassword(testDb(), { userId: created.id, sessionId: s.id, current: created.password, next: "short" }))).toBe("INVALID");
    await changeOwnPassword(testDb(), { userId: created.id, sessionId: s.id, current: created.password, next: "a brand new password" });
    expect((await listStaff(testDb())).find((x) => x.id === created.id)?.mustChangePassword).toBe(false);
    expect((await loginStaff(testDb(), { email: "bob@example.test", password: "a brand new password" })).ok).toBe(true);
    expect((await loginStaff(testDb(), { email: "bob@example.test", password: created.password })).ok).toBe(false);
  });

  it("protects the last owner and cannot switch yourself off; switching someone off ends their sessions", async () => {
    await makeWorld();
    const t = await team();
    expect(await code(updateStaff(testDb(), { id: t.owner.userId, roles: ["OPS_MANAGER"], actor: t.owner }))).toBe("NOT_ALLOWED");
    expect(await code(updateStaff(testDb(), { id: t.owner.userId, active: false, actor: t.owner }))).toBe("NOT_ALLOWED");
    const second = await makeStaff(["OWNER"], "owner2@example.test");
    await updateStaff(testDb(), { id: t.owner.userId, roles: ["OPS_MANAGER"], actor: act(second, ["OWNER"]) }); // fine: someone else is still owner
    expect(await code(updateStaff(testDb(), { id: second.id, active: false, actor: act(second, ["OWNER"]) }))).toBe("NOT_ALLOWED");

    expect((await loginStaff(testDb(), { email: `rider-${n}@example.test`, password: TEST_PASSWORD })).ok).toBe(true);
    await updateStaff(testDb(), { id: t.rider.userId, active: false, actor: act(second, ["OWNER"]) });
    const sessions = await testDb().select().from(schema.staffSession).where(eq(schema.staffSession.userId, t.rider.userId));
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect((await loginStaff(testDb(), { email: `rider-${n}@example.test`, password: TEST_PASSWORD })).ok).toBe(false);
  });

  it("a password reset gives a new one-time password and signs the person out", async () => {
    await makeWorld();
    const t = await team();
    await loginStaff(testDb(), { email: `packer-${n}@example.test`, password: TEST_PASSWORD });
    const { password } = await resetStaffPassword(testDb(), { id: t.packer.userId, actor: t.owner });
    const sessions = await testDb().select().from(schema.staffSession).where(eq(schema.staffSession.userId, t.packer.userId));
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect((await loginStaff(testDb(), { email: `packer-${n}@example.test`, password: TEST_PASSWORD })).ok).toBe(false);
    expect((await loginStaff(testDb(), { email: `packer-${n}@example.test`, password })).ok).toBe(true);
    expect(await code(resetStaffPassword(testDb(), { id: t.packer.userId, actor: t.ops }))).toBe("FORBIDDEN");
  });
});

describe("reports", () => {
  async function oneDelivery(w: Awaited<ReturnType<typeof makeWorld>>, t: Awaited<ReturnType<typeof team>>, key: string, option: string, packed: number) {
    const c = await makeCustomer();
    const o = await createOrder(testDb(), { customerId: c.id, customerName: "A B", idempotencyKey: key, deliveryOption: option, address: { line: "12 Lake View Apartments", lat: NEAR.lat, lng: NEAR.lng }, paymentMode: "PAY_ON_DELIVERY", items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }], transactionalConsent: true });
    const [line] = await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.orderId));
    await startPacking(testDb(), { orderId: o.orderId, actor: t.packer });
    await recordPackedLine(testDb(), { orderId: o.orderId, lineId: line.id, packedBase: packed, actor: t.packer });
    await finishPacking(testDb(), { orderId: o.orderId, actor: t.packer });
    await dispatchOrder(testDb(), { orderId: o.orderId, actor: t.rider });
    const due = o.totalPaise - (await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.orderId)))[0].refundedPaise;
    await completeDelivery(testDb(), { orderId: o.orderId, actor: t.rider, code: o.handoverCode, payment: { method: "CASH", amountPaise: due } });
    return o;
  }

  it("adds up deliveries, fees, short-weight adjustments, speed split, cash and top products", async () => {
    const w = await makeWorld();
    const t = await team();
    await oneDelivery(w, t, "idem-rep-1-abcdefghij", "INSTANT", 1000); // Rs 48 + Rs 20 fee
    await oneDelivery(w, t, "idem-rep-2-abcdefghij", "THREE_HOUR", 500); // Rs 48 -> short by half: Rs 24 + free
    const today = istDate(new Date());
    const r = await buildReport(testDb(), { range: { from: today, to: today }, actor: t.ops });
    expect(r).toMatchObject({ placed: 2, delivered: 2, cancelled: 0, goodsPaise: 4800 + 2400, feesPaise: 2000, adjustedPaise: 2400, collectedPaise: 4800 + 2400 + 2000, avgBasketPaise: 3600, onTimePct: 100 });
    expect(r.bySpeed.map((s) => [s.code, s.delivered, s.feesPaise])).toEqual([["INSTANT", 1, 2000], ["ONE_HOUR", 0, 0], ["THREE_HOUR", 1, 0]]);
    expect(r.topProducts[0]).toMatchObject({ name: "Tomato", orders: 2, revenuePaise: 7200 });
    expect(r.cash).toEqual({ cashPaise: 6800 + 2400, upiPaise: 0, cashUndepositedPaise: 9200 });
    expect(r.daily).toEqual([{ date: today, placed: 2, delivered: 2, collectedPaise: 9200 }]);
    expect(r.avgDeliveryMinutes).not.toBeNull();
  });

  it("is empty and safe for a quiet period, and only for people who may read reports", async () => {
    await makeWorld();
    const t = await team();
    const r = await buildReport(testDb(), { range: { from: "2020-01-01", to: "2020-01-03" }, actor: t.owner });
    expect(r).toMatchObject({ placed: 0, delivered: 0, goodsPaise: 0, avgBasketPaise: 0, onTimePct: null });
    expect(r.daily.map((d) => d.date)).toEqual(["2020-01-01", "2020-01-02", "2020-01-03"]);
    expect(await code(buildReport(testDb(), { range: { from: "2020-01-01", to: "2020-01-03" }, actor: t.rider }))).toBe("FORBIDDEN");
    expect(await code(buildReport(testDb(), { range: { from: "bad", to: "2020-01-03" }, actor: t.owner }))).toBe("INVALID");
  });

  it("exports one row per order as CSV", async () => {
    const w = await makeWorld();
    const t = await team();
    const o = await oneDelivery(w, t, "idem-csv-1-abcdefghij", "ONE_HOUR", 1000);
    const today = istDate(new Date());
    const csv = await ordersCsv(testDb(), { range: { from: today, to: today }, actor: t.ops });
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Order,Placed (IST),Status,Speed,Payment,Items (paise),Delivery fee (paise),Adjusted (paise),Total (paise),Promised (IST),Delivered (IST),Rider");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`${o.publicCode},`);
    expect(lines[1]).toContain(",DELIVERED,1 hour,PAY_ON_DELIVERY,4800,1000,0,5800,");
    expect(lines[1]).toContain("Test RIDER");
    expect(await code(ordersCsv(testDb(), { range: { from: today, to: today }, actor: t.packer }))).toBe("FORBIDDEN");
  });
});
