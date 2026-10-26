import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh, Countdown } from "@/components/admin/kit";
import { PageHeader, Panel, SpeedBadge, Stat, StatusBadge } from "@/components/admin/parts";
import { buttonClass } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { nowMs } from "@/lib/clock";
import { currentStaff } from "@/server/auth/guards";
import { can, permissionsFor } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { messageHealth } from "@/server/notify/dispatcher";
import { todaySummary } from "@/server/services/admin/ops";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  const roles = ctx.user.roles;
  const manager = can(roles, "delivery.manage");
  // People whose job is one screen land on it.
  if (!manager) {
    if (can(roles, "order.deliver")) redirect("/admin/rider");
    if (can(roles, "order.pack")) redirect("/admin/packing");
    if (can(roles, "stock.adjust")) redirect("/admin/stock");
    if (can(roles, "customer.read")) redirect("/admin/orders");
  }
  const [t, mh] = await Promise.all([todaySummary(db()), messageHealth(db())]);
  const now = nowMs();
  const perms = [...permissionsFor(roles)].sort();
  const waiting = t.byStatus.CONFIRMED ?? 0;

  return (
    <div className="max-w-5xl">
      <AutoRefresh seconds={20} />
      <PageHeader
        title={`Hello, ${ctx.user.name.split(" ")[0]}`}
        sub="Everything the hub is working on right now. This page refreshes by itself."
        actions={
          <Link href="/admin/dispatch" className={buttonClass({ size: "md" })}>
            Open dispatch board
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New orders" value={waiting} sub={waiting > 0 ? "waiting to be packed" : "all picked up"} tone={waiting > 0 ? "brand" : undefined} />
        <Stat label="In progress" value={(t.byStatus.PACKING ?? 0) + (t.byStatus.PACKED ?? 0) + (t.byStatus.OUT_FOR_DELIVERY ?? 0)} sub={`${t.byStatus.OUT_FOR_DELIVERY ?? 0} out for delivery`} />
        <Stat label="Running late" value={t.late} tone={t.late > 0 ? "danger" : undefined} sub={t.dueSoon > 0 ? `${t.dueSoon} more due in 10 min` : "nothing overdue"} />
        <Stat label="Needs a decision" value={t.needAttention + t.waitingForRider} tone={t.needAttention > 0 ? "danger" : undefined} sub={`${t.needAttention} on hold or failed, ${t.waitingForRider} need a rider`} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Delivered today" value={t.deliveredToday} />
        <Stat label="Sales today" value={formatINR(t.goodsTodayPaise)} sub="items only, after short-weight adjustments" />
        <Stat label="Cash with riders" value={formatINR(t.cashHeldPaise)} sub={t.cashHeldPaise > 0 ? "not handed in yet" : "all handed in"} />
      </div>

      {mh.failed > 0 || mh.waiting > 0 ? (
        <div className="mt-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-[14px]">
          <p className="font-bold text-danger">{mh.failed > 0 ? `${mh.failed} customer message${mh.failed === 1 ? "" : "s"} could not be delivered in the last 3 days` : `${mh.waiting} message${mh.waiting === 1 ? " is" : "s are"} waiting to be retried`}</p>
          <p className="text-muted">Open the order to see which message, and phone the customer if it matters.</p>
        </div>
      ) : null}

      <Panel title="Next due" sub="Orders closest to their promised time" className="mt-6" flush>
        {t.nextDue.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted">No active orders right now.</p>
        ) : (
          <ul className="divide-y divide-line">
            {t.nextDue.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2">
                  <span className="font-mono font-bold tracking-wide">{o.publicCode}</span>
                  <SpeedBadge name={o.optionName} />
                  <StatusBadge status={o.status} />
                  <span className="ml-auto text-[13px] text-muted">by {formatTime(o.promisedAt)}</span>
                  <Countdown at={o.promisedAt.toISOString()} serverNow={now} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <details className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-3.5 shadow-card">
        <summary className="cursor-pointer text-[14px] font-bold">Your access</summary>
        <p className="mb-3 mt-2 text-[13.5px] text-muted">Permissions are enforced on the server for every action, not only in the menus.</p>
        <ul className="flex flex-wrap gap-1.5">
          {perms.map((p) => (
            <li key={p} className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[12px] text-muted">
              {p}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
