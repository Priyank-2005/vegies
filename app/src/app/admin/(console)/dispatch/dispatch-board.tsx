"use client";

import Link from "next/link";
import { ActionButton, Countdown, useRunner } from "@/components/admin/kit";
import { SpeedBadge, StatusBadge } from "@/components/admin/parts";
import { cx } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { assignRiderAction, dispatchAction, resolveAttentionAction, startPackingAction } from "@/server/actions/orders";

interface BoardOrder {
  id: string;
  publicCode: string;
  status: string;
  optionCode: string;
  optionName: string;
  promisedAt: string;
  recipientName: string;
  addressLine: string;
  itemCount: number;
  dueNowPaise: number;
  riderId: string | null;
  riderName: string | null;
  note: string | null;
}
interface Rider {
  id: string;
  name: string;
  active: number;
}

const LANES: Array<{ key: string; title: string; hint: string; statuses: string[] }> = [
  { key: "new", title: "New", hint: "Waiting to be packed", statuses: ["CONFIRMED"] },
  { key: "packing", title: "Packing", hint: "Being put together", statuses: ["PACKING", "ATTENTION"] },
  { key: "ready", title: "Ready", hint: "Packed, needs a rider", statuses: ["PACKED"] },
  { key: "road", title: "On the road", hint: "With a rider", statuses: ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"] },
];

export function DispatchBoard({ orders, riders, serverNow }: { orders: BoardOrder[]; riders: Rider[]; serverNow: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {LANES.map((lane) => {
        const items = orders.filter((o) => lane.statuses.includes(o.status));
        const late = items.filter((o) => new Date(o.promisedAt).getTime() < serverNow).length;
        return (
          <section key={lane.key} aria-label={lane.title} className="min-w-0 rounded-2xl bg-surface-2 p-3">
            <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
              <div>
                <h2 className="font-extrabold">
                  {lane.title} <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-[12px] tabular-nums text-muted">{items.length}</span>
                </h2>
                <p className="text-[12px] text-muted">{lane.hint}</p>
              </div>
              {late > 0 ? <span className="rounded-md bg-danger-soft px-2 py-0.5 text-[12px] font-bold text-danger">{late} late</span> : null}
            </header>
            <ul className="space-y-2.5">
              {items.length === 0 ? <li className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-[13px] text-muted">Nothing here</li> : null}
              {items.map((o) => (
                <OrderCard key={o.id} o={o} riders={riders} serverNow={serverNow} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function OrderCard({ o, riders, serverNow }: { o: BoardOrder; riders: Rider[]; serverNow: number }) {
  const { run, pending } = useRunner();
  const late = new Date(o.promisedAt).getTime() < serverNow;
  const canAssign = ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "DELIVERY_FAILED"].includes(o.status);
  return (
    <li className={cx("rounded-xl border bg-surface p-3 shadow-card", late ? "border-danger/50" : "border-line", o.status === "ATTENTION" || o.status === "DELIVERY_FAILED" ? "ring-2 ring-danger/40" : "")}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/orders/${o.id}`} className="font-mono text-[15px] font-extrabold tracking-wide hover:text-brand">
          {o.publicCode}
        </Link>
        <Countdown at={o.promisedAt} serverNow={serverNow} className="text-[13px]" />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <SpeedBadge name={o.optionName} code={o.optionCode} />
        {o.status === "ATTENTION" || o.status === "DELIVERY_FAILED" ? <StatusBadge status={o.status} /> : null}
        <span className="text-[12px] text-muted">by {formatTime(o.promisedAt)}</span>
      </div>
      <p className="mt-2 text-[14px] font-semibold leading-snug">{o.recipientName}</p>
      <p className="line-clamp-2 text-[13px] text-muted">{o.addressLine}</p>
      <p className="mt-1 text-[13px] text-muted">
        {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
        {o.dueNowPaise > 0 ? <span className="font-semibold text-ink"> · collect {formatINR(o.dueNowPaise)}</span> : null}
      </p>
      {o.note ? <p className="mt-1.5 rounded-md bg-accent-soft px-2 py-1 text-[12.5px] text-accent-ink">“{o.note}”</p> : null}

      {canAssign ? (
        <label className="mt-2.5 block">
          <span className="sr-only">Rider for {o.publicCode}</span>
          <select
            value={o.riderId ?? ""}
            disabled={pending}
            onChange={(e) => e.target.value && run(() => assignRiderAction({ orderId: o.id, riderId: e.target.value }))}
            className="min-h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium"
          >
            <option value="">{o.riderName ? o.riderName : "Assign a rider…"}</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.active} active)
              </option>
            ))}
          </select>
        </label>
      ) : o.riderName ? (
        <p className="mt-2.5 text-[13px]">
          Rider: <span className="font-semibold">{o.riderName}</span>
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {o.status === "CONFIRMED" ? <ActionButton label="Start packing" variant="primary" action={() => startPackingAction(o.id)} /> : null}
        {o.status === "PACKING" ? (
          <Link href={`/admin/packing/${o.id}`} className="inline-flex min-h-9 items-center rounded-[var(--radius-ctl)] border border-line-strong px-3 text-[13px] font-bold hover:bg-surface-2">
            Open packing
          </Link>
        ) : null}
        {o.status === "ATTENTION" ? <ActionButton label="Resolve, back to packing" variant="primary" action={() => resolveAttentionAction({ orderId: o.id })} /> : null}
        {o.status === "PACKED" || o.status === "DELIVERY_FAILED" ? (
          <ActionButton label={o.status === "PACKED" ? "Send out" : "Retry delivery"} variant="primary" disabled={!o.riderId} action={() => dispatchAction(o.id)} />
        ) : null}
        <Link href={`/admin/orders/${o.id}`} className="inline-flex min-h-9 items-center px-2 text-[13px] font-bold text-brand hover:underline">
          Details
        </Link>
      </div>
      {(o.status === "PACKED" || o.status === "DELIVERY_FAILED") && !o.riderId ? <p className="mt-1.5 text-[12px] text-muted">Pick a rider to send this out.</p> : null}
    </li>
  );
}
