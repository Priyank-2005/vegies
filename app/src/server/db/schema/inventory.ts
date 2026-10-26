import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgEnum, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, ts, updatedAt } from "./_common";
import { product } from "./catalog";
import { orderLine } from "./sales";
import { staffUser } from "./staff";

export const supplier = pgTable("supplier", {
  id: id(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  address: text("address"),
  fssaiNo: text("fssai_no"),
  gstin: text("gstin"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const purchase = pgTable(
  "purchase",
  {
    id: id(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id),
    purchaseDate: date("purchase_date").notNull(),
    invoiceRef: text("invoice_ref"),
    totalPaise: integer("total_paise").notNull().default(0),
    paidPaise: integer("paid_paise").notNull().default(0),
    note: text("note"),
    createdBy: uuid("created_by").references(() => staffUser.id),
    createdAt: createdAt(),
  },
  (t) => [index("purchase_date_idx").on(t.purchaseDate), check("purchase_paid_le_total", sql`${t.paidPaise} <= ${t.totalPaise}`)],
);

export const purchaseLine = pgTable(
  "purchase_line",
  {
    id: id(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchase.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    qtyReceivedBase: integer("qty_received_base").notNull(),
    qtyAcceptedBase: integer("qty_accepted_base").notNull(),
    qtyRejectedBase: integer("qty_rejected_base").notNull().default(0),
    costPaise: integer("cost_paise").notNull(), // total paid for the whole received quantity
    grade: text("grade"),
    rejectionReason: text("rejection_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    check("purchase_line_qty", sql`${t.qtyReceivedBase} > 0 AND ${t.qtyAcceptedBase} >= 0 AND ${t.qtyRejectedBase} >= 0 AND ${t.qtyAcceptedBase} + ${t.qtyRejectedBase} = ${t.qtyReceivedBase}`),
    check("purchase_line_cost", sql`${t.costPaise} >= 0`),
  ],
);

export const stockLot = pgTable(
  "stock_lot",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    purchaseLineId: uuid("purchase_line_id").references(() => purchaseLine.id),
    serviceDate: date("service_date").notNull(), // the sales day this lot is intended for
    qtyBase: integer("qty_base").notNull(),
    costPaise: integer("cost_paise").notNull(), // cost attributed to the accepted quantity
    grade: text("grade"),
    createdAt: createdAt(),
  },
  (t) => [index("stock_lot_product_date_idx").on(t.productId, t.serviceDate), check("stock_lot_qty", sql`${t.qtyBase} > 0 AND ${t.costPaise} >= 0`)],
);

/**
 * Per product per service date availability counters. Counter updates and the matching
 * stock_movement ledger row are written in the same transaction.
 */
export const stockDay = pgTable(
  "stock_day",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    serviceDate: date("service_date").notNull(),
    publishedQty: integer("published_qty").notNull().default(0), // what we promise customers can order
    reservedQty: integer("reserved_qty").notNull().default(0),
    receivedQty: integer("received_qty").notNull().default(0), // accepted into stock
    packedQty: integer("packed_qty").notNull().default(0),
    collectedQty: integer("collected_qty").notNull().default(0),
    wastedQty: integer("wasted_qty").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.serviceDate] }),
    check("stock_day_reserve_cap", sql`${t.reservedQty} >= 0 AND ${t.reservedQty} <= ${t.publishedQty}`),
    check("stock_day_nonneg", sql`${t.receivedQty} >= 0 AND ${t.packedQty} >= 0 AND ${t.collectedQty} >= 0 AND ${t.wastedQty} >= 0`),
  ],
);

export const movementType = pgEnum("stock_movement_type", [
  "PUBLISHED",
  "RECEIVED",
  "REJECTED",
  "RESERVED",
  "RELEASED",
  "PACKED",
  "COLLECTED",
  "RETURNED",
  "DAMAGED",
  "WASTED",
  "ADJUST_PLUS",
  "ADJUST_MINUS",
  "WALKUP_SOLD",
]);

/** Append-only. Signed qty; balances are derived from this ledger. UPDATE/DELETE are blocked by trigger. */
export const stockMovement = pgTable(
  "stock_movement",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    serviceDate: date("service_date").notNull(),
    lotId: uuid("lot_id").references(() => stockLot.id),
    type: movementType("type").notNull(),
    qtyBase: integer("qty_base").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    reason: text("reason"),
    actorId: uuid("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movement_product_date_idx").on(t.productId, t.serviceDate), index("stock_movement_ref_idx").on(t.refType, t.refId)],
);

export const reservationStatus = pgEnum("reservation_status", ["RESERVED", "RELEASED", "CONSUMED"]);

export const reservation = pgTable(
  "reservation",
  {
    id: id(),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLine.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    serviceDate: date("service_date").notNull(),
    qtyBase: integer("qty_base").notNull(),
    status: reservationStatus("status").notNull().default("RESERVED"),
    expiresAt: ts("expires_at"), // soft hold for unpaid prepaid orders
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reservation_line_idx").on(t.orderLineId), index("reservation_open_idx").on(t.productId, t.serviceDate).where(sql`${t.status} = 'RESERVED'`), check("reservation_qty", sql`${t.qtyBase} > 0`)],
);
