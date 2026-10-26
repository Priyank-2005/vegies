import pino from "pino";

/** Fields that must never reach logs (PII, secrets, credentials). */
const REDACT = [
  "password",
  "passwordHash",
  "token",
  "code",
  "otp",
  "phone",
  "email",
  "address",
  "totp",
  "totpSecret",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.code",
  "*.otp",
  "*.phone",
  "*.email",
  "*.address",
  "*.totpSecret",
  "req.headers.cookie",
  "req.headers.authorization",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACT, censor: "[redacted]" },
  base: undefined,
});

/** "9876543210" -> "******3210". Use when a log line must reference a customer. */
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? "****" : `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}
