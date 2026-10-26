import Link from "next/link";
import { redirect } from "next/navigation";
import { formatBase, PageHeader, Panel, Stat, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { Button, cx, Input } from "@/components/ui";
import { formatServiceDate } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { istDate } from "@/server/services/delivery";
import { buildReport } from "@/server/services/admin/reports";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "report.read")) redirect("/admin");
  const sp = await searchParams;
  const today = istDate(new Date());
  let from = isDate(sp.from) ? sp.from : addDays(today, -6);
  let to = isDate(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  if (addDays(from, 92) < to) from = addDays(to, -92); // keep queries small: at most about three months
  const r = await buildReport(db(), { range: { from, to }, actor: { userId: ctx.user.id, roles: ctx.user.roles } });
  const presets: Array<[string, string, string]> = [
    ["Today", today, today],
    ["Yesterday", addDays(today, -1), addDays(today, -1)],
    ["Last 7 days", addDays(today, -6), today],
    ["Last 30 days", addDays(today, -29), today],
  ];
  const maxDay = Math.max(1, ...r.daily.map((d) => d.collectedPaise));
  const csv = `/admin/reports/export?from=${from}&to=${to}`;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Reports" sub={`${formatServiceDate(from)} to ${formatServiceDate(to)} (India time)`} actions={<a href={csv} className="inline-flex min-h-9 items-center rounded-[var(--radius-ctl)] border border-line-strong px-3 text-[13px] font-bold hover:bg-surface-2">Download orders (CSV)</a>} />

      <div className="mb-5 flex flex-wrap items-end gap-2">
        {presets.map(([label, f, t]) => (
          <Link key={label} href={`/admin/reports?from=${f}&to=${t}`} className={cx("rounded-full border px-3.5 py-1.5 text-[13px] font-semibold", f === from && t === to ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:bg-surface-2")}>
            {label}
          </Link>
        ))}
        <form method="get" className="ml-auto flex flex-wrap items-end gap-2">
          <label className="text-[12px] font-semibold text-muted">
            From
            <span className="mt-0.5 block w-40"><Input type="date" name="from" defaultValue={from} max={today} className="min-h-9" /></span>
          </label>
          <label className="text-[12px] font-semibold text-muted">
            To
            <span className="mt-0.5 block w-40"><Input type="date" name="to" defaultValue={to} max={today} className="min-h-9" /></span>
          </label>
          <Button type="submit" size="sm">
            Show
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders placed" value={r.placed} sub={`${r.cancelled} cancelled`} />
        <Stat label="Delivered" value={r.delivered} sub={r.failedNow > 0 ? `${r.failedNow} failed delivery open now` : undefined} />
        <Stat label="Sales (items)" value={formatINR(r.goodsPaise)} sub={r.adjustedPaise > 0 ? `after ${formatINR(r.adjustedPaise)} short-weight adjustments` : "after adjustments"} />
        <Stat label="Delivery fees" value={formatINR(r.feesPaise)} sub="no other charges are taken" />
        <Stat label="Average basket" value={formatINR(r.avgBasketPaise)} sub="items per delivered order" />
        <Stat label="On time" value={r.onTimePct === null ? "–" : `${Math.round(r.onTimePct)}%`} tone={r.onTimePct !== null && r.onTimePct < 80 ? "danger" : "brand"} sub="delivered by the promised time" />
        <Stat label="Average time" value={r.avgDeliveryMinutes === null ? "–" : `${Math.round(r.avgDeliveryMinutes)} min`} sub="from order to door" />
        <Stat label="Cash collected" value={formatINR(r.cash.cashPaise)} sub={`${formatINR(r.cash.cashUndepositedPaise)} not yet handed in · UPI ${formatINR(r.cash.upiPaise)}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="By delivery speed" flush>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Speed</th>
                <th className={`${thClass} text-right`}>Delivered</th>
                <th className={`${thClass} text-right`}>Fees</th>
                <th className={`${thClass} text-right`}>Avg basket</th>
                <th className={`${thClass} text-right`}>On time</th>
              </tr>
            </thead>
            <tbody>
              {r.bySpeed.map((s) => (
                <tr key={s.code}>
                  <td className={`${tdClass} font-semibold`}>{s.name}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{s.delivered}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatINR(s.feesPaise)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatINR(s.avgBasketPaise)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{s.onTimePct === null ? "–" : `${Math.round(s.onTimePct)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Top products" sub="By sales in the period" flush>
          {r.topProducts.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted">No deliveries in this period.</p>
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Product</th>
                  <th className={`${thClass} text-right`}>Orders</th>
                  <th className={`${thClass} text-right`}>Quantity</th>
                  <th className={`${thClass} text-right`}>Sales</th>
                </tr>
              </thead>
              <tbody>
                {r.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td className={`${tdClass} font-semibold`}>
                      {p.name} <span className="deva font-normal text-muted">{p.nameHi}</span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{p.orders}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatBase(p.qtyBase, p.baseUnit)}</td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatINR(p.revenuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Day by day" className="mt-5" flush>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Day</th>
              <th className={`${thClass} text-right`}>Placed</th>
              <th className={`${thClass} text-right`}>Delivered</th>
              <th className={`${thClass} w-1/2`}>Collected</th>
            </tr>
          </thead>
          <tbody>
            {r.daily.map((d) => (
              <tr key={d.date}>
                <td className={`${tdClass} whitespace-nowrap font-semibold`}>{formatServiceDate(d.date)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{d.placed}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{d.delivered}</td>
                <td className={tdClass}>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((d.collectedPaise / maxDay) * 100)}%` }} />
                    </div>
                    <span className="w-24 text-right tabular-nums">{formatINR(d.collectedPaise)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {r.wastage.length > 0 ? (
        <Panel title="Wastage" sub="Stock thrown away in the period" className="mt-5" flush>
          <ul className="divide-y divide-line">
            {r.wastage.map((w) => (
              <li key={w.name} className="flex justify-between px-5 py-2.5 text-[14px]">
                <span className="font-semibold">{w.name}</span>
                <span className="tabular-nums">{formatBase(w.qtyBase, w.baseUnit)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
