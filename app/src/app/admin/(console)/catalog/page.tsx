import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { Badge, Button, buttonClass, Input, Select } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { listCategoriesAdmin, listProductsAdmin } from "@/server/services/admin/catalog";
import { unitShort } from "@/components/shop/product-card";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "Catalogue" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; all?: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "catalog.write")) redirect("/admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const categoryId = sp.category && /^[0-9a-f-]{36}$/i.test(sp.category) ? sp.category : undefined;
  const includeInactive = sp.all === "1";
  const [products, categories] = await Promise.all([listProductsAdmin(db(), { q, categoryId, includeInactive }), listCategoriesAdmin(db())]);
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Catalogue"
        sub="Everything customers can buy, with prices in English and Hindi."
        actions={
          <Link href="/admin/catalog/new" className={buttonClass({ size: "md" })}>
            Add a product
          </Link>
        }
      />
      <form method="get" className="flex flex-wrap items-center gap-2" role="search">
        <div className="min-w-56 flex-1">
          <Input name="q" defaultValue={q} placeholder="Search by name, Hindi name or spelling" aria-label="Search products" />
        </div>
        <div className="w-full sm:w-56">
          <Select name="category" defaultValue={categoryId ?? ""} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" name="all" value="1" defaultChecked={includeInactive} className="size-4" /> Include hidden
        </label>
        <Button type="submit">Filter</Button>
      </form>

      <Panel flush>
        {products.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No products match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Product</th>
                  <th className={thClass}>Category</th>
                  <th className={`${thClass} text-right`}>Price</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className={`hover:bg-surface-2 ${p.active ? "" : "opacity-60"}`}>
                    <td className={tdClass}>
                      <Link href={`/admin/catalog/${p.id}`} className="font-semibold text-brand hover:underline">
                        {p.name}
                      </Link>
                      <span className="deva ml-2 text-muted">{p.nameHi}</span>
                    </td>
                    <td className={`${tdClass} text-muted`}>{p.categoryName}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {p.pricePaise === null || p.unitBaseQty === null ? (
                        <span className="text-danger">No price</span>
                      ) : (
                        <>
                          {p.salePricePaise !== null ? <s className="mr-1.5 text-muted">{formatINR(p.pricePaise)}</s> : null}
                          <span className="font-semibold">{formatINR(p.salePricePaise ?? p.pricePaise)}</span>
                          <span className="text-muted"> / {unitShort(p.unitBaseQty, p.baseUnit)}</span>
                        </>
                      )}
                    </td>
                    <td className={tdClass}>{p.active ? <Badge tone="brand">In the shop</Badge> : <Badge tone="outline">Hidden</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Categories" sub="How the shop groups products" flush>
        <CategoryManager categories={categories.map((c) => ({ id: c.id, name: c.name, nameHi: c.nameHi, sortOrder: c.sortOrder, active: c.active }))} />
      </Panel>
    </div>
  );
}
