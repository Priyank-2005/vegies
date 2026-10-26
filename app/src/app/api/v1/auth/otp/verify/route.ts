import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/server/auth/customer-auth";
import { setCustomerCookie } from "@/server/auth/customer-guards";
import { db } from "@/server/db/client";
import { HttpError, clientIp, route } from "@/server/http";

const body = z.object({ phone: z.string().min(5).max(20), code: z.string().regex(/^\d{6}$/) });

export const POST = route(async (req) => {
  const input = body.parse(await req.json().catch(() => ({})));
  const r = await verifyOtp(db(), { ...input, ip: clientIp(req) });
  if (!r.ok) {
    if (r.reason === "RATE_LIMITED") throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
    if (r.reason === "EXPIRED") throw new HttpError(422, "OTP_EXPIRED", "That code has expired. Ask for a new one.");
    if (r.reason === "INVALID_PHONE") throw new HttpError(422, "INVALID_PHONE", "Enter a valid 10-digit mobile number");
    throw new HttpError(422, "OTP_INVALID", "That code is not correct");
  }
  await setCustomerCookie(r.token, r.expiresAt);
  return NextResponse.json({ ok: true, customer: { name: r.customer.name } }, { headers: { "Cache-Control": "no-store" } });
});
