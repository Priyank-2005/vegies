import { NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/guards";
import { permissionsFor } from "@/server/auth/permissions";
import { route } from "@/server/http";

export const GET = route(async () => {
  const { user, session } = await requireStaff(undefined, { allowWithoutMfa: true });
  return NextResponse.json(
    {
      user: { name: user.name, roles: user.roles, totpEnabled: user.totpEnabled },
      mfaVerified: !!session.mfaVerifiedAt,
      permissions: [...permissionsFor(user.roles)].sort(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
