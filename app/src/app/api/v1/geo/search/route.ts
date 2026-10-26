import { NextResponse } from "next/server";
import { z } from "zod";
import { geocoder, geocoderAttribution } from "@/server/geo/geocoder";
import { route, throttle } from "@/server/http";

const query = z.object({ q: z.string().trim().min(3).max(120) });

/** Address text -> candidate places inside the Udaipur area (used when location permission is denied). */
export const GET = route(async (req) => {
  await throttle(req, "geo", 30, 60);
  const { q } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json({ results: await geocoder().search(q), attribution: geocoderAttribution() }, { headers: { "Cache-Control": "no-store" } });
});
