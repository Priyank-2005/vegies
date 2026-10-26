import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/admin/kit";
import { PageHeader, Panel, Stat, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { cashHeldByRider } from "@/server/services/admin/ops";
import { DepositButton } from "./deposit-button";

export const metadata = { title: "Cash" };
export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "delivery.manage")) redirect("/admin");
  const held = await cashHeldByRider(db());
  const total = held.reduce((s, h) => s + h.amountPaise, 0);
  return (
    <div className="max-w-4xl">
      <AutoRefresh seconds={30} />
      <PageHeader title="Cash from deliveries" sub="Cash riders have collected at the door and not yet handed in. UPI payments go straight to the business account, so they are not listed here." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat label="With riders now" value={formatINR(total)} tone={total > 0 ? "danger" : "brand"} />
        <Stat label="Riders holding cash" value={held.length} />
      </div>
      <Panel title="By rider" sub="When a rider hands in their cash, count it, then record it here." flush>
        {held.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No cash is waiting to be handed in.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Rider</th>
                  <th className={`${thClass} text-right`}>Deliveries</th>
                  <th className={thClass}>Oldest collection</th>
                  <th className={`${thClass} text-right`}>Cash held</th>
                  <th className={thClass}>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {held.map((h) => (
                  <tr key={h.riderId}>
                    <td className={`${tdClass} font-semibold`}>{h.riderName}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{h.receipts}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(h.oldest)}</td>
                    <td className={`${tdClass} text-right font-extrabold tabular-nums`}>{formatINR(h.amountPaise)}</td>
                    <td className={`${tdClass} text-right`}>
                      <DepositButton riderId={h.riderId} riderName={h.riderName} amountLabel={formatINR(h.amountPaise)} />
                    </td>
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
