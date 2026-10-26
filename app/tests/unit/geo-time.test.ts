import { describe, expect, it } from "vitest";
import { UDAIPUR_BOUNDS, distanceMeters, formatDistance, insideUdaipurBounds, roundCoord, validCoordinates } from "@/lib/geo";
import { hubClock, istDate, istInstant, istMinuteOfDay, serviceDateFor } from "@/server/services/delivery";
import { normalizeIndianPhone } from "@/lib/phone";

describe("geography", () => {
  const hub = { lat: 24.5854, lng: 73.7125 };

  it("computes great-circle distance (0.005 degrees of latitude is about 556 m)", () => {
    const d = distanceMeters(hub, { lat: 24.5904, lng: 73.7125 });
    expect(d).toBeGreaterThan(540);
    expect(d).toBeLessThan(570);
    expect(distanceMeters(hub, hub)).toBe(0);
  });

  it("is symmetric and handles longitude distances", () => {
    const a = { lat: 24.6, lng: 73.7 };
    const b = { lat: 24.55, lng: 73.75 };
    expect(distanceMeters(a, b)).toBe(distanceMeters(b, a));
    // Udaipur to Jaipur is roughly 330-345 km
    const km = distanceMeters(hub, { lat: 26.9124, lng: 75.7873 }) / 1000;
    expect(km).toBeGreaterThan(300);
    expect(km).toBeLessThan(380);
  });

  it("validates coordinates and the Udaipur sanity box", () => {
    expect(validCoordinates(24.58, 73.71)).toBe(true);
    for (const [a, b] of [[NaN, 1], [91, 0], [0, 181], ["24", "73"], [undefined, undefined], [Infinity, 0]] as unknown[][]) expect(validCoordinates(a, b)).toBe(false);
    expect(insideUdaipurBounds(hub)).toBe(true);
    expect(insideUdaipurBounds({ lat: 26.9124, lng: 75.7873 })).toBe(false); // Jaipur
    expect(insideUdaipurBounds({ lat: UDAIPUR_BOUNDS.maxLat + 0.01, lng: 73.7 })).toBe(false);
  });

  it("rounds coordinates and formats distances", () => {
    expect(roundCoord(24.58539, 2)).toBe(24.59);
    expect(roundCoord(73.71251, 4)).toBe(73.7125);
    expect(formatDistance(640)).toBe("640 m");
    expect(formatDistance(2450)).toBe("2.5 km");
  });
});

describe("India time and hub opening hours", () => {
  const hours = { opensAtMinute: 7 * 60, closesAtMinute: 22 * 60, lastOrderBufferMinutes: 20 };
  const ist = (date: string, hh: number, mm = 0) => istInstant(date, hh * 60 + mm);

  it("converts between UTC instants and IST dates/minutes (UTC+5:30, no DST)", () => {
    expect(istDate(new Date("2026-10-24T18:00:00Z"))).toBe("2026-10-24"); // 23:30 IST
    expect(istMinuteOfDay(new Date("2026-10-24T18:00:00Z"))).toBe(23 * 60 + 30);
    expect(istDate(new Date("2026-10-24T19:00:00Z"))).toBe("2026-10-25"); // 00:30 IST next day
    expect(istMinuteOfDay(new Date("2026-10-24T19:00:00Z"))).toBe(30);
    expect(istInstant("2026-10-25", 7 * 60).toISOString()).toBe("2026-10-25T01:30:00.000Z");
    expect(istMinuteOfDay(istInstant("2026-10-25", 13 * 60 + 5))).toBe(13 * 60 + 5);
  });

  it("accepts orders during opening hours except in the last-order buffer", () => {
    const noon = hubClock(hours, ist("2026-10-24", 12));
    expect(noon).toMatchObject({ open: true, acceptingOrders: true });
    expect(noon.closesAt.toISOString()).toBe(ist("2026-10-24", 22).toISOString());

    const buffer = hubClock(hours, ist("2026-10-24", 21, 45));
    expect(buffer).toMatchObject({ open: true, acceptingOrders: false });
    expect(buffer.nextAcceptingAt.toISOString()).toBe(ist("2026-10-25", 7).toISOString());

    expect(hubClock(hours, ist("2026-10-24", 21, 39)).acceptingOrders).toBe(true);
    expect(hubClock(hours, ist("2026-10-24", 21, 40)).acceptingOrders).toBe(false);
  });

  it("before opening it opens today; after closing it opens tomorrow", () => {
    const early = hubClock(hours, ist("2026-10-24", 5, 30));
    expect(early).toMatchObject({ open: false, acceptingOrders: false });
    expect(early.nextAcceptingAt.toISOString()).toBe(ist("2026-10-24", 7).toISOString());
    const late = hubClock(hours, ist("2026-10-24", 23));
    expect(late.nextAcceptingAt.toISOString()).toBe(ist("2026-10-25", 7).toISOString());
  });

  it("shop stock date: today while taking orders, otherwise the next opening day", () => {
    expect(serviceDateFor(hours, ist("2026-10-24", 10))).toBe("2026-10-24");
    expect(serviceDateFor(hours, ist("2026-10-24", 6))).toBe("2026-10-24");
    expect(serviceDateFor(hours, ist("2026-10-24", 22, 30))).toBe("2026-10-25");
    expect(serviceDateFor(hours, ist("2026-10-24", 21, 50))).toBe("2026-10-25");
  });

  it("an all-day hub (0-1440, no buffer) is always accepting", () => {
    const allDay = { opensAtMinute: 0, closesAtMinute: 1440, lastOrderBufferMinutes: 0 };
    for (const h of [0, 3, 12, 23]) expect(hubClock(allDay, ist("2026-10-24", h)).acceptingOrders).toBe(true);
  });
});

describe("phone numbers", () => {
  it("normalises Indian mobiles and rejects the rest", () => {
    expect(normalizeIndianPhone("98765 43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("+919876543210");
    for (const bad of ["12345", "5876543210", "+14155550100", "abcdefghij", ""]) expect(normalizeIndianPhone(bad)).toBeNull();
  });
});
