/**
 * Role -> permission map. Deny by default: anything not listed here is forbidden.
 * Every privileged server operation must call can()/assertCan() with one of these permissions;
 * hiding a button in the UI is never the control.
 */
export const ROLES = ["OWNER", "OPS_MANAGER", "PROCUREMENT", "PACKER", "RIDER", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "catalog.read",
  "catalog.write",
  "price.write",
  "stock.read",
  "stock.adjust",
  "purchase.write",
  "supplier.write",
  "order.read",
  "order.cancel",
  "order.pack",
  "order.deliver", // dispatch, complete or fail a delivery
  "payment.record_cash",
  "refund.create",
  "refund.approve",
  "delivery.read",
  "delivery.manage", // assign riders, change hub hours, delivery options, radii and capacity
  "customer.read",
  "customer.write",
  "finance.read",
  "report.read",
  "staff.manage",
  "settings.write",
  "audit.read",
  "support.reply",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  OPS_MANAGER: ALL.filter((p) => p !== "staff.manage" && p !== "settings.write"),
  PROCUREMENT: [
    "catalog.read",
    "catalog.write",
    "price.write",
    "stock.read",
    "stock.adjust",
    "purchase.write",
    "supplier.write",
    "order.read",
    "report.read",
  ],
  PACKER: ["catalog.read", "stock.read", "order.read", "order.pack"],
  // Riders only act on orders assigned to them: the service layer enforces that, not just this list.
  RIDER: ["delivery.read", "order.read", "order.deliver", "payment.record_cash"],
  SUPPORT: ["order.read", "order.cancel", "customer.read", "customer.write", "refund.create", "support.reply"],
};

/**
 * Staff two-factor (authenticator app) is switched OFF for now: founder's decision, 2026-10-24.
 * The whole mechanism (enrolment, login check, session gating) is still in the code and tested; flip this to
 * `true` to make it mandatory again for MFA_REQUIRED_ROLES. **Do this before real customer or money data goes in.**
 */
export const MFA_ENFORCED = false;

/** Roles that must use two-factor whenever it is enforced. */
export const MFA_REQUIRED_ROLES: readonly Role[] = ["OWNER", "OPS_MANAGER", "PROCUREMENT"];

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) out.add(p);
  return out;
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(roles: readonly Role[], permission: Permission): void {
  if (!can(roles, permission)) throw new ForbiddenError(permission);
}

/** Would these roles need two-factor if it were enforced? (Pure role logic, independent of the switch.) */
export function rolesRequiringMfa(roles: readonly Role[]): boolean {
  return roles.some((r) => MFA_REQUIRED_ROLES.includes(r));
}

/** Must this user complete two-factor right now? Always false while MFA_ENFORCED is off. */
export function mfaRequired(roles: readonly Role[]): boolean {
  return MFA_ENFORCED && rolesRequiringMfa(roles);
}

/** Largest single refund (paise) a user may create without approval by someone higher. */
export function refundLimitPaise(roles: readonly Role[]): number {
  if (roles.includes("OWNER")) return Number.MAX_SAFE_INTEGER;
  if (roles.includes("OPS_MANAGER")) return 150_000; // Rs 1,500
  if (roles.includes("SUPPORT")) return 30_000; // Rs 300
  return 0;
}
