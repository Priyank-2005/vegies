import { and, eq, inArray, sql } from "drizzle-orm";
import { distanceMeters, insideUdaipurBounds, validCoordinates, type LatLng } from "@/lib/geo";
import { schema, type DbOrTx } from "../db/client";
import { ACTIVE_STATUSES } from "../domain/order-state";

export type OptionStatus = "AVAILABLE" | "BUSY" | "CLOSED" | "OUT_OF_RANGE" | "DISABLED";

export interface HubInfo {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  opensAtMinute: number;
  closesAtMinute: number;
  lastOrderBufferMinutes: number;
}

export interface DeliveryOptionView {
  code: string;
  name: string;
  nameHi: string | null;
  feePaise: number;
  promisedMinutes: number;
  minOrderPaise: number;
  /** When the order would arrive if placed now (or when the hub next opens). ISO string. */
  etaAt: string;
  status: OptionStatus;
  radiusM: number;
  activeOrders: number;
  maxActiveOrders: number;
}

// ---- India Standard Time helpers (no daylight saving, always UTC+5:30) ----------------------------

const IST_OFFSET_MIN = 330;

/** Calendar date (YYYY-MM-DD) in India at the given instant. */
export function istDate(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Minutes after midnight in India at the given instant. */
export function istMinuteOfDay(now: Date): number {
  const d = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** The instant at which `minute` (after midnight IST) occurs on India calendar date `date` (YYYY-MM-DD). */
export function istInstant(date: string, minute: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minute) - IST_OFFSET_MIN * 60_000);
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export interface HubClock {
  /** Hub is inside its opening hours right now. */
  open: boolean;
  /** Hub is open and not inside the last-order buffer before closing. */
  acceptingOrders: boolean;
  /** Next moment it accepts orders (now if it already does). */
  nextAcceptingAt: Date;
  /** Closing time of the current or next opening period. */
  closesAt: Date;
}

export function hubClock(hub: Pick<HubInfo, "opensAtMinute" | "closesAtMinute" | "lastOrderBufferMinutes">, now: Date): HubClock {
  const today = istDate(now);
  const minute = istMinuteOfDay(now);
  const lastOrder = hub.closesAtMinute - hub.lastOrderBufferMinutes;
  const open = minute >= hub.opensAtMinute && minute < hub.closesAtMinute;
  const acceptingOrders = minute >= hub.opensAtMinute && minute < lastOrder;
  if (acceptingOrders) return { open, acceptingOrders, nextAcceptingAt: now, closesAt: istInstant(today, hub.closesAtMinute) };
  // Before opening: opens today. After the last order: opens tomorrow.
  const openDate = minute < hub.opensAtMinute ? today : addDays(today, 1);
  return { open, acceptingOrders, nextAcceptingAt: istInstant(openDate, hub.opensAtMinute), closesAt: istInstant(openDate, hub.closesAtMinute) };
}

/**
 * The date whose stock customers are shopping from: today while the hub can still take orders,
 * otherwise the next opening day (so browsing at night shows tomorrow's availability).
 */
export function serviceDateFor(hub: Pick<HubInfo, "opensAtMinute" | "closesAtMinute" | "lastOrderBufferMinutes">, now: Date): string {
  const clock = hubClock(hub, now);
  return istDate(clock.nextAcceptingAt);
}

// ---- Hub lookup ------------------------------------------------------------------------------------

function toHubInfo(h: typeof schema.hub.$inferSelect): HubInfo {
  return { id: h.id, slug: h.slug, name: h.name, address: h.address, lat: h.lat, lng: h.lng, opensAtMinute: h.opensAtMinute, closesAtMinute: h.closesAtMinute, lastOrderBufferMinutes: h.lastOrderBufferMinutes };
}

/** The hub used for browsing (and the only hub today): the first active one. */
export async function primaryHub(db: DbOrTx): Promise<HubInfo | null> {
  const [h] = await db.select().from(schema.hub).where(eq(schema.hub.active, true)).orderBy(schema.hub.createdAt).limit(1);
  return h ? toHubInfo(h) : null;
}

export async function getHub(db: DbOrTx, hubId: string): Promise<HubInfo | null> {
  const [h] = await db.select().from(schema.hub).where(eq(schema.hub.id, hubId)).limit(1);
  return h ? toHubInfo(h) : null;
}

/** The nearest active hub whose largest enabled delivery radius covers the point, or null. */
export async function findServingHub(db: DbOrTx, point: LatLng): Promise<{ hub: HubInfo; distanceM: number } | null> {
  if (!validCoordinates(point.lat, point.lng) || !insideUdaipurBounds(point)) return null;
  const rows = await db
    .select({ hub: schema.hub, radius: sql<number>`max(${schema.hubDeliveryOption.radiusM})` })
    .from(schema.hub)
    .innerJoin(schema.hubDeliveryOption, and(eq(schema.hubDeliveryOption.hubId, schema.hub.id), eq(schema.hubDeliveryOption.enabled, true)))
    .innerJoin(schema.deliveryOption, and(eq(schema.deliveryOption.code, schema.hubDeliveryOption.optionCode), eq(schema.deliveryOption.active, true)))
    .where(eq(schema.hub.active, true))
    .groupBy(schema.hub.id);
  let best: { hub: HubInfo; distanceM: number } | null = null;
  for (const r of rows) {
    const d = distanceMeters(point, { lat: r.hub.lat, lng: r.hub.lng });
    if (d <= Number(r.radius) && (!best || d < best.distanceM)) best = { hub: toHubInfo(r.hub), distanceM: d };
  }
  return best;
}

/** Orders currently occupying capacity, per delivery option, at a hub. */
export async function activeOrderCounts(db: DbOrTx, hubId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ code: schema.order.deliveryOption, n: sql<number>`count(*)::int` })
    .from(schema.order)
    .where(and(eq(schema.order.hubId, hubId), inArray(schema.order.status, [...ACTIVE_STATUSES])))
    .groupBy(schema.order.deliveryOption);
  return new Map(rows.map((r) => [r.code, Number(r.n)]));
}

/** Every delivery speed for a customer at `distanceM` from the hub, with whether it can be ordered right now. */
export async function getDeliveryOptions(db: DbOrTx, hub: HubInfo, distanceM: number, now = new Date()): Promise<DeliveryOptionView[]> {
  const rows = await db
    .select({ o: schema.deliveryOption, h: schema.hubDeliveryOption })
    .from(schema.deliveryOption)
    .innerJoin(schema.hubDeliveryOption, and(eq(schema.hubDeliveryOption.optionCode, schema.deliveryOption.code), eq(schema.hubDeliveryOption.hubId, hub.id)))
    .orderBy(schema.deliveryOption.sortOrder);
  const counts = await activeOrderCounts(db, hub.id);
  const clock = hubClock(hub, now);

  return rows.map(({ o, h }) => {
    const activeOrders = counts.get(o.code) ?? 0;
    let status: OptionStatus;
    if (!o.active || !h.enabled) status = "DISABLED";
    else if (distanceM > h.radiusM) status = "OUT_OF_RANGE";
    else if (!clock.acceptingOrders) status = "CLOSED";
    else if (activeOrders >= h.maxActiveOrders) status = "BUSY";
    else status = "AVAILABLE";

    // Promise: placed now -> now + promised minutes, but never later than closing time; if closed, from the next opening.
    const base = clock.nextAcceptingAt;
    const raw = new Date(base.getTime() + o.promisedMinutes * 60_000);
    const eta = clock.acceptingOrders && raw > clock.closesAt ? clock.closesAt : raw;
    return {
      code: o.code,
      name: o.name,
      nameHi: o.nameHi,
      feePaise: o.feePaise,
      promisedMinutes: o.promisedMinutes,
      minOrderPaise: o.minOrderPaise,
      etaAt: eta.toISOString(),
      status,
      radiusM: h.radiusM,
      activeOrders,
      maxActiveOrders: h.maxActiveOrders,
    };
  });
}
