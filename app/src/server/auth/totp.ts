import * as OTPAuth from "otpauth";

import { BRAND } from "@/lib/brand";

const ISSUER = BRAND.totpIssuer;
const PERIOD = 30;

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totp(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function totpUri(secretBase32: string, accountLabel: string): string {
  return totp(secretBase32, accountLabel).toString();
}

/**
 * Returns the accepted 30-second step number, or null. Accepts +-1 step of clock drift and
 * refuses any step <= lastStep so a captured code cannot be replayed.
 */
export function verifyTotp(secretBase32: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = totp(secretBase32, "x").validate({ token: code, timestamp: now, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(now / 1000 / PERIOD) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

export function currentTotp(secretBase32: string, now = Date.now()): string {
  return totp(secretBase32, "x").generate({ timestamp: now });
}
