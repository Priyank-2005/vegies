import { NextResponse } from "next/server";
import { z } from "zod";
import { insideUdaipurBounds } from "@/lib/geo";
import { geocoder, geocoderAttribution } from "@/server/geo/geocoder";
import { route, throttle } from "@/server/http";

const query = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

/** Coordinates -> a suggested address line. Best effort: the customer can always edit it. Coordinates are not logged. */
export const GET = route(async (req) => {
  await throttle(req, "geo", 30, 60);
  const { lat, lng } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const result = insideUdaipurBounds({ lat, lng }) ? await geocoder().reverse(lat, lng) : null;
  return NextResponse.json({ result, attribution: geocoderAttribution() }, { headers: { "Cache-Control": "no-store" } });
});
