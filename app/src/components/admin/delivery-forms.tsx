"use client";

import { useState } from "react";
import { Dialog, useRunner } from "@/components/admin/kit";
import { Button, Field, Input } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { parseRupeesInput, paiseToInput } from "@/lib/qty-input";
import { cancelOrderAction, completeDeliveryAction, failDeliveryAction } from "@/server/actions/orders";

/** Hand over the order: the customer reads out their 4-digit code, and cash or UPI is recorded for pay-on-delivery orders. */
export function DeliverDialog({ orderId, open, onClose, dueNowPaise, cod, override }: { orderId: string; open: boolean; onClose: () => void; dueNowPaise: number; cod: boolean; override?: boolean }) {
  const { run, pending } = useRunner();
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"CASH" | "UPI">("CASH");
  const [reference, setReference] = useState("");
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState(paiseToInput(dueNowPaise));
  const [note, setNote] = useState("");

  const amountPaise = partial ? parseRupeesInput(amount) : dueNowPaise;
  const needNote = override || partial;
  const ready = (override ? true : /^\d{4}$/.test(code)) && (!cod || (amountPaise !== null && amountPaise > 0)) && (!needNote || note.trim().length > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        completeDeliveryAction({
          orderId,
          code: override ? undefined : code,
          manualOverride: override || undefined,
          partial: partial || undefined,
          note: note.trim() || undefined,
          payment: cod && amountPaise ? { method, amountPaise, reference: reference.trim() || undefined } : undefined,
        }),
      onClose,
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={override ? "Complete without the customer's code" : "Complete delivery"}>
      <form onSubmit={submit} className="space-y-4">
        {override ? (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-[13.5px] text-accent-ink">Use this only when the customer cannot give the 4-digit code. A note is required and is kept on the order.</p>
        ) : (
          <Field label="Customer's 4-digit code" id="hcode" hint="Ask the customer to read it from their order page">
            <Input id="hcode" inputMode="numeric" autoComplete="off" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center font-mono text-[28px] tracking-[0.5em]" autoFocus />
          </Field>
        )}
        {cod ? (
          <fieldset className="space-y-3">
            <legend className="mb-1.5 text-sm font-medium">Payment received</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["CASH", "UPI"] as const).map((m) => (
                <label key={m} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-[14px] font-bold ${method === m ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
                  <input type="radio" name="method" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                  {m === "CASH" ? "Cash" : "UPI"}
                </label>
              ))}
            </div>
            {method === "UPI" ? (
              <Field label="UPI reference" id="upiref" optional>
                <Input id="upiref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
              </Field>
            ) : null}
            <p className="text-[15px]">
              Amount to collect: <strong className="tabular-nums">{formatINR(dueNowPaise)}</strong>
            </p>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="size-4" />
              The customer did not accept everything
            </label>
            {partial ? (
              <Field label="Amount actually collected (₹)" id="amt">
                <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            ) : null}
          </fieldset>
        ) : null}
        {needNote ? (
          <Field label={override ? "Why is the code missing?" : "Which items were not accepted?"} id="dnote">
            <Input id="dnote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
        ) : null}
        <Button type="submit" size="lg" full disabled={!ready || pending}>
          {pending ? "Saving…" : "Confirm delivered"}
        </Button>
      </form>
    </Dialog>
  );
}

/** The rider could not hand the order over. */
export function FailDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const { run, pending } = useRunner();
  const [reason, setReason] = useState("");
  const [atFault, setAtFault] = useState(true);
  return (
    <Dialog open={open} onClose={onClose} title="Could not deliver">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => failDeliveryAction({ orderId, reason, customerAtFault: atFault }), onClose);
        }}
      >
        <Field label="What happened?" id="freason" hint="For example: nobody home, phone switched off, wrong address">
          <Input id="freason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus />
        </Field>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={atFault} onChange={(e) => setAtFault(e.target.checked)} className="size-4" />
          The customer was not reachable or refused
        </label>
        <Button type="submit" size="lg" variant="danger" full disabled={!reason.trim() || pending}>
          {pending ? "Saving…" : "Mark as not delivered"}
        </Button>
      </form>
    </Dialog>
  );
}

/** Cancel an order for the customer. Releases the stock. */
export function CancelDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const { run, pending } = useRunner();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Cancel this order">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => cancelOrderAction({ orderId, reason }), onClose);
        }}
      >
        <p className="text-[14px] text-muted">The stock is released straight away. If the customer already paid online, a refund is queued.</p>
        <Field label="Reason" id="creason">
          <Input id="creason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus />
        </Field>
        <Button type="submit" size="lg" variant="danger" full disabled={!reason.trim() || pending}>
          {pending ? "Cancelling…" : "Cancel order"}
        </Button>
      </form>
    </Dialog>
  );
}
