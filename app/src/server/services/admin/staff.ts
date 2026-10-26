import { randomInt } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { audit } from "../../audit";
import { assertCan, ROLES, type Role } from "../../auth/permissions";
import { hashPassword, passwordProblem, verifyPassword } from "../../auth/password";
import { revokeAllSessions } from "../../auth/session";
import { createStaffUser } from "../../auth/staff-auth";
import { schema, type Db, type DbOrTx } from "../../db/client";
import { AdminError, type StaffActor } from "./common";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: Role[];
  active: boolean;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}

export async function listStaff(db: DbOrTx): Promise<StaffRow[]> {
  const rows = await db.select().from(schema.staffUser).orderBy(sql`${schema.staffUser.active} desc`, asc(schema.staffUser.name));
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, roles: r.roles as Role[], active: r.active, lastLoginAt: r.lastLoginAt, mustChangePassword: r.mustChangePassword }));
}

// No look-alike characters (0/O, 1/l/I) so a password read out over the phone is not misheard.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generatePassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

const validRoles = (roles: Role[]) => roles.length > 0 && roles.every((r) => (ROLES as readonly string[]).includes(r));

/** Add a staff member. Returns a one-time password that they must change at first sign-in. */
export async function createStaff(db: Db, args: { name: string; email: string; phone?: string; roles: Role[]; actor: StaffActor }): Promise<{ id: string; password: string }> {
  assertCan(args.actor.roles, "staff.manage");
  if (!args.name.trim()) throw new AdminError("INVALID", "Enter a name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email.trim())) throw new AdminError("INVALID", "Enter a valid email address");
  if (!validRoles(args.roles)) throw new AdminError("INVALID", "Choose at least one role");
  const [dup] = await db.select({ id: schema.staffUser.id }).from(schema.staffUser).where(eq(schema.staffUser.email, args.email.trim().toLowerCase())).limit(1);
  if (dup) throw new AdminError("CONFLICT", "Someone with that email already exists");
  const password = generatePassword();
  const id = await createStaffUser(db, { email: args.email, name: args.name, password, roles: args.roles, phone: args.phone?.trim() || undefined, actorId: args.actor.userId });
  await db.update(schema.staffUser).set({ mustChangePassword: true }).where(eq(schema.staffUser.id, id));
  return { id, password };
}

async function otherActiveOwners(tx: DbOrTx, exceptId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.staffUser)
    .where(and(ne(schema.staffUser.id, exceptId), eq(schema.staffUser.active, true), sql`'OWNER' = any(${schema.staffUser.roles})`));
  return r?.n ?? 0;
}

/** Change a person's roles or switch them off. The last active owner can never be removed or locked out. */
export async function updateStaff(db: Db, args: { id: string; name?: string; phone?: string | null; roles?: Role[]; active?: boolean; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "staff.manage");
  if (args.roles && !validRoles(args.roles)) throw new AdminError("INVALID", "Choose at least one role");
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(schema.staffUser).where(eq(schema.staffUser.id, args.id)).for("update").limit(1);
    if (!u) throw new AdminError("NOT_FOUND", "Staff member not found");
    const newRoles = args.roles ?? (u.roles as Role[]);
    const newActive = args.active ?? u.active;
    const wasOwner = u.active && u.roles.includes("OWNER");
    const stillOwner = newActive && newRoles.includes("OWNER");
    if (wasOwner && !stillOwner && (await otherActiveOwners(tx, u.id)) === 0) throw new AdminError("NOT_ALLOWED", "There must always be at least one active owner");
    if (args.id === args.actor.userId && !newActive) throw new AdminError("NOT_ALLOWED", "You cannot switch yourself off");
    await tx
      .update(schema.staffUser)
      .set({ name: args.name?.trim() || u.name, phone: args.phone === undefined ? u.phone : args.phone?.trim() || null, roles: newRoles, active: newActive })
      .where(eq(schema.staffUser.id, u.id));
    if (!newActive) await revokeAllSessions(tx, u.id);
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "staff.update", entity: "staff_user", entityId: u.id, before: { roles: u.roles, active: u.active }, after: { roles: newRoles, active: newActive } });
  });
}

/** Give someone a new one-time password (forgotten password, lost phone). Signs them out everywhere. */
export async function resetStaffPassword(db: Db, args: { id: string; actor: StaffActor }): Promise<{ password: string }> {
  assertCan(args.actor.roles, "staff.manage");
  const password = generatePassword();
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const res = await tx
      .update(schema.staffUser)
      .set({ passwordHash: hash, mustChangePassword: true, failedLogins: 0, lockedUntil: null })
      .where(eq(schema.staffUser.id, args.id))
      .returning({ id: schema.staffUser.id });
    if (res.length === 0) throw new AdminError("NOT_FOUND", "Staff member not found");
    await revokeAllSessions(tx, args.id);
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "staff.password_reset", entity: "staff_user", entityId: args.id });
  });
  return { password };
}

/** A signed-in person changes their own password (and is signed out of their other sessions). */
export async function changeOwnPassword(db: Db, args: { userId: string; sessionId: string; current: string; next: string }): Promise<void> {
  const [u] = await db.select().from(schema.staffUser).where(eq(schema.staffUser.id, args.userId)).limit(1);
  if (!u || !(await verifyPassword(u.passwordHash, args.current))) throw new AdminError("INVALID", "The current password is not correct");
  const problem = passwordProblem(args.next);
  if (problem) throw new AdminError("INVALID", problem);
  if (args.next === args.current) throw new AdminError("INVALID", "Choose a different password");
  await db.transaction(async (tx) => {
    await tx.update(schema.staffUser).set({ passwordHash: await hashPassword(args.next), mustChangePassword: false }).where(eq(schema.staffUser.id, u.id));
    await revokeAllSessions(tx, u.id, args.sessionId);
    await audit(tx, { actorType: "staff", actorId: u.id, action: "staff.password_changed", entity: "staff_user", entityId: u.id });
  });
}
