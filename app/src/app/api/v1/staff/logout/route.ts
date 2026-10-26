import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { currentStaff } from "@/server/auth/guards";
import { revokeSessionByToken } from "@/server/auth/session";
import { route } from "@/server/http";

export const POST = route(async () => {
  const jar = await cookies();
  const name = env().SESSION_COOKIE_NAME;
  const ctx = await currentStaff();
  await revokeSessionByToken(db(), jar.get(name)?.value);
  if (ctx) await audit(db(), { actorType: "staff", actorId: ctx.user.id, action: "staff.logout", entity: "staff_session", entityId: ctx.session.id });
  jar.delete(name);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
