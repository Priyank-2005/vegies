"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionButton, useRunner } from "@/components/admin/kit";
import { CancelDialog, DeliverDialog } from "@/components/admin/delivery-forms";
import { Button } from "@/components/ui";
import { assignRiderAction, dispatchAction, resolveAttentionAction, startPackingAction } from "@/server/actions/orders";

interface Props {
  orderId: string;
  status: string;
  riderId: string | null;
  riders: Array<{ id: string; name: string; active: number }>;
  canManage: boolean;
  canCancel: boolean;
  canPack: boolean;
  cod: boolean;
  dueNowPaise: number;
}

/** The buttons that make sense for this order right now. The server checks every one of them again. */
export function OrderActions({ orderId, status, riderId, riders, canManage, canCancel, canPack, cod, dueNowPaise }: Props) {
  const { run, pending } = useRunner();
  const [dialog, setDialog] = useState<"cancel" | "override" | null>(null);
  const canAssign = canManage && ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "DELIVERY_FAILED"].includes(status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAssign ? (
        <select
          aria-label="Rider"
          value={riderId ?? ""}
          disabled={pending}
          onChange={(e) => e.target.value && run(() => assignRiderAction({ orderId, riderId: e.target.value }))}
          className="min-h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium"
        >
          <option value="">Assign a rider…</option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.active} active)
            </option>
          ))}
        </select>
      ) : null}
      {canPack && status === "CONFIRMED" ? <ActionButton label="Start packing" variant="primary" action={() => startPackingAction(orderId)} /> : null}
      {canPack && status === "PACKING" ? (
        <Link href={`/admin/packing/${orderId}`} className="inline-flex min-h-9 items-center rounded-[var(--radius-ctl)] bg-brand px-3 text-[13px] font-bold text-brand-ink hover:bg-brand-hover">
          Open packing
        </Link>
      ) : null}
      {canPack && status === "ATTENTION" ? <ActionButton label="Resolve, back to packing" variant="primary" action={() => resolveAttentionAction({ orderId })} /> : null}
      {canManage && (status === "PACKED" || status === "DELIVERY_FAILED") ? (
        <ActionButton label={status === "PACKED" ? "Send out" : "Retry delivery"} variant="primary" disabled={!riderId} action={() => dispatchAction(orderId)} />
      ) : null}
      {canManage && status === "OUT_FOR_DELIVERY" ? (
        <Button size="sm" variant="secondary" onClick={() => setDialog("override")}>
          Complete without code
        </Button>
      ) : null}
      {canCancel ? (
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDialog("cancel")}>
          Cancel order
        </Button>
      ) : null}
      {dialog === "cancel" ? <CancelDialog orderId={orderId} open onClose={() => setDialog(null)} /> : null}
      {dialog === "override" ? <DeliverDialog orderId={orderId} open override cod={cod} dueNowPaise={dueNowPaise} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
