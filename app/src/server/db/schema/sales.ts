import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, ts, updatedAt } from "./_common";
import { bundle, product, saleUnit } from "./catalog";
import { deliveryOption, hub } from "./geo";
import { staffUser } from "./staff";

export const customer = pgTable(
  "customer",
  {
    id: id(),
    phone: text("phone").notNull(), // E.164, e.g. +919876543210
    name: text("name"),
    email: text("email"),
    phoneVerifiedAt: ts("phone_verified_at"),
    noShowCount: integer("no_show_count").notNull().default(0),
    blocked: boolean("blocked").notNull().default(false),
    blockedReason: text("blocked_reason"),
    notes: text("notes"), // staff-only
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customer_phone_uq").on(t.phone), check("customer_phone_fmt", sql`${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`)],
);

export const consent = pgTable(
  "consent",
  {
    id: id(),
    customerId: uuid("customer_id").references(() => customer.id),
    phone: text("phone").notNull(),
    channel: text("channel").notNull(), // WHATSAPP | SMS | EMAIL
    purpose: text("purpose").notNull(), // TRANSACTIONAL | MARKETING | WAITLIST
    granted: boolean("granted").notNull(),
    textVersion: text("text_version").notNull(),
    source: text("source").notNull(), // checkout | waitlist | admin | ...
    ip: inet("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("consent_phone_idx").on(t.phone, t.channel, t.purpose, t.createdAt)],
);

export const waitlistEntry = pgTable(
  "waitlist_entry",
  {
    id: id(),
    phone: text("phone").notNull(),
    name: text("name"),
    pincode: text("pincode"),
    cityText: text("city_text"), // where they are, when outside Udaipur
    areaText: text("area_text"),
    societyText: text("society_text"),
    lat: doublePrecision("lat"), // rounded to ~1 km before storing (see services/serviceability.ts)
    lng: doublePrecision("lng"),
    consentId: uuid("consent_id").references(() => consent.id),
    createdAt: createdAt(),
  },
  (t) => [index("waitlist_pincode_idx").on(t.pincode), check("waitlist_pincode_fmt", sql`${t.pincode} is null or ${t.pincode} ~ '^[1-9][0-9]{5}$'`)],
);

export const otpChallenge = pgTable(
  "otp_challenge",
  {
    id: id(),
    phone: text("phone").notNull(),
    purpose: text("purpose").notNull(), // CHECKOUT | TRACK | LOGIN
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    ip: inet("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_idx").on(t.phone, t.createdAt)],
);

/** Customer login after phone OTP. Only a hash of the cookie token is stored. */
export const customerSession = pgTable(
  "customer_session",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    ip: inet("ip"),
  },
  (t) => [uniqueIndex("customer_session_token_uq").on(t.tokenHash), index("customer_session_customer_idx").on(t.customerId)],
);

export const paymentMode = pgEnum("payment_mode", ["PREPAID", "PAY_ON_DELIVERY"]);
export const orderStatus = pgEnum("order_status", [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PACKING",
  "ATTENTION",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED",
  "EXPIRED",
]);

// Table is named "orders" because ORDER is an SQL reserved word.
export const order = pgTable(
  "orders",
  {
    id: id(),
    publicCode: text("public_code").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id),
    hubId: uuid("hub_id")
      .notNull()
      .references(() => hub.id),
    deliveryOption: text("delivery_option")
      .notNull()
      .references(() => deliveryOption.code),
    // Delivery address snapshot (personal data: shown only to the customer and staff who deliver it).
    addressLine: text("address_line").notNull(),
    landmark: text("landmark"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    distanceM: integer("distance_m").notNull(),
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    deliveryNote: text("delivery_note"),
    promisedAt: ts("promised_at").notNull(),
    riderId: uuid("rider_id").references(() => staffUser.id),
    dispatchedAt: ts("dispatched_at"),
    deliveredAt: ts("delivered_at"),
    status: orderStatus("status").notNull(),
    paymentMode: paymentMode("payment_mode").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    feePaise: integer("fee_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    promoCode: text("promo_code"),
    handoverCode: text("handover_code").notNull(), // 4 digits; the customer tells the rider, proof of delivery
    trackingTokenHash: text("tracking_token_hash").notNull(),
    holdExpiresAt: ts("hold_expires_at"), // PENDING_PAYMENT orders release their stock after this
    idempotencyKey: text("idempotency_key"),
    policyVersion: text("policy_version").notNull(),
    customerNote: text("customer_note"),
    staffNote: text("staff_note"),
    cancelledAt: ts("cancelled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("order_public_code_uq").on(t.publicCode),
    uniqueIndex("order_idem_uq").on(t.customerId, t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
    index("order_hub_active_idx").on(t.hubId, t.deliveryOption, t.status),
    index("order_rider_idx").on(t.riderId, t.status),
    check("order_handover_fmt", sql`${t.handoverCode} ~ '^[0-9]{4}$'`),
    check("order_lat_lng", sql`${t.lat} between -90 and 90 AND ${t.lng} between -180 and 180`),
    index("order_customer_idx").on(t.customerId, t.createdAt),
    index("order_status_idx").on(t.status, t.createdAt),
    check("order_totals", sql`${t.subtotalPaise} >= 0 AND ${t.discountPaise} >= 0 AND ${t.feePaise} >= 0 AND ${t.totalPaise} = ${t.subtotalPaise} - ${t.discountPaise} + ${t.feePaise} AND ${t.totalPaise} >= 0`),
  ],
);

export const orderLineStatus = pgEnum("order_line_status", ["ACTIVE", "SHORT", "SUBSTITUTED", "REFUNDED", "CANCELLED"]);

export const orderLine = pgTable(
  "order_line",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    saleUnitId: uuid("sale_unit_id")
      .notNull()
      .references(() => saleUnit.id),
    bundleId: uuid("bundle_id").references(() => bundle.id),
    // snapshots: the order must stay readable and correct after catalog edits
    nameEn: text("name_en").notNull(),
    nameHi: text("name_hi").notNull(),
    baseUnit: text("base_unit").notNull(),
    weightModel: text("weight_model").notNull(),
    tolerancePct: smallint("tolerance_pct").notNull().default(0),
    unitBaseQty: integer("unit_base_qty").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    qtyOrderedBase: integer("qty_ordered_base").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    serviceDate: date("service_date").notNull(),
    status: orderLineStatus("status").notNull().default("ACTIVE"),
    qtyPackedBase: integer("qty_packed_base"),
    refundedPaise: integer("refunded_paise").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("order_line_order_idx").on(t.orderId),
    index("order_line_product_date_idx").on(t.productId, t.serviceDate),
    check("order_line_qty", sql`${t.qtyOrderedBase} > 0 AND ${t.lineTotalPaise} >= 0 AND ${t.unitPricePaise} > 0 AND ${t.unitBaseQty} > 0`),
    check("order_line_refund", sql`${t.refundedPaise} >= 0 AND ${t.refundedPaise} <= ${t.lineTotalPaise}`),
  ],
);

export const orderEvent = pgTable(
  "order_event",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_event_order_idx").on(t.orderId, t.createdAt)],
);

export const paymentStatus = pgEnum("payment_status", ["CREATED", "CAPTURED", "FAILED", "REVIEW"]);

export const payment = pgTable(
  "payment",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    status: paymentStatus("status").notNull().default("CREATED"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    method: text("method"),
    failureReason: text("failure_reason"),
    capturedAt: ts("captured_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("payment_order_idx").on(t.orderId),
    uniqueIndex("payment_provider_pid_uq").on(t.provider, t.providerPaymentId).where(sql`${t.providerPaymentId} is not null`),
    // at most one captured payment per order
    uniqueIndex("payment_one_captured_uq").on(t.orderId).where(sql`${t.status} = 'CAPTURED'`),
    check("payment_amount", sql`${t.amountPaise} > 0 AND ${t.currency} = 'INR'`),
  ],
);

export const gatewayEvent = pgTable(
  "gateway_event",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    signatureOk: boolean("signature_ok").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: createdAt(),
    processedAt: ts("processed_at"),
    error: text("error"),
  },
  (t) => [uniqueIndex("gateway_event_uq").on(t.provider, t.eventId)],
);

export const refundStatus = pgEnum("refund_status", ["REQUESTED", "APPROVED", "SENT", "SETTLED", "FAILED", "REJECTED"]);
export const refundMethod = pgEnum("refund_method", ["GATEWAY", "CASH", "UPI", "CREDIT"]);

export const refund = pgTable(
  "refund",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id),
    orderLineId: uuid("order_line_id").references(() => orderLine.id),
    paymentId: uuid("payment_id").references(() => payment.id),
    amountPaise: integer("amount_paise").notNull(),
    reason: text("reason").notNull(),
    status: refundStatus("status").notNull().default("REQUESTED"),
    method: refundMethod("method").notNull(),
    providerRefundId: text("provider_refund_id"),
    requestedBy: uuid("requested_by").references(() => staffUser.id),
    approvedBy: uuid("approved_by").references(() => staffUser.id),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
    settledAt: ts("settled_at"),
  },
  (t) => [
    index("refund_order_idx").on(t.orderId),
    uniqueIndex("refund_idem_uq").on(t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
    check("refund_amount", sql`${t.amountPaise} > 0`),
  ],
);

export const deliveryResult = pgEnum("delivery_result", ["DELIVERED", "PARTIAL", "FAILED"]);

/** Proof of delivery: who delivered, how the customer was verified, and what happened. One row per order. */
export const deliveryRecord = pgTable(
  "delivery_record",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id),
    result: deliveryResult("result").notNull(),
    verifiedBy: text("verified_by").notNull(), // CODE | MANUAL (manual needs a note)
    note: text("note"), // discrepancy or failure reason
    riderId: uuid("rider_id")
      .notNull()
      .references(() => staffUser.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("delivery_record_order_uq").on(t.orderId)],
);

export const receiptMethod = pgEnum("receipt_method", ["CASH", "UPI"]);

export const cashReceipt = pgTable(
  "cash_receipt",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id),
    deliveryRecordId: uuid("delivery_record_id").references(() => deliveryRecord.id),
    method: receiptMethod("method").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    reference: text("reference"), // UPI transaction id
    collectedBy: uuid("collected_by")
      .notNull()
      .references(() => staffUser.id),
    depositedAt: ts("deposited_at"),
    createdAt: createdAt(),
  },
  (t) => [index("cash_receipt_order_idx").on(t.orderId), check("cash_receipt_amount", sql`${t.amountPaise} > 0`)],
);

export const substitutionStatus = pgEnum("substitution_status", ["PROPOSED", "ACCEPTED", "DECLINED", "EXPIRED"]);

export const substitution = pgTable(
  "substitution",
  {
    id: id(),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLine.id),
    proposedProductId: uuid("proposed_product_id")
      .notNull()
      .references(() => product.id),
    proposedSaleUnitId: uuid("proposed_sale_unit_id")
      .notNull()
      .references(() => saleUnit.id),
    proposedQtyBase: integer("proposed_qty_base").notNull(),
    proposedPricePaise: integer("proposed_price_paise").notNull(), // total for the substitute quantity
    status: substitutionStatus("status").notNull().default("PROPOSED"),
    deadlineAt: ts("deadline_at").notNull(),
    decidedAt: ts("decided_at"),
    decidedVia: text("decided_via"), // CUSTOMER_LINK | PHONE_CALL | ADMIN_OVERRIDE
    decisionNote: text("decision_note"),
    createdBy: uuid("created_by").references(() => staffUser.id),
    createdAt: createdAt(),
  },
  (t) => [index("substitution_line_idx").on(t.orderLineId)],
);

export const promotion = pgTable(
  "promotion",
  {
    id: id(),
    code: text("code").notNull(), // stored upper-case
    kind: text("kind").notNull(), // PERCENT | FIXED
    value: integer("value").notNull(), // percent in bps for PERCENT, paise for FIXED
    minSubtotalPaise: integer("min_subtotal_paise").notNull().default(0),
    maxDiscountPaise: integer("max_discount_paise"),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    perPhoneLimit: integer("per_phone_limit").notNull().default(1),
    totalLimit: integer("total_limit"),
    usedCount: integer("used_count").notNull().default(0),
    validFrom: ts("valid_from"),
    validTo: ts("valid_to"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("promotion_code_uq").on(t.code), check("promotion_kind", sql`${t.kind} in ('PERCENT','FIXED') AND ${t.value} > 0`)],
);

export const notification = pgTable(
  "notification",
  {
    id: id(),
    orderId: uuid("order_id").references(() => order.id),
    customerId: uuid("customer_id").references(() => customer.id),
    channel: text("channel").notNull(), // WHATSAPP | SMS | FAKE (test channel)
    template: text("template").notNull(), // e.g. ORDER_CONFIRMED
    toMasked: text("to_masked").notNull(),
    status: text("status").notNull().default("QUEUED"), // QUEUED | SENT | FAILED | SKIPPED
    providerMessageId: text("provider_message_id"),
    error: text("error"), // why it failed or was skipped (never the message text)
    attempts: smallint("attempts").notNull().default(0),
    // The text is kept only for the test channel, so a developer can read it. Real channels never store it (it can hold the delivery code).
    body: text("body"),
    createdAt: createdAt(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    index("notification_order_idx").on(t.orderId),
    // One message of each kind per order and channel: a retried job or a duplicate event can never send it twice.
    uniqueIndex("notification_once_uq").on(t.orderId, t.template, t.channel).where(sql`${t.orderId} is not null`),
    check("notification_status", sql`${t.status} in ('QUEUED','SENT','FAILED','SKIPPED')`),
  ],
);
