import { createHash, createCipheriv, createDecipheriv, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Crockford-style base32 without I, L, O, U: unambiguous when read aloud or hand-written. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Customer-facing order code, e.g. "K7M2QD4H". ~40 bits; uniqueness is enforced by a DB constraint. */
export function publicOrderCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** 4-digit delivery code: the customer tells it to the rider, who enters it to complete the delivery. */
export function handoverCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export function otpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// AES-256-GCM helpers for small secrets at rest (TOTP seeds). Key = 32 bytes, base64.
function key(base64Key: string): Buffer {
  const k = Buffer.from(base64Key, "base64");
  if (k.length !== 32) throw new Error("APP_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return k;
}

export function encryptSecret(plain: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(base64Key), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(payload: string, base64Key: string): string {
  const [v, iv, tag, enc] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Unsupported secret format");
  const d = createDecipheriv("aes-256-gcm", key(base64Key), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}
