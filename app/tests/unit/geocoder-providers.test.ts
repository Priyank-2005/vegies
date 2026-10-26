import { describe, expect, it, vi } from "vitest";
import { GoogleGeocoder, OlaGeocoder, parseGoogleStyle, scoped } from "@/server/geo/providers";

// The Google shape below follows Google's published documentation. The Ola shape is ASSUMED (see OlaGeocoder) and must be
// replaced by a recorded real response once an Ola key exists.
const googleOk = {
  status: "OK",
  results: [
    {
      formatted_address: "12, Hiran Magri Road, Sector 4, Udaipur, Rajasthan 313002, India",
      geometry: { location: { lat: 24.5854, lng: 73.7125 }, location_type: "ROOFTOP" },
      address_components: [
        { long_name: "12", types: ["street_number"] },
        { long_name: "Hiran Magri Road", types: ["route"] },
        { long_name: "Sector 4", types: ["sublocality_level_1", "sublocality"] },
        { long_name: "313002", types: ["postal_code"] },
      ],
    },
    { formatted_address: "Hiran Magri, Jaipur, Rajasthan, India", geometry: { location: { lat: 26.9124, lng: 75.7873 } } },
  ],
};

function fakeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn<(url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>>(async () => ({ ok, status, json: async () => body }));
}

describe("parseGoogleStyle", () => {
  it("builds a short address line from the parts and keeps the postcode", () => {
    const [r] = parseGoogleStyle(googleOk, ["results"]);
    expect(r).toMatchObject({ lat: 24.5854, lng: 73.7125, addressLine: "12, Hiran Magri Road, Sector 4", postcode: "313002" });
    expect(r.displayName).toContain("Udaipur");
  });

  it("falls back to the first parts of the full address, and skips entries without usable coordinates", () => {
    const out = parseGoogleStyle({ results: [{ formatted_address: "Near Fateh Sagar, Udaipur, Rajasthan, India", geometry: { location: { lat: 24.6, lng: 73.68 } } }, { formatted_address: "x", geometry: {} }, { geometry: { location: { lat: 1, lng: 2 } } }, { formatted_address: "y", geometry: { location: { lat: "a", lng: 2 } } }] }, ["results"]);
    expect(out).toHaveLength(1);
    expect(out[0].addressLine).toBe("Near Fateh Sagar, Udaipur, Rajasthan");
    expect(parseGoogleStyle(null, ["results"])).toEqual([]);
    expect(parseGoogleStyle({ results: "nope" }, ["results"])).toEqual([]);
  });

  it("accepts either list name", () => {
    expect(parseGoogleStyle({ geocodingResults: googleOk.results }, ["geocodingResults", "results"])).toHaveLength(2);
  });
});

describe("Google geocoder", () => {
  it("asks for Udaipur, India, with a bias box and the key, and drops results outside Udaipur", async () => {
    const f = fakeFetch(googleOk);
    const g = new GoogleGeocoder("test-key-12345", f);
    const res = await g.search("12 Hiran Magri Road sector 4");
    expect(res).toHaveLength(1); // the Jaipur result is removed
    const url = new URL(f.mock.calls[0][0]);
    expect(url.hostname).toBe("maps.googleapis.com");
    expect(url.searchParams.get("address")).toBe("12 hiran magri road sector 4, Udaipur, Rajasthan");
    expect(url.searchParams.get("components")).toBe("country:IN");
    expect(url.searchParams.get("bounds")).toBe("24.4,73.5|24.8,73.95");
    expect(url.searchParams.get("key")).toBe("test-key-12345");
  });

  it("caches repeated searches and ignores too-short ones without calling the provider", async () => {
    const f = fakeFetch(googleOk);
    const g = new GoogleGeocoder("test-key-12345", f);
    await g.search("Hiran Magri");
    await g.search("  HIRAN MAGRI ");
    expect(f).toHaveBeenCalledTimes(1);
    expect(await g.search("ab")).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns nothing, not an error, when the provider refuses or fails, and never leaks the key", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });
    try {
      expect(await new GoogleGeocoder("secret-key-abcdef", fakeFetch({ status: "REQUEST_DENIED", error_message: "bad key" })).search("anything here")).toEqual([]);
      expect(await new GoogleGeocoder("secret-key-abcdef", fakeFetch({}, false, 500)).search("another thing")).toEqual([]);
      expect(await new GoogleGeocoder("secret-key-abcdef", vi.fn(async () => { throw new Error("network down"); })).search("third thing")).toEqual([]);
      expect(await new GoogleGeocoder("secret-key-abcdef", fakeFetch({ status: "ZERO_RESULTS", results: [] })).search("nowhere at all")).toEqual([]);
    } finally {
      spy.mockRestore();
    }
    expect(logs.join("")).not.toContain("secret-key-abcdef");
  });

  it("reverse geocoding takes the first result and caches by rounded position", async () => {
    const f = fakeFetch(googleOk);
    const g = new GoogleGeocoder("test-key-12345", f);
    const r = await g.reverse(24.58541, 73.71249);
    expect(r?.addressLine).toContain("Hiran Magri Road");
    expect(new URL(f.mock.calls[0][0]).searchParams.get("latlng")).toBe("24.58541,73.71249");
    await g.reverse(24.585412, 73.712488); // same spot at 4 decimals
    expect(f).toHaveBeenCalledTimes(1);
    expect(await new GoogleGeocoder("test-key-12345", fakeFetch({ status: "ZERO_RESULTS", results: [] })).reverse(24.5, 73.7)).toBeNull();
  });
});

describe("Ola geocoder (assumed response shape)", () => {
  it("parses a Google-style answer and scopes the search to Udaipur", async () => {
    const f = fakeFetch({ status: "ok", geocodingResults: googleOk.results });
    const o = new OlaGeocoder("test-key-12345", f);
    const res = await o.search("Hiran Magri");
    expect(res).toHaveLength(1);
    const url = new URL(f.mock.calls[0][0]);
    expect(url.hostname).toBe("api.olamaps.io");
    expect(url.searchParams.get("address")).toBe("hiran magri, Udaipur, Rajasthan");
    expect(url.searchParams.get("api_key")).toBe("test-key-12345");
  });

  it("an answer in a shape we do not recognise gives no results instead of crashing", async () => {
    expect(await new OlaGeocoder("test-key-12345", fakeFetch({ something: "else" })).search("Hiran Magri")).toEqual([]);
    expect(await new OlaGeocoder("test-key-12345", fakeFetch({}, false, 401)).reverse(24.58, 73.71)).toBeNull();
  });
});

describe("scoped", () => {
  it("adds Udaipur unless the customer already typed it", () => {
    expect(scoped("sector 4")).toBe("sector 4, Udaipur, Rajasthan");
    expect(scoped("City Palace, Udaipur")).toBe("City Palace, Udaipur");
    expect(scoped("udaypur station")).toBe("udaypur station");
  });
});
