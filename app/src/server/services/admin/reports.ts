import { sql } from "drizzle-orm";
import { assertCan } from "../../auth/permissions";
import type { Db, DbOrTx } from "../../db/client";
import { istInstant } from "../delivery";
import { assertDate, type StaffActor } from "./common";

export interface ReportRange {
  from: string; // inclusive, India date
  to: string; // inclusive, India date
}

export interface Report {
  range: ReportRange;
  placed: number;
  delivered: number;
  cancelled: number;
  failedNow: number;
  /** Delivered orders only. */
  goodsPaise: number; // item value after short-weight adjustments
  feesPaise: number;
  adjustedPaise: number; // short-weight / missing-item reductions
  collectedPaise: number; // total money due on delivered orders (items net + fees)
  avgBasketPaise: number;
  onTimePct: number | null;
  avgDeliveryMinutes: number | null;
  bySpeed: Array<{ code: string; name: string; delivered: number; feesPaise: number; onTimePct: number | null; avgBasketPaise: number }>;
  daily: Array<{ date: string; placed: number; delivered: number; collectedPaise: number }>;
  topProducts: Array<{ name: string; nameHi: string; orders: number; revenuePaise: number; baseUnit: string; qtyBase: number }>;
  cash: { cashPaise: number; upiPaise: number; cashUndepositedPaise: number };
  wastage: Array<{ name: string; baseUnit: string; qtyBase: number }>;
}

function bounds(range: ReportRange): { from: Date; to: Date } {
  assertDate(range.from, "start date");
  assertDate(range.to, "end date");
  const from = istInstant(range.from, 0);
  const to = istInstant(range.to, 1440);
  return { from, to };
}

type Row = Record<string, unknown>;
const q = async <T extends Row>(db: DbOrTx, query: ReturnType<typeof sql>): Promise<T[]> => ((await db.execute(query)) as unknown as { rows: T[] }).rows;

/** Business report for a date range (India dates). Orders are bucketed by when they were placed, deliveries by when they were delivered. */
export async function buildReport(db: Db, args: { range: ReportRange; actor: StaffActor }): Promise<Report> {
  assertCan(args.actor.roles, "report.read");
  const { from, to } = bounds(args.range);
  const f = from.toISOString();
  const t = to.toISOString();

  const [counts] = await q<{ placed: number; delivered: number; cancelled: number; failed_now: number }>(
    db,
    sql`select
      count(*) filter (where created_at >= ${f} and created_at < ${t} and status not in ('PENDING_PAYMENT','EXPIRED'))::int as placed,
      count(*) filter (where delivered_at >= ${f} and delivered_at < ${t})::int as delivered,
      count(*) filter (where status = 'CANCELLED' and cancelled_at >= ${f} and cancelled_at < ${t})::int as cancelled,
      count(*) filter (where status = 'DELIVERY_FAILED')::int as failed_now
    from orders`,
  );

  const [money] = await q<{ goods: number; fees: number; adjusted: number; on_time: number | null; avg_min: number | null; delivered: number }>(
    db,
    sql`with d as (
      select o.*, coalesce((select sum(l.refunded_paise) from order_line l where l.order_id = o.id), 0) as refunded
      from orders o where o.delivered_at >= ${f} and o.delivered_at < ${t}
    )
    select
      coalesce(sum(subtotal_paise - refunded), 0)::int as goods,
      coalesce(sum(fee_paise), 0)::int as fees,
      coalesce(sum(refunded), 0)::int as adjusted,
      (100.0 * count(*) filter (where delivered_at <= promised_at) / nullif(count(*), 0))::float as on_time,
      (avg(extract(epoch from (delivered_at - created_at)) / 60.0))::float as avg_min,
      count(*)::int as delivered
    from d`,
  );

  const bySpeed = await q<{ code: string; name: string; delivered: number; fees: number; on_time: number | null; goods: number }>(
    db,
    sql`with d as (
      select o.*, coalesce((select sum(l.refunded_paise) from order_line l where l.order_id = o.id), 0) as refunded
      from orders o where o.delivered_at >= ${f} and o.delivered_at < ${t}
    )
    select opt.code, opt.name, count(d.id)::int as delivered,
      coalesce(sum(d.fee_paise), 0)::int as fees,
      (100.0 * count(*) filter (where d.delivered_at <= d.promised_at) / nullif(count(d.id), 0))::float as on_time,
      coalesce(sum(d.subtotal_paise - d.refunded), 0)::int as goods
    from delivery_option opt left join d on d.delivery_option = opt.code
    group by opt.code, opt.name, opt.sort_order order by opt.sort_order`,
  );

  const daily = await q<{ day: string; placed: number; delivered: number; collected: number }>(
    db,
    sql`with days as (
      select generate_series(${args.range.from}::date, ${args.range.to}::date, interval '1 day')::date as day
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      (select count(*) from orders o where (o.created_at at time zone 'Asia/Kolkata')::date = days.day and o.status not in ('PENDING_PAYMENT','EXPIRED'))::int as placed,
      (select count(*) from orders o where (o.delivered_at at time zone 'Asia/Kolkata')::date = days.day)::int as delivered,
      (select coalesce(sum(o.total_paise - coalesce((select sum(l.refunded_paise) from order_line l where l.order_id = o.id), 0)), 0) from orders o where (o.delivered_at at time zone 'Asia/Kolkata')::date = days.day)::int as collected
    from days order by days.day`,
  );

  const top = await q<{ name: string; name_hi: string; orders: number; revenue: number; base_unit: string; qty: number }>(
    db,
    sql`select min(l.name_en) as name, min(l.name_hi) as name_hi, count(distinct l.order_id)::int as orders,
      coalesce(sum(l.line_total_paise - l.refunded_paise), 0)::int as revenue, min(l.base_unit) as base_unit,
      coalesce(sum(coalesce(l.qty_packed_base, l.qty_ordered_base)), 0)::int as qty
    from order_line l join orders o on o.id = l.order_id
    where o.delivered_at >= ${f} and o.delivered_at < ${t} and l.status <> 'CANCELLED'
    group by l.product_id order by revenue desc limit 10`,
  );

  const [cash] = await q<{ cash: number; upi: number; undeposited: number }>(
    db,
    sql`select
      coalesce(sum(amount_paise) filter (where method = 'CASH'), 0)::int as cash,
      coalesce(sum(amount_paise) filter (where method = 'UPI'), 0)::int as upi,
      coalesce(sum(amount_paise) filter (where method = 'CASH' and deposited_at is null), 0)::int as undeposited
    from cash_receipt where created_at >= ${f} and created_at < ${t}`,
  );

  const waste = await q<{ name: string; base_unit: string; qty: number }>(
    db,
    sql`select p.name, p.base_unit, sum(m.qty_base)::int as qty
    from stock_movement m join product p on p.id = m.product_id
    where m.type = 'WASTED' and m.service_date >= ${args.range.from}::date and m.service_date <= ${args.range.to}::date
    group by p.id, p.name, p.base_unit order by qty desc limit 10`,
  );

  const delivered = money?.delivered ?? 0;
  const collected = (money?.goods ?? 0) + (money?.fees ?? 0);
  return {
    range: args.range,
    placed: counts?.placed ?? 0,
    delivered,
    cancelled: counts?.cancelled ?? 0,
    failedNow: counts?.failed_now ?? 0,
    goodsPaise: money?.goods ?? 0,
    feesPaise: money?.fees ?? 0,
    adjustedPaise: money?.adjusted ?? 0,
    collectedPaise: collected,
    avgBasketPaise: delivered > 0 ? Math.round((money?.goods ?? 0) / delivered) : 0,
    onTimePct: money?.on_time ?? null,
    avgDeliveryMinutes: money?.avg_min ?? null,
    bySpeed: bySpeed.map((s) => ({ code: s.code, name: s.name, delivered: s.delivered, feesPaise: s.fees, onTimePct: s.on_time, avgBasketPaise: s.delivered > 0 ? Math.round(s.goods / s.delivered) : 0 })),
    daily: daily.map((d) => ({ date: d.day, placed: d.placed, delivered: d.delivered, collectedPaise: d.collected })),
    topProducts: top.map((p) => ({ name: p.name, nameHi: p.name_hi, orders: p.orders, revenuePaise: p.revenue, baseUnit: p.base_unit, qtyBase: p.qty })),
    cash: { cashPaise: cash?.cash ?? 0, upiPaise: cash?.upi ?? 0, cashUndepositedPaise: cash?.undeposited ?? 0 },
    wastage: waste.map((w) => ({ name: w.name, baseUnit: w.base_unit, qtyBase: w.qty })),
  };
}

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Spreadsheet programs run text that starts with = + - @ as a formula: neutralise it.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per order placed in the range, for a spreadsheet. */
export async function ordersCsv(db: Db, args: { range: ReportRange; actor: StaffActor }): Promise<string> {
  assertCan(args.actor.roles, "report.read");
  const { from, to } = bounds(args.range);
  const rows = await q<Row>(
    db,
    sql`select o.public_code, to_char(o.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as placed_at, o.status, opt.name as speed,
      o.payment_mode, o.subtotal_paise, o.fee_paise, coalesce((select sum(l.refunded_paise) from order_line l where l.order_id = o.id), 0)::int as adjusted_paise,
      o.total_paise, to_char(o.promised_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as promised_at,
      to_char(o.delivered_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as delivered_at, r.name as rider
    from orders o join delivery_option opt on opt.code = o.delivery_option left join staff_user r on r.id = o.rider_id
    where o.created_at >= ${from.toISOString()} and o.created_at < ${to.toISOString()}
    order by o.created_at`,
  );
  const header = ["Order", "Placed (IST)", "Status", "Speed", "Payment", "Items (paise)", "Delivery fee (paise)", "Adjusted (paise)", "Total (paise)", "Promised (IST)", "Delivered (IST)", "Rider"];
  const keys = ["public_code", "placed_at", "status", "speed", "payment_mode", "subtotal_paise", "fee_paise", "adjusted_paise", "total_paise", "promised_at", "delivered_at", "rider"];
  return [header.join(","), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(","))].join("\r\n") + "\r\n";
}
