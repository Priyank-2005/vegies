"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton, Dialog, useRunner } from "@/components/admin/kit";
import { formatBase } from "@/components/admin/parts";
import { Alert, Button, cx, Field, Input } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { finishPackingAction, flagAttentionAction, recordPackedAction, resolveAttentionAction, startPackingAction } from "@/server/actions/orders";

interface Line {
  id: string;
  nameEn: string;
  nameHi: string;
  baseUnit: string;
  weightModel: string;
  qtyOrderedBase: number;
  qtyPackedBase: number | null;
  lineTotalPaise: number;
  refundedPaise: number;
  status: string;
  minOkBase: number;
  maxFreeBase: number;
}

export function PackingForm({ orderId, status, lines, customerNote, canResolve }: { orderId: string; status: string; lines: Line[]; customerNote: string | null; canResolve: boolean }) {
  const router = useRouter();
  const [hold, setHold] = useState(false);
  const allDone = lines.length > 0 && lines.every((l) => l.qtyPackedBase !== null);

  if (status === "CONFIRMED") {
    return (
      <div className="space-y-4">
        {customerNote ? <Alert tone="warn">Customer note: {customerNote}</Alert> : null}
        <ItemPreview lines={lines} />
        <ActionButton label="Start packing this order" variant="primary" size="lg" className="w-full" action={() => startPackingAction(orderId)} />
      </div>
    );
  }
  if (status === "ATTENTION") {
    return (
      <div className="space-y-4">
        <Alert tone="danger">This order is on hold. A manager decides what happens next.</Alert>
        <ItemPreview lines={lines} />
        {canResolve ? <ActionButton label="Problem solved, back to packing" variant="primary" size="lg" className="w-full" action={() => resolveAttentionAction({ orderId })} /> : null}
      </div>
    );
  }
  if (status !== "PACKING") {
    return (
      <div className="space-y-4">
        <Alert tone="success">This order is {status.toLowerCase().replace(/_/g, " ")}. Nothing left to pack.</Alert>
        <ItemPreview lines={lines} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {customerNote ? <Alert tone="warn">Customer note: {customerNote}</Alert> : null}
      <p className="text-[14px] text-muted">Weigh each item and type what went into the bag. Pack at least the ordered weight; up to 5% extra is free. If you are short, the customer pays less automatically.</p>
      <ul className="space-y-3">
        {lines.map((l) => (
          <LineCard key={l.id} orderId={orderId} line={l} />
        ))}
      </ul>
      <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-3 shadow-pop">
        <ActionButton
          label={allDone ? "Finish packing" : "Record every item to finish"}
          variant="primary"
          size="lg"
          className="min-w-52 flex-1"
          disabled={!allDone}
          action={() => finishPackingAction(orderId)}
          after={() => router.push("/admin/packing")}
        />
        <Button variant="secondary" size="lg" onClick={() => setHold(true)}>
          Put on hold
        </Button>
      </div>
      {hold ? <HoldDialog orderId={orderId} onClose={() => setHold(false)} /> : null}
    </div>
  );
}

function ItemPreview({ lines }: { lines: Line[] }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
      {lines.map((l) => (
        <li key={l.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
          <span>
            <span className="font-bold">{l.nameEn}</span> <span className="deva text-muted">{l.nameHi}</span>
          </span>
          <span className="font-semibold tabular-nums">{formatBase(l.qtyOrderedBase, l.baseUnit)}</span>
        </li>
      ))}
    </ul>
  );
}

function LineCard({ orderId, line: l }: { orderId: string; line: Line }) {
  const { run, pending } = useRunner();
  const piece = l.baseUnit === "PIECE";
  const [text, setText] = useState(l.qtyPackedBase === null ? "" : String(l.qtyPackedBase));
  const typed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
  const unit = piece ? "pcs" : "g";

  function save(base: number) {
    run(() => recordPackedAction({ orderId, lineId: l.id, packedBase: base }));
  }
  const done = l.qtyPackedBase !== null;
  const short = l.status === "SHORT";
  const gone = l.status === "REFUNDED";
  return (
    <li className={cx("rounded-2xl border bg-surface p-4 shadow-card", done ? (short || gone ? "border-danger/50" : "border-brand/50") : "border-line")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-[17px] font-extrabold leading-tight">
          {l.nameEn} <span className="deva text-[15px] font-semibold text-muted">{l.nameHi}</span>
        </p>
        <p className="text-[15px] font-bold tabular-nums">Ordered {formatBase(l.qtyOrderedBase, l.baseUnit)}</p>
      </div>
      {!piece && l.weightModel === "LOOSE_WEIGHT" ? (
        <p className="mt-0.5 text-[12.5px] text-muted">
          Pack {l.minOkBase}–{l.maxFreeBase} g (up to 5% extra is free)
        </p>
      ) : (
        <p className="mt-0.5 text-[12.5px] text-muted">
          Pack at least {formatBase(l.minOkBase, l.baseUnit)}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-36">
          <Field label={`Packed (${unit})`} id={`p-${l.id}`}>
            <Input
              id={`p-${l.id}`}
              inputMode="numeric"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && typed !== null && save(typed)}
              className="text-[18px] font-bold tabular-nums"
            />
          </Field>
        </div>
        <Button variant="primary" disabled={typed === null || pending} onClick={() => typed !== null && save(typed)}>
          {pending ? "…" : "Save"}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setText(String(l.qtyOrderedBase));
            save(l.qtyOrderedBase);
          }}
        >
          Exact {l.qtyOrderedBase} {unit}
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Mark ${l.nameEn} as not available? The customer will not be charged for it.`)) {
              setText("0");
              save(0);
            }
          }}
        >
          Not available
        </Button>
      </div>
      {done ? (
        <p className={cx("mt-3 rounded-lg px-3 py-1.5 text-[13.5px] font-semibold", short || gone ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand")}>
          {gone
            ? `Unavailable. Taken off the bill (−${formatINR(l.refundedPaise)}).`
            : short
              ? `Short by ${formatBase(l.qtyOrderedBase - (l.qtyPackedBase ?? 0), l.baseUnit)}. The customer pays ${formatINR(l.refundedPaise)} less.`
              : (l.qtyPackedBase ?? 0) > l.qtyOrderedBase
                ? `Packed ${formatBase(l.qtyPackedBase ?? 0, l.baseUnit)} (${formatBase((l.qtyPackedBase ?? 0) - l.qtyOrderedBase, l.baseUnit)} free extra)`
                : `Packed ${formatBase(l.qtyPackedBase ?? 0, l.baseUnit)}`}
        </p>
      ) : null}
    </li>
  );
}

function HoldDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { run, pending } = useRunner();
  const router = useRouter();
  const [note, setNote] = useState("");
  return (
    <Dialog open onClose={onClose} title="Put this order on hold">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => flagAttentionAction({ orderId, note }), () => {
            onClose();
            router.push("/admin/packing");
          });
        }}
      >
        <p className="text-[14px] text-muted">Use this when something needs a manager: an item is missing, or the quality is not good enough to send.</p>
        <Field label="What is the problem?" id="holdnote">
          <Input id="holdnote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus />
        </Field>
        <Button type="submit" size="lg" full disabled={!note.trim() || pending}>
          {pending ? "Saving…" : "Put on hold"}
        </Button>
      </form>
    </Dialog>
  );
}
