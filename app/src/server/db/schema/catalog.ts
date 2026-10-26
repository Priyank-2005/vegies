import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, primaryKey, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, ts, updatedAt } from "./_common";

export const weightModel = pgEnum("weight_model", ["FIXED_PACK", "APPROX_PIECE", "LOOSE_WEIGHT"]);
export const baseUnit = pgEnum("base_unit", ["GRAM", "PIECE"]);

export const category = pgTable(
  "category",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameHi: text("name_hi").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    imageKey: text("image_key"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("category_slug_uq").on(t.slug)],
);

export const product = pgTable(
  "product",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(), // English
    nameHi: text("name_hi").notNull(), // Devanagari
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`), // Hinglish / local spellings for search
    descriptionEn: text("description_en"),
    descriptionHi: text("description_hi"),
    weightModel: weightModel("weight_model").notNull().default("LOOSE_WEIGHT"),
    baseUnit: baseUnit("base_unit").notNull().default("GRAM"),
    tolerancePct: smallint("tolerance_pct").notNull().default(0),
    grade: text("grade"),
    storageNote: text("storage_note"),
    originNote: text("origin_note"), // only if verified
    imageKey: text("image_key"),
    seasonStartMonth: smallint("season_start_month"), // 1-12, null = all year
    seasonEndMonth: smallint("season_end_month"),
    popularity: integer("popularity").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("product_slug_uq").on(t.slug),
    index("product_category_idx").on(t.categoryId),
    check("product_tolerance", sql`${t.tolerancePct} between 0 and 50`),
  ],
);

/**
 * A way of buying a product. `unitBaseQty` is the quantity the price refers to
 * (1000 g => "per kg", 500 g, or 1 piece). min/max/step are in base units.
 */
export const saleUnit = pgTable(
  "sale_unit",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    unitBaseQty: integer("unit_base_qty").notNull(),
    minBase: integer("min_base").notNull(),
    maxBase: integer("max_base").notNull(),
    stepBase: integer("step_base").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("sale_unit_product_idx").on(t.productId),
    uniqueIndex("sale_unit_one_default_uq").on(t.productId).where(sql`${t.isDefault} and ${t.active}`),
    check(
      "sale_unit_rules",
      sql`${t.unitBaseQty} > 0 AND ${t.stepBase} > 0 AND ${t.minBase} > 0 AND ${t.maxBase} >= ${t.minBase} AND ${t.minBase} % ${t.stepBase} = 0`,
    ),
  ],
);

/** Price history. Current price = latest row valid now. Rows are never edited, only superseded. */
export const price = pgTable(
  "price",
  {
    id: id(),
    saleUnitId: uuid("sale_unit_id")
      .notNull()
      .references(() => saleUnit.id, { onDelete: "cascade" }),
    pricePaise: integer("price_paise").notNull(),
    salePricePaise: integer("sale_price_paise"),
    validFrom: ts("valid_from").notNull().defaultNow(),
    validTo: ts("valid_to"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("price_unit_idx").on(t.saleUnitId, t.validFrom),
    check("price_pos", sql`${t.pricePaise} > 0`),
    check("price_sale_lt", sql`${t.salePricePaise} is null OR (${t.salePricePaise} > 0 AND ${t.salePricePaise} <= ${t.pricePaise})`),
  ],
);

export const bundle = pgTable(
  "bundle",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameHi: text("name_hi").notNull(),
    descriptionEn: text("description_en"),
    descriptionHi: text("description_hi"),
    pricePaise: integer("price_paise").notNull(),
    imageKey: text("image_key"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("bundle_slug_uq").on(t.slug), check("bundle_price_pos", sql`${t.pricePaise} > 0`)],
);

export const bundleItem = pgTable(
  "bundle_item",
  {
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => bundle.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    qtyBase: integer("qty_base").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bundleId, t.productId] }), check("bundle_item_qty", sql`${t.qtyBase} > 0`)],
);
