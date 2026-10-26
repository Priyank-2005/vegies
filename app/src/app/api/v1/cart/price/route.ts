import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { route, throttle } from "@/server/http";
import { currentServiceDate } from "@/server/selection";
import { MAX_CART_LINES, priceCart } from "@/server/services/pricing";
import { loadSettings } from "@/server/settings";

const body = z.object({
  /** Optional: defaults to the date whose stock the shop is selling right now. */
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(z.object({ saleUnitId: z.uuid(), qtyBase: z.number().int().min(-1_000_000).max(1_000_000) })).max(MAX_CART_LINES),
});

/** Prices a cart from the database. The request carries ids and quantities only: there is no client price to tamper with. */
export const POST = route(async (req) => {
  await throttle(req, "cart-price", 120, 60);
  const input = body.parse(await req.json().catch(() => ({})));
  const settings = await loadSettings(db());
  const serviceDate = input.serviceDate ?? (await currentServiceDate());
  const result = await priceCart(db(), { serviceDate, items: input.items });
  return NextResponse.json(
    { ...result, minOrderPaise: settings.minOrderPaise, payOnDeliveryCapPaise: settings.payOnDeliveryCapPaise, prepaidEnabled: settings.prepaidEnabled },
    { headers: { "Cache-Control": "no-store" } },
  );
});
