import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ForbiddenError } from "./auth/permissions";

/** An error that maps to a stable machine-readable code and an HTTP status. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

export function problem(status: number, code: string, detail?: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ code, detail, ...extra }, { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" } });
}

/**
 * Reject cross-site state-changing requests. Browsers always send Origin on non-GET fetches/forms,
 * so a missing or mismatching Origin is refused. Combined with SameSite=Lax cookies this is the CSRF control.
 */
export function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const allowed = new URL(env().APP_URL).origin;
  if (!origin || origin !== allowed) throw new HttpError(403, "BAD_ORIGIN", "Cross-origin request refused");
}

export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || null;
}

/** Per-IP throttle for public endpoints. Throws 429 with Retry-After information. */
export async function throttle(req: Request, name: string, limit: number, windowSeconds: number): Promise<void> {
  const { db } = await import("./db/client");
  const { rateLimit } = await import("./security/rate-limit");
  const r = await rateLimit(db(), `${name}:ip:${clientIp(req) ?? "unknown"}`, limit, windowSeconds);
  if (!r.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many requests. Please slow down.", { retryAfterSeconds: r.retryAfterSeconds });
}

type Handler<C> = (req: Request, ctx: C, requestId: string) => Promise<Response> | Response;

/** Wrap a route handler: same-origin check, request id, and uniform error mapping (no stack traces to clients). */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const requestId = randomUUID();
    try {
      assertSameOrigin(req);
      const res = await handler(req, ctx, requestId);
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (err) {
      let res: NextResponse;
      if (err instanceof HttpError) res = problem(err.status, err.code, err.message, err.extra);
      else if (err instanceof ForbiddenError) res = problem(403, "FORBIDDEN", "You do not have permission to do that");
      else if (err instanceof ZodError) res = problem(422, "VALIDATION_FAILED", "Invalid input", { issues: err.issues.map((i) => ({ path: i.path, message: i.message })) });
      else {
        logger.error({ err, requestId, path: new URL(req.url).pathname }, "unhandled error");
        res = problem(500, "INTERNAL_ERROR", "Something went wrong");
      }
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
  };
}
