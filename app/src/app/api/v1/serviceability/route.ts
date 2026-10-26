import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { route, throttle } from "@/server/http";
import { checkServiceability } from "@/server/services/serviceability";

const query = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

/**
 * Do we deliver to this point, and which speeds can be ordered right now?
 * The browser sends coordinates only after the customer allowed location access. Nothing is stored.
 */
export const GET = route(async (req) => {
  await throttle(req, "serviceability", 60, 60);
  const { lat, lng } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await checkServiceability(db(), { lat, lng }), { headers: { "Cache-Control": "no-store" } });
});
