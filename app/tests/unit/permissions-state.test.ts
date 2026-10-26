import { describe, expect, it } from "vitest";
import { ForbiddenError, MFA_ENFORCED, PERMISSIONS, ROLES, assertCan, can, mfaRequired, permissionsFor, refundLimitPaise, rolesRequiringMfa } from "@/server/auth/permissions";
import { ACTIVE_STATUSES, RULES, TERMINAL, InvalidTransitionError, allowedNext, checkTransition } from "@/server/domain/order-state";

describe("RBAC (deny by default)", () => {
  it("OWNER holds every permission", () => {
    for (const p of PERMISSIONS) expect(can(["OWNER"], p)).toBe(true);
  });

  it("only OWNER can manage staff and settings", () => {
    for (const r of ROLES) {
      expect(can([r], "staff.manage")).toBe(r === "OWNER");
      expect(can([r], "settings.write")).toBe(r === "OWNER");
    }
  });

  it("acceptance AC-AUTHZ: a packer cannot refund, adjust stock, or see finance", () => {
    expect(can(["PACKER"], "refund.create")).toBe(false);
    expect(can(["PACKER"], "stock.adjust")).toBe(false);
    expect(can(["PACKER"], "finance.read")).toBe(false);
    expect(() => assertCan(["PACKER"], "refund.create")).toThrow(ForbiddenError);
    expect(can(["PACKER"], "order.pack")).toBe(true);
  });

  it("riders can deliver and record cash but cannot cancel, refund, pack or manage delivery", () => {
    expect(can(["RIDER"], "order.deliver")).toBe(true);
    expect(can(["RIDER"], "payment.record_cash")).toBe(true);
    expect(can(["RIDER"], "order.cancel")).toBe(false);
    expect(can(["RIDER"], "refund.create")).toBe(false);
    expect(can(["RIDER"], "order.pack")).toBe(false);
    expect(can(["RIDER"], "delivery.manage")).toBe(false);
  });

  it("only owner and ops can manage delivery (riders, hours, fees)", () => {
    for (const r of ROLES) expect(can([r], "delivery.manage")).toBe(r === "OWNER" || r === "OPS_MANAGER");
  });

  it("support can create small refunds but not approve them, or change prices", () => {
    expect(can(["SUPPORT"], "refund.create")).toBe(true);
    expect(can(["SUPPORT"], "refund.approve")).toBe(false);
    expect(can(["SUPPORT"], "price.write")).toBe(false);
  });

  it("procurement cannot touch orders' money or staff", () => {
    expect(can(["PROCUREMENT"], "refund.create")).toBe(false);
    expect(can(["PROCUREMENT"], "finance.read")).toBe(false);
    expect(can(["PROCUREMENT"], "purchase.write")).toBe(true);
  });

  it("multiple roles union their permissions; no roles means nothing", () => {
    const both = permissionsFor(["PACKER", "RIDER"]);
    expect(both.has("order.pack") && both.has("order.deliver")).toBe(true);
    expect(permissionsFor([]).size).toBe(0);
  });

  it("two-factor is currently switched off, but the role rules are kept for when it is turned back on", () => {
    expect(MFA_ENFORCED).toBe(false); // founder's decision 2026-10-24: re-enable before real data goes in
    for (const r of ROLES) expect(mfaRequired([r])).toBe(false);
    // the underlying policy: money/ops roles would need it
    expect(rolesRequiringMfa(["OWNER"])).toBe(true);
    expect(rolesRequiringMfa(["OPS_MANAGER"])).toBe(true);
    expect(rolesRequiringMfa(["PROCUREMENT"])).toBe(true);
    expect(rolesRequiringMfa(["PACKER"])).toBe(false);
    expect(rolesRequiringMfa(["RIDER"])).toBe(false);
  });

  it("refund limits step up with seniority", () => {
    expect(refundLimitPaise(["PACKER"])).toBe(0);
    expect(refundLimitPaise(["SUPPORT"])).toBe(30_000);
    expect(refundLimitPaise(["OPS_MANAGER"])).toBe(150_000);
    expect(refundLimitPaise(["OWNER"])).toBeGreaterThan(10 ** 12);
  });
});

describe("order state machine (delivery lifecycle)", () => {
  const packer = { type: "staff" as const, userId: "u1", roles: ["PACKER" as const] };
  const rider = { type: "staff" as const, userId: "u2", roles: ["RIDER" as const] };
  const ops = { type: "staff" as const, userId: "u3", roles: ["OPS_MANAGER" as const] };
  const system = { type: "system" as const };

  it("the happy path is CONFIRMED -> PACKING -> PACKED -> OUT_FOR_DELIVERY -> DELIVERED", () => {
    const path = ["CONFIRMED", "PACKING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(allowedNext(path[i])).toContain(path[i + 1]);
  });

  it("terminal states have no way out", () => {
    for (const t of TERMINAL) expect(allowedNext(t)).toEqual([]);
  });

  it("every status except the terminal ones occupies hub capacity", () => {
    for (const s of ACTIVE_STATUSES) expect(TERMINAL).not.toContain(s);
    expect(ACTIVE_STATUSES).toContain("OUT_FOR_DELIVERY");
    expect(ACTIVE_STATUSES).toContain("DELIVERY_FAILED");
  });

  it("every rule is reachable by at least one kind of actor", () => {
    for (const r of RULES) expect(r.system || r.customer || r.permission).toBeTruthy();
  });

  it("rejects transitions that are not in the table", () => {
    expect(() => checkTransition("CONFIRMED", "DELIVERED", ops)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("DELIVERED", "CONFIRMED", ops)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("PACKED", "PACKING", ops)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("CONFIRMED", "OUT_FOR_DELIVERY", ops)).toThrow(InvalidTransitionError); // must be packed first
  });

  it("payment confirmation is system-only: staff and customers cannot mark an order paid", () => {
    expect(() => checkTransition("PENDING_PAYMENT", "CONFIRMED", system)).not.toThrow();
    expect(() => checkTransition("PENDING_PAYMENT", "CONFIRMED", ops)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("PENDING_PAYMENT", "CONFIRMED", { type: "customer", customerId: "c" }, true)).toThrow(InvalidTransitionError);
  });

  it("a customer may cancel only their own order, and only before packing starts", () => {
    const c = { type: "customer" as const, customerId: "c1" };
    expect(() => checkTransition("CONFIRMED", "CANCELLED", c, true)).not.toThrow();
    expect(() => checkTransition("PENDING_PAYMENT", "CANCELLED", c, true)).not.toThrow();
    expect(() => checkTransition("CONFIRMED", "CANCELLED", c, false)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("PACKING", "CANCELLED", c, true)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("PACKED", "CANCELLED", c, true)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("OUT_FOR_DELIVERY", "CANCELLED", c, true)).toThrow(InvalidTransitionError);
  });

  it("staff need the right permission per step", () => {
    expect(() => checkTransition("CONFIRMED", "PACKING", packer)).not.toThrow();
    expect(() => checkTransition("CONFIRMED", "PACKING", rider)).toThrow(ForbiddenError);
    expect(() => checkTransition("OUT_FOR_DELIVERY", "DELIVERED", rider)).not.toThrow();
    expect(() => checkTransition("OUT_FOR_DELIVERY", "DELIVERED", packer)).toThrow(ForbiddenError);
    expect(() => checkTransition("PACKING", "CANCELLED", packer)).toThrow(ForbiddenError);
    expect(() => checkTransition("PACKED", "OUT_FOR_DELIVERY", rider)).not.toThrow();
  });

  it("a failed delivery can be retried or cancelled, never marked delivered directly", () => {
    expect(allowedNext("DELIVERY_FAILED").sort()).toEqual(["CANCELLED", "OUT_FOR_DELIVERY"]);
  });

  it("the system cannot pack or deliver", () => {
    expect(() => checkTransition("CONFIRMED", "PACKING", system)).toThrow(InvalidTransitionError);
    expect(() => checkTransition("OUT_FOR_DELIVERY", "DELIVERED", system)).toThrow(InvalidTransitionError);
  });
});
