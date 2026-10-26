/** Geography helpers. Pure and isomorphic (used by server and browser). */

export interface LatLng {
  lat: number;
  lng: number;
}

export function validCoordinates(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (haversine). Accurate to well under 0.5% at city scale. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * A deliberately generous box around Udaipur city and its surroundings. It is only a first sanity gate
 * ("is this even Udaipur?"); the real boundary is each hub's delivery radius. Approximate, not surveyed.
 */
export const UDAIPUR_BOUNDS = { minLat: 24.4, maxLat: 24.8, minLng: 73.5, maxLng: 73.95 } as const;

export function insideUdaipurBounds(p: LatLng): boolean {
  return p.lat >= UDAIPUR_BOUNDS.minLat && p.lat <= UDAIPUR_BOUNDS.maxLat && p.lng >= UDAIPUR_BOUNDS.minLng && p.lng <= UDAIPUR_BOUNDS.maxLng;
}

/** Round a coordinate to `decimals` places (2 decimals is roughly 1 km): used when we store a rough location only. */
export function roundCoord(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}
