import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { audit } from "@/server/audit";
import { schema } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/permissions";
import { InvalidTransitionError, transitionOrder } from "@/server/domain/order-state";
import { makeOrderLine, makeStaff, makeWorld, setupCleanDb, testDb } from "../helpers";

setupCleanDb();

describe("append-only ledgers (acceptance: auditable, immutable)", () => {
  it("stock_movement, audit_log and order_event reject UPDATE and DELETE", async () => {
    const w = await makeWorld();
    const l = await makeOrderLine(w);
    await testDb().insert(schema.stockMovement).values({ productId: w.product.id, serviceDate: w.serviceDate, type: "RECEIVED", qtyBase: 5000 });
    await audit(testDb(), { actorType: "system", action: "test", entity: "x" });
    await testDb().insert(schema.orderEvent).values({ orderId: l.order.id, toStatus: "CONFIRMED", actorType: "system" });

    // Drizzle wraps driver errors; the Postgres message is on `cause`.
    const dbMessage = async (q: string) => {
      try {
        await testDb().execute(sql.raw(q));
      } catch (e) {
        return String((e as Error & { cause?: Error }).cause?.message ?? (e as Error).message);
      }
      return "NO ERROR";
    };
    for (const t of ["stock_movement", "audit_log", "order_event"]) {
      expect(await dbMessage(`update ${t} set id = id`)).toMatch(/append-only/);
      expect(await dbMessage(`delete from ${t}`)).toMatch(/append-only/);
    }
  });
});

describe("database constraints back up the business rules", () => {
  it("rejects an order whose total does not equal subtotal - discount + fee", async () => {
    const w = await makeWorld();
    const l = await makeOrderLine(w);
    await expect(testDb().update(schema.order).set({ totalPaise: 1 }).where(eq(schema.order.id, l.order.id))).rejects.toThrow();
    // a delivery fee changes the total consistently
    await testDb().update(schema.order).set({ feePaise: 2000, totalPaise: 6800 }).where(eq(schema.order.id, l.order.id));
  });

  it("requires a 4-digit handover code and sane coordinates", async () => {
    const w = await makeWorld();
    const l = await makeOrderLine(w);
    await expect(testDb().update(schema.order).set({ handoverCode: "12" }).where(eq(schema.order.id, l.order.id))).rejects.toThrow();
    await expect(testDb().update(schema.order).set({ handoverCode: "12ab" }).where(eq(schema.order.id, l.order.id))).rejects.toThrow();
    await expect(testDb().update(schema.order).set({ lat: 123 }).where(eq(schema.order.id, l.order.id))).rejects.toThrow();
  });

  it("allows at most one CAPTURED payment per order (no duplicate financial transactions)", async () => {
    const w = await makeWorld();
    const { order } = await makeOrderLine(w);
    const base = { orderId: order.id, provider: "razorpay", amountPaise: 4800, status: "CAPTURED" as const };
    await testDb().insert(schema.payment).values({ ...base, providerPaymentId: "pay_1" });
    await expect(testDb().insert(schema.payment).values({ ...base, providerPaymentId: "pay_2" })).rejects.toThrow();
    await testDb().insert(schema.payment).values({ ...base, status: "FAILED", providerPaymentId: "pay_3" });
  });

  it("deduplicates gateway webhook events by (provider, event id)", async () => {
    const ev = { provider: "razorpay", eventId: "evt_1", eventType: "payment.captured", signatureOk: true, payload: {} };
    await testDb().insert(schema.gatewayEvent).values(ev);
    await expect(testDb().insert(schema.gatewayEvent).values(ev)).rejects.toThrow();
  });

  it("enforces unique public order codes", async () => {
    const w = await makeWorld();
    const a = await makeOrderLine(w);
    const b = await makeOrderLine(w);
    await expect(testDb().update(schema.order).set({ publicCode: a.order.publicCode }).where(eq(schema.order.id, b.order.id))).rejects.toThrow();
  });

  it("validates customer phone format and waitlist pincodes", async () => {
    await expect(testDb().insert(schema.customer).values({ phone: "9876543210" })).rejects.toThrow(); // must be E.164
    await expect(testDb().insert(schema.waitlistEntry).values({ phone: "+919876543210", pincode: "12345" })).rejects.toThrow();
    await testDb().insert(schema.waitlistEntry).values({ phone: "+919876543210", pincode: "313001" });
  });

  it("validates sale unit rules and price sanity at the database level", async () => {
    const w = await makeWorld();
    await expect(testDb().insert(schema.saleUnit).values({ productId: w.product.id, unitBaseQty: 1000, minBase: 300, maxBase: 5000, stepBase: 250 })).rejects.toThrow();
    await expect(testDb().insert(schema.price).values({ saleUnitId: w.unit.id, pricePaise: 0 })).rejects.toThrow();
    await expect(testDb().insert(schema.price).values({ saleUnitId: w.unit.id, pricePaise: 4800, salePricePaise: 5000 })).rejects.toThrow();
    await testDb().insert(schema.price).values({ saleUnitId: w.unit.id, pricePaise: 4800, salePricePaise: 4200 });
  });

  it("only one active default sale unit per product", async () => {
    const w = await makeWorld();
    await expect(testDb().insert(schema.saleUnit).values({ productId: w.product.id, unitBaseQty: 500, minBase: 500, maxBase: 5000, stepBase: 250, isDefault: true })).rejects.toThrow();
  });

  it("hub hours and delivery option numbers are validated", async () => {
    const w = await makeWorld();
    await expect(testDb().update(schema.hub).set({ opensAtMinute: 600, closesAtMinute: 500 }).where(eq(schema.hub.id, w.hub.id))).rejects.toThrow();
    await expect(testDb().update(schema.deliveryOption).set({ feePaise: -1 }).where(eq(schema.deliveryOption.code, "INSTANT"))).rejects.toThrow();
    await expect(testDb().update(schema.deliveryOption).set({ promisedMinutes: 0 }).where(eq(schema.deliveryOption.code, "INSTANT"))).rejects.toThrow();
  });
});

describe("order transitions against the database", () => {
  it("applies a valid transition, records an event and an audit row", async () => {
    const w = await makeWorld();
    const { order } = await makeOrderLine(w);
    const packer = await makeStaff(["PACKER"]);

    await testDb().transaction((tx) => transitionOrder(tx, { orderId: order.id, to: "PACKING", actor: { type: "staff", userId: packer.id, roles: ["PACKER"] } }));
    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, order.id));
    expect(o.status).toBe("PACKING");
    const events = await testDb().select().from(schema.orderEvent).where(eq(schema.orderEvent.orderId, order.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: "CONFIRMED", toStatus: "PACKING", actorType: "staff", actorId: packer.id });
    expect((await testDb().select().from(schema.auditLog)).some((a) => a.action === "order.transition")).toBe(true);
  });

  it("stamps dispatch, delivery and cancellation times", async () => {
    const w = await makeWorld();
    const ops = await makeStaff(["OWNER"]);
    const actor = { type: "staff" as const, userId: ops.id, roles: ["OWNER" as const] };
    const a = await makeOrderLine(w, 1000, { status: "PACKED" });
    await testDb().transaction((tx) => transitionOrder(tx, { orderId: a.order.id, to: "OUT_FOR_DELIVERY", actor }));
    await testDb().transaction((tx) => transitionOrder(tx, { orderId: a.order.id, to: "DELIVERED", actor }));
    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, a.order.id));
    expect(o.dispatchedAt).not.toBeNull();
    expect(o.deliveredAt).not.toBeNull();
  });

  it("refuses invalid and unauthorised transitions without changing anything", async () => {
    const w = await makeWorld();
    const { order } = await makeOrderLine(w);
    const rider = await makeStaff(["RIDER"]);
    const actor = { type: "staff" as const, userId: rider.id, roles: ["RIDER" as const] };

    await expect(testDb().transaction((tx) => transitionOrder(tx, { orderId: order.id, to: "DELIVERED", actor }))).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(testDb().transaction((tx) => transitionOrder(tx, { orderId: order.id, to: "PACKING", actor }))).rejects.toBeInstanceOf(ForbiddenError);
    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, order.id));
    expect(o.status).toBe("CONFIRMED");
    expect(await testDb().select().from(schema.orderEvent)).toHaveLength(0);
  });

  it("two simultaneous transitions: exactly one wins", async () => {
    const w = await makeWorld();
    const { order } = await makeOrderLine(w);
    const owner = await makeStaff(["OWNER"]);
    const actor = { type: "staff" as const, userId: owner.id, roles: ["OWNER" as const] };
    const results = await Promise.allSettled([
      testDb().transaction((tx) => transitionOrder(tx, { orderId: order.id, to: "CANCELLED", actor })),
      testDb().transaction((tx) => transitionOrder(tx, { orderId: order.id, to: "PACKING", actor })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await testDb().select().from(schema.orderEvent).where(eq(schema.orderEvent.orderId, order.id))).toHaveLength(1);
  });

  it("customers can cancel only their own order", async () => {
    const w = await makeWorld();
    const mine = await makeOrderLine(w);
    const other = await makeOrderLine(w);
    await expect(testDb().transaction((tx) => transitionOrder(tx, { orderId: other.order.id, to: "CANCELLED", actor: { type: "customer", customerId: mine.customer.id } }))).rejects.toBeInstanceOf(InvalidTransitionError);
    await testDb().transaction((tx) => transitionOrder(tx, { orderId: mine.order.id, to: "CANCELLED", actor: { type: "customer", customerId: mine.customer.id } }));
    const [o] = await testDb().select().from(schema.order).where(eq(schema.order.id, mine.order.id));
    expect(o.status).toBe("CANCELLED");
    expect(o.cancelledAt).not.toBeNull();
  });
});
