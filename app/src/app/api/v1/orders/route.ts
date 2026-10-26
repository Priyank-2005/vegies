import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/server/auth/customer-guards";
import { db } from "@/server/db/client";
import { HttpError, clientIp, route, throttle } from "@/server/http";
import { CheckoutError, createOrder, type CheckoutErrorCode } from "@/server/services/orders";
import { MAX_CART_LINES } from "@/server/services/pricing";
import { rateLimit } from "@/server/security/rate-limit";

const body = z.object({
  deliveryOption: z.string().regex(/^[A-Z][A-Z_]{2,29}$/),
  address: z.object({
    line: z.string().trim().min(6, "Please enter your full address").max(200),
    landmark: z.string().max(120).optional(),
    note: z.string().max(200).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  paymentMode: z.enum(["PREPAID", "PAY_ON_DELIVERY"]),
  customerName: z.string().trim().min(2, "Please enter your name").max(80),
  note: z.string().max(300).optional(),
  transactionalConsent: z.boolean(),
  items: z.array(z.object({ saleUnitId: z.uuid(), qtyBase: z.number().int().min(-1_000_000).max(1_000_000) })).min(1).max(MAX_CART_LINES),
});

const STATUS: Record<CheckoutErrorCode, number> = {
  CUSTOMER_BLOCKED: 403,
  INVALID_ADDRESS: 422,
  OUT_OF_AREA: 422,
  OPTION_UNAVAILABLE: 409,
  OPTION_BUSY: 409,
  HUB_CLOSED: 409,
  CART_INVALID: 422,
  OUT_OF_STOCK: 409,
  PAYMENT_MODE_UNAVAILABLE: 422,
  PAY_ON_DELIVERY_NOT_ALLOWED: 422,
  BELOW_MINIMUM_ORDER: 422,
  CONSENT_REQUIRED: 422,
};

/** Place an order. Requires a verified phone and an Idempotency-Key header (a retry returns the same order). */
export const POST = route(async (req) => {
  await throttle(req, "orders", 20, 600);
  const customer = await requireCustomer();
  const rl = await rateLimit(db(), `orders:customer:${customer.id}`, 10, 600);
  if (!rl.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many orders in a short time. Please wait a few minutes.");

  const key = req.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_-]{16,100}$/.test(key)) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header (16-100 URL-safe characters) is required");
  const input = body.parse(await req.json().catch(() => ({})));

  try {
    const r = await createOrder(db(), { ...input, customerId: customer.id, idempotencyKey: key, ip: clientIp(req) });
    return NextResponse.json(
      {
        orderId: r.orderId,
        publicCode: r.publicCode,
        status: r.status,
        deliveryOption: r.deliveryOption,
        subtotalPaise: r.subtotalPaise,
        deliveryFeePaise: r.deliveryFeePaise,
        totalPaise: r.totalPaise,
        promisedAt: r.promisedAt,
        handoverCode: r.handoverCode,
        trackingToken: r.trackingToken,
        replayed: r.replayed,
        holdExpiresAt: r.holdExpiresAt,
      },
      { status: r.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof CheckoutError) throw new HttpError(STATUS[e.code], e.code, e.message, { ...e.details });
    throw e;
  }
});
