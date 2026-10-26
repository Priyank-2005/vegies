"use client";

import { IconMinus, IconPlus } from "@/components/icons";
import { buttonClass, cx } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatQuantity, lineTotal, type BaseUnit } from "@/lib/units";
import { useShop } from "./shop-context";

export interface QtyRules {
  saleUnitId: string;
  productName: string;
  baseUnit: BaseUnit;
  minBase: number;
  maxBase: number;
  stepBase: number;
  unitBaseQty: number;
  unitPricePaise: number;
}

/**
 * Add / minus / plus for one product.
 *  - card: compact ADD button that turns into a stepper (product grids)
 *  - line: stepper with quantity (cart rows)
 *  - page: large "Add to cart" button + stepper with an estimate (product page)
 * The total shown is an estimate; the server prices the real order.
 */
export function QtyControl({ rules, variant = "card" }: { rules: QtyRules; variant?: "card" | "line" | "page" }) {
  const { cart, setQty, ready } = useShop();
  const qty = cart[rules.saleUnitId] ?? 0;
  const hint = { p: rules.unitPricePaise, b: rules.unitBaseQty };
  const add = () => setQty(rules.saleUnitId, rules.minBase, hint);
  const dec = qty - rules.stepBase;
  const inc = qty + rules.stepBase;

  if (qty === 0 || !ready) {
    if (variant === "page") {
      return (
        <button type="button" disabled={!ready} onClick={add} className={buttonClass({ size: "lg", full: true })} aria-label={`Add ${rules.productName}, ${formatQuantity(rules.minBase, rules.baseUnit)}`}>
          <IconPlus size={18} /> Add {formatQuantity(rules.minBase, rules.baseUnit)} to cart
        </button>
      );
    }
    return (
      <button type="button" disabled={!ready} onClick={add} className="min-h-9 min-w-[72px] rounded-[10px] border-[1.5px] border-brand bg-surface px-4 text-[13px] font-extrabold uppercase tracking-wide text-brand shadow-[0_2px_6px_rgba(5,59,39,.14)] transition-colors hover:bg-brand-soft disabled:opacity-60" aria-label={`Add ${rules.productName}, ${formatQuantity(rules.minBase, rules.baseUnit)}`}>
        Add
      </button>
    );
  }

  const stepper = (
    <div className={cx("inline-flex items-stretch overflow-hidden rounded-[10px] bg-brand text-brand-ink shadow-[0_2px_6px_rgba(5,59,39,.25)]", variant === "page" ? "h-12" : "h-9")} role="group" aria-label={`${rules.productName} quantity`}>
      <button type="button" className={cx("flex items-center justify-center hover:bg-brand-hover", variant === "page" ? "w-12" : "w-9")} aria-label={`Decrease ${rules.productName}`} onClick={() => setQty(rules.saleUnitId, dec >= rules.minBase ? dec : 0, hint)}>
        <IconMinus size={16} />
      </button>
      <span className={cx("flex min-w-[52px] items-center justify-center px-1 text-center font-semibold tabular-nums", variant === "page" ? "min-w-[84px] text-base" : "text-[13px]")} aria-live="polite">
        {formatQuantity(qty, rules.baseUnit)}
      </span>
      <button type="button" className={cx("flex items-center justify-center hover:bg-brand-hover disabled:opacity-40", variant === "page" ? "w-12" : "w-9")} aria-label={`Increase ${rules.productName}`} disabled={inc > rules.maxBase} onClick={() => setQty(rules.saleUnitId, inc, hint)}>
        <IconPlus size={16} />
      </button>
    </div>
  );

  if (variant === "page") {
    return (
      <div className="flex items-center gap-4">
        {stepper}
        <p className="text-sm text-muted">
          In your cart · about <strong className="font-semibold text-ink tabular-nums">{formatINR(lineTotal(qty, rules.unitPricePaise, rules.unitBaseQty))}</strong>
        </p>
      </div>
    );
  }
  return stepper;
}
