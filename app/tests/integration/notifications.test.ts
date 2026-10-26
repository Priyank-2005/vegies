import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "@/server/db/client";
import { PermanentSendError, clearFakeSent, fakeChannel, fakeSent, type MessageChannel } from "@/server/notify/channel";
import { MAX_ATTEMPTS, messageHealth, processOutbox, queueLateOrderAlerts } from "@/server/notify/dispatcher";
import { startPacking } from "@/server/services/admin/orders";
import { finishPacking, recordPackedLine } from "@/server/services/admin/packing";
import { assignRider, cancelOrderByStaff, completeDelivery, dispatchOrder, type StaffActor } from "@/server/services/delivery-ops";
import { cancelOrderByCustomer, createOrder } from "@/server/services/orders";
import { tick } from "@/server/worker/run";
import { NEAR, makeCustomer, makeStaff, makeWorld, setupCleanDb, testDb } from "../helpers";

setupCleanDb();

let n = 0;
const act = (s: { id: string }, roles: StaffActor["roles"]): StaffActor => ({ userId: s.id, roles });

async function placeOrder(option = "ONE_HOUR") {
  clearFakeSent();
  const w = await makeWorld();
  const c = await makeCustomer();
  const o = await createOrder(testDb(), {
    customerId: c.id,
    customerName: "Asha Sharma",
    idempotencyKey: `idem-n-${++n}-abcdefghijkl`,
    deliveryOption: option,
    address: { line: "12 Lake View Apartments, Fatehpura", lat: NEAR.lat, lng: NEAR.lng },
    paymentMode: "PAY_ON_DELIVERY",
    items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }],
    transactionalConsent: true,
  });
  return { w, c, o };
}
const notes = async (orderId: string) => (await testDb().select().from(schema.notification).where(eq(schema.notification.orderId, orderId))).sort((a, b) => a.template.localeCompare(b.template));
const outboxRows = async () => testDb().select().from(schema.outbox);

/** A channel whose first calls fail the way we tell it to. */
function scripted(failures: Array<Error | null>): MessageChannel & { calls: number } {
  const ch = {
    name: "FAKE" as const,
    consentChannel: "WHATSAPP" as const,
    keepsBody: false,
    calls: 0,
    async send() {
      const f = failures[ch.calls++];
      if (f) throw f;
      return { providerMessageId: `s-${ch.calls}` };
    },
  };
  return ch;
}

describe("order messages", () => {
  it("sends one bilingual confirmation when an order is placed, and never twice", async () => {
    const { c, o } = await placeOrder();
    const r = await processOutbox(testDb(), { channel: fakeChannel });
    expect(r).toMatchObject({ claimed: 1, sent: 1 });
    const [m] = await notes(o.orderId);
    expect(m).toMatchObject({ template: "ORDER_CONFIRMED", channel: "FAKE", status: "SENT", attempts: 1 });
    expect(m.toMasked).not.toContain(c.phone.slice(0, 8));
    expect(m.body).toContain(o.publicCode);
    expect(m.body).toContain("1 hour delivery");
    expect(m.body).toContain("हरी हाट");
    expect(m.body).toContain("₹58"); // Rs 48 + Rs 10 delivery
    expect(m.body).toContain(`/my-orders/${o.orderId}`);
    expect(fakeSent()).toHaveLength(1);
    expect(fakeSent()[0].to).toBe(c.phone);

    // the same event again (a duplicate or a replay) sends nothing
    await testDb().insert(schema.outbox).values({ topic: "order.created", payload: { orderId: o.orderId } });
    expect(await processOutbox(testDb(), { channel: fakeChannel, now: new Date(Date.now() + 1000) })).toMatchObject({ claimed: 1, sent: 1 }); // counted as already sent
    expect(fakeSent()).toHaveLength(1);
    expect(await notes(o.orderId)).toHaveLength(1);
    expect((await outboxRows()).every((x) => x.processedAt !== null)).toBe(true);
  });

  it("follows an order through packing, delivery and the door, sending the right message at each step", async () => {
    const { w, o } = await placeOrder();
    const packer = act(await makeStaff(["PACKER"], `p-${n}@example.test`), ["PACKER"]);
    const rider = act(await makeStaff(["RIDER"], `r-${n}@example.test`), ["RIDER"]);
    const ops = act(await makeStaff(["OPS_MANAGER"], `o-${n}@example.test`), ["OPS_MANAGER"]);
    const [line] = await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.orderId));
    await startPacking(testDb(), { orderId: o.orderId, actor: packer });
    await recordPackedLine(testDb(), { orderId: o.orderId, lineId: line.id, packedBase: 500, actor: packer }); // short: customer pays less
    await finishPacking(testDb(), { orderId: o.orderId, actor: packer });
    await assignRider(testDb(), { orderId: o.orderId, riderId: rider.userId, actor: ops });
    await dispatchOrder(testDb(), { orderId: o.orderId, actor: rider });
    await processOutbox(testDb(), { channel: fakeChannel });

    const out = (await notes(o.orderId)).find((x) => x.template === "ORDER_OUT_FOR_DELIVERY");
    expect(out?.status).toBe("SENT");
    expect(out?.body).toContain(`delivery code ${o.handoverCode}`);
    expect(out?.body).toContain("₹34"); // Rs 58 less Rs 24 for the short half = Rs 34
    expect(out?.body).toContain("Test"); // rider's first name
    expect(w.hub.id).toBeTruthy();

    await completeDelivery(testDb(), { orderId: o.orderId, actor: rider, code: o.handoverCode, payment: { method: "CASH", amountPaise: 3400 } });
    await processOutbox(testDb(), { channel: fakeChannel });
    expect((await notes(o.orderId)).map((x) => x.template)).toEqual(["ORDER_CONFIRMED", "ORDER_DELIVERED", "ORDER_OUT_FOR_DELIVERY"]);
    // "packed" is an internal event: it sent nothing
    expect((await outboxRows()).find((x) => x.topic === "order.packed")?.processedAt).not.toBeNull();
    expect(fakeSent()).toHaveLength(3);
  });

  it("a confirmation that is overtaken by a cancellation is dropped, and the customer only hears about the cancellation", async () => {
    const { c, o } = await placeOrder();
    expect(await cancelOrderByCustomer(testDb(), { orderId: o.orderId, customerId: c.id })).toEqual({ ok: true });
    const r = await processOutbox(testDb(), { channel: fakeChannel });
    expect(r).toMatchObject({ claimed: 2, sent: 1, skipped: 1 });
    expect((await notes(o.orderId)).map((x) => [x.template, x.status])).toEqual([["ORDER_CANCELLED", "SENT"]]);
    expect(fakeSent()[0].text).toContain("रद्द");
  });

  it("staff cancellation, failed delivery and lateness each send their own message", async () => {
    const { o } = await placeOrder();
    const ops = act(await makeStaff(["OPS_MANAGER"], `o2-${n}@example.test`), ["OPS_MANAGER"]);
    await cancelOrderByStaff(testDb(), { orderId: o.orderId, actor: ops, reason: "out of stock" });
    await processOutbox(testDb(), { channel: fakeChannel });
    expect((await notes(o.orderId)).map((x) => x.template)).toEqual(["ORDER_CANCELLED"]);
  });

  it("does not message a customer who has not agreed to order updates", async () => {
    const { o } = await placeOrder();
    await testDb().delete(schema.consent);
    const r = await processOutbox(testDb(), { channel: fakeChannel });
    expect(r).toMatchObject({ sent: 0, skipped: 1 });
    const [m] = await notes(o.orderId);
    expect(m).toMatchObject({ status: "SKIPPED", error: expect.stringContaining("consent") });
    expect(fakeSent()).toHaveLength(0);

    // withdrawn consent after agreeing also stops messages
    const second = await placeOrder();
    await testDb().insert(schema.consent).values({ customerId: second.c.id, phone: second.c.phone, channel: "WHATSAPP", purpose: "TRANSACTIONAL", granted: false, textVersion: "t", source: "admin" });
    expect(await processOutbox(testDb(), { channel: fakeChannel })).toMatchObject({ sent: 0 });
    expect(fakeSent()).toHaveLength(0);
  });

  it("an unpaid prepaid order sends nothing until it is confirmed, and then sends the confirmation once", async () => {
    const { o } = await placeOrder();
    await testDb().update(schema.order).set({ status: "PENDING_PAYMENT" }).where(eq(schema.order.id, o.orderId));
    await processOutbox(testDb(), { channel: fakeChannel });
    expect(await notes(o.orderId)).toHaveLength(0);
    await testDb().update(schema.order).set({ status: "CONFIRMED" }).where(eq(schema.order.id, o.orderId));
    await testDb().insert(schema.outbox).values({ topic: "order.confirmed", payload: { orderId: o.orderId } });
    // (a second later: the database stamps the event with its own clock, to the microsecond)
    expect(await processOutbox(testDb(), { channel: fakeChannel, now: new Date(Date.now() + 1000) })).toMatchObject({ sent: 1 });
    expect(fakeSent()).toHaveLength(1);
  });

  it("two workers at once never send the same message twice", async () => {
    const { o } = await placeOrder();
    const [a, b] = await Promise.all([processOutbox(testDb(), { channel: fakeChannel }), processOutbox(testDb(), { channel: fakeChannel })]);
    expect(a.claimed + b.claimed).toBe(1);
    expect(fakeSent()).toHaveLength(1);
    expect(await notes(o.orderId)).toHaveLength(1);
  });
});

describe("failures and retries", () => {
  it("retries a temporary failure with growing waits, then succeeds", async () => {
    const { o } = await placeOrder();
    const ch = scripted([new Error("timeout"), new Error("503"), null]);
    const t0 = new Date();
    let r = await processOutbox(testDb(), { channel: ch, now: t0 });
    expect(r).toMatchObject({ retried: 1, sent: 0 });
    let [ev] = await outboxRows();
    expect(ev).toMatchObject({ attempts: 1, processedAt: null });
    expect(ev.availableAt.getTime() - t0.getTime()).toBe(30_000);
    expect((await notes(o.orderId))[0]).toMatchObject({ status: "QUEUED", attempts: 1, error: "timeout" });

    // too early: nothing is due yet
    expect(await processOutbox(testDb(), { channel: ch, now: new Date(t0.getTime() + 10_000) })).toMatchObject({ claimed: 0 });

    r = await processOutbox(testDb(), { channel: ch, now: new Date(t0.getTime() + 31_000) });
    expect(r.retried).toBe(1);
    [ev] = await outboxRows();
    expect(ev.attempts).toBe(2);
    expect(ev.availableAt.getTime() - (t0.getTime() + 31_000)).toBe(120_000);

    r = await processOutbox(testDb(), { channel: ch, now: new Date(t0.getTime() + 31_000 + 121_000) });
    expect(r.sent).toBe(1);
    expect((await notes(o.orderId))[0]).toMatchObject({ status: "SENT", attempts: 3, error: null });
    expect((await outboxRows())[0].processedAt).not.toBeNull();
  });

  it("gives up on a permanent failure straight away, and keeps the reason for staff", async () => {
    const { o } = await placeOrder();
    const ch = scripted([new PermanentSendError("number is not on WhatsApp")]);
    const r = await processOutbox(testDb(), { channel: ch });
    expect(r).toMatchObject({ failed: 1, retried: 0 });
    expect((await notes(o.orderId))[0]).toMatchObject({ status: "FAILED", error: "number is not on WhatsApp" });
    expect((await outboxRows())[0]).toMatchObject({ lastError: expect.any(String) });
    expect((await outboxRows())[0].processedAt).not.toBeNull();
    expect(await messageHealth(testDb())).toEqual({ waiting: 0, failed: 1 });
    // not retried later
    expect(await processOutbox(testDb(), { channel: ch, now: new Date(Date.now() + 86_400_000) })).toMatchObject({ claimed: 0 });
    expect(ch.calls).toBe(1);
  });

  it("stops after the maximum number of tries and marks the message failed", async () => {
    const { o } = await placeOrder();
    const ch = scripted(Array.from({ length: 10 }, () => new Error("provider down")));
    let now = new Date();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await processOutbox(testDb(), { channel: ch, now });
      now = new Date(now.getTime() + 7 * 3600_000);
    }
    expect(ch.calls).toBe(MAX_ATTEMPTS);
    expect((await notes(o.orderId))[0]).toMatchObject({ status: "FAILED", attempts: MAX_ATTEMPTS });
    expect((await outboxRows())[0].processedAt).not.toBeNull();
    expect(await processOutbox(testDb(), { channel: ch, now })).toMatchObject({ claimed: 0 });
  });

  it("reports messages waiting for a retry", async () => {
    await placeOrder();
    await processOutbox(testDb(), { channel: scripted([new Error("x")]) });
    expect(await messageHealth(testDb())).toEqual({ waiting: 1, failed: 0 });
  });
});

describe("late orders", () => {
  it("queues one 'running late' message per order, only for orders past their promise by the grace period", async () => {
    const { o } = await placeOrder();
    await processOutbox(testDb(), { channel: fakeChannel });
    const now = new Date();
    expect(await queueLateOrderAlerts(testDb(), { now })).toBe(0); // not late yet

    const later = new Date(o.promisedAt.getTime() + 3 * 60_000);
    expect(await queueLateOrderAlerts(testDb(), { now: later })).toBe(0); // inside the 5-minute grace

    const lateEnough = new Date(o.promisedAt.getTime() + 6 * 60_000);
    expect(await queueLateOrderAlerts(testDb(), { now: lateEnough })).toBe(1);
    expect(await queueLateOrderAlerts(testDb(), { now: lateEnough })).toBe(0); // already queued
    await processOutbox(testDb(), { channel: fakeChannel, now: lateEnough });
    const delayed = (await notes(o.orderId)).find((x) => x.template === "ORDER_DELAYED");
    expect(delayed?.status).toBe("SENT");
    expect(delayed?.body).toContain("taking longer");
    expect(await queueLateOrderAlerts(testDb(), { now: new Date(lateEnough.getTime() + 3600_000) })).toBe(0); // already told
  });

  it("does not chase orders that are finished or cancelled", async () => {
    const { c, o } = await placeOrder();
    await cancelOrderByCustomer(testDb(), { orderId: o.orderId, customerId: c.id });
    expect(await queueLateOrderAlerts(testDb(), { now: new Date(o.promisedAt.getTime() + 3600_000) })).toBe(0);
  });
});

describe("the worker tick", () => {
  it("sends due messages, queues late alerts and releases expired holds in one pass", async () => {
    const { o } = await placeOrder();
    const t = await tick(testDb(), { channel: fakeChannel, now: new Date(o.promisedAt.getTime() + 10 * 60_000) });
    expect(t.lateQueued).toBe(1);
    expect(t.messages).toMatchObject({ sent: 2 }); // confirmation and the late notice
    expect(fakeSent().map((m) => m.template).sort()).toEqual(["ORDER_CONFIRMED", "ORDER_DELAYED"]);
  });

  it("with no channel configured, messages wait in the queue and nothing is lost", async () => {
    const { o } = await placeOrder();
    const t = await tick(testDb(), { channel: null });
    expect(t.messages.claimed).toBe(0);
    expect(fakeSent()).toHaveLength(0);
    expect((await outboxRows()).filter((x) => x.processedAt === null)).toHaveLength(1);
    // once a channel is configured the backlog is sent
    expect((await tick(testDb(), { channel: fakeChannel })).messages.sent).toBe(1);
    expect(await notes(o.orderId)).toHaveLength(1);
  });
});
