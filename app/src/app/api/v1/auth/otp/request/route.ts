import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/server/auth/customer-auth";
import { db } from "@/server/db/client";
import { HttpError, clientIp, route } from "@/server/http";

const body = z.object({ phone: z.string().min(5).max(20) });

export const POST = route(async (req) => {
  const { phone } = body.parse(await req.json().catch(() => ({})));
  const r = await requestOtp(db(), { phone, purpose: "CHECKOUT", ip: clientIp(req) });
  if (!r.ok) {
    if (r.reason === "INVALID_PHONE") throw new HttpError(422, "INVALID_PHONE", "Enter a valid 10-digit mobile number");
    if (r.reason === "DELIVERY_FAILED") throw new HttpError(503, "OTP_DELIVERY_FAILED", "We could not send the code right now. Please try again shortly.");
    throw new HttpError(429, r.reason, r.reason === "COOLDOWN" ? "Please wait a moment before asking for another code" : "Too many codes requested. Try again later.", { retryAfterSeconds: r.retryAfterSeconds });
  }
  return NextResponse.json({ ok: true, expiresInSeconds: r.expiresInSeconds, ...(r.devCode ? { devCode: r.devCode } : {}) }, { headers: { "Cache-Control": "no-store" } });
});
