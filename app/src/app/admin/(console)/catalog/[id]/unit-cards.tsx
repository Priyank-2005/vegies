"use client";

import { useState } from "react";
import { ActionButton, useRunner } from "@/components/admin/kit";
import { unitShort } from "@/components/shop/product-card";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { paiseToInput, parseQty, parseRupeesInput, qtyToInput, stockUnit } from "@/lib/qty-input";
import { addUnitAction, setPriceAction, setProductActiveAction, updateUnitAction } from "@/server/actions/catalog";

interface Unit {
  id: string;
  unitBaseQty: number;
  minBase: number;
  maxBase: number;
  stepBase: number;
  isDefault: boolean;
  active: boolean;
  pricePaise: number | null;
  salePricePaise: number | null;
}
type Base = "GRAM" | "PIECE";

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  return <ActionButton label={active ? "Hide from the shop" : "Show in the shop"} variant="secondary" action={() => setProductActiveAction({ id, active: !active })} />;
}

export function UnitCard({ unit: u, baseUnit, canPrice, history }: { unit: Unit; baseUnit: Base; canPrice: boolean; history: Array<{ pricePaise: number; salePricePaise: number | null; validFrom: string }> }) {
  const { run, pending } = useRunner();
  const qUnit = stockUnit(baseUnit);
  const unitName = unitShort(u.unitBaseQty, baseUnit);
  const [price, setPrice] = useState(u.pricePaise === null ? "" : paiseToInput(u.pricePaise));
  const [offer, setOffer] = useState(u.salePricePaise === null ? "" : paiseToInput(u.salePricePaise));
  const [min, setMin] = useState(qtyToInput(u.minBase, qUnit));
  const [max, setMax] = useState(qtyToInput(u.maxBase, qUnit));
  const [step, setStep] = useState(qtyToInput(u.stepBase, qUnit));
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className={u.active ? "" : "opacity-60"}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-extrabold">Price per {unitName}</h3>
        {u.isDefault ? <Badge tone="brand">Main unit</Badge> : null}
        {!u.active ? <Badge tone="outline">Switched off</Badge> : null}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Price (₹)" id={`pr-${u.id}`}>
          <Input id={`pr-${u.id}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canPrice} />
        </Field>
        <Field label="Offer price (₹)" id={`of-${u.id}`} optional>
          <Input id={`of-${u.id}`} inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} disabled={!canPrice} />
        </Field>
        {canPrice ? (
          <div className="col-span-2 flex items-end">
            <Button
              disabled={pending || parseRupeesInput(price) === null}
              onClick={() => run(() => setPriceAction({ saleUnitId: u.id, pricePaise: parseRupeesInput(price) ?? 0, salePricePaise: offer.trim() ? (parseRupeesInput(offer) ?? 0) : null }))}
            >
              {pending ? "Saving…" : "Save price"}
            </Button>
          </div>
        ) : null}
        <Field label={`Smallest order (${qUnit === "pc" ? "pieces" : "kg"})`} id={`mn-${u.id}`}>
          <Input id={`mn-${u.id}`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
        <Field label={`Largest order (${qUnit === "pc" ? "pieces" : "kg"})`} id={`mx-${u.id}`}>
          <Input id={`mx-${u.id}`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
        <Field label={`Steps (${qUnit === "pc" ? "pieces" : "kg"})`} id={`st-${u.id}`}>
          <Input id={`st-${u.id}`} inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
        </Field>
        <div className="flex items-end gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => updateUnitAction({ id: u.id, rules: { unitBaseQty: u.unitBaseQty, minBase: parseQty(min, qUnit) ?? 0, maxBase: parseQty(max, qUnit) ?? 0, stepBase: parseQty(step, qUnit) ?? 0 } }))}
          >
            Save limits
          </Button>
          {!u.isDefault ? (
            <Button variant="ghost" disabled={pending} onClick={() => run(() => updateUnitAction({ id: u.id, rules: { unitBaseQty: u.unitBaseQty, minBase: u.minBase, maxBase: u.maxBase, stepBase: u.stepBase }, active: !u.active }))}>
              {u.active ? "Switch off" : "Switch on"}
            </Button>
          ) : null}
        </div>
      </div>
      {history.length > 0 ? (
        <div className="mt-3">
          <button type="button" className="text-[13px] font-bold text-brand hover:underline" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Hide price history" : "Price history"}
          </button>
          {showHistory ? (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-[13.5px]">
              {history.map((h, i) => (
                <li key={h.validFrom + i} className="flex justify-between gap-3 px-3 py-1.5">
                  <span className="text-muted">{formatDateTime(h.validFrom)}</span>
                  <span className="tabular-nums">
                    {formatINR(h.pricePaise)}
                    {h.salePricePaise !== null ? ` (offer ${formatINR(h.salePricePaise)})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AddUnit({ productId, baseUnit }: { productId: string; baseUnit: Base }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useRunner();
  const qUnit = stockUnit(baseUnit);
  const piece = baseUnit === "PIECE";
  const [per, setPer] = useState(piece ? "6" : "500");
  const [price, setPrice] = useState("");
  const [min, setMin] = useState(piece ? "1" : "0.5");
  const [max, setMax] = useState(piece ? "12" : "5");
  const [step, setStep] = useState(piece ? "1" : "0.5");
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Add another way to buy it (for example a 500 g pack)
      </Button>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <Field label="Price is for" id="aper">
        <Select id="aper" value={per} onChange={(e) => setPer(e.target.value)}>
          {piece ? (
            <>
              <option value="1">1 piece</option>
              <option value="6">6 pieces</option>
              <option value="12">12 pieces</option>
            </>
          ) : (
            <>
              <option value="1000">1 kg</option>
              <option value="500">500 g</option>
              <option value="250">250 g</option>
              <option value="100">100 g</option>
            </>
          )}
        </Select>
      </Field>
      <Field label="Price (₹)" id="aprice">
        <Input id="aprice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Smallest" id="amin">
        <Input id="amin" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
      </Field>
      <Field label="Largest" id="amax">
        <Input id="amax" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
      </Field>
      <Field label="Steps" id="astep">
        <Input id="astep" inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
      </Field>
      <div className="col-span-2 flex gap-2 sm:col-span-5">
        <Button
          disabled={pending || parseRupeesInput(price) === null}
          onClick={() =>
            run(
              () => addUnitAction({ productId, rules: { unitBaseQty: Number.parseInt(per, 10), minBase: parseQty(min, qUnit) ?? 0, maxBase: parseQty(max, qUnit) ?? 0, stepBase: parseQty(step, qUnit) ?? 0 }, pricePaise: parseRupeesInput(price) ?? 0 }),
              () => setOpen(false),
            )
          }
        >
          {pending ? "Adding…" : "Add"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
