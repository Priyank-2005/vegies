import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/ids";
import { decryptSecret } from "@/lib/ids";
import { env } from "@/lib/env";
import { beginTotpEnrollment, changePassword, confirmTotpEnrollment, createStaffUser, loginStaff } from "@/server/auth/staff-auth";
import { resolveSession, revokeAllSessions, revokeSessionByToken } from "@/server/auth/session";
import { currentTotp } from "@/server/auth/totp";
import { schema } from "@/server/db/client";
import { rateLimit } from "@/server/security/rate-limit";
import { TEST_PASSWORD, makeStaff, testDb, setupCleanDb } from "../helpers";

setupCleanDb();

const login = (email: string, password: string, extra: { totp?: string; ip?: string } = {}, now?: Date) =>
  loginStaff(testDb(), { email, password, ip: extra.ip ?? "10.0.0.1", userAgent: "vitest", totp: extra.totp }, now);

describe("staff login", () => {
  it("logs in with correct credentials and creates a session whose token is never stored raw", async () => {
    const s = await makeStaff(["PACKER"]);
    const r = await login(s.email, TEST_PASSWORD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mfaSetupRequired).toBe(false); // packers do not need MFA
    const rows = await testDb().select().from(schema.staffSession);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(sha256Hex(r.token));
    expect(JSON.stringify(rows[0])).not.toContain(r.token);

    const who = await resolveSession(testDb(), r.token);
    expect(who?.user.roles).toEqual(["PACKER"]);
  });

  it("is case-insensitive on email and uses the same error for unknown user and wrong password", async () => {
    const s = await makeStaff(["PACKER"], "Packer@Example.test");
    expect((await login("PACKER@example.TEST", TEST_PASSWORD)).ok).toBe(true);
    const wrong = await login(s.email, "wrong password!!");
    const unknown = await login("nobody@example.test", "whatever password");
    expect(wrong).toEqual({ ok: false, reason: "INVALID" });
    expect(unknown).toEqual({ ok: false, reason: "INVALID" });
  });

  it("locks the account after 5 failures, even for the right password, then unlocks after the lock period", async () => {
    const s = await makeStaff(["SUPPORT"]);
    const t0 = new Date("2026-10-24T10:00:00Z");
    for (let i = 0; i < 5; i++) await login(s.email, `bad password ${i}!!`, { ip: `10.0.1.${i}` }, t0);
    const locked = await login(s.email, TEST_PASSWORD, { ip: "10.0.2.1" }, t0);
    expect(locked).toMatchObject({ ok: false, reason: "LOCKED" });

    const later = new Date(t0.getTime() + 16 * 60_000);
    expect((await login(s.email, TEST_PASSWORD, { ip: "10.0.2.2" }, later)).ok).toBe(true);
  });

  it("rate limits by IP and by email before checking passwords", async () => {
    const s = await makeStaff(["SUPPORT"]);
    const t0 = new Date("2026-10-24T10:00:00Z");
    let last;
    for (let i = 0; i < 12; i++) last = await login(s.email, TEST_PASSWORD + "x", { ip: `10.1.0.${i}` }, t0);
    // email bucket (10 / 10 min) trips regardless of IP rotation
    expect(last).toMatchObject({ ok: false, reason: "RATE_LIMITED" });
  });

  it("rejects inactive users", async () => {
    const s = await makeStaff(["PACKER"]);
    await testDb().update(schema.staffUser).set({ active: false }).where(eq(schema.staffUser.id, s.id));
    expect(await login(s.email, TEST_PASSWORD)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("writes audit rows for failures and successes without leaking secrets", async () => {
    const s = await makeStaff(["PACKER"]);
    await login(s.email, "wrong password!!");
    await login(s.email, TEST_PASSWORD);
    const rows = await testDb().select().from(schema.auditLog);
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("staff.login_failed");
    expect(actions).toContain("staff.login");
    expect(JSON.stringify(rows)).not.toContain(TEST_PASSWORD);
  });
});

describe("sessions", () => {
  it("expires on idle and absolute timeouts, and on revoke", async () => {
    const s = await makeStaff(["PACKER"]);
    const t0 = new Date("2026-10-24T10:00:00Z");
    const r = await login(s.email, TEST_PASSWORD, {}, t0);
    if (!r.ok) throw new Error("login failed");

    expect(await resolveSession(testDb(), r.token, new Date(t0.getTime() + 30 * 60_000))).not.toBeNull();
    // idle: 60 min with no activity (the previous resolve touched at +30m only if >60s: it did, so idle runs from +30m)
    expect(await resolveSession(testDb(), r.token, new Date(t0.getTime() + 30 * 60_000 + env().SESSION_IDLE_MINUTES * 60_000 + 1))).toBeNull();

    const r2 = await login(s.email, TEST_PASSWORD, { ip: "10.0.5.5" }, t0);
    if (!r2.ok) throw new Error("login failed");
    // keep it active every 30 min until past the 12h absolute limit
    let t = t0;
    for (let i = 0; i < 24; i++) {
      t = new Date(t.getTime() + 30 * 60_000);
      await resolveSession(testDb(), r2.token, t);
    }
    expect(await resolveSession(testDb(), r2.token, new Date(t0.getTime() + env().SESSION_ABSOLUTE_HOURS * 3_600_000 + 1))).toBeNull();

    const r3 = await login(s.email, TEST_PASSWORD, { ip: "10.0.6.6" });
    if (!r3.ok) throw new Error("login failed");
    await revokeSessionByToken(testDb(), r3.token);
    expect(await resolveSession(testDb(), r3.token)).toBeNull();
  });

  it("unknown or empty tokens resolve to nothing", async () => {
    expect(await resolveSession(testDb(), undefined)).toBeNull();
    expect(await resolveSession(testDb(), "not-a-real-token")).toBeNull();
  });

  it("changing the password signs out every other session", async () => {
    const s = await makeStaff(["PACKER"]);
    const a = await login(s.email, TEST_PASSWORD, { ip: "10.0.7.1" });
    const b = await login(s.email, TEST_PASSWORD, { ip: "10.0.7.2" });
    if (!a.ok || !b.ok) throw new Error("login failed");
    const sessA = await resolveSession(testDb(), a.token);
    await changePassword(testDb(), s.id, sessA!.session.id, "a brand new passphrase");
    expect(await resolveSession(testDb(), a.token)).not.toBeNull();
    expect(await resolveSession(testDb(), b.token)).toBeNull();
    expect((await login(s.email, TEST_PASSWORD, { ip: "10.0.7.3" })).ok).toBe(false);
    expect((await login(s.email, "a brand new passphrase", { ip: "10.0.7.4" })).ok).toBe(true);
    await revokeAllSessions(testDb(), s.id);
  });

  it("refuses weak passwords at account creation", async () => {
    await expect(createStaffUser(testDb(), { email: "x@example.test", name: "X", password: "short", roles: ["PACKER"] })).rejects.toThrow(/at least 12/);
    await expect(createStaffUser(testDb(), { email: "y@example.test", name: "Y", password: TEST_PASSWORD, roles: [] })).rejects.toThrow(/role/);
  });
});

describe("two-factor (TOTP)", () => {
  it("while two-factor is switched off the owner signs in with a password only; voluntary enrolment still works and then later logins need a code", async () => {
    const s = await makeStaff(["OWNER"]);
    const first = await login(s.email, TEST_PASSWORD);
    if (!first.ok) throw new Error("login failed");
    expect(first.mfaSetupRequired).toBe(false); // MFA_ENFORCED is off
    const sess = await resolveSession(testDb(), first.token);
    expect(sess?.session.mfaVerifiedAt).toBeNull();

    const { secret, uri } = await beginTotpEnrollment(testDb(), s.id);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    const [stored] = await testDb().select().from(schema.staffUser).where(eq(schema.staffUser.id, s.id));
    expect(stored.totpSecretEnc).not.toContain(secret); // encrypted at rest
    expect(decryptSecret(stored.totpSecretEnc!, env().APP_ENCRYPTION_KEY)).toBe(secret);

    expect(await confirmTotpEnrollment(testDb(), s.id, sess!.session.id, "000000")).toBe(false);
    expect(await confirmTotpEnrollment(testDb(), s.id, sess!.session.id, currentTotp(secret))).toBe(true);
    expect((await resolveSession(testDb(), first.token))?.session.mfaVerifiedAt).not.toBeNull();

    // next login: password alone is not enough
    const need = await login(s.email, TEST_PASSWORD, { ip: "10.2.0.1" }, new Date(Date.now() + 120_000));
    expect(need).toEqual({ ok: false, reason: "TOTP_REQUIRED" });

    const t = Date.now() + 5 * 60_000; // a later 30-second step than the one used during enrolment
    const good = await login(s.email, TEST_PASSWORD, { totp: currentTotp(secret, t), ip: "10.2.0.2" }, new Date(t));
    expect(good.ok).toBe(true);

    // replaying the same code is refused
    const replay = await login(s.email, TEST_PASSWORD, { totp: currentTotp(secret, t), ip: "10.2.0.3" }, new Date(t));
    expect(replay).toEqual({ ok: false, reason: "TOTP_INVALID" });
  });

  it("a wrong code counts toward lockout", async () => {
    const s = await makeStaff(["OPS_MANAGER"]);
    const first = await login(s.email, TEST_PASSWORD);
    if (!first.ok) throw new Error("login failed");
    const sess = await resolveSession(testDb(), first.token);
    const { secret } = await beginTotpEnrollment(testDb(), s.id);
    await confirmTotpEnrollment(testDb(), s.id, sess!.session.id, currentTotp(secret));

    const t0 = new Date(Date.now() + 10 * 60_000);
    for (let i = 0; i < 5; i++) await login(s.email, TEST_PASSWORD, { totp: "000000", ip: `10.3.0.${i}` }, t0);
    expect(await login(s.email, TEST_PASSWORD, { totp: currentTotp(secret, t0.getTime()), ip: "10.3.1.1" }, t0)).toMatchObject({ ok: false, reason: "LOCKED" });
  });
});

describe("rate limiter", () => {
  it("allows up to the limit within a window and resets in the next", async () => {
    const t0 = new Date("2026-10-24T10:00:05Z");
    const res = [];
    for (let i = 0; i < 4; i++) res.push(await rateLimit(testDb(), "k", 3, 60, t0));
    expect(res.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(res[3].retryAfterSeconds).toBeGreaterThan(0);
    expect((await rateLimit(testDb(), "k", 3, 60, new Date(t0.getTime() + 60_000))).allowed).toBe(true);
    expect((await rateLimit(testDb(), "other", 3, 60, t0)).allowed).toBe(true);
  });

  it("counts correctly under concurrency", async () => {
    const t0 = new Date("2026-10-24T11:00:00Z");
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(testDb(), "burst", 5, 60, t0)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});
