import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel, formatBase, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { formatDateTime, formatServiceDate } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { getStockOverview, listRecentPurchases, listSuppliers } from "@/server/services/admin/stock";
import { istDate } from "@/server/services/delivery";
import { StockTable } from "./stock-table";
import { SupplierManager } from "./supplier-manager";

export const metadata = { title: "Stock & buying" };
export const dynamic = "force-dynamic";

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default async function StockPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "stock.read")) redirect("/admin");
  const sp = await searchParams;
  const today = istDate(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const roles = ctx.user.roles;
  const [rows, suppliers, purchases] = await Promise.all([getStockOverview(db(), date), listSuppliers(db()), listRecentPurchases(db(), 12)]);
  const tab = (d: string, label: string) => (
    <Link key={label} href={`/admin/stock?date=${d}`} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${d === date ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:bg-surface-2"}`}>
      {label}
    </Link>
  );
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Stock & buying" sub={`What customers can order on ${formatServiceDate(date)}. Published is what you promise; reserved is what is already ordered.`} actions={<>{tab(addDays(today, -1), "Yesterday")}{tab(today, "Today")}{tab(addDays(today, 1), "Tomorrow")}</>} />

      <StockTable
        date={date}
        canPublish={can(roles, "stock.adjust")}
        canReceive={can(roles, "purchase.write")}
        suppliers={suppliers.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        rows={rows}
      />

      <Panel title="Recent purchases" sub="Latest goods received" flush>
        {purchases.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted">Nothing recorded yet. Use Receive on a product above when stock arrives.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>Product</th>
                  <th className={thClass}>Supplier</th>
                  <th className={`${thClass} text-right`}>Accepted</th>
                  <th className={`${thClass} text-right`}>Rejected</th>
                  <th className={`${thClass} text-right`}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(p.createdAt)}</td>
                    <td className={`${tdClass} font-semibold`}>{p.product}</td>
                    <td className={tdClass}>{p.supplier}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatBase(p.accepted, p.baseUnit)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{p.rejected > 0 ? formatBase(p.rejected, p.baseUnit) : "–"}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatINR(p.costPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Suppliers" sub="People you buy from" flush>
        <SupplierManager canEdit={can(roles, "supplier.write")} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, contactName: s.contactName, phone: s.phone, address: s.address, notes: s.notes, active: s.active }))} />
      </Panel>
    </div>
  );
}
