import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh, Countdown } from "@/components/admin/kit";
import { PageHeader, Panel, SpeedBadge, StatusBadge } from "@/components/admin/parts";
import { nowMs } from "@/lib/clock";
import { formatTime } from "@/lib/format";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { packingQueue } from "@/server/services/admin/packing";

export const metadata = { title: "Packing" };
export const dynamic = "force-dynamic";

export default async function PackingQueuePage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "order.pack")) redirect("/admin");
  const queue = await packingQueue(db());
  const now = nowMs();
  return (
    <div className="max-w-3xl">
      <AutoRefresh seconds={10} />
      <PageHeader title="Packing" sub="Orders waiting to be put together, most urgent first. New orders appear here by themselves." />
      {queue.length === 0 ? (
        <Panel>
          <p className="py-8 text-center text-muted">Nothing to pack right now.</p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {queue.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/packing/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-line bg-surface p-4 shadow-card hover:border-line-strong">
                <span className="font-mono text-[18px] font-extrabold tracking-wide">{o.publicCode}</span>
                <SpeedBadge name={o.optionName} />
                <StatusBadge status={o.status} />
                <span className="ml-auto text-right">
                  <span className="block text-[13px] text-muted">
                    {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · by {formatTime(o.promisedAt)}
                  </span>
                  <Countdown at={o.promisedAt.toISOString()} serverNow={now} className="text-[14px]" />
                </span>
                {o.customerNote ? <span className="w-full rounded-md bg-accent-soft px-2.5 py-1 text-[13px] text-accent-ink">“{o.customerNote}”</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
