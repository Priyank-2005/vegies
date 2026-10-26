import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id minimums: m=19 MiB, t=2, p=1.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 12;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > 128) return "Password is too long";
  if (/^(.)\1+$/.test(password)) return "Password is too repetitive";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/** Verify against a fixed hash so "no such user" costs the same as "wrong password". */
export async function burnPasswordTime(password: string): Promise<void> {
  dummy ??= hashPassword("dummy-password-for-timing-equalisation");
  await verifyPassword(await dummy, password);
}
