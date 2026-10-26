import { createHmac } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { otpCode, randomToken, safeEqual, sha256Hex } from "@/lib/ids";
import { normalizeIndianPhone } from "@/lib/phone";
import { echoDevCode, otpProvider } from "../notify/otp-provider";
import { rateLimit } from "../security/rate-limit";
import { schema, type Db, type DbOrTx } from "../db/client";

export type OtpPurpose = "CHECKOUT" | "TRACK";

const OTP_TTL_MS = 10 * 60_000;
const COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 5;
export const CUSTOMER_SESSION_DAYS = 30;

function hashCode(phone: string, code: string): string {
  return createHmac("sha256", Buffer.from(env().APP_ENCRYPTION_KEY, "base64")).update(`${phone}:${code}`).digest("hex");
}

export type RequestOtpResult =
  | { ok: true; phone: string; expiresInSeconds: number; devCode?: string }
  | { ok: false; reason: "INVALID_PHONE" | "RATE_LIMITED" | "COOLDOWN" | "DELIVERY_FAILED"; retryAfterSeconds?: number };

export async function requestOtp(db: Db, input: { phone: string; purpose: OtpPurpose; ip?: string | null }, now = new Date()): Promise<RequestOtpResult> {
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) return { ok: false, reason: "INVALID_PHONE" };

  const byPhone = await rateLimit(db, `otp:phone:${phone}`, 5, 3600, now);
  const byIp = await rateLimit(db, `otp:ip:${input.ip ?? "unknown"}`, 30, 3600, now);
  if (!byPhone.allowed || !byIp.allowed) {
    return { ok: false, reason: "RATE_LIMITED", retryAfterSeconds: Math.max(byPhone.retryAfterSeconds, byIp.retryAfterSeconds) };
  }

  const [latest] = await db
    .select({ createdAt: schema.otpChallenge.createdAt })
    .from(schema.otpChallenge)
    .where(eq(schema.otpChallenge.phone, phone))
    .orderBy(desc(schema.otpChallenge.createdAt))
    .limit(1);
  if (latest && now.getTime() - latest.createdAt.getTime() < COOLDOWN_MS) {
    return { ok: false, reason: "COOLDOWN", retryAfterSeconds: Math.ceil((COOLDOWN_MS - (now.getTime() - latest.createdAt.getTime())) / 1000) };
  }

  const code = otpCode();
  // Only one live code per phone: retire earlier ones.
  await db
    .update(schema.otpChallenge)
    .set({ consumedAt: now })
    .where(and(eq(schema.otpChallenge.phone, phone), isNull(schema.otpChallenge.consumedAt)));
  await db.insert(schema.otpChallenge).values({
    phone,
    purpose: input.purpose,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    ip: input.ip ?? null,
    createdAt: now,
  });
  try {
    await otpProvider().send(phone, code);
  } catch {
    return { ok: false, reason: "DELIVERY_FAILED" };
  }
  return { ok: true, phone, expiresInSeconds: OTP_TTL_MS / 1000, ...(echoDevCode() ? { devCode: code } : {}) };
}

export type VerifyOtpResult =
  | { ok: true; token: string; expiresAt: Date; customer: { id: string; phone: string; name: string | null } }
  | { ok: false; reason: "INVALID_PHONE" | "INVALID_CODE" | "EXPIRED" | "RATE_LIMITED" };

export async function verifyOtp(db: Db, input: { phone: string; code: string; ip?: string | null }, now = new Date()): Promise<VerifyOtpResult> {
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) return { ok: false, reason: "INVALID_PHONE" };
  if (!/^\d{6}$/.test(input.code)) return { ok: false, reason: "INVALID_CODE" };

  const a = await rateLimit(db, `otp-verify:phone:${phone}`, 10, 600, now);
  const b = await rateLimit(db, `otp-verify:ip:${input.ip ?? "unknown"}`, 40, 600, now);
  if (!a.allowed || !b.allowed) return { ok: false, reason: "RATE_LIMITED" };

  const [ch] = await db
    .select()
    .from(schema.otpChallenge)
    .where(and(eq(schema.otpChallenge.phone, phone), isNull(schema.otpChallenge.consumedAt)))
    .orderBy(desc(schema.otpChallenge.createdAt))
    .limit(1);
  if (!ch) return { ok: false, reason: "INVALID_CODE" };
  if (ch.expiresAt <= now) return { ok: false, reason: "EXPIRED" };
  if (ch.attempts >= MAX_ATTEMPTS) {
    await db.update(schema.otpChallenge).set({ consumedAt: now }).where(eq(schema.otpChallenge.id, ch.id));
    return { ok: false, reason: "INVALID_CODE" };
  }
  if (!safeEqual(ch.codeHash, hashCode(phone, input.code))) {
    await db
      .update(schema.otpChallenge)
      .set({ attempts: ch.attempts + 1 })
      .where(eq(schema.otpChallenge.id, ch.id));
    return { ok: false, reason: "INVALID_CODE" };
  }

  // Consume atomically: of two simultaneous correct submissions only one gets the row.
  const consumed = await db
    .update(schema.otpChallenge)
    .set({ consumedAt: now })
    .where(and(eq(schema.otpChallenge.id, ch.id), isNull(schema.otpChallenge.consumedAt)))
    .returning({ id: schema.otpChallenge.id });
  if (consumed.length === 0) return { ok: false, reason: "INVALID_CODE" };

  const [cust] = await db
    .insert(schema.customer)
    .values({ phone, phoneVerifiedAt: now })
    .onConflictDoUpdate({ target: schema.customer.phone, set: { phoneVerifiedAt: now } })
    .returning();
  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_DAYS * 86_400_000);
  await db.insert(schema.customerSession).values({ customerId: cust.id, tokenHash: sha256Hex(token), expiresAt, ip: input.ip ?? null, createdAt: now });
  return { ok: true, token, expiresAt, customer: { id: cust.id, phone: cust.phone, name: cust.name } };
}

export interface CustomerPrincipal {
  id: string;
  phone: string;
  name: string | null;
  blocked: boolean;
  noShowCount: number;
}

export async function resolveCustomerSession(db: DbOrTx, rawToken: string | undefined, now = new Date()): Promise<CustomerPrincipal | null> {
  if (!rawToken) return null;
  const rows = await db
    .select({ c: schema.customer })
    .from(schema.customerSession)
    .innerJoin(schema.customer, eq(schema.customer.id, schema.customerSession.customerId))
    .where(and(eq(schema.customerSession.tokenHash, sha256Hex(rawToken)), isNull(schema.customerSession.revokedAt), gt(schema.customerSession.expiresAt, now)))
    .limit(1);
  const c = rows[0]?.c;
  return c ? { id: c.id, phone: c.phone, name: c.name, blocked: c.blocked, noShowCount: c.noShowCount } : null;
}

export async function revokeCustomerSession(db: DbOrTx, rawToken: string | undefined, now = new Date()): Promise<void> {
  if (!rawToken) return;
  await db.update(schema.customerSession).set({ revokedAt: now }).where(eq(schema.customerSession.tokenHash, sha256Hex(rawToken)));
}
