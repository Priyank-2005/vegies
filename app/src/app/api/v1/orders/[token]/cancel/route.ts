import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { HttpError, route, throttle } from "@/server/http";
import { cancelOrderByCustomer, getOrderByTrackingToken } from "@/server/services/orders";
import { schema } from "@/server/db/client";
import { eq } from "drizzle-orm";

/**
 * Cancel by tracking token. The token is an unguessable secret delivered only to the customer
 * (same model as a guest-order link), so holding it is the authority to cancel.
 */
export const POST = route(async (req, ctx: { params: Promise<{ token: string }> }) => {
  await throttle(req, "cancel", 20, 600);
  const { token } = await ctx.params;
  const view = await getOrderByTrackingToken(db(), token);
  if (!view) throw new HttpError(404, "NOT_FOUND", "We could not find that order");
  const [o] = await db().select({ customerId: schema.order.customerId }).from(schema.order).where(eq(schema.order.id, view.id)).limit(1);
  const r = await cancelOrderByCustomer(db(), { orderId: view.id, customerId: o.customerId });
  if (!r.ok) {
    const msg = "We have already started preparing this order, so it can no longer be cancelled online. Please contact us if you need help.";
    throw new HttpError(409, r.reason, msg);
  }
  return NextResponse.json({ ok: true });
});
