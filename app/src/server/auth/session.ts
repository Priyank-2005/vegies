import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { env } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/ids";
import { schema, type DbOrTx } from "../db/client";
import type { Role } from "./permissions";

export interface StaffPrincipal {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  totpEnabled: boolean;
  mustChangePassword: boolean;
}

export interface SessionInfo {
  id: string;
  mfaVerifiedAt: Date | null;
  absoluteExpiresAt: Date;
}

const TOUCH_EVERY_MS = 60_000;

export async function createSession(
  db: DbOrTx,
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; mfaVerified: boolean },
  now = new Date(),
): Promise<{ token: string; session: SessionInfo }> {
  const e = env();
  const token = randomToken(32);
  const [row] = await db
    .insert(schema.staffSession)
    .values({
      userId,
      tokenHash: sha256Hex(token),
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: new Date(now.getTime() + e.SESSION_IDLE_MINUTES * 60_000),
      absoluteExpiresAt: new Date(now.getTime() + e.SESSION_ABSOLUTE_HOURS * 3_600_000),
      mfaVerifiedAt: opts.mfaVerified ? now : null,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
    })
    .returning();
  return { token, session: { id: row.id, mfaVerifiedAt: row.mfaVerifiedAt, absoluteExpiresAt: row.absoluteExpiresAt } };
}

/** Look up the session for a raw cookie value. Returns null if unknown, revoked, expired, or the user is inactive. */
export async function resolveSession(
  db: DbOrTx,
  rawToken: string | undefined,
  now = new Date(),
): Promise<{ user: StaffPrincipal; session: SessionInfo } | null> {
  if (!rawToken) return null;
  const rows = await db
    .select({ s: schema.staffSession, u: schema.staffUser })
    .from(schema.staffSession)
    .innerJoin(schema.staffUser, eq(schema.staffUser.id, schema.staffSession.userId))
    .where(eq(schema.staffSession.tokenHash, sha256Hex(rawToken)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { s, u } = row;
  if (s.revokedAt || !u.active) return null;
  if (s.idleExpiresAt <= now || s.absoluteExpiresAt <= now) return null;

  if (now.getTime() - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    const idle = new Date(Math.min(now.getTime() + env().SESSION_IDLE_MINUTES * 60_000, s.absoluteExpiresAt.getTime()));
    await db.update(schema.staffSession).set({ lastSeenAt: now, idleExpiresAt: idle }).where(eq(schema.staffSession.id, s.id));
  }
  return {
    user: { id: u.id, email: u.email, name: u.name, roles: u.roles as Role[], totpEnabled: u.totpEnabled, mustChangePassword: u.mustChangePassword },
    session: { id: s.id, mfaVerifiedAt: s.mfaVerifiedAt, absoluteExpiresAt: s.absoluteExpiresAt },
  };
}

export async function revokeSessionByToken(db: DbOrTx, rawToken: string | undefined, now = new Date()): Promise<void> {
  if (!rawToken) return;
  await db
    .update(schema.staffSession)
    .set({ revokedAt: now })
    .where(and(eq(schema.staffSession.tokenHash, sha256Hex(rawToken)), isNull(schema.staffSession.revokedAt)));
}

export async function revokeAllSessions(db: DbOrTx, userId: string, exceptSessionId?: string, now = new Date()): Promise<void> {
  const conds = [eq(schema.staffSession.userId, userId), isNull(schema.staffSession.revokedAt)];
  if (exceptSessionId) conds.push(ne(schema.staffSession.id, exceptSessionId));
  await db.update(schema.staffSession).set({ revokedAt: now }).where(and(...conds));
}

export async function markSessionMfaVerified(db: DbOrTx, sessionId: string, now = new Date()): Promise<void> {
  await db.update(schema.staffSession).set({ mfaVerifiedAt: now }).where(eq(schema.staffSession.id, sessionId));
}

/** Housekeeping for the nightly job. */
export async function deleteExpiredSessions(db: DbOrTx, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 7 * 86_400_000);
  await db.delete(schema.staffSession).where(lt(schema.staffSession.absoluteExpiresAt, cutoff));
}
