import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/admin/kit";
import { PageHeader } from "@/components/admin/parts";
import { nowMs } from "@/lib/clock";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { listBoard, listRiders } from "@/server/services/admin/orders";
import { DispatchBoard } from "./dispatch-board";

export const metadata = { title: "Dispatch board" };
export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "delivery.manage")) redirect("/admin");
  const [orders, riders] = await Promise.all([listBoard(db()), listRiders(db())]);
  return (
    <div>
      <AutoRefresh seconds={15} />
      <PageHeader title="Dispatch board" sub="Every active order, by stage. Most urgent first. This page refreshes by itself." />
      <DispatchBoard
        serverNow={nowMs()}
        riders={riders.map((r) => ({ id: r.id, name: r.name, active: r.active }))}
        orders={orders.map((o) => ({
          id: o.id,
          publicCode: o.publicCode,
          status: o.status,
          optionCode: o.optionCode,
          optionName: o.optionName,
          promisedAt: o.promisedAt.toISOString(),
          recipientName: o.recipientName,
          addressLine: o.addressLine,
          itemCount: o.itemCount,
          dueNowPaise: o.paymentMode === "PAY_ON_DELIVERY" ? o.dueNowPaise : 0,
          riderId: o.riderId,
          riderName: o.riderName,
          note: o.customerNote,
        }))}
      />
    </div>
  );
}
