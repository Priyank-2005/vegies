import { NextResponse } from "next/server";
import { requireCustomer } from "@/server/auth/customer-guards";
import { db } from "@/server/db/client";
import { HttpError, route, throttle } from "@/server/http";
import { cancelOrderByCustomer, getOrderForCustomer } from "@/server/services/orders";

/** Cancel one of the signed-in customer's own orders. */
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await throttle(req, "cancel", 20, 600);
  const customer = await requireCustomer();
  const { id } = await ctx.params;
  const view = await getOrderForCustomer(db(), customer.id, id);
  if (!view) throw new HttpError(404, "NOT_FOUND", "We could not find that order");
  const r = await cancelOrderByCustomer(db(), { orderId: view.id, customerId: customer.id });
  if (!r.ok) {
    const msg = "We have already started preparing this order, so it can no longer be cancelled online. Please contact us if you need help.";
    throw new HttpError(409, r.reason, msg);
  }
  return NextResponse.json({ ok: true });
});
