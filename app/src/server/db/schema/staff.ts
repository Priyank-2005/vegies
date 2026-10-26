import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, ts, updatedAt } from "./_common";

export const staffRole = pgEnum("staff_role", [
  "OWNER",
  "OPS_MANAGER",
  "PROCUREMENT",
  "PACKER",
  "RIDER",
  "SUPPORT",
]);

export const staffUser = pgTable(
  "staff_user",
  {
    id: id(),
    email: text("email").notNull(), // stored lower-cased
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    roles: staffRole("roles").array().notNull(),
    totpSecretEnc: text("totp_secret_enc"), // AES-256-GCM, see lib/ids.ts
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    totpLastStep: integer("totp_last_step"), // replay protection: last accepted 30s step
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    active: boolean("active").notNull().default(true),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("staff_user_email_uq").on(t.email)],
);

export const staffSession = pgTable(
  "staff_session",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUser.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // sha256 of the cookie value; the raw token is never stored
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    mfaVerifiedAt: ts("mfa_verified_at"),
    revokedAt: ts("revoked_at"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("staff_session_token_uq").on(t.tokenHash), index("staff_session_user_idx").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorType: text("actor_type").notNull(), // 'staff' | 'customer' | 'system'
    actorId: uuid("actor_id"),
    action: text("action").notNull(), // e.g. 'price.update'
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),
    ip: inet("ip"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entity, t.entityId),
    index("audit_actor_idx").on(t.actorId, t.createdAt),
    index("audit_created_idx").on(t.createdAt),
  ],
);

/** Fixed-window counters; `key` encodes scope + subject, e.g. "login:ip:1.2.3.4". */
export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] })],
);

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});

export const featureFlag = pgTable("feature_flag", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  note: text("note"),
  updatedAt: updatedAt(),
});

// Transactional outbox: written in the same transaction as the state change, drained by the worker.
export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: ts("processed_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("outbox_pending_idx").on(t.availableAt).where(sql`${t.processedAt} is null`)],
);
