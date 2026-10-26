import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "@/server/db/client";
import { istInstant } from "@/server/services/delivery";
import { checkServiceability, joinWaitlist, type ServiceabilityResult } from "@/server/services/serviceability";
import { FAR, JAIPUR, MID, NEAR, NOWHERE_IN_UDAIPUR_BOX, makeOrderLine, makeWorld, setupCleanDb, testDb } from "../helpers";

setupCleanDb();

function served(r: ServiceabilityResult) {
  if (!r.served) throw new Error(`expected served, got ${r.reason}`);
  return r;
}
const byCode = (r: ServiceabilityResult) => Object.fromEntries(served(r).options.map((o) => [o.code, o]));

describe("serviceability from the customer's location (acceptance: Udaipur only)", () => {
  it("serves a nearby point with all three speeds, with the fees from the brief", async () => {
    await makeWorld();
    const r = served(await checkServiceability(testDb(), NEAR));
    expect(r.orderingOpen).toBe(true);
    expect(r.options.map((o) => [o.code, o.feePaise, o.status])).toEqual([
      ["INSTANT", 2000, "AVAILABLE"],
      ["ONE_HOUR", 1000, "AVAILABLE"],
      ["THREE_HOUR", 0, "AVAILABLE"],
    ]);
    expect(r.distanceM).toBeGreaterThan(400);
    expect(r.distanceM).toBeLessThan(800);
  });

  it("distance decides which speeds apply: the further you are, the fewer", async () => {
    await makeWorld();
    const mid = byCode(await checkServiceability(testDb(), MID));
    expect(mid.INSTANT.status).toBe("OUT_OF_RANGE");
    expect(mid.ONE_HOUR.status).toBe("AVAILABLE");
    expect(mid.THREE_HOUR.status).toBe("AVAILABLE");
    const far = byCode(await checkServiceability(testDb(), FAR));
    expect(far.INSTANT.status).toBe("OUT_OF_RANGE");
    expect(far.ONE_HOUR.status).toBe("OUT_OF_RANGE");
    expect(far.THREE_HOUR.status).toBe("AVAILABLE");
  });

  it("outside Udaipur, or invalid coordinates, is not served", async () => {
    await makeWorld();
    expect(await checkServiceability(testDb(), JAIPUR)).toEqual({ served: false, reason: "OUTSIDE_AREA" });
    expect(await checkServiceability(testDb(), NOWHERE_IN_UDAIPUR_BOX)).toEqual({ served: false, reason: "OUTSIDE_AREA" }); // inside the box, beyond every radius
    for (const bad of [{ lat: NaN, lng: 73.7 }, { lat: 200, lng: 73.7 }, { lat: 24.6, lng: Infinity }]) {
      expect(await checkServiceability(testDb(), bad)).toEqual({ served: false, reason: "INVALID_LOCATION" });
    }
  });

  it("with no hub configured nothing is served", async () => {
    expect(await checkServiceability(testDb(), NEAR)).toEqual({ served: false, reason: "OUTSIDE_AREA" });
  });

  it("inactive hubs and disabled speeds are not offered", async () => {
    const w = await makeWorld();
    await testDb().update(schema.hubDeliveryOption).set({ enabled: false }).where(eq(schema.hubDeliveryOption.optionCode, "INSTANT"));
    expect(byCode(await checkServiceability(testDb(), NEAR)).INSTANT.status).toBe("DISABLED");
    await testDb().update(schema.deliveryOption).set({ active: false }).where(eq(schema.deliveryOption.code, "ONE_HOUR"));
    expect(byCode(await checkServiceability(testDb(), NEAR)).ONE_HOUR.status).toBe("DISABLED");
    await testDb().update(schema.hub).set({ active: false }).where(eq(schema.hub.id, w.hub.id));
    expect(await checkServiceability(testDb(), NEAR)).toEqual({ served: false, reason: "OUTSIDE_AREA" });
  });

  it("the nearest hub wins when there are two", async () => {
    const a = await makeWorld();
    const b = await makeWorld();
    await testDb().update(schema.hub).set({ lat: 24.6, lng: 73.7125 }).where(eq(schema.hub.id, b.hub.id)); // closer to NEAR than the first hub? (first is ~0.6 km away, second ~1.1 km)
    const r = served(await checkServiceability(testDb(), NEAR));
    expect(r.hub.name).toBe(a.hub.name);
  });
});

describe("opening hours and promised arrival times", () => {
  const OPEN = { opens: 7 * 60, closes: 22 * 60, buffer: 20 };
  const ist = (date: string, hh: number, mm = 0) => istInstant(date, hh * 60 + mm);

  it("every speed is CLOSED outside opening hours, with the next opening time", async () => {
    await makeWorld(OPEN);
    const r = served(await checkServiceability(testDb(), NEAR, ist("2026-10-24", 3)));
    expect(r.orderingOpen).toBe(false);
    expect(r.options.every((o) => o.status === "CLOSED")).toBe(true);
    expect(r.nextOpensAt).toBe(ist("2026-10-24", 7).toISOString());
    // ETAs count from the opening time
    expect(byCode(r).INSTANT.etaAt).toBe(new Date(ist("2026-10-24", 7).getTime() + 25 * 60_000).toISOString());
  });

  it("the promise is 'within 25 / 60 / 180 minutes' from now", async () => {
    await makeWorld(OPEN);
    const now = ist("2026-10-24", 12);
    const o = byCode(await checkServiceability(testDb(), NEAR, now));
    expect(new Date(o.INSTANT.etaAt).getTime() - now.getTime()).toBe(25 * 60_000);
    expect(new Date(o.ONE_HOUR.etaAt).getTime() - now.getTime()).toBe(60 * 60_000);
    expect(new Date(o.THREE_HOUR.etaAt).getTime() - now.getTime()).toBe(180 * 60_000);
  });

  it("a promise is never later than closing time", async () => {
    await makeWorld(OPEN);
    const now = ist("2026-10-24", 21, 10); // still accepting (last order 21:40)
    const o = byCode(await checkServiceability(testDb(), NEAR, now));
    expect(o.THREE_HOUR.status).toBe("AVAILABLE");
    expect(o.THREE_HOUR.etaAt).toBe(ist("2026-10-24", 22).toISOString());
    expect(o.INSTANT.etaAt).toBe(new Date(now.getTime() + 25 * 60_000).toISOString());
  });

  it("the last-order buffer closes ordering before the hub itself closes", async () => {
    await makeWorld(OPEN);
    const r = served(await checkServiceability(testDb(), NEAR, ist("2026-10-24", 21, 45)));
    expect(r.orderingOpen).toBe(false);
    expect(r.nextOpensAt).toBe(ist("2026-10-25", 7).toISOString());
    expect(r.serviceDate).toBe("2026-10-25");
  });
});

describe("capacity: a busy speed shows BUSY, the others stay open", () => {
  it("counts orders in progress per speed and frees them when they finish", async () => {
    const w = await makeWorld({ maxInstant: 2 });
    const a = await makeOrderLine(w, 1000, { option: "INSTANT" });
    await makeOrderLine(w, 1000, { option: "INSTANT", status: "PACKING" });
    await makeOrderLine(w, 1000, { option: "INSTANT", status: "CANCELLED" }); // does not count
    await makeOrderLine(w, 1000, { option: "INSTANT", status: "DELIVERED" }); // does not count
    let o = byCode(await checkServiceability(testDb(), NEAR));
    expect(o.INSTANT).toMatchObject({ status: "BUSY", activeOrders: 2, maxActiveOrders: 2 });
    expect(o.ONE_HOUR.status).toBe("AVAILABLE");
    expect(o.THREE_HOUR.status).toBe("AVAILABLE");

    await testDb().update(schema.order).set({ status: "DELIVERED" }).where(eq(schema.order.id, a.order.id));
    o = byCode(await checkServiceability(testDb(), NEAR));
    expect(o.INSTANT).toMatchObject({ status: "AVAILABLE", activeOrders: 1 });
  });
});

describe("waitlist for places we do not serve yet", () => {
  const base = { phone: "98765 43210", cityText: "Jaipur", consent: true, ip: "10.9.9.9" };

  it("requires consent and a valid phone and pincode", async () => {
    expect(await joinWaitlist(testDb(), { ...base, consent: false })).toEqual({ ok: false, reason: "CONSENT_REQUIRED" });
    expect(await joinWaitlist(testDb(), { ...base, phone: "12345" })).toEqual({ ok: false, reason: "INVALID_PHONE" });
    expect(await joinWaitlist(testDb(), { ...base, pincode: "1234" })).toEqual({ ok: false, reason: "INVALID_PINCODE" });
    expect(await testDb().select().from(schema.waitlistEntry)).toHaveLength(0);
  });

  it("stores a normalised phone, a consent record, and only a rough (~1 km) location", async () => {
    expect(await joinWaitlist(testDb(), { ...base, name: "Asha", lat: JAIPUR.lat, lng: JAIPUR.lng })).toEqual({ ok: true, alreadyRegistered: false });
    expect(await joinWaitlist(testDb(), base)).toEqual({ ok: true, alreadyRegistered: true });
    const rows = await testDb().select().from(schema.waitlistEntry);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phone: "+919876543210", name: "Asha", cityText: "Jaipur", lat: 26.91, lng: 75.79 }); // rounded, not the exact point
    const consents = await testDb().select().from(schema.consent);
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ purpose: "WAITLIST", granted: true });
  });

  it("rate limits abusive submission from one IP", async () => {
    let last;
    for (let i = 0; i < 12; i++) last = await joinWaitlist(testDb(), { ...base, phone: `9876500${String(100 + i)}`, ip: "10.8.8.8" });
    expect(last).toEqual({ ok: false, reason: "RATE_LIMITED" });
  });
});
