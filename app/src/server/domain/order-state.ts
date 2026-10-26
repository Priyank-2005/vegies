import { and, eq } from "drizzle-orm";
import { audit } from "../audit";
import { assertCan, can, type Permission, type Role } from "../auth/permissions";
import { schema, type DbOrTx } from "../db/client";

export type OrderStatus = (typeof schema.orderStatus.enumValues)[number];

/** Who is asking for a transition. */
export type Actor =
  | { type: "system" }
  | { type: "customer"; customerId: string }
  | { type: "staff"; userId: string; roles: Role[] };

interface Rule {
  from: OrderStatus;
  to: OrderStatus;
  /** System (jobs/webhooks) may do it. */
  system?: boolean;
  /** The order's own customer may do it. */
  customer?: boolean;
  /** Staff need this permission. */
  permission?: Permission;
}

// The single source of truth for the order lifecycle (see ARCHITECTURE.md).
//   PENDING_PAYMENT -> CONFIRMED -> PACKING -> PACKED -> OUT_FOR_DELIVERY -> DELIVERED
export const RULES: readonly Rule[] = [
  { from: "PENDING_PAYMENT", to: "CONFIRMED", system: true },
  { from: "PENDING_PAYMENT", to: "EXPIRED", system: true },
  { from: "PENDING_PAYMENT", to: "CANCELLED", customer: true, permission: "order.cancel" },
  { from: "CONFIRMED", to: "PACKING", permission: "order.pack" },
  { from: "CONFIRMED", to: "CANCELLED", customer: true, permission: "order.cancel" },
  { from: "PACKING", to: "PACKED", permission: "order.pack" },
  { from: "PACKING", to: "ATTENTION", permission: "order.pack" },
  { from: "PACKING", to: "CANCELLED", permission: "order.cancel" },
  { from: "ATTENTION", to: "PACKING", permission: "order.pack" },
  { from: "ATTENTION", to: "CANCELLED", permission: "order.cancel" },
  { from: "PACKED", to: "OUT_FOR_DELIVERY", permission: "order.deliver" },
  { from: "PACKED", to: "CANCELLED", permission: "order.cancel" },
  { from: "OUT_FOR_DELIVERY", to: "DELIVERED", permission: "order.deliver" },
  { from: "OUT_FOR_DELIVERY", to: "DELIVERY_FAILED", permission: "order.deliver" },
  { from: "DELIVERY_FAILED", to: "OUT_FOR_DELIVERY", permission: "order.deliver" },
  { from: "DELIVERY_FAILED", to: "CANCELLED", permission: "order.cancel" },
];

export const TERMINAL: readonly OrderStatus[] = ["DELIVERED", "CANCELLED", "EXPIRED"];

/** Statuses that occupy hub capacity (the order is promised and not yet finished). */
export const ACTIVE_STATUSES: readonly OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"];

export class InvalidTransitionError extends Error {
  constructor(public readonly from: OrderStatus, public readonly to: OrderStatus, why: string) {
    super(`Cannot move order from ${from} to ${to}: ${why}`);
    this.name = "InvalidTransitionError";
  }
}

export function allowedNext(from: OrderStatus): OrderStatus[] {
  return RULES.filter((r) => r.from === from).map((r) => r.to);
}

/** Pure check; throws InvalidTransitionError (shape) or ForbiddenError (permission). */
export function checkTransition(from: OrderStatus, to: OrderStatus, actor: Actor, isOwnOrder = false): void {
  const rule = RULES.find((r) => r.from === from && r.to === to);
  if (!rule) throw new InvalidTransitionError(from, to, "no such transition");
  if (actor.type === "system") {
    if (!rule.system) throw new InvalidTransitionError(from, to, "not allowed for the system");
    return;
  }
  if (actor.type === "customer") {
    if (!rule.customer || !isOwnOrder) throw new InvalidTransitionError(from, to, "not allowed for customers");
    return;
  }
  if (!rule.permission) throw new InvalidTransitionError(from, to, "staff cannot perform this transition");
  assertCan(actor.roles, rule.permission);
}

export function staffCanDo(roles: Role[], from: OrderStatus, to: OrderStatus): boolean {
  const rule = RULES.find((r) => r.from === from && r.to === to);
  return !!rule?.permission && can(roles, rule.permission);
}

/**
 * Move an order to a new status. Compare-and-set on the current status makes the transition
 * safe against two staff/webhooks acting at once: the loser gets InvalidTransitionError.
 */
export async function transitionOrder(
  tx: DbOrTx,
  args: { orderId: string; to: OrderStatus; actor: Actor; note?: string },
): Promise<{ from: OrderStatus; to: OrderStatus }> {
  const [o] = await tx
    .select({ status: schema.order.status, customerId: schema.order.customerId })
    .from(schema.order)
    .where(eq(schema.order.id, args.orderId))
    .limit(1);
  if (!o) throw new InvalidTransitionError("CANCELLED", args.to, "order not found");

  const isOwn = args.actor.type === "customer" && args.actor.customerId === o.customerId;
  checkTransition(o.status, args.to, args.actor, isOwn);

  const now = new Date();
  const updated = await tx
    .update(schema.order)
    .set({
      status: args.to,
      ...(args.to === "CANCELLED" ? { cancelledAt: now } : {}),
      ...(args.to === "OUT_FOR_DELIVERY" ? { dispatchedAt: now } : {}),
      ...(args.to === "DELIVERED" ? { deliveredAt: now } : {}),
    })
    .where(and(eq(schema.order.id, args.orderId), eq(schema.order.status, o.status)))
    .returning({ id: schema.order.id });
  if (updated.length === 0) throw new InvalidTransitionError(o.status, args.to, "order changed concurrently");

  const actorId = args.actor.type === "staff" ? args.actor.userId : args.actor.type === "customer" ? args.actor.customerId : null;
  await tx.insert(schema.orderEvent).values({
    orderId: args.orderId,
    fromStatus: o.status,
    toStatus: args.to,
    actorType: args.actor.type,
    actorId,
    note: args.note ?? null,
  });
  await audit(tx, {
    actorType: args.actor.type,
    actorId,
    action: "order.transition",
    entity: "order",
    entityId: args.orderId,
    before: { status: o.status },
    after: { status: args.to },
    note: args.note,
  });
  return { from: o.status, to: args.to };
}
