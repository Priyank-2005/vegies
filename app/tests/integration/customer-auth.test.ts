import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/ids";
import { requestOtp, resolveCustomerSession, revokeCustomerSession, verifyOtp } from "@/server/auth/customer-auth";
import { schema } from "@/server/db/client";
import { lastDevOtp } from "@/server/notify/otp-provider";
import { setupCleanDb, testDb } from "../helpers";

setupCleanDb();

const PHONE = "98765 43210";
const E164 = "+919876543210";
const T0 = new Date("2026-10-24T10:00:00Z");
const at = (secs: number) => new Date(T0.getTime() + secs * 1000);

async function otp(now = T0, phone = PHONE, ip = "10.0.0.1") {
  const r = await requestOtp(testDb(), { phone, purpose: "CHECKOUT", ip }, now);
  if (!r.ok) throw new Error(`requestOtp failed: ${r.reason}`);
  return lastDevOtp(r.phone)!;
}

describe("customer phone OTP", () => {
  it("issues a code, verifies it, creates a verified customer and a session whose token is stored hashed", async () => {
    const code = await otp();
    expect(code).toMatch(/^\d{6}$/);
    const v = await verifyOtp(testDb(), { phone: PHONE, code, ip: "10.0.0.1" }, at(20));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.customer.phone).toBe(E164);

    const [c] = await testDb().select().from(schema.customer).where(eq(schema.customer.phone, E164));
    expect(c.phoneVerifiedAt).not.toBeNull();
    const [s] = await testDb().select().from(schema.customerSession);
    expect(s.tokenHash).toBe(sha256Hex(v.token));
    expect(JSON.stringify(s)).not.toContain(v.token);
    expect((await resolveCustomerSession(testDb(), v.token, at(60)))?.id).toBe(c.id);
  });

  it("never stores the code in the clear", async () => {
    const code = await otp();
    const rows = await testDb().select().from(schema.otpChallenge);
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it("a code works once", async () => {
    const code = await otp();
    expect((await verifyOtp(testDb(), { phone: PHONE, code }, at(5))).ok).toBe(true);
    expect(await verifyOtp(testDb(), { phone: PHONE, code }, at(6))).toEqual({ ok: false, reason: "INVALID_CODE" });
  });

  it("wrong codes are refused and the challenge dies after 5 attempts, even for the right code", async () => {
    const code = await otp();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await verifyOtp(testDb(), { phone: PHONE, code: wrong, ip: `10.1.0.${i}` }, at(5))).toEqual({ ok: false, reason: "INVALID_CODE" });
    expect(await verifyOtp(testDb(), { phone: PHONE, code, ip: "10.1.1.1" }, at(6))).toEqual({ ok: false, reason: "INVALID_CODE" });
  });

  it("codes expire after 10 minutes", async () => {
    const code = await otp();
    expect(await verifyOtp(testDb(), { phone: PHONE, code }, at(601))).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("requesting a new code retires the previous one", async () => {
    const first = await otp(T0);
    const second = await otp(at(60));
    if (first !== second) expect(await verifyOtp(testDb(), { phone: PHONE, code: first }, at(70))).toMatchObject({ ok: false });
    expect((await verifyOtp(testDb(), { phone: PHONE, code: second }, at(71))).ok).toBe(true);
  });

  it("enforces a 30-second resend cooldown", async () => {
    await otp(T0);
    const r = await requestOtp(testDb(), { phone: PHONE, purpose: "CHECKOUT", ip: "10.0.0.1" }, at(10));
    expect(r).toMatchObject({ ok: false, reason: "COOLDOWN" });
    expect((await requestOtp(testDb(), { phone: PHONE, purpose: "CHECKOUT", ip: "10.0.0.1" }, at(31))).ok).toBe(true);
  });

  it("limits requests per phone (5/hour) and rejects invalid numbers", async () => {
    for (let i = 0; i < 5; i++) expect((await requestOtp(testDb(), { phone: PHONE, purpose: "CHECKOUT", ip: "10.0.0.2" }, at(i * 40))).ok).toBe(true);
    expect(await requestOtp(testDb(), { phone: PHONE, purpose: "CHECKOUT", ip: "10.0.0.2" }, at(300))).toMatchObject({ ok: false, reason: "RATE_LIMITED" });
    for (const bad of ["12345", "5876543210", "+14155550100", "abcdefghij", ""]) expect(await requestOtp(testDb(), { phone: bad, purpose: "CHECKOUT" }, T0)).toEqual({ ok: false, reason: "INVALID_PHONE" });
  });

  it("limits verification guesses per phone across challenges", async () => {
    await otp();
    let last;
    for (let i = 0; i < 12; i++) last = await verifyOtp(testDb(), { phone: PHONE, code: "123456", ip: `10.2.0.${i}` }, at(5));
    expect(last).toEqual({ ok: false, reason: "RATE_LIMITED" });
  });

  it("two simultaneous correct submissions create only one session", async () => {
    const code = await otp();
    const results = await Promise.all([verifyOtp(testDb(), { phone: PHONE, code }, at(5)), verifyOtp(testDb(), { phone: PHONE, code }, at(5))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await testDb().select().from(schema.customerSession)).toHaveLength(1);
  });

  it("sessions expire and can be revoked; garbage tokens resolve to nothing", async () => {
    const code = await otp();
    const v = await verifyOtp(testDb(), { phone: PHONE, code }, at(5));
    if (!v.ok) throw new Error("verify failed");
    expect(await resolveCustomerSession(testDb(), v.token, at(100))).not.toBeNull();
    expect(await resolveCustomerSession(testDb(), v.token, new Date(T0.getTime() + 31 * 86_400_000))).toBeNull();
    await revokeCustomerSession(testDb(), v.token, at(200));
    expect(await resolveCustomerSession(testDb(), v.token, at(300))).toBeNull();
    expect(await resolveCustomerSession(testDb(), "nonsense")).toBeNull();
    expect(await resolveCustomerSession(testDb(), undefined)).toBeNull();
  });

  it("a returning customer reuses the same record", async () => {
    const a = await verifyOtp(testDb(), { phone: PHONE, code: await otp(T0) }, at(5));
    const b = await verifyOtp(testDb(), { phone: PHONE, code: await otp(at(100)) }, at(105));
    if (!a.ok || !b.ok) throw new Error("verify failed");
    expect(a.customer.id).toBe(b.customer.id);
    expect(await testDb().select().from(schema.customer)).toHaveLength(1);
  });
});
