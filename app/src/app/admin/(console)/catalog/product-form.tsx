"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRunner } from "@/components/admin/kit";
import { Button, Field, Input, Select } from "@/components/ui";
import { parseQty, parseRupeesInput, stockUnit } from "@/lib/qty-input";
import { createProductAction, updateProductAction } from "@/server/actions/catalog";

export interface ProductValues {
  id?: string;
  name: string;
  nameHi: string;
  categoryId: string;
  aliases: string;
  descriptionEn: string;
  storageNote: string;
  weightModel: "FIXED_PACK" | "APPROX_PIECE" | "LOOSE_WEIGHT";
  baseUnit: "GRAM" | "PIECE";
  tolerancePct: number;
  seasonStartMonth: number | null;
  seasonEndMonth: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEIGHT_HELP: Record<string, string> = {
  LOOSE_WEIGHT: "Sold by weight and weighed at packing. We pack at least what was ordered, up to 5% extra is free, and the customer is never charged more than at checkout.",
  APPROX_PIECE: "Sold by the piece, but pieces vary in weight a little (for example a cauliflower). The price per piece is fixed.",
  FIXED_PACK: "A sealed pack with a fixed weight or count. The price is fixed.",
};

export function ProductForm({ mode, categories, initial }: { mode: "new" | "edit"; categories: Array<{ id: string; name: string }>; initial: ProductValues }) {
  const router = useRouter();
  const { run, pending } = useRunner();
  const [v, setV] = useState(initial);
  const set = <K extends keyof ProductValues>(k: K, val: ProductValues[K]) => setV((p) => ({ ...p, [k]: val }));

  // first unit and price (new products only)
  const qUnit = stockUnit(v.baseUnit);
  const [priceFor, setPriceFor] = useState("1000");
  const [price, setPrice] = useState("");
  const [offer, setOffer] = useState("");
  const [minQ, setMinQ] = useState("0.25");
  const [maxQ, setMaxQ] = useState("10");
  const [stepQ, setStepQ] = useState("0.25");

  const details = {
    name: v.name,
    nameHi: v.nameHi,
    categoryId: v.categoryId,
    aliases: v.aliases.split(",").map((a) => a.trim()).filter(Boolean),
    descriptionEn: v.descriptionEn.trim() || null,
    storageNote: v.storageNote.trim() || null,
    weightModel: v.weightModel,
    baseUnit: v.baseUnit,
    tolerancePct: v.tolerancePct,
    seasonStartMonth: v.seasonStartMonth,
    seasonEndMonth: v.seasonEndMonth,
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "edit") {
      run(() => updateProductAction({ id: v.id, input: details }));
      return;
    }
    run(
      () =>
        createProductAction({
          ...details,
          unit: { unitBaseQty: Number.parseInt(priceFor, 10), minBase: parseQty(minQ, qUnit) ?? 0, maxBase: parseQty(maxQ, qUnit) ?? 0, stepBase: parseQty(stepQ, qUnit) ?? 0 },
          pricePaise: parseRupeesInput(price) ?? 0,
          salePricePaise: offer.trim() ? (parseRupeesInput(offer) ?? 0) : null,
        }),
      (r) => router.push(`/admin/catalog/${r.id}`),
    );
  }

  const piece = v.baseUnit === "PIECE";
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Name (English)" id="pname" hint="Include the common name in brackets if helpful, for example Bottle Gourd (Lauki)">
        <Input id="pname" value={v.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Name in Hindi" id="pnamehi">
        <Input id="pnamehi" value={v.nameHi} onChange={(e) => set("nameHi", e.target.value)} className="deva" />
      </Field>
      <Field label="Category" id="pcat">
        <Select id="pcat" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">Choose…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Other spellings people search for" id="palias" hint="Separate with commas, for example: aloo, alu, batata">
        <Input id="palias" value={v.aliases} onChange={(e) => set("aliases", e.target.value)} />
      </Field>
      <Field label="How it is sold" id="pmodel">
        <Select id="pmodel" value={v.weightModel} onChange={(e) => set("weightModel", e.target.value as ProductValues["weightModel"])}>
          <option value="LOOSE_WEIGHT">Loose, by weight</option>
          <option value="APPROX_PIECE">By the piece (weights vary)</option>
          <option value="FIXED_PACK">Fixed pack</option>
        </Select>
      </Field>
      <Field label="Counted in" id="pbase" hint={mode === "edit" ? "Cannot change after the product has orders" : undefined}>
        <Select id="pbase" value={v.baseUnit} onChange={(e) => set("baseUnit", e.target.value as ProductValues["baseUnit"])} disabled={mode === "edit"}>
          <option value="GRAM">Weight (grams and kilograms)</option>
          <option value="PIECE">Pieces</option>
        </Select>
      </Field>
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted sm:col-span-2">{WEIGHT_HELP[v.weightModel]}</p>
      {v.weightModel !== "LOOSE_WEIGHT" ? (
        <Field label="Allowed shortfall (%)" id="ptol" hint="How much lighter than described is still fine without a price adjustment">
          <Input id="ptol" inputMode="numeric" value={String(v.tolerancePct)} onChange={(e) => set("tolerancePct", Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} />
        </Field>
      ) : null}
      <Field label="In season from" id="pfrom" hint="Leave both empty if it is available all year" optional>
        <Select id="pfrom" value={v.seasonStartMonth ?? ""} onChange={(e) => set("seasonStartMonth", e.target.value ? Number(e.target.value) : null)}>
          <option value="">All year</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="In season until" id="pto" optional>
        <Select id="pto" value={v.seasonEndMonth ?? ""} onChange={(e) => set("seasonEndMonth", e.target.value ? Number(e.target.value) : null)}>
          <option value="">All year</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Storage tip" id="pstore" optional hint="Shown on the product page">
          <Input id="pstore" value={v.storageNote} onChange={(e) => set("storageNote", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description" id="pdesc" optional>
          <Input id="pdesc" value={v.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} />
        </Field>
      </div>

      {mode === "new" ? (
        <fieldset className="grid grid-cols-2 gap-4 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-3">
          <legend className="px-2 text-sm font-extrabold">First price and order limits</legend>
          <Field label="Price is for" id="pfor">
            <Select id="pfor" value={priceFor} onChange={(e) => setPriceFor(e.target.value)}>
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
          <Field label="Price (₹)" id="pprice">
            <Input id="pprice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Offer price (₹)" id="poffer" optional hint="Lower than the price">
            <Input id="poffer" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} />
          </Field>
          <Field label={`Smallest order (${piece ? "pieces" : "kg"})`} id="pmin">
            <Input id="pmin" inputMode="decimal" value={minQ} onChange={(e) => setMinQ(e.target.value)} />
          </Field>
          <Field label={`Largest order (${piece ? "pieces" : "kg"})`} id="pmax">
            <Input id="pmax" inputMode="decimal" value={maxQ} onChange={(e) => setMaxQ(e.target.value)} />
          </Field>
          <Field label={`Steps (${piece ? "pieces" : "kg"})`} id="pstep" hint="Each tap adds this much">
            <Input id="pstep" inputMode="decimal" value={stepQ} onChange={(e) => setStepQ(e.target.value)} />
          </Field>
        </fieldset>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending || !v.name.trim() || !v.nameHi.trim() || !v.categoryId || (mode === "new" && !price.trim())}>
          {pending ? "Saving…" : mode === "new" ? "Create product" : "Save product"}
        </Button>
      </div>
    </form>
  );
}
