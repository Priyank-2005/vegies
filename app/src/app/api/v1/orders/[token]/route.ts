import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { HttpError, route, throttle } from "@/server/http";
import { getOrderByTrackingToken } from "@/server/services/orders";

export const GET = route(async (req, ctx: { params: Promise<{ token: string }> }) => {
  await throttle(req, "track", 60, 60); // slows token guessing; tokens are 192-bit so guessing is infeasible anyway
  const { token } = await ctx.params;
  const view = await getOrderByTrackingToken(db(), token);
  if (!view) throw new HttpError(404, "NOT_FOUND", "We could not find that order");
  return NextResponse.json({ order: view }, { headers: { "Cache-Control": "no-store" } });
});
