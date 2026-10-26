import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { db } from "../db/client";
import { HttpError } from "../http";
import { assertCan, mfaRequired, type Permission } from "./permissions";
import { resolveSession, type SessionInfo, type StaffPrincipal } from "./session";

export interface StaffContext {
  user: StaffPrincipal;
  session: SessionInfo;
}

export async function currentStaff(): Promise<StaffContext | null> {
  const jar = await cookies();
  const raw = jar.get(env().SESSION_COOKIE_NAME)?.value;
  return resolveSession(db(), raw);
}

/**
 * Server-side gate for every privileged operation.
 * - 401 if not signed in
 * - 403 MFA_SETUP_REQUIRED if the role requires TOTP and this session has not completed it
 * - 403 if the permission is missing
 * `allowWithoutMfa` is only for the TOTP-enrolment endpoints themselves.
 */
export async function requireStaff(permission?: Permission, opts: { allowWithoutMfa?: boolean } = {}): Promise<StaffContext> {
  const ctx = await currentStaff();
  if (!ctx) throw new HttpError(401, "UNAUTHENTICATED", "Sign in required");
  if (!opts.allowWithoutMfa && mfaRequired(ctx.user.roles) && !ctx.session.mfaVerifiedAt) {
    throw new HttpError(403, "MFA_SETUP_REQUIRED", "Two-factor authentication must be set up first");
  }
  if (permission) assertCan(ctx.user.roles, permission);
  return ctx;
}
