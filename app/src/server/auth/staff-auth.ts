import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/ids";
import { audit } from "../audit";
import { schema, type Db } from "../db/client";
import { rateLimit } from "../security/rate-limit";
import { burnPasswordTime, hashPassword, passwordProblem, verifyPassword } from "./password";
import { mfaRequired, type Role } from "./permissions";
import { createSession, markSessionMfaVerified, revokeAllSessions } from "./session";
import { newTotpSecret, totpUri, verifyTotp } from "./totp";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; mfaSetupRequired: boolean; user: { id: string; name: string; roles: Role[] } }
  | { ok: false; reason: "INVALID" | "LOCKED" | "RATE_LIMITED" | "TOTP_REQUIRED" | "TOTP_INVALID"; retryAfterSeconds?: number };

export interface LoginInput {
  email: string;
  password: string;
  totp?: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function loginStaff(db: Db, input: LoginInput, now = new Date()): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();

  const ipLimit = await rateLimit(db, `login:ip:${input.ip ?? "unknown"}`, 30, 600, now);
  const emailLimit = await rateLimit(db, `login:email:${email}`, 10, 600, now);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    await burnPasswordTime(input.password);
    return { ok: false, reason: "RATE_LIMITED", retryAfterSeconds: Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds) };
  }

  const [user] = await db.select().from(schema.staffUser).where(eq(schema.staffUser.email, email)).limit(1);
  if (!user || !user.active) {
    await burnPasswordTime(input.password);
    return { ok: false, reason: "INVALID" };
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    await burnPasswordTime(input.password);
    return { ok: false, reason: "LOCKED", retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000) };
  }

  const fail = async (reason: "INVALID" | "TOTP_INVALID"): Promise<LoginResult> => {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db
      .update(schema.staffUser)
      .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil })
      .where(eq(schema.staffUser.id, user.id));
    await audit(db, { actorType: "system", action: lock ? "staff.locked" : "staff.login_failed", entity: "staff_user", entityId: user.id, ip: input.ip });
    return { ok: false, reason };
  };

  if (!(await verifyPassword(user.passwordHash, input.password))) return fail("INVALID");

  let totpStep: number | null = null;
  if (user.totpEnabled) {
    if (!input.totp) return { ok: false, reason: "TOTP_REQUIRED" };
    const secret = decryptSecret(user.totpSecretEnc ?? "", env().APP_ENCRYPTION_KEY);
    totpStep = verifyTotp(secret, input.totp.trim(), user.totpLastStep, now.getTime());
    if (totpStep === null) return fail("TOTP_INVALID");
  }

  await db
    .update(schema.staffUser)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: now, ...(totpStep !== null ? { totpLastStep: totpStep } : {}) })
    .where(eq(schema.staffUser.id, user.id));
  const { token, session } = await createSession(db, user.id, { ip: input.ip, userAgent: input.userAgent, mfaVerified: user.totpEnabled }, now);
  await audit(db, { actorType: "staff", actorId: user.id, action: "staff.login", entity: "staff_session", entityId: session.id, ip: input.ip });

  const roles = user.roles as Role[];
  return {
    ok: true,
    token,
    expiresAt: session.absoluteExpiresAt,
    mfaSetupRequired: mfaRequired(roles) && !user.totpEnabled,
    user: { id: user.id, name: user.name, roles },
  };
}

/** Step 1 of enrollment: store a pending (not yet enabled) secret and return what to show the user. */
export async function beginTotpEnrollment(db: Db, userId: string): Promise<{ secret: string; uri: string }> {
  const [user] = await db.select().from(schema.staffUser).where(eq(schema.staffUser.id, userId)).limit(1);
  if (!user) throw new Error("User not found");
  if (user.totpEnabled) throw new Error("TOTP already enabled");
  const secret = newTotpSecret();
  await db.update(schema.staffUser).set({ totpSecretEnc: encryptSecret(secret, env().APP_ENCRYPTION_KEY) }).where(eq(schema.staffUser.id, userId));
  return { secret, uri: totpUri(secret, user.email) };
}

/** Step 2: prove possession by entering a valid code; enables TOTP and unlocks the current session. */
export async function confirmTotpEnrollment(db: Db, userId: string, sessionId: string, code: string, now = new Date()): Promise<boolean> {
  const rl = await rateLimit(db, `totp-enroll:${userId}`, 10, 600, now);
  if (!rl.allowed) return false;
  const [user] = await db.select().from(schema.staffUser).where(eq(schema.staffUser.id, userId)).limit(1);
  if (!user || user.totpEnabled || !user.totpSecretEnc) return false;
  const secret = decryptSecret(user.totpSecretEnc, env().APP_ENCRYPTION_KEY);
  const step = verifyTotp(secret, code.trim(), null, now.getTime());
  if (step === null) return false;
  await db.update(schema.staffUser).set({ totpEnabled: true, totpLastStep: step }).where(eq(schema.staffUser.id, userId));
  await markSessionMfaVerified(db, sessionId, now);
  await audit(db, { actorType: "staff", actorId: userId, action: "staff.totp_enabled", entity: "staff_user", entityId: userId });
  return true;
}

export async function createStaffUser(
  db: Db,
  input: { email: string; name: string; password: string; roles: Role[]; phone?: string; actorId?: string | null },
): Promise<string> {
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  if (input.roles.length === 0) throw new Error("At least one role is required");
  const email = input.email.trim().toLowerCase();
  const [row] = await db
    .insert(schema.staffUser)
    .values({ email, name: input.name.trim(), phone: input.phone ?? null, passwordHash: await hashPassword(input.password), roles: input.roles })
    .returning({ id: schema.staffUser.id });
  await audit(db, { actorType: input.actorId ? "staff" : "system", actorId: input.actorId, action: "staff.create", entity: "staff_user", entityId: row.id, after: { roles: input.roles } });
  return row.id;
}

export async function changePassword(db: Db, userId: string, currentSessionId: string, newPassword: string): Promise<void> {
  const problem = passwordProblem(newPassword);
  if (problem) throw new Error(problem);
  await db
    .update(schema.staffUser)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(schema.staffUser.id, userId));
  await revokeAllSessions(db, userId, currentSessionId);
  await audit(db, { actorType: "staff", actorId: userId, action: "staff.password_changed", entity: "staff_user", entityId: userId });
}
