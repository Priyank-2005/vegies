import type { StaffActor } from "../delivery-ops";

export type { StaffActor };

export type AdminErrorCode = "NOT_FOUND" | "WRONG_STATE" | "INVALID" | "CONFLICT" | "OVERPACKED" | "INCOMPLETE" | "NOT_ALLOWED";

/** A business-rule refusal from the admin services. The message is written for the person using the panel. */
export class AdminError extends Error {
  constructor(public readonly code: AdminErrorCode, message: string) {
    super(message);
    this.name = "AdminError";
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** A calendar date as YYYY-MM-DD, validated. */
export function assertDate(s: string, label = "date"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new AdminError("INVALID", `Enter a valid ${label}`);
  return s;
}
