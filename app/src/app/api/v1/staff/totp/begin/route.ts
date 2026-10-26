import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/server/db/client";
import { requireStaff } from "@/server/auth/guards";
import { beginTotpEnrollment } from "@/server/auth/staff-auth";
import { HttpError, route } from "@/server/http";

export const POST = route(async () => {
  const { user } = await requireStaff(undefined, { allowWithoutMfa: true });
  if (user.totpEnabled) throw new HttpError(409, "TOTP_ALREADY_ENABLED", "Two-factor authentication is already on");
  const { secret, uri } = await beginTotpEnrollment(db(), user.id);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return NextResponse.json({ secret, qr }, { headers: { "Cache-Control": "no-store" } });
});
