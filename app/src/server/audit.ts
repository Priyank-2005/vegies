import { schema, type DbOrTx } from "./db/client";

export interface AuditEntry {
  actorType: "staff" | "customer" | "system";
  actorId?: string | null;
  action: string; // e.g. "price.update", "staff.login"
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string;
  ip?: string | null;
  requestId?: string | null;
}

/** Write inside the same transaction as the change being audited, so both commit or neither does. */
export async function audit(db: DbOrTx, e: AuditEntry): Promise<void> {
  await db.insert(schema.auditLog).values({
    actorType: e.actorType,
    actorId: e.actorId ?? null,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    before: e.before === undefined ? null : e.before,
    after: e.after === undefined ? null : e.after,
    note: e.note ?? null,
    ip: e.ip ?? null,
    requestId: e.requestId ?? null,
  });
}
