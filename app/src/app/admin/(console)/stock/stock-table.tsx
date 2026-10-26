"use client";

import { useState } from "react";
import { Dialog, useRunner } from "@/components/admin/kit";
import { formatBase, Panel, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { Button, cx, Field, Input, Select } from "@/components/ui";
import { parseQty, parseRupeesInput, qtyToInput, stockUnit } from "@/lib/qty-input";
import { publishStockAction, receiveStockAction, recordWasteAction } from "@/server/actions/stock";

interface Row {
  productId: string;
  name: string;
  nameHi: string;
  categoryName: string;
  baseUnit: "GRAM" | "PIECE";
  publishedQty: number;
  reservedQty: number;
  receivedQty: number;
  packedQty: number;
  wastedQty: number;
}

export function StockTable({ date, rows, canPublish, canReceive, suppliers }: { date: string; rows: Row[]; canPublish: boolean; canReceive: boolean; suppliers: Array<{ id: string; name: string }> }) {
  const { run, pending } = useRunner();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<{ kind: "receive" | "waste"; row: Row } | null>(null);

  const changed = rows.flatMap((r) => {
    const t = edits[r.productId];
    if (t === undefined) return [];
    const q = parseQty(t, stockUnit(r.baseUnit));
    return q !== null && q !== r.publishedQty ? [{ productId: r.productId, publishedQty: q }] : [];
  });
  const invalid = rows.some((r) => edits[r.productId] !== undefined && parseQty(edits[r.productId], stockUnit(r.baseUnit)) === null);

  return (
    <Panel flush>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <p className="text-[13.5px] text-muted">{canPublish ? "Type the quantity you will sell, then save. It cannot go below what is already reserved." : "You can see the stock but not change it."}</p>
        {canPublish ? (
          <Button
            disabled={pending || changed.length === 0 || invalid}
            onClick={() => run(() => publishStockAction({ serviceDate: date, items: changed }), () => setEdits({}))}
          >
            {pending ? "Saving…" : changed.length > 0 ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Save changes"}
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Product</th>
              <th className={`${thClass} text-right`}>Publish</th>
              <th className={`${thClass} text-right`}>Reserved</th>
              <th className={`${thClass} text-right`}>Left</th>
              <th className={`${thClass} text-right`}>Received</th>
              <th className={`${thClass} text-right`}>Wasted</th>
              <th className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const unit = stockUnit(r.baseUnit);
              const left = r.publishedQty - r.reservedQty;
              const val = edits[r.productId] ?? qtyToInput(r.publishedQty, unit);
              const bad = edits[r.productId] !== undefined && parseQty(val, unit) === null;
              return (
                <tr key={r.productId}>
                  <td className={tdClass}>
                    <p className="font-semibold">{r.name}</p>
                    <p className="deva text-[12.5px] text-muted">{r.nameHi}</p>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <div className="ml-auto flex w-32 items-center gap-1.5">
                      <Input
                        aria-label={`Publish ${r.name} (${unit})`}
                        inputMode="decimal"
                        value={val}
                        disabled={!canPublish}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.productId]: e.target.value }))}
                        className={cx("min-h-9 text-right tabular-nums", bad && "border-danger")}
                      />
                      <span className="text-[12px] text-muted">{unit}</span>
                    </div>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatBase(r.reservedQty, r.baseUnit)}</td>
                  <td className={cx(tdClass, "text-right font-bold tabular-nums", left === 0 && r.publishedQty > 0 ? "text-danger" : "")}>{formatBase(left, r.baseUnit)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-muted`}>{r.receivedQty > 0 ? formatBase(r.receivedQty, r.baseUnit) : "–"}</td>
                  <td className={`${tdClass} text-right tabular-nums text-muted`}>{r.wastedQty > 0 ? formatBase(r.wastedQty, r.baseUnit) : "–"}</td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {canReceive ? (
                      <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "receive", row: r })}>
                        Receive
                      </Button>
                    ) : null}{" "}
                    {canPublish ? (
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "waste", row: r })}>
                        Waste
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog?.kind === "receive" ? <ReceiveDialog date={date} row={dialog.row} suppliers={suppliers} canPublish={canPublish} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "waste" ? <WasteDialog date={date} row={dialog.row} onClose={() => setDialog(null)} /> : null}
    </Panel>
  );
}

function ReceiveDialog({ date, row, suppliers, canPublish, onClose }: { date: string; row: Row; suppliers: Array<{ id: string; name: string }>; canPublish: boolean; onClose: () => void }) {
  const { run, pending } = useRunner();
  const unit = stockUnit(row.baseUnit);
  const uLabel = unit === "pc" ? "pieces" : "kg";
  const [supplier, setSupplier] = useState("");
  const [accepted, setAccepted] = useState("");
  const [rejected, setRejected] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [publish, setPublish] = useState(canPublish);
  const a = parseQty(accepted, unit);
  const rj = rejected.trim() ? parseQty(rejected, unit) : 0;
  const c = parseRupeesInput(cost);
  const ok = a !== null && rj !== null && c !== null && a + rj > 0 && (rj === 0 || reason.trim().length > 0);
  return (
    <Dialog open onClose={onClose} title={`Receive ${row.name}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          run(() => receiveStockAction({ serviceDate: date, productId: row.productId, supplierId: supplier || null, acceptedBase: a, rejectedBase: rj, costPaise: c, rejectionReason: rj > 0 ? reason.trim() : null, publish: publish && canPublish }), onClose);
        }}
      >
        <Field label="Supplier" id="rsup" optional>
          <Select id="rsup" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">Market purchase (no named supplier)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Accepted (${uLabel})`} id="racc">
            <Input id="racc" inputMode="decimal" value={accepted} onChange={(e) => setAccepted(e.target.value)} />
          </Field>
          <Field label={`Rejected (${uLabel})`} id="rrej" optional>
            <Input id="rrej" inputMode="decimal" value={rejected} onChange={(e) => setRejected(e.target.value)} />
          </Field>
        </div>
        {rj !== null && rj > 0 ? (
          <Field label="Why was some rejected?" id="rwhy">
            <Input id="rwhy" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Total cost paid (₹)" id="rcost" hint="For everything received, accepted and rejected">
          <Input id="rcost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        {canPublish ? (
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="size-4" /> Also add the accepted quantity to what customers can order
          </label>
        ) : null}
        <Button type="submit" size="lg" full disabled={!ok || pending}>
          {pending ? "Saving…" : "Record delivery"}
        </Button>
      </form>
    </Dialog>
  );
}

function WasteDialog({ date, row, onClose }: { date: string; row: Row; onClose: () => void }) {
  const { run, pending } = useRunner();
  const unit = stockUnit(row.baseUnit);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const q = parseQty(qty, unit);
  const free = row.publishedQty - row.reservedQty;
  return (
    <Dialog open onClose={onClose} title={`Throw away ${row.name}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (q === null || q <= 0) return;
          run(() => recordWasteAction({ serviceDate: date, productId: row.productId, qtyBase: q, reason }), onClose);
        }}
      >
        <p className="text-[14px] text-muted">
          You can throw away up to {formatBase(Math.max(0, free), row.baseUnit)} (the part not already promised to customers). It is taken off what customers can order.
        </p>
        <Field label={`How much (${unit === "pc" ? "pieces" : "kg"})`} id="wqty">
          <Input id="wqty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Why" id="wwhy" hint="For example: spoiled, damaged, dried out">
          <Input id="wwhy" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" variant="danger" full disabled={pending || q === null || q <= 0 || !reason.trim()}>
          {pending ? "Saving…" : "Record wastage"}
        </Button>
      </form>
    </Dialog>
  );
}
