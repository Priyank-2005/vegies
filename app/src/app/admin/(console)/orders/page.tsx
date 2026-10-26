import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel, SpeedBadge, StatusBadge, STATUS_LABEL, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { Button, Input, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { searchOrders } from "@/server/services/admin/orders";
import type { OrderStatus } from "@/server/domain/order-state";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  // Orders show customers' names, phones and addresses: only roles that deal with customers see them (not riders or packers).
  if (!can(ctx.user.roles, "customer.read")) redirect("/admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const status = sp.status && sp.status in STATUS_LABEL ? (sp.status as OrderStatus) : undefined;
  const orders = await searchOrders(db(), { q, status });
  return (
    <div className="max-w-6xl">
      <PageHeader title="Orders" sub="Find any order by its code, the customer's name or phone number." />
      <form method="get" className="mb-5 flex flex-wrap gap-2" role="search">
        <div className="min-w-56 flex-1">
          <Input name="q" defaultValue={q} placeholder="Order code, name or phone" aria-label="Search orders" />
        </div>
        <div className="w-full sm:w-52">
          <Select name="status" defaultValue={status ?? ""} aria-label="Status">
            <option value="">Any status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Search</Button>
      </form>
      <Panel flush>
        {orders.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No orders match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Order</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Speed</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Total</th>
                  <th className={thClass}>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-2">
                    <td className={tdClass}>
                      <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold tracking-wide text-brand hover:underline">
                        {o.publicCode}
                      </Link>
                    </td>
                    <td className={tdClass}>{o.recipientName}</td>
                    <td className={tdClass}>
                      <SpeedBadge name={o.optionName} />
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatINR(o.totalPaise)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
