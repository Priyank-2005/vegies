import { sql } from "drizzle-orm";
import { checkQuantity, lineTotal, type BaseUnit, type QuantityError, type WeightModel } from "@/lib/units";
import type { DbOrTx } from "../db/client";
import { availabilityFor } from "./catalog";

export interface CartItemInput {
  saleUnitId: string;
  qtyBase: number;
}

export type PricingIssueCode =
  | "UNKNOWN_ITEM"
  | "INACTIVE"
  | "OUT_OF_SEASON"
  | "NOT_PUBLISHED"
  | "SOLD_OUT"
  | "INSUFFICIENT_STOCK"
  | "NO_PRICE"
  | QuantityError;

export interface PricingIssue {
  saleUnitId: string;
  code: PricingIssueCode;
  /** Quantity that would be accepted instead (e.g. what is left), when meaningful. */
  maxAvailableBase?: number;
}

export interface PricedLine {
  saleUnitId: string;
  productId: string;
  nameEn: string;
  nameHi: string;
  baseUnit: BaseUnit;
  weightModel: WeightModel;
  tolerancePct: number;
  unitBaseQty: number;
  unitPricePaise: number; // effective price actually charged for unitBaseQty
  listPricePaise: number;
  qtyBase: number;
  lineTotalPaise: number;
}

/** Display + quantity-rule info for every unit in the cart that exists, even ones that have issues. */
export interface UnitInfo {
  slug: string;
  categorySlug: string;
  nameEn: string;
  nameHi: string;
  baseUnit: BaseUnit;
  unitBaseQty: number;
  unitPricePaise: number;
  minBase: number;
  maxBase: number;
  stepBase: number;
}

export interface PricingResult {
  serviceDate: string;
  lines: PricedLine[];
  units: Record<string, UnitInfo>;
  subtotalPaise: number;
  issues: PricingIssue[];
  /** True when every line is valid and orderable. */
  ok: boolean;
}

export const MAX_CART_LINES = 60;

interface Row extends Record<string, unknown> {
  unit_id: string;
  unit_base_qty: number;
  min_base: number;
  max_base: number;
  step_base: number;
  unit_active: boolean;
  product_id: string;
  slug: string;
  category_slug: string;
  name: string;
  name_hi: string;
  product_active: boolean;
  weight_model: WeightModel;
  base_unit: BaseUnit;
  tolerance_pct: number;
  season_start_month: number | null;
  season_end_month: number | null;
  price_paise: number | null;
  sale_price_paise: number | null;
  published_qty: number | null;
  reserved_qty: number | null;
}

/**
 * The ONLY place prices are computed. Client-supplied prices/totals do not exist in the API;
 * everything comes from the database at call time (acceptance AC-PRICE).
 */
export async function priceCart(db: DbOrTx, args: { serviceDate: string; items: CartItemInput[] }): Promise<PricingResult> {
  const { serviceDate } = args;
  if (args.items.length > MAX_CART_LINES) throw new RangeError(`A cart can have at most ${MAX_CART_LINES} lines`);

  // Merge duplicate lines so the same unit cannot sneak past max-quantity checks twice.
  const merged = new Map<string, number>();
  for (const it of args.items) {
    if (!Number.isSafeInteger(it.qtyBase)) throw new RangeError("qtyBase must be an integer");
    merged.set(it.saleUnitId, (merged.get(it.saleUnitId) ?? 0) + it.qtyBase);
  }
  const ids = [...merged.keys()];
  const issues: PricingIssue[] = [];
  const lines: PricedLine[] = [];
  const units: Record<string, UnitInfo> = {};
  if (ids.length === 0) return { serviceDate, lines, units, subtotalPaise: 0, issues, ok: false };

  const res = await db.execute<Row>(sql`
    select u.id as unit_id, u.unit_base_qty, u.min_base, u.max_base, u.step_base, u.active as unit_active,
           p.id as product_id, p.slug, c.slug as category_slug, p.name, p.name_hi, p.active as product_active, p.weight_model, p.base_unit,
           p.tolerance_pct, p.season_start_month, p.season_end_month,
           pr.price_paise, pr.sale_price_paise, sd.published_qty, sd.reserved_qty
    from sale_unit u
    join product p on p.id = u.product_id
    join category c on c.id = p.category_id
    left join lateral (
      select price_paise, sale_price_paise from price
      where sale_unit_id = u.id and valid_from <= now() and (valid_to is null or valid_to > now())
      order by valid_from desc limit 1
    ) pr on true
    left join stock_day sd on sd.product_id = p.id and sd.service_date = ${serviceDate}::date
    where u.id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
  const byId = new Map(res.rows.map((r) => [r.unit_id, r]));

  for (const [saleUnitId, qtyBase] of merged) {
    const r = byId.get(saleUnitId);
    if (!r) {
      issues.push({ saleUnitId, code: "UNKNOWN_ITEM" });
      continue;
    }
    if (!r.unit_active || !r.product_active) {
      issues.push({ saleUnitId, code: "INACTIVE" });
      continue;
    }
    if (r.price_paise == null) {
      issues.push({ saleUnitId, code: "NO_PRICE" });
      continue;
    }
    units[saleUnitId] = {
      slug: r.slug,
      categorySlug: r.category_slug,
      nameEn: r.name,
      nameHi: r.name_hi,
      baseUnit: r.base_unit,
      unitBaseQty: r.unit_base_qty,
      unitPricePaise: r.sale_price_paise ?? r.price_paise,
      minBase: r.min_base,
      maxBase: r.max_base,
      stepBase: r.step_base,
    };
    const qIssue = checkQuantity({ minBase: r.min_base, maxBase: r.max_base, stepBase: r.step_base }, qtyBase);
    if (qIssue) {
      issues.push({ saleUnitId, code: qIssue });
      continue;
    }
    const { availability, availableBase } = availabilityFor({
      serviceDate,
      published: r.published_qty,
      reserved: r.reserved_qty,
      minBase: r.min_base,
      seasonStart: r.season_start_month,
      seasonEnd: r.season_end_month,
    });
    if (availability === "OUT_OF_SEASON" || availability === "NOT_PUBLISHED" || availability === "SOLD_OUT") {
      issues.push({ saleUnitId, code: availability });
      continue;
    }
    if (availableBase != null && qtyBase > availableBase) {
      issues.push({ saleUnitId, code: "INSUFFICIENT_STOCK", maxAvailableBase: availableBase - (availableBase % r.step_base) });
      continue;
    }
    const unitPrice = r.sale_price_paise ?? r.price_paise;
    const total = lineTotal(qtyBase, unitPrice, r.unit_base_qty);
    lines.push({
      saleUnitId,
      productId: r.product_id,
      nameEn: r.name,
      nameHi: r.name_hi,
      baseUnit: r.base_unit,
      weightModel: r.weight_model,
      tolerancePct: Number(r.tolerance_pct),
      unitBaseQty: r.unit_base_qty,
      unitPricePaise: unitPrice,
      listPricePaise: r.price_paise,
      qtyBase,
      lineTotalPaise: total,
    });
  }

  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  return {
    serviceDate,
    lines,
    units,
    subtotalPaise,
    issues,
    ok: issues.length === 0 && lines.length > 0,
  };
}
