import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { loginStaff } from "@/server/auth/staff-auth";
import { HttpError, clientIp, route } from "@/server/http";

const body = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(256),
  totp: z.string().trim().regex(/^\d{6}$/).optional(),
});

export const POST = route(async (req) => {
  const input = body.parse(await req.json().catch(() => ({})));
  const result = await loginStaff(db(), {
    ...input,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  if (!result.ok) {
    switch (result.reason) {
      case "TOTP_REQUIRED":
        throw new HttpError(401, "TOTP_REQUIRED", "Enter your 6-digit authenticator code");
      case "TOTP_INVALID":
        throw new HttpError(401, "TOTP_INVALID", "That code is not valid");
      case "LOCKED":
        throw new HttpError(423, "LOCKED", "Too many attempts. Try again later.", { retryAfterSeconds: result.retryAfterSeconds });
      case "RATE_LIMITED":
        throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again later.", { retryAfterSeconds: result.retryAfterSeconds });
      default:
        throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }
  }

  (await cookies()).set(env().SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
  });
  return NextResponse.json({ ok: true, mfaSetupRequired: result.mfaSetupRequired, user: { name: result.user.name, roles: result.user.roles } }, { headers: { "Cache-Control": "no-store" } });
});
