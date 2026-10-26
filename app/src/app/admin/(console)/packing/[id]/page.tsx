import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/admin/kit";
import { PageHeader, SpeedBadge, StatusBadge } from "@/components/admin/parts";
import { nowMs } from "@/lib/clock";
import { formatTime } from "@/lib/format";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { getPackingOrder } from "@/server/services/admin/packing";
import { PackingForm } from "./packing-form";

export const metadata = { title: "Pack order" };
export const dynamic = "force-dynamic";

export default async function PackOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "order.pack")) redirect("/admin");
  const { id } = await params;
  const o = await getPackingOrder(db(), id);
  if (!o) notFound();
  return (
    <div className="max-w-2xl">
      <Link href="/admin/packing" className="mb-3 inline-block text-[13px] font-semibold text-brand hover:underline">
        ← Packing queue
      </Link>
      <PageHeader
        title={o.publicCode}
        sub={`Promised by ${formatTime(o.promisedAt)}`}
        actions={
          <>
            <StatusBadge status={o.status} />
            <SpeedBadge name={o.optionName} />
            <Countdown at={o.promisedAt.toISOString()} serverNow={nowMs()} className="text-[14px]" />
          </>
        }
      />
      <PackingForm
        orderId={o.id}
        status={o.status}
        customerNote={o.customerNote}
        canResolve={can(ctx.user.roles, "order.pack")}
        lines={o.lines.map((l) => ({
          id: l.id,
          nameEn: l.nameEn,
          nameHi: l.nameHi,
          baseUnit: l.baseUnit,
          weightModel: l.weightModel,
          qtyOrderedBase: l.qtyOrderedBase,
          qtyPackedBase: l.qtyPackedBase,
          lineTotalPaise: l.lineTotalPaise,
          refundedPaise: l.refundedPaise,
          status: l.status,
          minOkBase: l.minOkBase,
          maxFreeBase: l.maxFreeBase,
        }))}
      />
    </div>
  );
}
