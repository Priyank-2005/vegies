import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireStaff } from "@/server/auth/guards";
import { confirmTotpEnrollment } from "@/server/auth/staff-auth";
import { HttpError, route } from "@/server/http";

const body = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export const POST = route(async (req) => {
  const { user, session } = await requireStaff(undefined, { allowWithoutMfa: true });
  const { code } = body.parse(await req.json().catch(() => ({})));
  const ok = await confirmTotpEnrollment(db(), user.id, session.id, code);
  if (!ok) throw new HttpError(422, "TOTP_INVALID", "That code is not valid. Check the time on your phone and try again.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
