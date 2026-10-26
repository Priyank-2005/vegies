"use client";

import { useState } from "react";
import { ActionButton, Countdown } from "@/components/admin/kit";
import { DeliverDialog, FailDialog } from "@/components/admin/delivery-forms";
import { formatBase, SpeedBadge } from "@/components/admin/parts";
import { Alert, Button, cx } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { dispatchAction } from "@/server/actions/orders";

interface Mine {
  id: string;
  publicCode: string;
  status: string;
  optionName: string;
  promisedAt: string;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  landmark: string | null;
  deliveryNote: string | null;
  customerNote: string | null;
  lat: number;
  lng: number;
  paymentMode: "PREPAID" | "PAY_ON_DELIVERY";
  amountDuePaise: number;
  items: Array<{ name: string; nameHi: string; qtyBase: number; baseUnit: string; status: string }>;
}
interface Open {
  id: string;
  publicCode: string;
  optionName: string;
  promisedAt: string;
  distanceM: number;
  itemCount: number;
}

export function RiderOrders({ mine, open, serverNow }: { mine: Mine[]; open: Open[]; serverNow: number }) {
  return (
    <div className="space-y-6">
      <section aria-label="My orders" className="space-y-3">
        {mine.length === 0 ? <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-10 text-center text-muted">No orders assigned to you right now.</p> : null}
        {mine.map((o) => (
          <MyOrder key={o.id} o={o} serverNow={serverNow} />
        ))}
      </section>

      {open.length > 0 ? (
        <section aria-label="Waiting for a rider" className="space-y-3">
          <h2 className="text-[17px] font-extrabold">Packed and waiting for a rider</h2>
          {open.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <span className="font-mono text-[16px] font-extrabold tracking-wide">{o.publicCode}</span>
              <SpeedBadge name={o.optionName} />
              <span className="text-[13px] text-muted">
                {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {(o.distanceM / 1000).toFixed(1)} km · by {formatTime(o.promisedAt)}
              </span>
              <Countdown at={o.promisedAt} serverNow={serverNow} className="text-[13px]" />
              <ActionButton label="Take this order and go" variant="primary" size="md" className="ml-auto" confirm={`Take ${o.publicCode} and start the delivery?`} action={() => dispatchAction(o.id)} />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function MyOrder({ o, serverNow }: { o: Mine; serverNow: number }) {
  const [dialog, setDialog] = useState<"deliver" | "fail" | null>(null);
  const cod = o.paymentMode === "PAY_ON_DELIVERY";
  const out = o.status === "OUT_FOR_DELIVERY";
  return (
    <article className={cx("rounded-2xl border bg-surface p-4 shadow-card", o.status === "DELIVERY_FAILED" ? "border-danger/50" : "border-line")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[18px] font-extrabold tracking-wide">{o.publicCode}</span>
        <SpeedBadge name={o.optionName} />
        <span className="ml-auto text-right text-[13px] text-muted">
          by {formatTime(o.promisedAt)} · <Countdown at={o.promisedAt} serverNow={serverNow} />
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[17px] font-extrabold">{o.recipientName}</p>
        <p className="mt-0.5 text-[15px] leading-snug">{o.addressLine}</p>
        {o.landmark ? <p className="text-[13.5px] text-muted">Landmark: {o.landmark}</p> : null}
        {o.deliveryNote ? <p className="mt-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-[13px] text-accent-ink">{o.deliveryNote}</p> : null}
        {o.customerNote ? <p className="mt-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-[13px] text-accent-ink">“{o.customerNote}”</p> : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`tel:${o.recipientPhone}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong text-[14px] font-bold hover:bg-surface-2">
          Call customer
        </a>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong text-[14px] font-bold hover:bg-surface-2">
          Navigate
        </a>
      </div>

      <details className="mt-3 rounded-xl bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer text-[14px] font-bold">
          {o.items.length} item{o.items.length === 1 ? "" : "s"}
        </summary>
        <ul className="mt-2 space-y-1 text-[14px]">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3">
              <span>
                {i.name} <span className="deva text-muted">{i.nameHi}</span>
                {i.status === "REFUNDED" ? <span className="ml-1 text-[12px] font-bold text-danger">not packed</span> : null}
              </span>
              <span className="tabular-nums">{formatBase(i.qtyBase, i.baseUnit)}</span>
            </li>
          ))}
        </ul>
      </details>

      <p className={cx("mt-3 rounded-xl px-3 py-2.5 text-center text-[15px] font-extrabold", cod ? "bg-accent-soft text-accent-ink" : "bg-brand-soft text-brand")}>
        {cod ? `Collect ${formatINR(o.amountDuePaise)} (cash or UPI)` : "Already paid online. Collect nothing."}
      </p>

      <div className="mt-3 space-y-2">
        {o.status === "PACKED" ? <ActionButton label="Start delivery" variant="primary" size="lg" className="w-full" action={() => dispatchAction(o.id)} /> : null}
        {out ? (
          <>
            <Button size="lg" full onClick={() => setDialog("deliver")}>
              Delivered
            </Button>
            <Button size="md" full variant="ghost" className="text-danger" onClick={() => setDialog("fail")}>
              Could not deliver
            </Button>
          </>
        ) : null}
        {o.status === "DELIVERY_FAILED" ? <Alert tone="warn">Marked as not delivered. A manager will decide what to do next.</Alert> : null}
      </div>
      {dialog === "deliver" ? <DeliverDialog orderId={o.id} open cod={cod} dueNowPaise={o.amountDuePaise} onClose={() => setDialog(null)} /> : null}
      {dialog === "fail" ? <FailDialog orderId={o.id} open onClose={() => setDialog(null)} /> : null}
    </article>
  );
}
