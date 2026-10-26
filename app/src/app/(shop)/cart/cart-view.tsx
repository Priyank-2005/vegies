"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconArrowRight } from "@/components/icons";
import { issueText } from "@/components/shop/issue-text";
import { LocationBanner } from "@/components/shop/location-banner";
import { unitShort } from "@/components/shop/product-card";
import { QtyControl } from "@/components/shop/qty-control";
import { useShop } from "@/components/shop/shop-context";
import { Alert, Button, Skeleton, buttonClass } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { ProductArt, artTint } from "@/components/shop/product-art";
import { formatQuantity } from "@/lib/units";
import type { PricingResult } from "@/server/services/pricing";

type PricedResponse = PricingResult & { minOrderPaise: number; payOnDeliveryCapPaise: number; prepaidEnabled: boolean };

export function CartView() {
  const { cart, setQty, clearCart, ready } = useShop();
  const [priced, setPriced] = useState<PricedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => Object.entries(cart).map(([saleUnitId, qtyBase]) => ({ saleUnitId, qtyBase })), [cart]);
  const key = JSON.stringify(items);

  useEffect(() => {
    if (!ready || items.length === 0) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/v1/cart/price", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ items }) });
        if (!res.ok) throw new Error(String(res.status));
        setPriced((await res.json()) as PricedResponse);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("We could not update your prices. Please check your connection.");
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  if (!ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-muted">Add vegetables and fruit to see delivery charges and arrival times.</p>
        <Link href="/shop" className={buttonClass({ className: "mt-5" })}>
          Start shopping
        </Link>
      </div>
    );
  }

  const stale = priced == null;
  const issueBy = new Map((priced?.issues ?? []).map((i) => [i.saleUnitId, i]));
  const lineBy = new Map((priced?.lines ?? []).map((l) => [l.saleUnitId, l]));
  const belowMin = priced ? priced.subtotalPaise < priced.minOrderPaise : false;
  const canCheckout = !!priced && priced.ok && !belowMin;

  const summary = (
    <div className="space-y-3 text-[15px]">
      <div className="flex items-baseline justify-between">
        <span className="text-muted">Items ({items.length})</span>
        <span className="font-semibold tabular-nums">{priced ? formatINR(priced.subtotalPaise) : "…"}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted">Delivery</span>
        <span className="text-[13px] text-muted">Chosen at checkout</span>
      </div>
      <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-muted">
        Instant <strong className="text-ink">₹20</strong> · 1 hour <strong className="text-ink">₹10</strong> · 3 hours <strong className="text-brand">Free</strong>. No platform charges.
      </p>
      {belowMin && priced ? <Alert tone="warn">Minimum order is {formatINR(priced.minOrderPaise)}. Add a little more to continue.</Alert> : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section className="space-y-4" aria-label="Cart items">
        <LocationBanner />
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
          {items.map(({ saleUnitId, qtyBase }) => {
            const info = priced?.units[saleUnitId];
            const issue = issueBy.get(saleUnitId);
            const line = lineBy.get(saleUnitId);
            return (
              <li key={saleUnitId} className="flex gap-3.5 p-4">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-xl p-1 sm:size-[72px]" style={{ background: info ? artTint(info.slug) : "var(--surface-2)" }} aria-hidden>
                  {info ? <ProductArt slug={info.slug} className="size-full" /> : null}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{info?.nameEn ?? (stale ? "Updating…" : "Item")}</p>
                      <p className="text-[13px] text-muted tabular-nums">{info ? `${formatINR(info.unitPricePaise)} per ${unitShort(info.unitBaseQty, info.baseUnit)}` : `${qtyBase}`}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{line ? formatINR(line.lineTotalPaise) : "…"}</p>
                  </div>
                  {issue ? (
                    <Alert tone="danger">
                      {issueText(issue.code, { ...info, maxAvailableBase: issue.maxAvailableBase })}
                      {issue.code === "INSUFFICIENT_STOCK" && issue.maxAvailableBase && issue.maxAvailableBase >= (info?.minBase ?? Infinity) ? (
                        <button className="ml-2 font-semibold underline underline-offset-2" onClick={() => setQty(saleUnitId, issue.maxAvailableBase!)}>
                          Reduce to {formatQuantity(issue.maxAvailableBase, info!.baseUnit)}
                        </button>
                      ) : null}
                    </Alert>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    {info ? (
                      <QtyControl variant="line" rules={{ saleUnitId, productName: info.nameEn, baseUnit: info.baseUnit, minBase: info.minBase, maxBase: info.maxBase, stepBase: info.stepBase, unitBaseQty: info.unitBaseQty, unitPricePaise: info.unitPricePaise }} />
                    ) : (
                      <Skeleton className="h-9 w-28" />
                    )}
                    <button className="text-[13px] font-medium text-muted underline underline-offset-2 hover:text-danger" onClick={() => setQty(saleUnitId, 0)}>
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button className="text-sm font-medium text-muted underline underline-offset-2 hover:text-danger" onClick={clearCart}>
          Empty cart
        </button>
      </section>

      <aside className="hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:block" aria-label="Order summary">
        <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
        {summary}
        {canCheckout ? (
          <Link href="/checkout" className={buttonClass({ size: "lg", full: true, className: "mt-5" })}>
            Continue to checkout <IconArrowRight size={18} />
          </Link>
        ) : (
          <Button size="lg" full className="mt-5" disabled>
            {stale ? "Updating prices…" : "Fix items to continue"}
          </Button>
        )}
      </aside>

      <div className="lg:hidden">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">{summary}</div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3">
            <div className="leading-tight">
              <p className="text-[12px] text-muted">Items total</p>
              <p className="text-lg font-semibold tabular-nums">{priced ? formatINR(priced.subtotalPaise) : "…"}</p>
            </div>
            {canCheckout ? (
              <Link href="/checkout" className={buttonClass({ size: "lg", full: true, className: "flex-1" })}>
                Checkout <IconArrowRight size={18} />
              </Link>
            ) : (
              <Button size="lg" full className="flex-1" disabled>
                {stale ? "Updating…" : "Fix items"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
