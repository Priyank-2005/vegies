CREATE TYPE "public"."staff_role" AS ENUM('OWNER', 'OPS_MANAGER', 'PROCUREMENT', 'PACKER', 'RIDER', 'SUPPORT');--> statement-breakpoint
CREATE TYPE "public"."base_unit" AS ENUM('GRAM', 'PIECE');--> statement-breakpoint
CREATE TYPE "public"."weight_model" AS ENUM('FIXED_PACK', 'APPROX_PIECE', 'LOOSE_WEIGHT');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('PUBLISHED', 'RECEIVED', 'REJECTED', 'RESERVED', 'RELEASED', 'PACKED', 'COLLECTED', 'RETURNED', 'DAMAGED', 'WASTED', 'ADJUST_PLUS', 'ADJUST_MINUS', 'WALKUP_SOLD');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('RESERVED', 'RELEASED', 'CONSUMED');--> statement-breakpoint
CREATE TYPE "public"."delivery_result" AS ENUM('DELIVERED', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."order_line_status" AS ENUM('ACTIVE', 'SHORT', 'SUBSTITUTED', 'REFUNDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'PACKING', 'ATTENTION', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('PREPAID', 'PAY_ON_DELIVERY');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('CREATED', 'CAPTURED', 'FAILED', 'REVIEW');--> statement-breakpoint
CREATE TYPE "public"."receipt_method" AS ENUM('CASH', 'UPI');--> statement-breakpoint
CREATE TYPE "public"."refund_method" AS ENUM('GATEWAY', 'CASH', 'UPI', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('REQUESTED', 'APPROVED', 'SENT', 'SETTLED', 'FAILED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."substitution_status" AS ENUM('PROPOSED', 'ACCEPTED', 'DECLINED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"note" text,
	"ip" "inet",
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_key_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"ip" "inet",
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "staff_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"roles" "staff_role"[] NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_last_step" integer,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_option" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_hi" text,
	"fee_paise" integer DEFAULT 0 NOT NULL,
	"promised_minutes" integer NOT NULL,
	"min_order_paise" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_option_code" CHECK ("delivery_option"."code" ~ '^[A-Z][A-Z_]{2,29}$'),
	CONSTRAINT "delivery_option_nums" CHECK ("delivery_option"."fee_paise" >= 0 AND "delivery_option"."promised_minutes" > 0 AND "delivery_option"."min_order_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hub" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_hi" text,
	"address" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"opens_at_minute" integer DEFAULT 420 NOT NULL,
	"closes_at_minute" integer DEFAULT 1320 NOT NULL,
	"last_order_buffer_minutes" integer DEFAULT 20 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_lat" CHECK ("hub"."lat" between -90 and 90),
	CONSTRAINT "hub_lng" CHECK ("hub"."lng" between -180 and 180),
	CONSTRAINT "hub_hours" CHECK ("hub"."opens_at_minute" >= 0 AND "hub"."closes_at_minute" <= 1440 AND "hub"."opens_at_minute" < "hub"."closes_at_minute"),
	CONSTRAINT "hub_buffer" CHECK ("hub"."last_order_buffer_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hub_delivery_option" (
	"hub_id" uuid NOT NULL,
	"option_code" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"radius_m" integer NOT NULL,
	"max_active_orders" integer NOT NULL,
	CONSTRAINT "hub_delivery_option_hub_id_option_code_pk" PRIMARY KEY("hub_id","option_code"),
	CONSTRAINT "hub_option_nums" CHECK ("hub_delivery_option"."radius_m" > 0 AND "hub_delivery_option"."max_active_orders" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bundle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_hi" text NOT NULL,
	"description_en" text,
	"description_hi" text,
	"price_paise" integer NOT NULL,
	"image_key" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_price_pos" CHECK ("bundle"."price_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "bundle_item" (
	"bundle_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_base" integer NOT NULL,
	CONSTRAINT "bundle_item_bundle_id_product_id_pk" PRIMARY KEY("bundle_id","product_id"),
	CONSTRAINT "bundle_item_qty" CHECK ("bundle_item"."qty_base" > 0)
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_hi" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_key" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_unit_id" uuid NOT NULL,
	"price_paise" integer NOT NULL,
	"sale_price_paise" integer,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_pos" CHECK ("price"."price_paise" > 0),
	CONSTRAINT "price_sale_lt" CHECK ("price"."sale_price_paise" is null OR ("price"."sale_price_paise" > 0 AND "price"."sale_price_paise" <= "price"."price_paise"))
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_hi" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"description_en" text,
	"description_hi" text,
	"weight_model" "weight_model" DEFAULT 'LOOSE_WEIGHT' NOT NULL,
	"base_unit" "base_unit" DEFAULT 'GRAM' NOT NULL,
	"tolerance_pct" smallint DEFAULT 0 NOT NULL,
	"grade" text,
	"storage_note" text,
	"origin_note" text,
	"image_key" text,
	"season_start_month" smallint,
	"season_end_month" smallint,
	"popularity" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_tolerance" CHECK ("product"."tolerance_pct" between 0 and 50)
);
--> statement-breakpoint
CREATE TABLE "sale_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_base_qty" integer NOT NULL,
	"min_base" integer NOT NULL,
	"max_base" integer NOT NULL,
	"step_base" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_unit_rules" CHECK ("sale_unit"."unit_base_qty" > 0 AND "sale_unit"."step_base" > 0 AND "sale_unit"."min_base" > 0 AND "sale_unit"."max_base" >= "sale_unit"."min_base" AND "sale_unit"."min_base" % "sale_unit"."step_base" = 0)
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_date" date NOT NULL,
	"invoice_ref" text,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"paid_paise" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_paid_le_total" CHECK ("purchase"."paid_paise" <= "purchase"."total_paise")
);
--> statement-breakpoint
CREATE TABLE "purchase_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_received_base" integer NOT NULL,
	"qty_accepted_base" integer NOT NULL,
	"qty_rejected_base" integer DEFAULT 0 NOT NULL,
	"cost_paise" integer NOT NULL,
	"grade" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_line_qty" CHECK ("purchase_line"."qty_received_base" > 0 AND "purchase_line"."qty_accepted_base" >= 0 AND "purchase_line"."qty_rejected_base" >= 0 AND "purchase_line"."qty_accepted_base" + "purchase_line"."qty_rejected_base" = "purchase_line"."qty_received_base"),
	CONSTRAINT "purchase_line_cost" CHECK ("purchase_line"."cost_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"qty_base" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'RESERVED' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_qty" CHECK ("reservation"."qty_base" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_day" (
	"product_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"published_qty" integer DEFAULT 0 NOT NULL,
	"reserved_qty" integer DEFAULT 0 NOT NULL,
	"received_qty" integer DEFAULT 0 NOT NULL,
	"packed_qty" integer DEFAULT 0 NOT NULL,
	"collected_qty" integer DEFAULT 0 NOT NULL,
	"wasted_qty" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_day_product_id_service_date_pk" PRIMARY KEY("product_id","service_date"),
	CONSTRAINT "stock_day_reserve_cap" CHECK ("stock_day"."reserved_qty" >= 0 AND "stock_day"."reserved_qty" <= "stock_day"."published_qty"),
	CONSTRAINT "stock_day_nonneg" CHECK ("stock_day"."received_qty" >= 0 AND "stock_day"."packed_qty" >= 0 AND "stock_day"."collected_qty" >= 0 AND "stock_day"."wasted_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_lot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"purchase_line_id" uuid,
	"service_date" date NOT NULL,
	"qty_base" integer NOT NULL,
	"cost_paise" integer NOT NULL,
	"grade" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_lot_qty" CHECK ("stock_lot"."qty_base" > 0 AND "stock_lot"."cost_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"lot_id" uuid,
	"type" "stock_movement_type" NOT NULL,
	"qty_base" integer NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"reason" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"address" text,
	"fssai_no" text,
	"gstin" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"delivery_record_id" uuid,
	"method" "receipt_method" NOT NULL,
	"amount_paise" integer NOT NULL,
	"reference" text,
	"collected_by" uuid NOT NULL,
	"deposited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_receipt_amount" CHECK ("cash_receipt"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"phone" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"text_version" text NOT NULL,
	"source" text NOT NULL,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"email" text,
	"phone_verified_at" timestamp with time zone,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_phone_fmt" CHECK ("customer"."phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "customer_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" "inet"
);
--> statement-breakpoint
CREATE TABLE "delivery_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"result" "delivery_result" NOT NULL,
	"verified_by" text NOT NULL,
	"note" text,
	"rider_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signature_ok" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"to_masked" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"hub_id" uuid NOT NULL,
	"delivery_option" text NOT NULL,
	"address_line" text NOT NULL,
	"landmark" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"distance_m" integer NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"delivery_note" text,
	"promised_at" timestamp with time zone NOT NULL,
	"rider_id" uuid,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"status" "order_status" NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"fee_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"promo_code" text,
	"handover_code" text NOT NULL,
	"tracking_token_hash" text NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"idempotency_key" text,
	"policy_version" text NOT NULL,
	"customer_note" text,
	"staff_note" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_handover_fmt" CHECK ("orders"."handover_code" ~ '^[0-9]{4}$'),
	CONSTRAINT "order_lat_lng" CHECK ("orders"."lat" between -90 and 90 AND "orders"."lng" between -180 and 180),
	CONSTRAINT "order_totals" CHECK ("orders"."subtotal_paise" >= 0 AND "orders"."discount_paise" >= 0 AND "orders"."fee_paise" >= 0 AND "orders"."total_paise" = "orders"."subtotal_paise" - "orders"."discount_paise" + "orders"."fee_paise" AND "orders"."total_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sale_unit_id" uuid NOT NULL,
	"bundle_id" uuid,
	"name_en" text NOT NULL,
	"name_hi" text NOT NULL,
	"base_unit" text NOT NULL,
	"weight_model" text NOT NULL,
	"tolerance_pct" smallint DEFAULT 0 NOT NULL,
	"unit_base_qty" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"qty_ordered_base" integer NOT NULL,
	"line_total_paise" integer NOT NULL,
	"service_date" date NOT NULL,
	"status" "order_line_status" DEFAULT 'ACTIVE' NOT NULL,
	"qty_packed_base" integer,
	"refunded_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_line_qty" CHECK ("order_line"."qty_ordered_base" > 0 AND "order_line"."line_total_paise" >= 0 AND "order_line"."unit_price_paise" > 0 AND "order_line"."unit_base_qty" > 0),
	CONSTRAINT "order_line_refund" CHECK ("order_line"."refunded_paise" >= 0 AND "order_line"."refunded_paise" <= "order_line"."line_total_paise")
);
--> statement-breakpoint
CREATE TABLE "otp_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"status" "payment_status" DEFAULT 'CREATED' NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"method" text,
	"failure_reason" text,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_amount" CHECK ("payment"."amount_paise" > 0 AND "payment"."currency" = 'INR')
);
--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"min_subtotal_paise" integer DEFAULT 0 NOT NULL,
	"max_discount_paise" integer,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"per_phone_limit" integer DEFAULT 1 NOT NULL,
	"total_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_kind" CHECK ("promotion"."kind" in ('PERCENT','FIXED') AND "promotion"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_line_id" uuid,
	"payment_id" uuid,
	"amount_paise" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'REQUESTED' NOT NULL,
	"method" "refund_method" NOT NULL,
	"provider_refund_id" text,
	"requested_by" uuid,
	"approved_by" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "refund_amount" CHECK ("refund"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "substitution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_line_id" uuid NOT NULL,
	"proposed_product_id" uuid NOT NULL,
	"proposed_sale_unit_id" uuid NOT NULL,
	"proposed_qty_base" integer NOT NULL,
	"proposed_price_paise" integer NOT NULL,
	"status" "substitution_status" DEFAULT 'PROPOSED' NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_via" text,
	"decision_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"pincode" text,
	"city_text" text,
	"area_text" text,
	"society_text" text,
	"lat" double precision,
	"lng" double precision,
	"consent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_pincode_fmt" CHECK ("waitlist_entry"."pincode" is null or "waitlist_entry"."pincode" ~ '^[1-9][0-9]{5}$')
);
--> statement-breakpoint
ALTER TABLE "staff_session" ADD CONSTRAINT "staff_session_user_id_staff_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub" ADD CONSTRAINT "hub_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_delivery_option" ADD CONSTRAINT "hub_delivery_option_hub_id_hub_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hub"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_delivery_option" ADD CONSTRAINT "hub_delivery_option_option_code_delivery_option_code_fk" FOREIGN KEY ("option_code") REFERENCES "public"."delivery_option"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_bundle_id_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_sale_unit_id_sale_unit_id_fk" FOREIGN KEY ("sale_unit_id") REFERENCES "public"."sale_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_unit" ADD CONSTRAINT "sale_unit_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_created_by_staff_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line" ADD CONSTRAINT "purchase_line_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line" ADD CONSTRAINT "purchase_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_day" ADD CONSTRAINT "stock_day_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lot" ADD CONSTRAINT "stock_lot_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lot" ADD CONSTRAINT "stock_lot_purchase_line_id_purchase_line_id_fk" FOREIGN KEY ("purchase_line_id") REFERENCES "public"."purchase_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_lot_id_stock_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."stock_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_receipt" ADD CONSTRAINT "cash_receipt_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_receipt" ADD CONSTRAINT "cash_receipt_delivery_record_id_delivery_record_id_fk" FOREIGN KEY ("delivery_record_id") REFERENCES "public"."delivery_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_receipt" ADD CONSTRAINT "cash_receipt_collected_by_staff_user_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_session" ADD CONSTRAINT "customer_session_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_record" ADD CONSTRAINT "delivery_record_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_record" ADD CONSTRAINT "delivery_record_rider_id_staff_user_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_hub_id_hub_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hub"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_option_delivery_option_code_fk" FOREIGN KEY ("delivery_option") REFERENCES "public"."delivery_option"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rider_id_staff_user_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_sale_unit_id_sale_unit_id_fk" FOREIGN KEY ("sale_unit_id") REFERENCES "public"."sale_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_bundle_id_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_requested_by_staff_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_approved_by_staff_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" ADD CONSTRAINT "substitution_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" ADD CONSTRAINT "substitution_proposed_product_id_product_id_fk" FOREIGN KEY ("proposed_product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" ADD CONSTRAINT "substitution_proposed_sale_unit_id_sale_unit_id_fk" FOREIGN KEY ("proposed_sale_unit_id") REFERENCES "public"."sale_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" ADD CONSTRAINT "substitution_created_by_staff_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_consent_id_consent_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("available_at") WHERE "outbox"."processed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_session_token_uq" ON "staff_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "staff_session_user_idx" ON "staff_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_user_email_uq" ON "staff_user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_slug_uq" ON "hub" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_slug_uq" ON "bundle" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "category_slug_uq" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "price_unit_idx" ON "price" USING btree ("sale_unit_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "product_slug_uq" ON "product" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "sale_unit_product_idx" ON "sale_unit" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_unit_one_default_uq" ON "sale_unit" USING btree ("product_id") WHERE "sale_unit"."is_default" and "sale_unit"."active";--> statement-breakpoint
CREATE INDEX "purchase_date_idx" ON "purchase" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "reservation_line_idx" ON "reservation" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "reservation_open_idx" ON "reservation" USING btree ("product_id","service_date") WHERE "reservation"."status" = 'RESERVED';--> statement-breakpoint
CREATE INDEX "stock_lot_product_date_idx" ON "stock_lot" USING btree ("product_id","service_date");--> statement-breakpoint
CREATE INDEX "stock_movement_product_date_idx" ON "stock_movement" USING btree ("product_id","service_date");--> statement-breakpoint
CREATE INDEX "stock_movement_ref_idx" ON "stock_movement" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "cash_receipt_order_idx" ON "cash_receipt" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "consent_phone_idx" ON "consent" USING btree ("phone","channel","purpose","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_phone_uq" ON "customer" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_session_token_uq" ON "customer_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_session_customer_idx" ON "customer_session" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_record_order_uq" ON "delivery_record" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_event_uq" ON "gateway_event" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "notification_order_idx" ON "notification" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_public_code_uq" ON "orders" USING btree ("public_code");--> statement-breakpoint
CREATE UNIQUE INDEX "order_idem_uq" ON "orders" USING btree ("customer_id","idempotency_key") WHERE "orders"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "order_hub_active_idx" ON "orders" USING btree ("hub_id","delivery_option","status");--> statement-breakpoint
CREATE INDEX "order_rider_idx" ON "orders" USING btree ("rider_id","status");--> statement-breakpoint
CREATE INDEX "order_customer_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "order_event_order_idx" ON "order_event" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_line_order_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_line_product_date_idx" ON "order_line" USING btree ("product_id","service_date");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_challenge" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_pid_uq" ON "payment" USING btree ("provider","provider_payment_id") WHERE "payment"."provider_payment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_one_captured_uq" ON "payment" USING btree ("order_id") WHERE "payment"."status" = 'CAPTURED';--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_code_uq" ON "promotion" USING btree ("code");--> statement-breakpoint
CREATE INDEX "refund_order_idx" ON "refund" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_idem_uq" ON "refund" USING btree ("idempotency_key") WHERE "refund"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "substitution_line_idx" ON "substitution" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "waitlist_pincode_idx" ON "waitlist_entry" USING btree ("pincode");