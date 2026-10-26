import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { insideUdaipurBounds, roundCoord } from "@/lib/geo";
import { TtlCache } from "./cache";
import { GoogleGeocoder, OlaGeocoder } from "./providers";

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Human-readable full address from the provider. */
  displayName: string;
  /** A shorter line suitable for pre-filling the address box (road, area). */
  addressLine: string;
  postcode: string | null;
}

/**
 * Turning coordinates into an address (reverse) and text into coordinates (search).
 * Serviceability never depends on this: it only makes address entry easier. Providers can be swapped
 * without touching the rest of the app.
 */
export interface Geocoder {
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
  search(query: string): Promise<GeocodeResult[]>;
}

const noneGeocoder: Geocoder = {
  async reverse() {
    return null;
  },
  async search() {
    return [];
  },
};

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function fromNominatim(i: NominatimItem): GeocodeResult | null {
  const lat = Number(i.lat);
  const lng = Number(i.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const a = i.address ?? {};
  const parts = [a.house_number, a.road, a.neighbourhood ?? a.suburb ?? a.quarter, a.city_district].filter(Boolean);
  return { lat, lng, displayName: i.display_name, addressLine: (parts.length ? parts.join(", ") : i.display_name.split(",").slice(0, 3).join(",")).slice(0, 160), postcode: a.postcode ?? null };
}

/**
 * Free public OpenStreetMap Nominatim. Development and very low volume ONLY: its usage policy allows about
 * 1 request/second, requires an identifying User-Agent and caching, and is not meant for production traffic.
 * Requests are queued to stay under 1/s, cached for a day, and time out after 4 s.
 * Data (c) OpenStreetMap contributors: the UI shows the attribution next to results.
 */
export class NominatimGeocoder implements Geocoder {
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private reverseCache = new TtlCache<GeocodeResult | null>(86_400_000);
  private searchCache = new TtlCache<GeocodeResult[]>(86_400_000);

  private throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = this.last + 1100 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      return fn();
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(url, { headers: { "User-Agent": env().GEOCODER_USER_AGENT, "Accept-Language": "en,hi" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    return res.json();
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const key = `${roundCoord(lat, 4)},${roundCoord(lng, 4)}`;
    const hit = this.reverseCache.get(key);
    if (hit !== undefined) return hit;
    try {
      const data = (await this.throttled(() => this.get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`))) as NominatimItem & { error?: string };
      const out = data.error ? null : fromNominatim(data);
      this.reverseCache.set(key, out);
      return out;
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "reverse geocode failed");
      return null;
    }
  }

  async search(query: string): Promise<GeocodeResult[]> {
    const q = query.trim().toLowerCase().slice(0, 120);
    if (q.length < 3) return [];
    const hit = this.searchCache.get(q);
    if (hit) return hit;
    try {
      // Bounded to the Udaipur area so results outside the city never appear.
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=in&viewbox=73.5,24.8,73.95,24.4&bounded=1&q=${encodeURIComponent(q)}`;
      const data = (await this.throttled(() => this.get(url))) as NominatimItem[];
      const out = data.map(fromNominatim).filter((r): r is GeocodeResult => !!r && insideUdaipurBounds(r));
      this.searchCache.set(q, out);
      return out;
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "address search failed");
      return [];
    }
  }
}

let instance: Geocoder | undefined;
export function geocoder(): Geocoder {
  if (instance) return instance;
  const e = env();
  if (e.GEOCODER_PROVIDER === "nominatim") instance = new NominatimGeocoder();
  else if (e.GEOCODER_PROVIDER === "ola") instance = new OlaGeocoder(e.OLA_MAPS_API_KEY ?? "");
  else if (e.GEOCODER_PROVIDER === "google") instance = new GoogleGeocoder(e.GOOGLE_MAPS_API_KEY ?? "");
  else instance = noneGeocoder;
  return instance;
}

/** Text the provider's terms require next to its results (shown under the address search). */
export function geocoderAttribution(): string | null {
  const p = env().GEOCODER_PROVIDER;
  if (p === "nominatim") return "© OpenStreetMap contributors";
  // Google asks for its attribution when results are shown outside a Google map. Ola's terms were not checked: confirm before launch.
  if (p === "google") return "Powered by Google";
  return null;
}
