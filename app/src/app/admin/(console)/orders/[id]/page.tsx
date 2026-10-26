import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/admin/kit";
import { formatBase, PageHeader, Panel, SpeedBadge, StatusBadge, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { Badge } from "@/components/ui";
import { nowMs } from "@/lib/clock";
import { formatDateTime, formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { getOrderDetail, listRiders } from "@/server/services/admin/orders";
import { OrderActions } from "./order-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order" };

const MESSAGE_LABEL: Record<string, string> = {
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_OUT_FOR_DELIVERY: "Out for delivery",
  ORDER_DELIVERED: "Delivered",
  ORDER_CANCELLED: "Cancelled",
  ORDER_DELIVERY_FAILED: "Delivery failed",
  ORDER_DELAYED: "Running late",
};

const ACTIVE = ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "customer.read")) redirect("/admin");
  const { id } = await params;
  const d = await getOrderDetail(db(), id);
  if (!d) notFound();
  const o = d.order;
  const riders = can(ctx.user.roles, "delivery.manage") ? await listRiders(db()) : [];
  const active = ACTIVE.includes(o.status);
  const cod = o.paymentMode === "PAY_ON_DELIVERY";

  return (
    <div className="max-w-6xl">
      <Link href="/admin/orders" className="mb-3 inline-block text-[13px] font-semibold text-brand hover:underline">
        ← All orders
      </Link>
      <PageHeader
        title={o.publicCode}
        sub={`Placed ${formatDateTime(o.createdAt)} · ${d.hubName}`}
        actions={
          <>
            <StatusBadge status={o.status} />
            <SpeedBadge name={d.optionName} code={o.deliveryOption} />
          </>
        }
      />

      {active ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <span className="text-[14px]">
            Promised by <strong>{formatTime(o.promisedAt)}</strong>
          </span>
          <Countdown at={o.promisedAt.toISOString()} serverNow={nowMs()} className="text-[14px]" />
          <div className="ml-auto">
            <OrderActions
              orderId={o.id}
              status={o.status}
              riderId={o.riderId}
              riders={riders.map((r) => ({ id: r.id, name: r.name, active: r.active }))}
              canManage={can(ctx.user.roles, "delivery.manage")}
              canCancel={can(ctx.user.roles, "order.cancel")}
              canPack={can(ctx.user.roles, "order.pack")}
              cod={cod}
              dueNowPaise={d.amountDuePaise}
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Items" flush>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Item</th>
                    <th className={thClass}>Ordered</th>
                    <th className={thClass}>Packed</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.id} className={l.status === "CANCELLED" ? "opacity-50" : ""}>
                      <td className={tdClass}>
                        <p className="font-semibold">{l.nameEn}</p>
                        <p className="deva text-[13px] text-muted">{l.nameHi}</p>
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{formatBase(l.qtyOrderedBase, l.baseUnit)}</td>
                      <td className={`${tdClass} tabular-nums`}>
                        {l.qtyPackedBase === null ? <span className="text-muted">not yet</span> : formatBase(l.qtyPackedBase, l.baseUnit)}
                        {l.status === "SHORT" || l.status === "REFUNDED" ? <span className="ml-1.5 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-bold text-danger">{l.status === "SHORT" ? "short" : "unavailable"}</span> : null}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatINR(l.lineTotalPaise)}
                        {l.refundedPaise > 0 ? <span className="block text-[12px] font-semibold text-danger">− {formatINR(l.refundedPaise)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[14px]">
              <Row k="Items" v={formatINR(o.subtotalPaise)} />
              <Row k="Delivery" v={o.feePaise === 0 ? "Free" : formatINR(o.feePaise)} />
              {d.refundedPaise > 0 ? <Row k="Short or missing items" v={`− ${formatINR(d.refundedPaise)}`} danger /> : null}
              <Row k={cod ? "To collect at the door" : "Order total"} v={formatINR(d.amountDuePaise)} strong />
            </dl>
          </Panel>

          <Panel title="What happened" flush>
            <ol className="divide-y divide-line">
              {d.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-2.5 text-[14px]">
                  <span className="w-36 shrink-0 text-[13px] text-muted">{formatDateTime(e.createdAt)}</span>
                  <StatusBadge status={e.toStatus} />
                  <span className="text-muted">{e.actorType === "staff" ? (e.actorName ?? "Staff") : e.actorType === "customer" ? "Customer" : "System"}</span>
                  {e.note ? <span className="w-full pl-0 text-[13px] sm:w-auto sm:pl-0">“{e.note}”</span> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Deliver to">
            <p className="font-bold">{o.recipientName}</p>
            <p className="mt-0.5 text-[14px]">
              <a href={`tel:${o.recipientPhone}`} className="font-semibold text-brand hover:underline">
                {o.recipientPhone}
              </a>
            </p>
            <p className="mt-3 text-[14px] leading-relaxed">{o.addressLine}</p>
            {o.landmark ? <p className="text-[13.5px] text-muted">Landmark: {o.landmark}</p> : null}
            {o.deliveryNote ? <p className="mt-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-[13px] text-accent-ink">Note for the rider: {o.deliveryNote}</p> : null}
            {o.customerNote ? <p className="mt-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-[13px] text-accent-ink">Customer note: {o.customerNote}</p> : null}
            <a href={`https://www.google.com/maps?q=${o.lat},${o.lng}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] font-bold text-brand hover:underline">
              Open in maps ({(o.distanceM / 1000).toFixed(1)} km from the store)
            </a>
          </Panel>

          <Panel title="Payment and delivery">
            <dl className="space-y-1.5 text-[14px]">
              <Row k="Payment" v={cod ? "Cash or UPI on delivery" : "Paid online"} />
              <Row k="Rider" v={d.riderName ?? "Not assigned"} />
              {d.delivery ? <Row k="Result" v={`${d.delivery.result.toLowerCase()} (${d.delivery.verifiedBy === "CODE" ? "customer code" : "manual"})`} /> : null}
              {d.delivery?.note ? <Row k="Note" v={d.delivery.note} /> : null}
              {d.receipts.map((r) => (
                <Row key={r.id} k={r.method === "CASH" ? "Cash collected" : "UPI collected"} v={formatINR(r.amountPaise)} />
              ))}
              {d.refunds.map((r) => (
                <Row key={r.id} k={`Refund (${r.status.toLowerCase()})`} v={formatINR(r.amountPaise)} />
              ))}
            </dl>
          </Panel>

          <Panel title="Messages to the customer" sub="Order updates sent by WhatsApp or SMS">
            {d.messages.length === 0 ? (
              <p className="text-[14px] text-muted">Nothing sent yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {d.messages.map((m) => (
                  <li key={m.id} className="text-[13.5px]">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold">{MESSAGE_LABEL[m.template] ?? m.template}</span>
                      <Badge tone={m.status === "SENT" ? "brand" : m.status === "FAILED" ? "danger" : "outline"}>{m.status === "SENT" ? "Sent" : m.status === "FAILED" ? "Failed" : m.status === "SKIPPED" ? "Not sent" : "Waiting"}</Badge>
                      <span className="text-muted">{formatDateTime(m.sentAt ?? m.createdAt)}</span>
                    </div>
                    {m.error ? <p className="text-muted">{m.status === "FAILED" ? "Could not be delivered: " : ""}{m.error}</p> : null}
                    {m.status === "FAILED" ? <p className="font-semibold text-danger">Please phone the customer.</p> : null}
                    {m.body ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[12.5px] font-bold text-brand">Show text (test channel)</summary>
                        <p className="mt-1 whitespace-pre-line rounded-md bg-surface-2 p-2.5 text-[13px]">{m.body}</p>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Customer">
            <p className="text-[14px]">
              {d.customer.name ?? o.recipientName} · {d.customer.phone}
            </p>
            {d.customer.noShowCount > 0 ? <p className="mt-1 text-[13px] font-semibold text-danger">{d.customer.noShowCount} failed deliveries on record</p> : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong, danger }: { k: string; v: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "border-t border-line pt-2 text-[16px] font-extrabold" : ""} ${danger ? "text-danger" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}
