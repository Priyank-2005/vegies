import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { Alert, Badge, buttonClass, cx } from "@/components/ui";
import { formatDateTime, formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { formatQuantity, unitLabel, type BaseUnit } from "@/lib/units";
import type { OrderView } from "@/server/services/orders";
import { CancelButton } from "./cancel-button";

const STEPS = [
  { label: "Order confirmed", note: "We have your order", statuses: ["PENDING_PAYMENT", "CONFIRMED"] },
  { label: "Being packed", note: "Picked and weighed at our store", statuses: ["PACKING", "ATTENTION"] },
  { label: "Ready for the rider", note: "Packed and waiting", statuses: ["PACKED"] },
  { label: "On the way", note: "The rider is heading to you", statuses: ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"] },
  { label: "Delivered", note: "Enjoy your order", statuses: ["DELIVERED"] },
];

const PAYMENT_TEXT: Record<OrderView["paymentStatus"], string> = {
  PAID: "Paid online",
  PAY_ON_DELIVERY: "Pay the rider on delivery (cash or UPI)",
  AWAITING_PAYMENT: "Awaiting payment",
  UNPAID: "Unpaid",
};

export function OrderDetails({ order: o, cancelUrl, justPlaced }: { order: OrderView; cancelUrl: string; justPlaced?: boolean }) {
  const cancelled = o.status === "CANCELLED" || o.status === "EXPIRED";
  const delivered = o.status === "DELIVERED";
  const current = STEPS.findIndex((s) => s.statuses.includes(o.status));
  const live = !cancelled && !delivered;

  return (
    <div className="space-y-6">
      {justPlaced ? (
        <Alert tone="success">
          <strong>Order placed{o.customerFirstName ? `, ${o.customerFirstName}` : ""}.</strong> Save this page: it is how you follow your order.
        </Alert>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Order</p>
          <h1 className="font-mono text-2xl font-semibold tracking-wide">{o.publicCode}</h1>
        </div>
        {cancelled ? <Badge tone="danger">{o.status === "CANCELLED" ? "Cancelled" : "Expired"}</Badge> : delivered ? <Badge tone="brand">Delivered</Badge> : <Badge tone="accent">{o.deliveryOption.name} delivery</Badge>}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          {live ? (
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
              <p className="text-[13px] font-medium text-muted">Arriving by</p>
              <p className="text-4xl font-semibold tabular-nums tracking-tight">{formatTime(o.promisedAt)}</p>
              {o.riderFirstName ? <p className="mt-1 text-sm text-muted">{o.riderFirstName} is bringing your order.</p> : null}
            </div>
          ) : null}
          {delivered ? (
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
              <p className="text-lg font-semibold">Delivered{o.deliveredAt ? ` at ${formatTime(o.deliveredAt)}` : ""}</p>
              <p className="text-sm text-muted">Something not right? Tell us the same day and we will make it right.</p>
            </div>
          ) : null}

          {o.status === "ATTENTION" ? <Alert tone="warn">We are checking one of your items and will contact you if anything needs your decision.</Alert> : null}
          {o.status === "DELIVERY_FAILED" ? <Alert tone="warn">We could not complete the delivery. Our team will call you shortly.</Alert> : null}
          {o.status === "PENDING_PAYMENT" && o.holdExpiresAt ? <Alert tone="warn">Complete payment before {formatDateTime(o.holdExpiresAt)} or this order will be released.</Alert> : null}

          {!cancelled ? (
            <ol className="space-y-0" aria-label="Order progress">
              {STEPS.map((s, i) => {
                const done = i < current || delivered;
                const active = i === current && !delivered;
                return (
                  <li key={s.label} className="relative flex gap-3.5 pb-6 last:pb-0" aria-current={active ? "step" : undefined}>
                    {i < STEPS.length - 1 ? <span className={cx("absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5", done ? "bg-brand" : "bg-line")} aria-hidden /> : null}
                    <span className={cx("z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2", done ? "border-brand bg-brand text-brand-ink" : active ? "border-brand bg-surface text-brand ring-4 ring-brand-soft" : "border-line-strong bg-surface text-transparent")}>
                      {done ? <IconCheck size={14} strokeWidth={3} /> : active ? <span className="size-2.5 rounded-full bg-brand" /> : <span className="size-2.5" />}
                    </span>
                    <div className="pt-0.5">
                      <p className={cx("font-semibold leading-tight", !done && !active && "text-muted")}>{s.label}</p>
                      <p className="text-[13px] text-muted">{s.note}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card" aria-label="Items">
            <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold">Items</h2>
            <ul className="divide-y divide-line px-5">
              {o.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.nameEn} <span className="deva font-normal text-muted">{l.nameHi}</span>
                    </p>
                    <p className="text-[13px] text-muted tabular-nums">
                      {formatQuantity(l.qtyOrderedBase, l.baseUnit as BaseUnit)} at {formatINR(l.unitPricePaise)} {unitLabel(l.unitBaseQty, l.baseUnit as BaseUnit)}
                    </p>
                    {l.status !== "ACTIVE" ? <Badge tone={l.status === "CANCELLED" ? "danger" : "accent"} className="mt-1">{l.status === "SHORT" ? "packed a little short" : l.status === "REFUNDED" ? "not available" : l.status.toLowerCase()}</Badge> : null}
                  </div>
                  <p className="shrink-0 text-right font-medium tabular-nums">
                    {formatINR(l.lineTotalPaise)}
                    {l.refundedPaise > 0 ? <span className="block text-[13px] font-semibold text-brand">− {formatINR(l.refundedPaise)}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="tabular-nums">{formatINR(o.subtotalPaise)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery · {o.deliveryOption.name}</dt><dd className={cx("tabular-nums", o.deliveryFeePaise === 0 && "font-semibold text-brand")}>{o.deliveryFeePaise === 0 ? "Free" : formatINR(o.deliveryFeePaise)}</dd></div>
              {o.adjustmentPaise > 0 ? <div className="flex justify-between"><dt className="text-muted">Short or missing items</dt><dd className="font-semibold tabular-nums text-brand">− {formatINR(o.adjustmentPaise)}</dd></div> : null}
              <div className="flex justify-between border-t border-line pt-2.5 text-[17px] font-semibold"><dt>{o.adjustmentPaise > 0 ? "You pay" : "Total"}</dt><dd className="tabular-nums">{formatINR(o.totalPaise - o.adjustmentPaise)}</dd></div>
              <p className="pt-1 text-[13px] text-muted">{PAYMENT_TEXT[o.paymentStatus]}. You pay no more than this total; if a bag is packed short, the difference is refunded. <Link className="underline underline-offset-2" href="/policies">Policy</Link></p>
            </dl>
          </section>
        </div>

        <div className="space-y-4">
          {live ? (
            <section className="overflow-hidden rounded-[var(--radius-card)] bg-brand-deep text-white shadow-card" aria-label="Delivery code">
              <div className="p-5">
                <p className="text-[13px] font-medium text-white/70">Your delivery code</p>
                <p className="mt-1 font-mono text-5xl font-semibold tracking-[0.3em] tabular-nums" aria-label={`Delivery code ${o.handoverCode.split("").join(" ")}`}>
                  {o.handoverCode}
                </p>
              </div>
              <p className="border-t border-white/15 bg-black/15 px-5 py-3 text-[13px] leading-relaxed text-white/80">Tell this code to the rider when your order arrives. Please do not share it with anyone else.</p>
            </section>
          ) : null}

          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card" aria-label="Delivery address">
            <h2 className="text-[15px] font-semibold">Delivering to</h2>
            <p className="mt-1.5 font-medium leading-snug">{o.address.line}</p>
            {o.address.landmark ? <p className="text-sm text-muted">{o.address.landmark}</p> : null}
            {o.address.note ? <p className="mt-1 text-sm text-muted">Note: {o.address.note}</p> : null}
            <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">From {o.hub.name}</p>
          </section>

          {o.cancellable ? (
            <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card" aria-label="Cancel order">
              <h2 className="text-[15px] font-semibold">Change of plans?</h2>
              <p className="mb-3 mt-1 text-sm text-muted">You can cancel free of charge until we start packing your order.</p>
              <CancelButton url={cancelUrl} />
            </section>
          ) : live ? (
            <p className="text-sm text-muted">We have started preparing your order, so it can no longer be cancelled online. Need help? Contact us.</p>
          ) : null}

          <Link href="/shop" className={buttonClass({ variant: "secondary", full: true })}>
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
