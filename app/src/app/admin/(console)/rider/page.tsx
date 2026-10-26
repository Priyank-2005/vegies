import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/admin/kit";
import { PageHeader, Stat } from "@/components/admin/parts";
import { nowMs } from "@/lib/clock";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { riderView } from "@/server/services/admin/ops";
import { RiderOrders } from "./rider-orders";

export const metadata = { title: "My deliveries" };
export const dynamic = "force-dynamic";

export default async function RiderPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "order.deliver")) redirect("/admin");
  const v = await riderView(db(), ctx.user.id);
  return (
    <div className="mx-auto max-w-xl">
      <AutoRefresh seconds={20} />
      <PageHeader title="My deliveries" sub={`Signed in as ${ctx.user.name}`} />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat label="Delivered today" value={v.deliveredToday} />
        <Stat label="Cash I am holding" value={formatINR(v.cashHeldPaise)} sub={v.cashHeldPaise > 0 ? "hand it in to the manager" : undefined} />
      </div>
      <RiderOrders
        serverNow={nowMs()}
        mine={v.mine.map((o) => ({ ...o, promisedAt: o.promisedAt.toISOString() }))}
        open={v.open.map((o) => ({ ...o, promisedAt: o.promisedAt.toISOString() }))}
      />
    </div>
  );
}
