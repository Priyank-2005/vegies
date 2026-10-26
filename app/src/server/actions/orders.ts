"use server";

import { z } from "zod";
import { runAction } from "../admin-action";
import { can } from "../auth/permissions";
import { db } from "../db/client";
import { setStaffNote, startPacking } from "../services/admin/orders";
import { finishPacking, flagAttention, recordPackedLine, resolveAttention, type PackedOutcome } from "../services/admin/packing";
import { markCashDeposited } from "../services/admin/ops";
import { AdminError } from "../services/admin/common";
import { assignRider, cancelOrderByStaff, completeDelivery, dispatchOrder, failDelivery } from "../services/delivery-ops";

const id = z.string().uuid();

export async function startPackingAction(orderId: string) {
  return runAction("order.pack", async ({ actor }) => {
    await startPacking(db(), { orderId: id.parse(orderId), actor });
    return null;
  }, "Packing started");
}

export async function recordPackedAction(input: { orderId: string; lineId: string; packedBase: number }) {
  return runAction<PackedOutcome>("order.pack", async ({ actor }) => {
    const i = z.object({ orderId: id, lineId: id, packedBase: z.number().int().min(0).max(1_000_000) }).parse(input);
    return recordPackedLine(db(), { ...i, actor });
  });
}

export async function finishPackingAction(orderId: string) {
  return runAction("order.pack", async ({ actor }) => {
    const r = await finishPacking(db(), { orderId: id.parse(orderId), actor });
    return { data: r, message: r.refundedPaise > 0 ? "Packed. The customer's amount was reduced for short or missing items." : "Packed and ready for a rider" };
  });
}

export async function flagAttentionAction(input: { orderId: string; note: string }) {
  return runAction("order.pack", async ({ actor }) => {
    const i = z.object({ orderId: id, note: z.string().max(300) }).parse(input);
    await flagAttention(db(), { ...i, actor });
    return null;
  }, "Order put on hold");
}

export async function resolveAttentionAction(input: { orderId: string; note?: string }) {
  return runAction("order.pack", async ({ actor }) => {
    const i = z.object({ orderId: id, note: z.string().max(300).optional() }).parse(input);
    await resolveAttention(db(), { ...i, actor });
    return null;
  }, "Back to packing");
}

export async function assignRiderAction(input: { orderId: string; riderId: string }) {
  return runAction("delivery.manage", async ({ actor }) => {
    const i = z.object({ orderId: id, riderId: id }).parse(input);
    await assignRider(db(), { ...i, actor });
    return null;
  }, "Rider assigned");
}

export async function dispatchAction(orderId: string) {
  return runAction("order.deliver", async ({ actor }) => {
    await dispatchOrder(db(), { orderId: id.parse(orderId), actor });
    return null;
  }, "Out for delivery");
}

const paymentSchema = z.object({ method: z.enum(["CASH", "UPI"]), amountPaise: z.number().int().positive().max(10_000_000), reference: z.string().max(60).optional() });

export async function completeDeliveryAction(input: { orderId: string; code?: string; manualOverride?: boolean; note?: string; partial?: boolean; payment?: { method: "CASH" | "UPI"; amountPaise: number; reference?: string } }) {
  return runAction("order.deliver", async ({ actor }) => {
    const i = z
      .object({ orderId: id, code: z.string().max(8).optional(), manualOverride: z.boolean().optional(), note: z.string().max(300).optional(), partial: z.boolean().optional(), payment: paymentSchema.optional() })
      .parse(input);
    // Delivering without the customer's code is a manager's call, not the rider's.
    if (i.manualOverride && !can(actor.roles, "delivery.manage")) throw new AdminError("NOT_ALLOWED", "Only a manager can complete a delivery without the customer's code");
    await completeDelivery(db(), { ...i, actor });
    return null;
  }, "Delivered");
}

export async function failDeliveryAction(input: { orderId: string; reason: string; customerAtFault?: boolean }) {
  return runAction("order.deliver", async ({ actor }) => {
    const i = z.object({ orderId: id, reason: z.string().max(300), customerAtFault: z.boolean().optional() }).parse(input);
    await failDelivery(db(), { ...i, actor });
    return null;
  }, "Marked as not delivered");
}

export async function cancelOrderAction(input: { orderId: string; reason: string }) {
  return runAction("order.cancel", async ({ actor }) => {
    const i = z.object({ orderId: id, reason: z.string().max(300) }).parse(input);
    await cancelOrderByStaff(db(), { ...i, actor });
    return null;
  }, "Order cancelled and stock released");
}

export async function staffNoteAction(input: { orderId: string; note: string }) {
  return runAction("customer.read", async ({ actor }) => {
    const i = z.object({ orderId: id, note: z.string().max(500) }).parse(input);
    await setStaffNote(db(), { ...i, actor });
    return null;
  }, "Note saved");
}

export async function markCashDepositedAction(riderId: string) {
  return runAction("delivery.manage", async ({ actor }) => {
    const r = await markCashDeposited(db(), { riderId: id.parse(riderId), actor });
    return { data: r, message: `Recorded ₹${(r.amountPaise / 100).toFixed(2)} handed in` };
  });
}
