import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { HttpError, clientIp, route } from "@/server/http";
import { joinWaitlist } from "@/server/services/serviceability";

const body = z.object({
  phone: z.string().min(5).max(20),
  name: z.string().max(80).optional(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional(),
  cityText: z.string().max(80).optional(),
  areaText: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  consent: z.boolean(),
});

export const POST = route(async (req) => {
  const input = body.parse(await req.json().catch(() => ({})));
  const r = await joinWaitlist(db(), { ...input, ip: clientIp(req) });
  if (!r.ok) {
    const map = { INVALID_PHONE: [422, "Enter a valid 10-digit mobile number"], INVALID_PINCODE: [422, "Enter a valid 6-digit pincode"], CONSENT_REQUIRED: [422, "Please tick the box so we may message you"], RATE_LIMITED: [429, "Too many requests. Try again later."] } as const;
    const [status, msg] = map[r.reason];
    throw new HttpError(status, r.reason, msg);
  }
  return NextResponse.json({ ok: true, alreadyRegistered: r.alreadyRegistered });
});
