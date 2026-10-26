import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "@/server/db/client";
import { saveSetting } from "@/server/settings";
import { CheckoutError, cancelOrderByCustomer, createOrder, expirePendingOrders, getOrderByTrackingToken, getOrderForCustomer, type CreateOrderInput } from "@/server/services/orders";
import { istDate, istInstant } from "@/server/services/delivery";
import { FAR, JAIPUR, MID, NEAR, NOWHERE_IN_UDAIPUR_BOX, addProduct, makeCustomer, makeStaff, makeWorld, setPrice, setupCleanDb, testDb, type World } from "../helpers";

setupCleanDb();

let keySeq = 0;
function input(w: World, customerId: string, over: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customerId,
    customerName: "Asha Sharma",
    idempotencyKey: `key-${++keySeq}-abcdefghijkl`,
    deliveryOption: "THREE_HOUR",
    address: { line: "12 Lake View Apartments, Fatehpura", landmark: "Near the temple", lat: NEAR.lat, lng: NEAR.lng },
    paymentMode: "PAY_ON_DELIVERY",
    items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }],
    transactionalConsent: true,
    ...over,
  };
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    return e instanceof CheckoutError ? e.code : `OTHER:${(e as Error).message}`;
  }
}

const stockRow = async (w: World) => (await testDb().select().from(schema.stockDay).where(eq(schema.stockDay.productId, w.product.id)))[0];
const orderCount = async () => (await testDb().select().from(schema.order)).length;

describe("checkout: delivery fees and the promise (the brief: Instant Rs 20, 1 hour Rs 10, 3 hours free)", () => {
  it.each([
    ["INSTANT", 2000, 25],
    ["ONE_HOUR", 1000, 60],
    ["THREE_HOUR", 0, 180],
  ])("%s adds a delivery fee of %i paise and promises %i minutes; no platform fee", async (option, fee, minutes) => {
    const w = await makeWorld();
    const c = await makeCustomer();
    // Noon India time: a promise is capped at closing time, so a clock near midnight must not decide this test.
    const now = istInstant(istDate(new Date()), 12 * 60);
    const r = await createOrder(testDb(), input(w, c.id, { deliveryOption: option }), now);
    expect(r).toMatchObject({ status: "CONFIRMED", deliveryOption: option, subtotalPaise: 4800, deliveryFeePaise: fee, totalPaise: 4800 + fee, replayed: false });
    expect(r.promisedAt.getTime() - now.getTime()).toBe(minutes * 60_000);

    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, r.orderId));
    expect(o).toMatchObject({ feePaise: fee, discountPaise: 0, subtotalPaise: 4800, totalPaise: 4800 + fee });
  });

  it("creates a confirmed order with address snapshot, hub, handover code, reservation, events, consent and outbox", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const r = await createOrder(testDb(), input(w, c.id, { deliveryOption: "ONE_HOUR", items: [{ saleUnitId: w.unit.id, qtyBase: 1500 }], note: "  ring the bell  " }));
    expect(r.totalPaise).toBe(7200 + 1000);
    expect(r.publicCode).toMatch(/^[0-9A-Z]{8}$/);
    expect(r.handoverCode).toMatch(/^\d{4}$/);
    expect(r.trackingToken).toBeTruthy();

    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, r.orderId));
    expect(o).toMatchObject({ hubId: w.hub.id, deliveryOption: "ONE_HOUR", addressLine: "12 Lake View Apartments, Fatehpura", landmark: "Near the temple", recipientName: "Asha Sharma", recipientPhone: c.phone, paymentMode: "PAY_ON_DELIVERY", customerNote: "ring the bell" });
    expect(o.distanceM).toBeGreaterThan(400);
    expect(o.distanceM).toBeLessThan(800);
    expect(o.trackingTokenHash).not.toBe(r.trackingToken);

    const lines = await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.id));
    expect(lines[0]).toMatchObject({ nameEn: "Tomato", nameHi: "टमाटर", qtyOrderedBase: 1500, unitPricePaise: 4800, lineTotalPaise: 7200 });
    expect((await stockRow(w)).reservedQty).toBe(1500);
    expect(await testDb().select().from(schema.orderEvent).where(eq(schema.orderEvent.orderId, o.id))).toHaveLength(1);
    expect((await testDb().select().from(schema.consent)).map((x) => x.purpose)).toEqual(["TRANSACTIONAL"]);
    expect((await testDb().select().from(schema.outbox)).map((x) => x.topic)).toEqual(["order.created"]);
    expect((await testDb().select().from(schema.auditLog)).some((a) => a.action === "order.create")).toBe(true);
    expect((await testDb().select().from(schema.customer).where(eq(schema.customer.id, c.id)))[0].name).toBe("Asha Sharma");
  });

  it("price changes after ordering do not alter the order", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const r = await createOrder(testDb(), input(w, c.id));
    await setPrice(w.unit.id, 9900);
    const view = await getOrderByTrackingToken(testDb(), r.trackingToken!);
    expect(view?.totalPaise).toBe(4800);
    expect(view?.lines[0].unitPricePaise).toBe(4800);
  });
});

describe("checkout: location, speed and hours (acceptance: Udaipur only)", () => {
  it("requires consent to order updates", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    expect(await code(createOrder(testDb(), input(w, c.id, { transactionalConsent: false })))).toBe("CONSENT_REQUIRED");
  });

  it("rejects incomplete addresses and invalid coordinates", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    expect(await code(createOrder(testDb(), input(w, c.id, { address: { line: "abc", lat: NEAR.lat, lng: NEAR.lng } })))).toBe("INVALID_ADDRESS");
    expect(await code(createOrder(testDb(), input(w, c.id, { address: { line: "12 Lake View Apartments", lat: NaN, lng: NEAR.lng } })))).toBe("INVALID_ADDRESS");
    expect(await code(createOrder(testDb(), input(w, c.id, { address: { line: "x".repeat(300), lat: NEAR.lat, lng: NEAR.lng } })))).toBe("INVALID_ADDRESS");
    expect(await orderCount()).toBe(0);
  });

  it("will not deliver outside Udaipur", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    for (const p of [JAIPUR, NOWHERE_IN_UDAIPUR_BOX]) {
      expect(await code(createOrder(testDb(), input(w, c.id, { address: { line: "1 Some Road, Elsewhere", lat: p.lat, lng: p.lng } })))).toBe("OUT_OF_AREA");
    }
    expect(await orderCount()).toBe(0);
    expect((await stockRow(w)).reservedQty).toBe(0);
  });

  it("a speed beyond its radius is refused, but a slower speed works from the same spot", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const at = (p: { lat: number; lng: number }, option: string) => input(w, c.id, { deliveryOption: option, address: { line: "7 Hiran Magri Road", lat: p.lat, lng: p.lng } });
    expect(await code(createOrder(testDb(), at(MID, "INSTANT")))).toBe("OPTION_UNAVAILABLE");
    expect(await code(createOrder(testDb(), at(MID, "ONE_HOUR")))).toBe("NO_ERROR");
    expect(await code(createOrder(testDb(), at(FAR, "ONE_HOUR")))).toBe("OPTION_UNAVAILABLE");
    expect(await code(createOrder(testDb(), at(FAR, "THREE_HOUR")))).toBe("NO_ERROR");
    expect(await code(createOrder(testDb(), input(w, c.id, { deliveryOption: "TEN_MINUTES" })))).toBe("OPTION_UNAVAILABLE");
  });

  it("refuses orders while the hub is closed and says when it opens", async () => {
    const w = await makeWorld({ opens: 7 * 60, closes: 22 * 60, buffer: 20 });
    const c = await makeCustomer();
    const night = istInstant(new Date().toISOString().slice(0, 10), 3 * 60);
    try {
      await createOrder(testDb(), input(w, c.id), night);
      throw new Error("should have failed");
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError);
      expect((e as CheckoutError).code).toBe("HUB_CLOSED");
      expect((e as CheckoutError).details?.nextOpensAt).toBeTruthy();
    }
    const lastOrderBuffer = istInstant(new Date().toISOString().slice(0, 10), 21 * 60 + 50);
    expect(await code(createOrder(testDb(), input(w, c.id), lastOrderBuffer))).toBe("HUB_CLOSED");
    expect(await orderCount()).toBe(0);
  });

  it("rejects invalid carts with per-item issues", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    for (const items of [[{ saleUnitId: w.unit.id, qtyBase: 300 }], [{ saleUnitId: w.unit.id, qtyBase: 50_000 }], [], [{ saleUnitId: "00000000-0000-4000-8000-000000000000", qtyBase: 250 }]]) {
      expect(await code(createOrder(testDb(), input(w, c.id, { items })))).toBe("CART_INVALID");
    }
    try {
      await createOrder(testDb(), input(w, c.id, { items: [{ saleUnitId: w.unit.id, qtyBase: 300 }] }));
    } catch (e) {
      expect((e as CheckoutError).details?.issues?.[0].code).toBe("NOT_STEP_MULTIPLE");
    }
    expect((await stockRow(w)).reservedQty).toBe(0);
  });

  it("enforces per-speed and global minimum orders (the basket, not the fee, is compared)", async () => {
    const w = await makeWorld({ minOrders: { INSTANT: 10_000 } }); // Rs 100 minimum for Instant only
    const c = await makeCustomer();
    expect(await code(createOrder(testDb(), input(w, c.id, { deliveryOption: "INSTANT" })))).toBe("BELOW_MINIMUM_ORDER");
    expect(await code(createOrder(testDb(), input(w, c.id, { deliveryOption: "THREE_HOUR" })))).toBe("NO_ERROR");
    expect(await code(createOrder(testDb(), input(w, c.id, { deliveryOption: "INSTANT", items: [{ saleUnitId: w.unit.id, qtyBase: 2500 }] })))).toBe("NO_ERROR");
    await saveSetting(testDb(), "orders.min_order_paise", 50_000);
    expect(await code(createOrder(testDb(), input(w, c.id, { deliveryOption: "THREE_HOUR" })))).toBe("BELOW_MINIMUM_ORDER");
  });

  it("blocked customers cannot order", async () => {
    const w = await makeWorld();
    const c = await makeCustomer({ blocked: true });
    expect(await code(createOrder(testDb(), input(w, c.id)))).toBe("CUSTOMER_BLOCKED");
  });

  it("is atomic: if the second line cannot be reserved nothing is left behind", async () => {
    const w = await makeWorld();
    const b = await addProduct(w, { slug: "rare", name: "Rare", nameHi: "दुर्लभ", published: 250 });
    const c = await makeCustomer();
    await testDb().update(schema.stockDay).set({ reservedQty: 250 }).where(eq(schema.stockDay.productId, b.product.id));
    const res = await code(createOrder(testDb(), input(w, c.id, { items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }, { saleUnitId: b.unit.id, qtyBase: 250 }] })));
    expect(["CART_INVALID", "OUT_OF_STOCK"]).toContain(res);
    expect((await stockRow(w)).reservedQty).toBe(0);
    expect(await orderCount()).toBe(0);
    expect(await testDb().select().from(schema.orderLine)).toHaveLength(0);
  });
});

describe("hub capacity (acceptance: a busy speed cannot be over-booked)", () => {
  it("a full speed is BUSY while other speeds still work; cancelling frees a place", async () => {
    const w = await makeWorld({ maxInstant: 1 });
    const [c1, c2, c3] = [await makeCustomer(), await makeCustomer(), await makeCustomer()];
    const first = await createOrder(testDb(), input(w, c1.id, { deliveryOption: "INSTANT" }));
    expect(await code(createOrder(testDb(), input(w, c2.id, { deliveryOption: "INSTANT" })))).toBe("OPTION_BUSY");
    expect(await code(createOrder(testDb(), input(w, c2.id, { deliveryOption: "ONE_HOUR" })))).toBe("NO_ERROR");
    await cancelOrderByCustomer(testDb(), { orderId: first.orderId, customerId: c1.id });
    expect(await code(createOrder(testDb(), input(w, c3.id, { deliveryOption: "INSTANT" })))).toBe("NO_ERROR");
  });

  it("12 simultaneous Instant orders against a limit of 3: exactly 3 succeed, the rest are told it is busy", async () => {
    const w = await makeWorld({ maxInstant: 3, published: 100_000 });
    const customers = await Promise.all(Array.from({ length: 12 }, () => makeCustomer()));
    const results = await Promise.allSettled(customers.map((c) => createOrder(testDb(), input(w, c.id, { deliveryOption: "INSTANT" }))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const failures = (results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]).map((r) => (r.reason as CheckoutError).code);
    expect(new Set(failures)).toEqual(new Set(["OPTION_BUSY"]));
    expect(await orderCount()).toBe(3);
    expect((await stockRow(w)).reservedQty).toBe(3000);
  });
});

describe("checkout: payment rules (BR-09)", () => {
  it("pay-on-delivery is capped at Rs 600 INCLUDING the delivery fee", async () => {
    const w = await makeWorld();
    await testDb().update(schema.price).set({ pricePaise: 9000 }).where(eq(schema.price.saleUnitId, w.unit.id)); // Rs 90/kg
    const c = await makeCustomer();
    const items = [{ saleUnitId: w.unit.id, qtyBase: 6500 }]; // Rs 585 of vegetables
    try {
      await createOrder(testDb(), input(w, c.id, { deliveryOption: "INSTANT", items })); // 585 + 20 = 605
      throw new Error("should have failed");
    } catch (e) {
      expect((e as CheckoutError).code).toBe("PAY_ON_DELIVERY_NOT_ALLOWED");
      expect((e as CheckoutError).details).toMatchObject({ reason: "OVER_CAP", capPaise: 60_000 });
    }
    expect(await code(createOrder(testDb(), input(w, c.id, { deliveryOption: "THREE_HOUR", items })))).toBe("NO_ERROR"); // 585 + 0
  });

  it("customers with too many failed deliveries cannot pay on delivery", async () => {
    const w = await makeWorld();
    const c = await makeCustomer({ failedDeliveries: 2 });
    try {
      await createOrder(testDb(), input(w, c.id));
      throw new Error("should have failed");
    } catch (e) {
      expect((e as CheckoutError).details?.reason).toBe("FAILED_DELIVERIES");
    }
  });

  it("prepaid is unavailable until enabled; then it creates PENDING_PAYMENT with a stock hold", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    expect(await code(createOrder(testDb(), input(w, c.id, { paymentMode: "PREPAID" })))).toBe("PAYMENT_MODE_UNAVAILABLE");
    await saveSetting(testDb(), "payments.prepaid_enabled", true);
    const now = new Date();
    const r = await createOrder(testDb(), input(w, c.id, { paymentMode: "PREPAID" }), now);
    expect(r.status).toBe("PENDING_PAYMENT");
    expect(r.holdExpiresAt!.getTime()).toBe(now.getTime() + 15 * 60_000);
    expect((await stockRow(w)).reservedQty).toBe(1000);
  });

  it("once prepaid is enabled, a first order cannot be pay-on-delivery; a returning customer can", async () => {
    const w = await makeWorld();
    await saveSetting(testDb(), "payments.prepaid_enabled", true);
    const c = await makeCustomer();
    try {
      await createOrder(testDb(), input(w, c.id));
      throw new Error("should have failed");
    } catch (e) {
      expect((e as CheckoutError).details?.reason).toBe("FIRST_ORDER_PREPAID");
    }
    const first = await createOrder(testDb(), input(w, c.id, { paymentMode: "PREPAID" }));
    await testDb().update(schema.order).set({ status: "DELIVERED" }).where(eq(schema.order.id, first.orderId));
    expect(await createOrder(testDb(), input(w, c.id))).toMatchObject({ status: "CONFIRMED" });
  });

  it("a malformed stored setting falls back to the safe default instead of breaking checkout", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    await testDb().insert(schema.setting).values({ key: "payments.pay_on_delivery_cap_paise", value: "not a number" });
    expect(await createOrder(testDb(), input(w, c.id))).toMatchObject({ status: "CONFIRMED" });
  });
});

describe("checkout: idempotency and concurrency (acceptance 3, 9)", () => {
  it("the same idempotency key returns the same order and creates nothing twice", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const i = input(w, c.id, { deliveryOption: "INSTANT" });
    const a = await createOrder(testDb(), i);
    const b = await createOrder(testDb(), i);
    expect(b).toMatchObject({ orderId: a.orderId, publicCode: a.publicCode, replayed: true, trackingToken: null, deliveryFeePaise: 2000, totalPaise: 6800 });
    expect(await orderCount()).toBe(1);
    expect((await stockRow(w)).reservedQty).toBe(1000);
  });

  it("double-clicking (two identical requests at once) creates exactly one order", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const i = input(w, c.id);
    const [a, b] = await Promise.all([createOrder(testDb(), i), createOrder(testDb(), i)]);
    expect(a.orderId).toBe(b.orderId);
    expect(await orderCount()).toBe(1);
    expect((await stockRow(w)).reservedQty).toBe(1000);
  });

  it("the same key from a different customer is a different order", async () => {
    const w = await makeWorld();
    const [c1, c2] = [await makeCustomer(), await makeCustomer()];
    const a = await createOrder(testDb(), input(w, c1.id, { idempotencyKey: "same-key-1234567890" }));
    const b = await createOrder(testDb(), input(w, c2.id, { idempotencyKey: "same-key-1234567890" }));
    expect(a.orderId).not.toBe(b.orderId);
  });

  it("20 customers each wanting 1 kg of 5 kg: exactly 5 orders, the rest sold out, counters consistent", async () => {
    const w = await makeWorld({ published: 5000 });
    const customers = await Promise.all(Array.from({ length: 20 }, () => makeCustomer()));
    const results = await Promise.allSettled(customers.map((c) => createOrder(testDb(), input(w, c.id))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const failures = (results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]).map((r) => (r.reason as CheckoutError).code);
    expect(new Set(failures)).toEqual(new Set(["CART_INVALID"])); // pricing sees the stock gone (orders are serialised per hub)
    expect((await stockRow(w)).reservedQty).toBe(5000);
    expect(await orderCount()).toBe(5);
    expect(await testDb().select().from(schema.reservation)).toHaveLength(5);
  });

  it("every order gets a unique public code", async () => {
    const w = await makeWorld({ published: 100_000 });
    const customers = await Promise.all(Array.from({ length: 25 }, () => makeCustomer()));
    const results = await Promise.all(customers.map((c) => createOrder(testDb(), input(w, c.id))));
    expect(new Set(results.map((r) => r.publicCode)).size).toBe(25);
  });
});

describe("cancellation and expiry (acceptance 10)", () => {
  async function placed(w: World, over: Partial<CreateOrderInput> = {}) {
    const c = await makeCustomer();
    const r = await createOrder(testDb(), input(w, c.id, over));
    return { c, r };
  }

  it("cancelling before packing releases stock and the hub place, and records events", async () => {
    const w = await makeWorld({ maxThreeHour: 1 });
    const { c, r } = await placed(w, { items: [{ saleUnitId: w.unit.id, qtyBase: 2000 }] });
    expect((await stockRow(w)).reservedQty).toBe(2000);
    expect(await code(createOrder(testDb(), input(w, (await makeCustomer()).id)))).toBe("OPTION_BUSY");

    expect(await cancelOrderByCustomer(testDb(), { orderId: r.orderId, customerId: c.id })).toEqual({ ok: true });
    expect((await stockRow(w)).reservedQty).toBe(0);
    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, r.orderId));
    expect(o.status).toBe("CANCELLED");
    expect(o.cancelledAt).not.toBeNull();
    expect((await testDb().select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.id)))[0].status).toBe("CANCELLED");
    expect((await testDb().select().from(schema.orderEvent).where(eq(schema.orderEvent.orderId, o.id))).map((e) => e.toStatus)).toEqual(["CONFIRMED", "CANCELLED"]);
    expect((await testDb().select().from(schema.outbox)).map((x) => x.topic)).toContain("order.cancelled");
    await placed(w, { items: [{ saleUnitId: w.unit.id, qtyBase: 2000 }] }); // the freed capacity and stock can be used again
  });

  it("a second cancel does nothing and cannot release twice", async () => {
    const w = await makeWorld();
    const { c, r } = await placed(w);
    await cancelOrderByCustomer(testDb(), { orderId: r.orderId, customerId: c.id });
    expect(await cancelOrderByCustomer(testDb(), { orderId: r.orderId, customerId: c.id })).toEqual({ ok: false, reason: "NOT_CANCELLABLE" });
    expect((await stockRow(w)).reservedQty).toBe(0);
  });

  it("once packing has started, or by another customer, cancel is refused", async () => {
    const w = await makeWorld();
    const { c, r } = await placed(w);
    const other = await makeCustomer();
    expect(await cancelOrderByCustomer(testDb(), { orderId: r.orderId, customerId: other.id })).toEqual({ ok: false, reason: "NOT_FOUND" });
    for (const status of ["PACKING", "PACKED", "OUT_FOR_DELIVERY"] as const) {
      await testDb().update(schema.order).set({ status }).where(eq(schema.order.id, r.orderId));
      expect(await cancelOrderByCustomer(testDb(), { orderId: r.orderId, customerId: c.id })).toEqual({ ok: false, reason: "NOT_CANCELLABLE" });
    }
    expect((await stockRow(w)).reservedQty).toBe(1000);
  });

  it("cancelling a paid order queues a refund for the captured amount", async () => {
    const w = await makeWorld();
    const { c, r } = await placed(w, { deliveryOption: "ONE_HOUR" });
    await testDb().insert(schema.payment).values({ orderId: r.orderId, provider: "test", providerPaymentId: "p1", amountPaise: r.totalPaise, status: "CAPTURED" });
    await cancelOrderByCustomer(testDb(), { orderId: r.orderId, customerId: c.id });
    const refunds = await testDb().select().from(schema.refund).where(eq(schema.refund.orderId, r.orderId));
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amountPaise: 5800, status: "REQUESTED", method: "GATEWAY" }); // includes the delivery fee
  });

  it("unpaid prepaid orders expire after the hold and give everything back; paid-in-time orders are untouched", async () => {
    const w = await makeWorld({ maxThreeHour: 5 });
    await saveSetting(testDb(), "payments.prepaid_enabled", true);
    const t0 = new Date();
    const a = await placed(w, { paymentMode: "PREPAID" });
    const b = await placed(w, { paymentMode: "PREPAID" });
    await testDb().update(schema.order).set({ status: "CONFIRMED" }).where(eq(schema.order.id, b.r.orderId));
    expect((await stockRow(w)).reservedQty).toBe(2000);

    expect(await expirePendingOrders(testDb(), new Date(t0.getTime() + 5 * 60_000))).toBe(0);
    expect(await expirePendingOrders(testDb(), new Date(t0.getTime() + 20 * 60_000))).toBe(1);
    expect(await expirePendingOrders(testDb(), new Date(t0.getTime() + 21 * 60_000))).toBe(0);

    const [oa] = await testDb().select().from(schema.order).where(eq(schema.order.id, a.r.orderId));
    const [ob] = await testDb().select().from(schema.order).where(eq(schema.order.id, b.r.orderId));
    expect(oa.status).toBe("EXPIRED");
    expect(ob.status).toBe("CONFIRMED");
    expect((await stockRow(w)).reservedQty).toBe(1000);
  });
});

describe("tracking view (privacy)", () => {
  it("shows the customer their own order and nothing about anyone else", async () => {
    const w = await makeWorld();
    const c1 = await makeCustomer();
    const c2 = await makeCustomer();
    const a = await createOrder(testDb(), input(w, c1.id, { deliveryOption: "INSTANT" }));
    const b = await createOrder(testDb(), input(w, c2.id));
    const view = await getOrderByTrackingToken(testDb(), a.trackingToken!);
    expect(view).toMatchObject({ publicCode: a.publicCode, status: "CONFIRMED", subtotalPaise: 4800, deliveryFeePaise: 2000, totalPaise: 6800, paymentStatus: "PAY_ON_DELIVERY", cancellable: true, customerFirstName: "Asha" });
    expect(view?.deliveryOption.name).toBe("Instant");
    expect(view?.address.line).toBe("12 Lake View Apartments, Fatehpura");
    expect(view?.handoverCode).toBe(a.handoverCode);
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(b.publicCode);
    expect(serialised).not.toContain(c1.phone);
    expect(serialised).not.toContain(String(NEAR.lat)); // no raw coordinates
    expect(Object.keys(view!)).not.toContain("customerId");
  });

  it("wrong, short or guessed tokens find nothing; a customer cannot open another customer's order by id", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const other = await makeCustomer();
    const a = await createOrder(testDb(), input(w, c.id));
    const real = a.trackingToken!;
    const lastCharChanged = real.slice(0, -1) + (real.endsWith("A") ? "B" : "A"); // always differs from the real token
    for (const bad of ["", "short", "x".repeat(40), lastCharChanged, a.publicCode, "x".repeat(500)]) {
      expect(await getOrderByTrackingToken(testDb(), bad)).toBeNull();
    }
    expect(await getOrderForCustomer(testDb(), c.id, a.orderId)).not.toBeNull();
    expect(await getOrderForCustomer(testDb(), other.id, a.orderId)).toBeNull();
    expect(await getOrderForCustomer(testDb(), c.id, "not-a-uuid")).toBeNull();
  });

  it("cancellable turns false once packing starts; the rider's first name appears only while out for delivery", async () => {
    const w = await makeWorld();
    const c = await makeCustomer();
    const rider = await makeStaff(["RIDER"]);
    const a = await createOrder(testDb(), input(w, c.id));
    await testDb().update(schema.order).set({ status: "PACKING", riderId: rider.id }).where(eq(schema.order.id, a.orderId));
    let view = await getOrderByTrackingToken(testDb(), a.trackingToken!);
    expect(view?.cancellable).toBe(false);
    expect(view?.riderFirstName).toBeNull();
    await testDb().update(schema.order).set({ status: "OUT_FOR_DELIVERY" }).where(eq(schema.order.id, a.orderId));
    view = await getOrderByTrackingToken(testDb(), a.trackingToken!);
    expect(view?.riderFirstName).toBe("Test");
    expect(JSON.stringify(view)).not.toContain(rider.email);
  });
});

describe("ledger consistency after a mixed workload", () => {
  it("reserved counter equals open reservations equals the sum of RESERVED+RELEASED movements", async () => {
    const w = await makeWorld({ published: 100_000, maxThreeHour: 30 });
    const cs = await Promise.all(Array.from({ length: 10 }, () => makeCustomer()));
    const orders = await Promise.all(cs.map((c, i) => createOrder(testDb(), input(w, c.id, { items: [{ saleUnitId: w.unit.id, qtyBase: 500 * (i + 1) }] }))));
    for (const i of [1, 4, 7]) await cancelOrderByCustomer(testDb(), { orderId: orders[i].orderId, customerId: cs[i].id });

    const stock = await stockRow(w);
    const open = await testDb().select().from(schema.reservation).where(and(eq(schema.reservation.productId, w.product.id), eq(schema.reservation.status, "RESERVED")));
    const moves = await testDb().select().from(schema.stockMovement).where(eq(schema.stockMovement.productId, w.product.id));
    const net = moves.filter((m) => m.type === "RESERVED" || m.type === "RELEASED").reduce((s, m) => s + m.qtyBase, 0);
    const expected = [0, 2, 3, 5, 6, 8, 9].reduce((s, i) => s + 500 * (i + 1), 0);
    expect(stock.reservedQty).toBe(expected);
    expect(open.reduce((s, r) => s + r.qtyBase, 0)).toBe(expected);
    expect(net).toBe(expected);
  });
});
