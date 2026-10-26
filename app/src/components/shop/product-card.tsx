import Link from "next/link";
import { cx } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { type BaseUnit } from "@/lib/units";
import type { CatalogProduct } from "@/server/services/catalog";
import { ProductArt, artTint } from "./product-art";
import { QtyControl } from "./qty-control";

/** "kg", "500 g", "piece": the unit a price refers to. */
export function unitShort(unitBaseQty: number, base: BaseUnit): string {
  if (base === "PIECE") return unitBaseQty === 1 ? "piece" : `${unitBaseQty} pcs`;
  return unitBaseQty === 1000 ? "kg" : unitBaseQty > 1000 ? `${unitBaseQty / 1000} kg` : `${unitBaseQty} g`;
}

/**
 * Illustrated stand-in for product photography: the vegetable drawn on a soft wash of its own colour.
 * A real photo replaces this when a product gets an image.
 */
export function ProductTile({ product, large, dim }: { product: Pick<CatalogProduct, "name" | "nameHi" | "slug"> & { category: { slug: string } }; large?: boolean; dim?: boolean }) {
  return (
    <div aria-hidden className={cx("relative flex items-center justify-center overflow-hidden", large ? "aspect-[4/3] rounded-[var(--radius-card)] md:aspect-square" : "aspect-square", dim && "grayscale")} style={{ background: artTint(product.slug) }}>
      <span className="absolute -right-10 -top-10 size-40 rounded-full bg-[var(--orb)]" />
      <span className="absolute -bottom-12 -left-8 size-32 rounded-full bg-[var(--orb)]" />
      <ProductArt slug={product.slug} className={cx("relative h-[80%] w-[80%] -translate-y-1.5 drop-shadow-[0_6px_8px_rgba(0,0,0,.08)]", large && "h-[90%] w-[90%] translate-y-0")} />
    </div>
  );
}

export function ProductCard({ product: p, serviceDateLabel }: { product: CatalogProduct; serviceDateLabel?: string }) {
  const unavailable = p.availability === "SOLD_OUT" || p.availability === "NOT_PUBLISHED" || p.availability === "OUT_OF_SEASON";
  // Never offer more than what is left, rounded down to a valid step.
  const maxByStock = p.availableBase == null ? p.unit.maxBase : Math.min(p.unit.maxBase, p.availableBase - (p.availableBase % p.unit.stepBase));
  const cannotBuy = unavailable || maxByStock < p.unit.minBase;
  const onSale = p.salePricePaise != null;
  const unit = unitShort(p.unit.unitBaseQty, p.baseUnit);
  const minLabel = p.unit.minBase >= 1000 ? `${p.unit.minBase / 1000} kg` : p.baseUnit === "PIECE" ? `${p.unit.minBase} pc` : `${p.unit.minBase} g`;
  const note =
    p.availability === "SOLD_OUT" ? "Sold out" : p.availability === "NOT_PUBLISHED" ? `Not in stock${serviceDateLabel ? ` for ${serviceDateLabel}` : ""}` : p.availability === "OUT_OF_SEASON" ? "Out of season" : null;
  const off = onSale ? Math.round(((p.pricePaise - p.effectivePricePaise) / p.pricePaise) * 100) : 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card transition-shadow hover:shadow-pop">
      <div className="relative">
        <Link href={`/product/${p.slug}`} className="block" aria-label={`${p.name}, ${p.nameHi}`}>
          <ProductTile product={p} dim={cannotBuy} />
        </Link>
        {p.availability === "LOW" ? <span className="absolute left-2.5 top-2.5 rounded-md bg-accent px-2 py-0.5 text-[11px] font-extrabold text-accent-ink">Few left</span> : null}
        {onSale ? <span className="absolute left-2.5 top-2.5 rounded-md bg-danger px-2 py-0.5 text-[11px] font-extrabold text-white">{off > 0 ? `${off}% OFF` : "Offer"}</span> : null}
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-surface/90 px-2 py-0.5 text-[11.5px] font-bold text-ink shadow-sm backdrop-blur">{unit === "kg" ? "1 kg" : unit}</span>
        {!cannotBuy ? (
          <div className="absolute bottom-2.5 right-2.5">
            <QtyControl variant="card" rules={{ saleUnitId: p.unit.id, productName: p.name, baseUnit: p.baseUnit, minBase: p.unit.minBase, maxBase: maxByStock, stepBase: p.unit.stepBase, unitBaseQty: p.unit.unitBaseQty, unitPricePaise: p.effectivePricePaise }} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3 pt-2.5">
        <p className="flex items-baseline gap-1.5 leading-none">
          <span className="text-[18px] font-extrabold tabular-nums">{formatINR(p.effectivePricePaise)}</span>
          {onSale ? <s className="text-[12.5px] text-muted tabular-nums">{formatINR(p.pricePaise)}</s> : null}
          <span className="text-[12px] font-medium text-muted">/{unit}</span>
        </p>
        <Link href={`/product/${p.slug}`} className="mt-1.5 block">
          <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-ink group-hover:text-brand">{p.name}</h3>
        </Link>
        <p className="deva text-[13px] text-muted">{p.nameHi}</p>
        <p className="mt-0.5 text-[12px] text-muted">{cannotBuy ? <span className="font-semibold text-danger">{note ?? "Unavailable"}</span> : `Min ${minLabel}`}</p>
      </div>
    </article>
  );
}
