import { sql } from "drizzle-orm";
import type { BaseUnit, WeightModel } from "@/lib/units";
import type { DbOrTx } from "../db/client";

export type Availability = "AVAILABLE" | "LOW" | "SOLD_OUT" | "NOT_PUBLISHED" | "OUT_OF_SEASON" | "UNKNOWN";

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  aliases: string[];
  descriptionEn: string | null;
  descriptionHi: string | null;
  weightModel: WeightModel;
  baseUnit: BaseUnit;
  tolerancePct: number;
  grade: string | null;
  storageNote: string | null;
  originNote: string | null;
  imageKey: string | null;
  popularity: number;
  category: { id: string; slug: string; name: string; nameHi: string };
  unit: { id: string; unitBaseQty: number; minBase: number; maxBase: number; stepBase: number };
  pricePaise: number;
  salePricePaise: number | null;
  /** The price the customer pays: sale price when one is active. */
  effectivePricePaise: number;
  availability: Availability;
  /** Quantity still orderable for the service date, in base units; null when unknown. */
  availableBase: number | null;
}

export type ProductSort = "popular" | "price_asc" | "price_desc" | "name";

export interface ProductQuery {
  serviceDate: string | null; // YYYY-MM-DD; null = availability unknown
  q?: string;
  categorySlug?: string;
  slug?: string;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

/** True when `month` (1-12) falls in the season window; windows may wrap the year end (e.g. 11 -> 2). */
export function inSeason(month: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null) return true;
  return start <= end ? month >= start && month <= end : month >= start || month <= end;
}

export function availabilityFor(args: {
  serviceDate: string | null;
  published: number | null;
  reserved: number | null;
  minBase: number;
  seasonStart: number | null;
  seasonEnd: number | null;
}): { availability: Availability; availableBase: number | null } {
  const { serviceDate, published, reserved, minBase } = args;
  if (!serviceDate) return { availability: "UNKNOWN", availableBase: null };
  const month = Number(serviceDate.slice(5, 7));
  if (!inSeason(month, args.seasonStart, args.seasonEnd)) return { availability: "OUT_OF_SEASON", availableBase: 0 };
  if (published == null) return { availability: "NOT_PUBLISHED", availableBase: 0 };
  const available = Math.max(0, published - (reserved ?? 0));
  if (available < minBase) return { availability: "SOLD_OUT", availableBase: available };
  return { availability: available < minBase * 4 ? "LOW" : "AVAILABLE", availableBase: available };
}

/** Escape LIKE wildcards so user text is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

interface Row extends Record<string, unknown> {
  id: string;
  slug: string;
  name: string;
  name_hi: string;
  aliases: string[];
  description_en: string | null;
  description_hi: string | null;
  weight_model: WeightModel;
  base_unit: BaseUnit;
  tolerance_pct: number;
  grade: string | null;
  storage_note: string | null;
  origin_note: string | null;
  image_key: string | null;
  season_start_month: number | null;
  season_end_month: number | null;
  popularity: number;
  category_id: string;
  category_slug: string;
  category_name: string;
  category_name_hi: string;
  unit_id: string;
  unit_base_qty: number;
  min_base: number;
  max_base: number;
  step_base: number;
  price_paise: number;
  sale_price_paise: number | null;
  published_qty: number | null;
  reserved_qty: number | null;
}

export async function queryProducts(db: DbOrTx, query: ProductQuery): Promise<CatalogProduct[]> {
  const q = (query.q ?? "").trim().toLowerCase().slice(0, 60);
  const like = likePattern(q);
  const where = [sql`p.active`];
  if (query.slug) where.push(sql`p.slug = ${query.slug}`);
  if (query.categorySlug) where.push(sql`c.slug = ${query.categorySlug}`);
  if (q) {
    where.push(sql`(
      lower(p.name) like ${like} escape '\\'
      or p.name_hi like ${like} escape '\\'
      or exists (select 1 from unnest(p.aliases) a where lower(a) like ${like} escape '\\')
      or similarity(lower(p.name), ${q}) > 0.35
      or similarity(lower(array_to_string(p.aliases, ' ')), ${q}) > 0.35
    )`);
  }
  // Relevance: exact name/alias, then prefix, then contains, then fuzzy.
  const relevance = q
    ? sql`case
        when lower(p.name) = ${q} or ${q} = any (select lower(a) from unnest(p.aliases) a) or p.name_hi = ${q} then 0
        when lower(p.name) like ${q.replace(/[\\%_]/g, (c) => `\\${c}`) + "%"} escape '\\' then 1
        when lower(p.name) like ${like} escape '\\' or p.name_hi like ${like} escape '\\' then 2
        else 3 end`
    : sql`0::int`;
  const order =
    query.sort === "price_asc"
      ? sql`coalesce(pr.sale_price_paise, pr.price_paise) * 1000 / u.unit_base_qty asc`
      : query.sort === "price_desc"
        ? sql`coalesce(pr.sale_price_paise, pr.price_paise) * 1000 / u.unit_base_qty desc`
        : query.sort === "name"
          ? sql`lower(p.name) asc`
          : sql`p.popularity desc, lower(p.name) asc`;

  const res = await db.execute<Row>(sql`
    select p.id, p.slug, p.name, p.name_hi, p.aliases, p.description_en, p.description_hi, p.weight_model,
           p.base_unit, p.tolerance_pct, p.grade, p.storage_note, p.origin_note, p.image_key,
           p.season_start_month, p.season_end_month, p.popularity,
           c.id as category_id, c.slug as category_slug, c.name as category_name, c.name_hi as category_name_hi,
           u.id as unit_id, u.unit_base_qty, u.min_base, u.max_base, u.step_base,
           pr.price_paise, pr.sale_price_paise,
           sd.published_qty, sd.reserved_qty
    from product p
    join category c on c.id = p.category_id and c.active
    join sale_unit u on u.product_id = p.id and u.is_default and u.active
    join lateral (
      select price_paise, sale_price_paise from price
      where sale_unit_id = u.id and valid_from <= now() and (valid_to is null or valid_to > now())
      order by valid_from desc limit 1
    ) pr on true
    left join stock_day sd on sd.product_id = p.id and sd.service_date = ${query.serviceDate}::date
    where ${sql.join(where, sql` and `)}
    order by ${relevance}, ${order}
    limit ${Math.min(query.limit ?? 60, 200)} offset ${query.offset ?? 0}`);

  return res.rows.map((r) => {
    const { availability, availableBase } = availabilityFor({
      serviceDate: query.serviceDate,
      published: r.published_qty,
      reserved: r.reserved_qty,
      minBase: r.min_base,
      seasonStart: r.season_start_month,
      seasonEnd: r.season_end_month,
    });
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      nameHi: r.name_hi,
      aliases: r.aliases,
      descriptionEn: r.description_en,
      descriptionHi: r.description_hi,
      weightModel: r.weight_model,
      baseUnit: r.base_unit,
      tolerancePct: Number(r.tolerance_pct),
      grade: r.grade,
      storageNote: r.storage_note,
      originNote: r.origin_note,
      imageKey: r.image_key,
      popularity: r.popularity,
      category: { id: r.category_id, slug: r.category_slug, name: r.category_name, nameHi: r.category_name_hi },
      unit: { id: r.unit_id, unitBaseQty: r.unit_base_qty, minBase: r.min_base, maxBase: r.max_base, stepBase: r.step_base },
      pricePaise: r.price_paise,
      salePricePaise: r.sale_price_paise,
      effectivePricePaise: r.sale_price_paise ?? r.price_paise,
      availability,
      availableBase,
    };
  });
}

export async function getProductBySlug(db: DbOrTx, slug: string, serviceDate: string | null): Promise<CatalogProduct | null> {
  const rows = await queryProducts(db, { slug, serviceDate, limit: 1 });
  return rows[0] ?? null;
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  productCount: number;
}

export async function listCategories(db: DbOrTx): Promise<CatalogCategory[]> {
  const res = await db.execute<{ id: string; slug: string; name: string; name_hi: string; n: number }>(sql`
    select c.id, c.slug, c.name, c.name_hi,
           (select count(*)::int from product p
              join sale_unit u on u.product_id = p.id and u.is_default and u.active
              where p.category_id = c.id and p.active
                and exists (select 1 from price pr where pr.sale_unit_id = u.id and pr.valid_from <= now() and (pr.valid_to is null or pr.valid_to > now()))) as n
    from category c where c.active order by c.sort_order, c.name`);
  return res.rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, nameHi: r.name_hi, productCount: Number(r.n) }));
}
