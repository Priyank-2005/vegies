import Link from "next/link";
import { LocationBanner } from "@/components/shop/location-banner";
import { ProductCard } from "@/components/shop/product-card";
import { SortSelect } from "@/components/shop/sort-select";
import { cx } from "@/components/ui";
import { formatServiceDate } from "@/lib/format";
import { db } from "@/server/db/client";
import { currentServiceDate } from "@/server/selection";
import { listCategories, queryProducts, type ProductSort } from "@/server/services/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop fresh vegetables" };

const SORTS: Array<[ProductSort, string]> = [
  ["popular", "Most ordered"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["name", "Name A to Z"],
];

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const category = sp.category && /^[a-z0-9-]{1,60}$/.test(sp.category) ? sp.category : undefined;
  const sort = SORTS.some(([k]) => k === sp.sort) ? (sp.sort as ProductSort) : "popular";

  const date = await currentServiceDate();
  const dayLabel = formatServiceDate(date);
  const [products, categories] = await Promise.all([queryProducts(db(), { serviceDate: date, q, categorySlug: category, sort, limit: 100 }), listCategories(db())]);
  const visibleCats = categories.filter((c) => c.productCount > 0);
  const activeCat = visibleCats.find((c) => c.slug === category);

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, category, sort: sort === "popular" ? undefined : sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return p.size ? `/shop?${p}` : "/shop";
  };
  const total = visibleCats.reduce((s, c) => s + c.productCount, 0);

  return (
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 lg:py-8">
      <div className="mb-4 space-y-3">
        <LocationBanner />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Categories">
          <p className="mb-2 hidden text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted lg:block">Categories</p>
          <nav className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
            {[{ slug: "", name: "All products", n: total }, ...visibleCats.map((c) => ({ slug: c.slug, name: c.name, n: c.productCount }))].map((c) => {
              const active = (c.slug || undefined) === category;
              return (
                <Link
                  key={c.slug || "all"}
                  href={href({ category: c.slug || undefined })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-full border px-3.5 py-2 text-[14px] font-semibold lg:rounded-xl lg:border-0 lg:py-2.5",
                    active ? "border-brand bg-brand text-brand-ink lg:bg-brand-soft lg:text-brand" : "border-line bg-surface text-ink hover:bg-surface-2 lg:bg-transparent",
                  )}
                >
                  <span>{c.name}</span>
                  <span className={cx("text-[12px] tabular-nums", active ? "text-brand-ink/80 lg:text-brand" : "text-muted")}>{c.n}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section aria-label="Products">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight">{q ? `Results for “${q}”` : (activeCat?.name ?? "All products")}</h1>
              <p className="text-sm text-muted">
                {products.length} item{products.length === 1 ? "" : "s"} · in stock for {dayLabel}
              </p>
            </div>
            <SortSelect value={sort} options={SORTS} params={{ q: q || undefined, category }} />
          </div>

          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
              <p className="text-lg font-semibold">Nothing matched{q ? ` “${q}”` : ""}</p>
              <p className="mt-1 text-muted">Try another spelling. You can search in English, Hindi or Hinglish.</p>
              <Link className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-2" href="/shop">
                Clear search
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} serviceDateLabel={dayLabel} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
