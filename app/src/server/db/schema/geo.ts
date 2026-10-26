import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_common";

export const city = pgTable("city", {
  id: id(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/**
 * A hub is the packing point / dark store that orders are delivered from.
 * Opening hours are minutes after midnight, India time (IST).
 */
export const hub = pgTable(
  "hub",
  {
    id: id(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => city.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameHi: text("name_hi"),
    address: text("address"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    opensAtMinute: integer("opens_at_minute").notNull().default(7 * 60),
    closesAtMinute: integer("closes_at_minute").notNull().default(22 * 60),
    lastOrderBufferMinutes: integer("last_order_buffer_minutes").notNull().default(20),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("hub_slug_uq").on(t.slug),
    check("hub_lat", sql`${t.lat} between -90 and 90`),
    check("hub_lng", sql`${t.lng} between -180 and 180`),
    check("hub_hours", sql`${t.opensAtMinute} >= 0 AND ${t.closesAtMinute} <= 1440 AND ${t.opensAtMinute} < ${t.closesAtMinute}`),
    check("hub_buffer", sql`${t.lastOrderBufferMinutes} >= 0`),
  ],
);

/** The delivery speeds we sell. Rows are data: fees, promises and minimums are editable by the owner. */
export const deliveryOption = pgTable(
  "delivery_option",
  {
    code: text("code").primaryKey(), // INSTANT | ONE_HOUR | THREE_HOUR
    name: text("name").notNull(),
    nameHi: text("name_hi"),
    feePaise: integer("fee_paise").notNull().default(0),
    promisedMinutes: integer("promised_minutes").notNull(),
    minOrderPaise: integer("min_order_paise").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("delivery_option_code", sql`${t.code} ~ '^[A-Z][A-Z_]{2,29}$'`),
    check("delivery_option_nums", sql`${t.feePaise} >= 0 AND ${t.promisedMinutes} > 0 AND ${t.minOrderPaise} >= 0`),
  ],
);

/** Per hub: which speeds it offers, how far it reaches, and how many orders it can have in progress at once. */
export const hubDeliveryOption = pgTable(
  "hub_delivery_option",
  {
    hubId: uuid("hub_id")
      .notNull()
      .references(() => hub.id, { onDelete: "cascade" }),
    optionCode: text("option_code")
      .notNull()
      .references(() => deliveryOption.code),
    enabled: boolean("enabled").notNull().default(true),
    radiusM: integer("radius_m").notNull(),
    maxActiveOrders: integer("max_active_orders").notNull(),
  },
  (t) => [primaryKey({ columns: [t.hubId, t.optionCode] }), check("hub_option_nums", sql`${t.radiusM} > 0 AND ${t.maxActiveOrders} >= 0`)],
);
