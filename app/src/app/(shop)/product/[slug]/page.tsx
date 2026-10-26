import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChevronRight, IconScale, IconWallet, IconTruck } from "@/components/icons";
import { ProductCard, ProductTile, unitShort } from "@/components/shop/product-card";
import { QtyControl } from "@/components/shop/qty-control";
import { Badge, SectionHeading } from "@/components/ui";
import { formatServiceDate } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { formatQuantity } from "@/lib/units";
import { db } from "@/server/db/client";
import { currentServiceDate, storefrontSnapshot } from "@/server/selection";
import { getProductBySlug, queryProducts } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(db(), slug, null);
  return { title: p ? `${p.name} (${p.nameHi})` : "Product not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const date = await currentServiceDate();
  const [p, snap] = await Promise.all([getProductBySlug(db(), slug, date), storefrontSnapshot()]);
  if (!p) notFound();
  const related = (await queryProducts(db(), { serviceDate: date, categorySlug: p.category.slug, sort: "popular", limit: 6 })).filter((r) => r.id !== p.id).slice(0, 5);

  const unavailable = p.availability === "SOLD_OUT" || p.availability === "NOT_PUBLISHED" || p.availability === "OUT_OF_SEASON";
  const maxByStock = p.availableBase == null ? p.unit.maxBase : Math.min(p.unit.maxBase, p.availableBase - (p.availableBase % p.unit.stepBase));
  const cannotBuy = unavailable || maxByStock < p.unit.minBase;
  const unit = unitShort(p.unit.unitBaseQty, p.baseUnit);
  const weightNote =
    p.weightModel === "LOOSE_WEIGHT"
      ? "Sold by weight. We pack at least the weight you order, and up to 5% extra is on us. You never pay more than the amount shown at checkout; if a bag turns out short, the difference is refunded."
      : p.weightModel === "APPROX_PIECE"
        ? "Sold per piece; weights vary a little. The price you see is the price you pay. If a piece is much lighter than described, we refund the difference."
        : "Fixed pack. The price you see is the price you pay.";
  const stockLine = p.availability === "SOLD_OUT" ? "Sold out" : p.availability === "NOT_PUBLISHED" ? "Not in stock" : p.availability === "OUT_OF_SEASON" ? "Out of season" : p.availability === "LOW" ? "Few left" : "In stock";

  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-[13px] text-muted">
        <Link className="hover:text-ink" href="/shop">Shop</Link>
        <IconChevronRight size={14} />
        <Link className="hover:text-ink" href={`/shop?category=${p.category.slug}`}>{p.category.name}</Link>
        <IconChevronRight size={14} />
        <span className="text-ink">{p.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12">
        <div>
          <ProductTile product={p} large dim={cannotBuy} />
          <p className="mt-2 text-xs text-muted">Illustration. Actual produce may look a little different.</p>
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{p.name}</h1>
            <p className="deva mt-0.5 text-xl text-muted">{p.nameHi}</p>
          </div>

          <div className="space-y-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[40px] font-extrabold tabular-nums">{formatINR(p.effectivePricePaise)}</span>
              {p.salePricePaise != null ? <s className="text-lg text-muted tabular-nums">{formatINR(p.pricePaise)}</s> : null}
              <span className="text-base text-muted">per {unit}</span>
              {p.salePricePaise != null ? <Badge tone="danger">Offer</Badge> : null}
            </p>
            <p className="text-sm text-muted">
              Order {formatQuantity(p.unit.minBase, p.baseUnit)} to {formatQuantity(p.unit.maxBase, p.baseUnit)}, in steps of {formatQuantity(p.unit.stepBase, p.baseUnit)}.
              <span className="mx-1.5 text-line-strong">|</span>
              <span className={cannotBuy ? "font-medium text-danger" : p.availability === "LOW" ? "font-medium text-accent-ink" : "font-medium text-brand"}>{stockLine}</span>
              <span className="text-muted"> for {formatServiceDate(date)}</span>
            </p>
          </div>

          <div className="max-w-sm">
            {cannotBuy ? (
              <p className="rounded-md border border-line bg-surface-2 px-3 py-3 text-sm font-medium text-muted">This item is not available for {formatServiceDate(date)}.</p>
            ) : (
              <QtyControl variant="page" rules={{ saleUnitId: p.unit.id, productName: p.name, baseUnit: p.baseUnit, minBase: p.unit.minBase, maxBase: maxByStock, stepBase: p.unit.stepBase, unitBaseQty: p.unit.unitBaseQty, unitPricePaise: p.effectivePricePaise }} />
            )}
          </div>

          <ul className="grid grid-cols-3 gap-2 text-center text-[12px] font-semibold leading-tight">
            {[
              [IconTruck, snap ? snap.options.map((o) => `${o.name} ${o.feePaise === 0 ? "free" : formatINR(o.feePaise)}`).join(" · ") : "Fast delivery"],
              [IconScale, "Honest weights, short bags refunded"],
              [IconWallet, "Pay cash or UPI on delivery"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof IconTruck;
              return (
                <li key={i} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface p-2.5 text-muted">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <I size={18} />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
            <h2 className="text-sm font-extrabold">How weight and price work</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{weightNote}</p>
          </div>

          {p.descriptionEn ? <p className="leading-relaxed">{p.descriptionEn}</p> : null}
          <dl className="space-y-1.5 text-sm">
            {p.storageNote ? <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Storage</dt><dd>{p.storageNote}</dd></div> : null}
            {p.originNote ? <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Origin</dt><dd>{p.originNote}</dd></div> : null}
          </dl>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-12 space-y-4" aria-labelledby="related">
          <SectionHeading title="You may also like" sub={`More from ${p.category.name}`} />
          <div id="related" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} serviceDateLabel={formatServiceDate(date)} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
