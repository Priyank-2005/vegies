import { sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in Postgres (fine at this scale; swap for an edge limiter later).
 * `key` encodes scope + subject, e.g. "login:ip:1.2.3.4". Always counts the attempt.
 */
export async function rateLimit(
  db: DbOrTx,
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit (key, window_start, count) VALUES (${key}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit.count + 1
    RETURNING count`);
  const count = Number(res.rows[0].count);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed: count <= limit, count, limit, retryAfterSeconds };
}

/** Current count in this window WITHOUT counting a new attempt (used when only some failures should count). */
export async function rateLimitPeek(db: DbOrTx, key: string, windowSeconds: number, now = new Date()): Promise<number> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const res = await db.execute<{ count: number }>(sql`SELECT count FROM rate_limit WHERE key = ${key} AND window_start = ${windowStart.toISOString()}`);
  return res.rows.length ? Number(res.rows[0].count) : 0;
}

/** Housekeeping: drop windows older than a day. Called by the nightly job. */
export async function pruneRateLimits(db: DbOrTx, olderThanHours = 24): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limit WHERE window_start < now() - make_interval(hours => ${olderThanHours})`);
}
