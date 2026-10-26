import { logger } from "@/lib/logger";
import { insideUdaipurBounds, roundCoord, UDAIPUR_BOUNDS } from "@/lib/geo";
import { TtlCache } from "./cache";
import type { GeocodeResult, Geocoder } from "./geocoder";

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface Component {
  long_name?: string;
  short_name?: string;
  types?: string[];
}
interface GoogleStyleResult {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: Component[];
}

const comp = (r: GoogleStyleResult, type: string): string | undefined => r.address_components?.find((c) => c.types?.includes(type))?.long_name;

/** Shared by both providers: both answer in the Google "results[].geometry.location" style. */
export function parseGoogleStyle(data: unknown, resultKeys: string[]): GeocodeResult[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const key = resultKeys.find((k) => Array.isArray(d[k]));
  const list = (key ? d[key] : []) as GoogleStyleResult[];
  const out: GeocodeResult[] = [];
  for (const r of list) {
    const lat = r.geometry?.location?.lat;
    const lng = r.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const full = (r.formatted_address ?? "").trim();
    if (!full) continue;
    const parts = [comp(r, "street_number"), comp(r, "route"), comp(r, "sublocality_level_1") ?? comp(r, "sublocality") ?? comp(r, "neighborhood")].filter(Boolean);
    out.push({ lat, lng, displayName: full, addressLine: (parts.length >= 2 ? parts.join(", ") : full.split(",").slice(0, 3).join(",").trim()).slice(0, 160), postcode: comp(r, "postal_code") ?? null });
  }
  return out;
}

/** Common behaviour: caching, a 4-second timeout, results kept inside the Udaipur area, and no key ever written to a log. */
abstract class HttpGeocoder implements Geocoder {
  private searchCache = new TtlCache<GeocodeResult[]>(86_400_000);
  private reverseCache = new TtlCache<GeocodeResult | null>(86_400_000);

  constructor(protected readonly fetchFn: FetchLike = fetch as unknown as FetchLike) {}

  protected abstract readonly name: string;
  protected abstract searchUrl(query: string): string;
  protected abstract reverseUrl(lat: number, lng: number): string;
  protected abstract parseSearch(data: unknown): GeocodeResult[];
  protected abstract parseReverse(data: unknown): GeocodeResult | null;

  protected async getJson(url: string): Promise<unknown> {
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`${this.name} answered ${res.status}`); // never include the URL: it carries the key
    return res.json();
  }

  async search(query: string): Promise<GeocodeResult[]> {
    const q = query.trim().toLowerCase().slice(0, 120);
    if (q.length < 3) return [];
    const hit = this.searchCache.get(q);
    if (hit) return hit;
    try {
      const out = this.parseSearch(await this.getJson(this.searchUrl(q))).filter(insideUdaipurBounds).slice(0, 5);
      this.searchCache.set(q, out);
      return out;
    } catch (e) {
      logger.warn({ provider: this.name, err: (e as Error).message }, "address search failed");
      return [];
    }
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const key = `${roundCoord(lat, 4)},${roundCoord(lng, 4)}`;
    const hit = this.reverseCache.get(key);
    if (hit !== undefined) return hit;
    try {
      const out = this.parseReverse(await this.getJson(this.reverseUrl(lat, lng)));
      this.reverseCache.set(key, out);
      return out;
    } catch (e) {
      logger.warn({ provider: this.name, err: (e as Error).message }, "reverse geocode failed");
      return null;
    }
  }
}

/** We only deliver in Udaipur, so say so to the provider unless the customer already did. */
export const scoped = (q: string): string => (/udaipur|udaypur/i.test(q) ? q : `${q}, Udaipur, Rajasthan`);

const BOUNDS = `${UDAIPUR_BOUNDS.minLat},${UDAIPUR_BOUNDS.minLng}|${UDAIPUR_BOUNDS.maxLat},${UDAIPUR_BOUNDS.maxLng}`;

/**
 * Google Geocoding API. The request and response format follows Google's published documentation (results[].formatted_address,
 * geometry.location, address_components, a `status` field). Prices and the monthly free allowance are in M4_PLAN.md.
 */
export class GoogleGeocoder extends HttpGeocoder {
  protected readonly name = "google";
  constructor(private readonly key: string, fetchFn?: FetchLike) {
    super(fetchFn);
  }
  protected searchUrl(q: string): string {
    // `bounds` only biases the answer toward Udaipur; results outside it are removed afterwards.
    return `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(scoped(q))}&components=country:IN&region=in&language=en&bounds=${encodeURIComponent(BOUNDS)}&key=${encodeURIComponent(this.key)}`;
  }
  protected reverseUrl(lat: number, lng: number): string {
    return `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${encodeURIComponent(this.key)}`;
  }
  private checked(data: unknown): unknown {
    const status = (data as { status?: string } | null)?.status;
    if (status === "OK" || status === "ZERO_RESULTS") return data;
    throw new Error(`google status ${status ?? "missing"}`);
  }
  protected parseSearch(data: unknown): GeocodeResult[] {
    return parseGoogleStyle(this.checked(data), ["results"]);
  }
  protected parseReverse(data: unknown): GeocodeResult | null {
    return parseGoogleStyle(this.checked(data), ["results"])[0] ?? null;
  }
}

/**
 * Ola Maps (Krutrim). **The request and response shapes below are ASSUMED to follow the Google style and are NOT yet verified**:
 * Ola's reference pages could not be read when this was written, and no key has been tried. The parser accepts either a `results`
 * or a `geocodingResults` list. Before relying on it, run `npm run geocoder:compare -- <file> --raw` with a real key and compare
 * the raw answer with what is parsed here; fix this class if they differ. Until then do not choose "ola" for production.
 */
export class OlaGeocoder extends HttpGeocoder {
  protected readonly name = "ola";
  constructor(private readonly key: string, fetchFn?: FetchLike) {
    super(fetchFn);
  }
  protected searchUrl(q: string): string {
    return `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(scoped(q))}&api_key=${encodeURIComponent(this.key)}`;
  }
  protected reverseUrl(lat: number, lng: number): string {
    return `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${encodeURIComponent(this.key)}`;
  }
  protected parseSearch(data: unknown): GeocodeResult[] {
    return parseGoogleStyle(data, ["geocodingResults", "results"]);
  }
  protected parseReverse(data: unknown): GeocodeResult | null {
    return parseGoogleStyle(data, ["results", "geocodingResults"])[0] ?? null;
  }
}
