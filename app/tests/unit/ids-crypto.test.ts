import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, otpCode, handoverCode, publicOrderCode, safeEqual, sha256Hex } from "@/lib/ids";
import { maskPhone } from "@/lib/logger";
import { currentTotp, newTotpSecret, verifyTotp } from "@/server/auth/totp";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";

const KEY = Buffer.alloc(32, 9).toString("base64");

describe("ids and secrets", () => {
  it("order codes avoid ambiguous characters and are 8 long", () => {
    for (let i = 0; i < 200; i++) expect(publicOrderCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it("handover and OTP codes are zero-padded digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(handoverCode()).toMatch(/^\d{4}$/);
      expect(otpCode()).toMatch(/^\d{6}$/);
    }
  });

  it("encrypts and decrypts; tampering fails; wrong key fails", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc, KEY)).toBe("JBSWY3DPEHPK3PXP");
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join(":"), KEY)).toThrow();
    expect(() => decryptSecret(enc, Buffer.alloc(32, 1).toString("base64"))).toThrow();
    expect(() => encryptSecret("x", Buffer.alloc(8).toString("base64"))).toThrow(/32 bytes/);
  });

  it("hashes and compares in constant-time-friendly ways", () => {
    expect(sha256Hex("a")).toHaveLength(64);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("masks phone numbers for logs", () => {
    expect(maskPhone("+919876543210")).toBe("*********3210");
    expect(maskPhone("12")).toBe("****");
  });
});

describe("passwords", () => {
  it("enforces a minimum policy", () => {
    expect(passwordProblem("short")).toMatch(/at least 12/);
    expect(passwordProblem("aaaaaaaaaaaaaaaa")).toMatch(/repetitive/);
    expect(passwordProblem("correct horse battery")).toBeNull();
  });

  it("hashes with argon2id and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "correct horse battery")).toBe(true);
    expect(await verifyPassword(h, "wrong horse battery")).toBe(false);
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("TOTP", () => {
  const secret = newTotpSecret();
  const t0 = Date.UTC(2026, 9, 24, 12, 0, 0);

  it("accepts the current code and returns its step", () => {
    const step = verifyTotp(secret, currentTotp(secret, t0), null, t0);
    expect(step).toBe(Math.floor(t0 / 30_000));
  });

  it("tolerates one step of clock drift but not more", () => {
    expect(verifyTotp(secret, currentTotp(secret, t0 - 30_000), null, t0)).not.toBeNull();
    expect(verifyTotp(secret, currentTotp(secret, t0 - 90_000), null, t0)).toBeNull();
  });

  it("refuses replay of an already-used step", () => {
    const step = verifyTotp(secret, currentTotp(secret, t0), null, t0)!;
    expect(verifyTotp(secret, currentTotp(secret, t0), step, t0)).toBeNull();
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(secret, "12345", null, t0)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null, t0)).toBeNull();
  });
});
