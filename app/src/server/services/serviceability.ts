import { sql } from "drizzle-orm";
import { insideUdaipurBounds, roundCoord, validCoordinates } from "@/lib/geo";
import { normalizeIndianPhone, PINCODE_RE } from "@/lib/phone";
import { schema, type DbOrTx } from "../db/client";
import { rateLimit } from "../security/rate-limit";
import { findServingHub, getDeliveryOptions, hubClock, serviceDateFor, type DeliveryOptionView, type HubInfo } from "./delivery";

export type NotServedReason = "INVALID_LOCATION" | "OUTSIDE_AREA";

export type ServiceabilityResult =
  | { served: false; reason: NotServedReason }
  | {
      served: true;
      hub: { name: string; address: string | null };
      distanceM: number;
      /** True when at least one speed can be ordered right now. */
      orderingOpen: boolean;
      /** If the hub is closed or in its last-order buffer: when it next takes orders. */
      nextOpensAt: string | null;
      serviceDate: string;
      options: DeliveryOptionView[];
    };

/**
 * Can we deliver to this point, and which speeds are available right now?
 * Pure server-side geometry: no external service is involved.
 */
export async function checkServiceability(db: DbOrTx, point: { lat: number; lng: number }, now = new Date()): Promise<ServiceabilityResult> {
  if (!validCoordinates(point.lat, point.lng)) return { served: false, reason: "INVALID_LOCATION" };
  if (!insideUdaipurBounds(point)) return { served: false, reason: "OUTSIDE_AREA" };
  const found = await findServingHub(db, point);
  if (!found) return { served: false, reason: "OUTSIDE_AREA" };
  return describe(db, found.hub, found.distanceM, now);
}

async function describe(db: DbOrTx, hub: HubInfo, distanceM: number, now: Date): Promise<ServiceabilityResult> {
  const options = await getDeliveryOptions(db, hub, distanceM, now);
  const clock = hubClock(hub, now);
  return {
    served: true,
    hub: { name: hub.name, address: hub.address },
    distanceM,
    orderingOpen: options.some((o) => o.status === "AVAILABLE"),
    nextOpensAt: clock.acceptingOrders ? null : clock.nextAcceptingAt.toISOString(),
    serviceDate: serviceDateFor(hub, now),
    options,
  };
}

export type WaitlistResult = { ok: true; alreadyRegistered: boolean } | { ok: false; reason: "INVALID_PHONE" | "INVALID_PINCODE" | "RATE_LIMITED" | "CONSENT_REQUIRED" };

export const WAITLIST_CONSENT_VERSION = "waitlist-2026-10-delivery";

/**
 * Register interest from outside our delivery area (or while no hub is open). Consent is required and recorded.
 * If coordinates are given they are rounded to ~1 km: we only need to know which neighbourhoods are asking.
 */
export async function joinWaitlist(
  db: DbOrTx,
  input: { phone: string; name?: string; pincode?: string; cityText?: string; areaText?: string; lat?: number; lng?: number; consent: boolean; ip?: string | null },
): Promise<WaitlistResult> {
  if (!input.consent) return { ok: false, reason: "CONSENT_REQUIRED" };
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) return { ok: false, reason: "INVALID_PHONE" };
  if (input.pincode && !PINCODE_RE.test(input.pincode)) return { ok: false, reason: "INVALID_PINCODE" };
  const rl = await rateLimit(db, `waitlist:ip:${input.ip ?? "unknown"}`, 10, 3600);
  if (!rl.allowed) return { ok: false, reason: "RATE_LIMITED" };

  const dup = await db.execute<{ id: string }>(sql`select id from waitlist_entry where phone = ${phone} limit 1`);
  if (dup.rows.length > 0) return { ok: true, alreadyRegistered: true };

  const [consent] = await db
    .insert(schema.consent)
    .values({ phone, channel: "WHATSAPP", purpose: "WAITLIST", granted: true, textVersion: WAITLIST_CONSENT_VERSION, source: "waitlist", ip: input.ip ?? null })
    .returning({ id: schema.consent.id });
  const hasPoint = validCoordinates(input.lat, input.lng);
  await db.insert(schema.waitlistEntry).values({
    phone,
    name: input.name?.trim().slice(0, 80) || null,
    pincode: input.pincode ?? null,
    cityText: input.cityText?.trim().slice(0, 80) || null,
    areaText: input.areaText?.trim().slice(0, 120) || null,
    lat: hasPoint ? roundCoord(input.lat!, 2) : null,
    lng: hasPoint ? roundCoord(input.lng!, 2) : null,
    consentId: consent.id,
  });
  return { ok: true, alreadyRegistered: false };
}
