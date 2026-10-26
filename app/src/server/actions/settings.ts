"use server";

import { z } from "zod";
import { runAction } from "../admin-action";
import { currentStaff } from "../auth/guards";
import { ROLES } from "../auth/permissions";
import { db } from "../db/client";
import { AdminError } from "../services/admin/common";
import { updateBusinessSettings, updateDeliveryOption, updateHub } from "../services/admin/settings";
import { changeOwnPassword, createStaff, resetStaffPassword, updateStaff } from "../services/admin/staff";

const id = z.string().uuid();
const roles = z.array(z.enum(ROLES)).min(1);

export async function updateHubAction(input: unknown) {
  return runAction("delivery.manage", async ({ actor }) => {
    const hub = z
      .object({
        id,
        name: z.string().max(120),
        nameHi: z.string().max(120).nullable(),
        address: z.string().max(300).nullable(),
        lat: z.number(),
        lng: z.number(),
        opensAtMinute: z.number().int(),
        closesAtMinute: z.number().int(),
        lastOrderBufferMinutes: z.number().int(),
        active: z.boolean(),
      })
      .parse(input);
    await updateHub(db(), { hub, actor });
    return null;
  }, "Store details saved");
}

export async function updateOptionAction(input: unknown) {
  return runAction("delivery.manage", async ({ actor }) => {
    const i = z
      .object({
        hubId: id,
        option: z.object({
          code: z.string().max(30),
          name: z.string().max(60),
          nameHi: z.string().max(60).nullable(),
          feePaise: z.number().int(),
          promisedMinutes: z.number().int(),
          minOrderPaise: z.number().int(),
          active: z.boolean(),
          enabled: z.boolean(),
          radiusM: z.number().int(),
          maxActiveOrders: z.number().int(),
        }),
      })
      .parse(input);
    await updateDeliveryOption(db(), { ...i, actor });
    return null;
  }, "Delivery speed saved");
}

export async function updateBusinessAction(input: unknown) {
  return runAction("settings.write", async ({ actor }) => {
    const patch = z
      .object({ minOrderPaise: z.number().int().optional(), holdMinutes: z.number().int().optional(), payOnDeliveryCapPaise: z.number().int().optional(), maxFailedDeliveriesForCod: z.number().int().optional() })
      .parse(input);
    await updateBusinessSettings(db(), { patch, actor });
    return null;
  }, "Business rules saved");
}

export async function createStaffAction(input: { name: string; email: string; phone?: string; roles: string[] }) {
  return runAction("staff.manage", async ({ actor }) => {
    const i = z.object({ name: z.string().max(120), email: z.string().max(200), phone: z.string().max(30).optional(), roles }).parse(input);
    const r = await createStaff(db(), { ...i, actor });
    return { data: r, message: "Staff member added. Share the temporary password below once." };
  });
}

export async function updateStaffAction(input: { id: string; name?: string; phone?: string | null; roles?: string[]; active?: boolean }) {
  return runAction("staff.manage", async ({ actor }) => {
    const i = z.object({ id, name: z.string().max(120).optional(), phone: z.string().max(30).nullable().optional(), roles: roles.optional(), active: z.boolean().optional() }).parse(input);
    await updateStaff(db(), { ...i, actor });
    return null;
  }, "Saved");
}

export async function resetPasswordAction(staffId: string) {
  return runAction("staff.manage", async ({ actor }) => {
    const r = await resetStaffPassword(db(), { id: id.parse(staffId), actor });
    return { data: r, message: "New temporary password created. Share it once." };
  });
}

/** Any signed-in person may change their own password, even before the forced change is done. */
export async function changeOwnPasswordAction(input: { current: string; next: string }): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, message: "Your session has ended. Sign in again." };
  try {
    const i = z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(input);
    await changeOwnPassword(db(), { userId: staff.user.id, sessionId: staff.session.id, ...i });
    return { ok: true, message: "Password changed" };
  } catch (e) {
    return { ok: false, message: e instanceof AdminError ? e.message : "Could not change the password" };
  }
}
