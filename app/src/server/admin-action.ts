import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { currentStaff } from "./auth/guards";
import { can, ForbiddenError, mfaRequired, type Permission } from "./auth/permissions";
import { InvalidTransitionError } from "./domain/order-state";
import { OutOfStockError, ReservationStateError } from "./domain/inventory";
import { AdminError, type StaffActor } from "./services/admin/common";
import { DeliveryOpError } from "./services/delivery-ops";
import type { SessionInfo, StaffPrincipal } from "./auth/session";

export type ActionResult<T = null> = { ok: true; data: T; message?: string } | { ok: false; message: string };

export interface ActionContext {
  actor: StaffActor;
  user: StaffPrincipal;
  session: SessionInfo;
}

/**
 * Wrap the body of a server action: the caller must be signed in (and have the permission), and every known
 * business-rule failure becomes a plain message for the screen instead of an error page.
 * Every action must go through this; the UI hiding a button is never the control.
 */
export async function runAction<T>(permission: Permission | null, fn: (ctx: ActionContext) => Promise<T | { data: T; message: string }>, success?: string): Promise<ActionResult<T>> {
  try {
    const staff = await currentStaff();
    if (!staff) return { ok: false, message: "Your session has ended. Sign in again." };
    if (mfaRequired(staff.user.roles) && !staff.session.mfaVerifiedAt) return { ok: false, message: "Two-factor sign-in is required first." };
    if (staff.user.mustChangePassword) return { ok: false, message: "Change your temporary password first." };
    if (permission && !can(staff.user.roles, permission)) return { ok: false, message: "You do not have permission to do that." };
    const out = await fn({ actor: { userId: staff.user.id, roles: staff.user.roles }, user: staff.user, session: staff.session });
    if (out && typeof out === "object" && "message" in out && "data" in out) return { ok: true, data: (out as { data: T }).data, message: (out as { message: string }).message };
    return { ok: true, data: out as T, message: success };
  } catch (e) {
    if (e instanceof AdminError || e instanceof DeliveryOpError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: "You do not have permission to do that." };
    if (e instanceof InvalidTransitionError) return { ok: false, message: "This order has just changed. The screen has been refreshed; please check and try again." };
    if (e instanceof OutOfStockError) return { ok: false, message: "Not enough stock for that." };
    if (e instanceof ReservationStateError) return { ok: false, message: e.message };
    if (e instanceof ZodError) return { ok: false, message: "Some of the values are not valid. Please check the form." };
    logger.error({ err: e }, "admin action failed");
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
