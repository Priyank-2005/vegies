import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/parts";
import { ProductArt, artTint } from "@/components/shop/product-art";
import { Badge } from "@/components/ui";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { getProductAdmin, listCategoriesAdmin } from "@/server/services/admin/catalog";
import { ProductForm } from "../product-form";
import { ActiveToggle, AddUnit, UnitCard } from "./unit-cards";

export const metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "catalog.write")) redirect("/admin");
  const { id } = await params;
  const [d, categories] = await Promise.all([getProductAdmin(db(), id), listCategoriesAdmin(db())]);
  if (!d) notFound();
  const p = d.product;
  const canPrice = can(ctx.user.roles, "price.write");
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/catalog" className="inline-block text-[13px] font-semibold text-brand hover:underline">
        ← Catalogue
      </Link>
      <PageHeader
        title={p.name}
        sub={p.nameHi}
        actions={
          <>
            {p.active ? <Badge tone="brand">In the shop</Badge> : <Badge tone="outline">Hidden</Badge>}
            <ActiveToggle id={p.id} active={p.active} />
          </>
        }
      />
      <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-xl p-1" style={{ background: artTint(p.slug) }} aria-hidden>
          <ProductArt slug={p.slug} className="size-full" />
        </span>
        <p className="text-[13.5px] text-muted">The picture in the shop is an illustration chosen from the product name. Real photos can be added later.</p>
      </div>

      <Panel title="Prices and order limits" sub="Every price change is kept in the history. Past orders keep the price they were placed at." flush>
        <ul className="divide-y divide-line">
          {d.units.map((u) => (
            <li key={u.id} className="p-5">
              <UnitCard
                unit={{ id: u.id, unitBaseQty: u.unitBaseQty, minBase: u.minBase, maxBase: u.maxBase, stepBase: u.stepBase, isDefault: u.isDefault, active: u.active, pricePaise: u.pricePaise, salePricePaise: u.salePricePaise }}
                baseUnit={p.baseUnit}
                canPrice={canPrice}
                history={u.history.map((h) => ({ pricePaise: h.pricePaise, salePricePaise: h.salePricePaise, validFrom: h.validFrom.toISOString() }))}
              />
            </li>
          ))}
        </ul>
        {canPrice ? (
          <div className="border-t border-line p-5">
            <AddUnit productId={p.id} baseUnit={p.baseUnit} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Details">
        <ProductForm
          mode="edit"
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            id: p.id,
            name: p.name,
            nameHi: p.nameHi,
            categoryId: p.categoryId,
            aliases: p.aliases.join(", "),
            descriptionEn: p.descriptionEn ?? "",
            storageNote: p.storageNote ?? "",
            weightModel: p.weightModel,
            baseUnit: p.baseUnit,
            tolerancePct: p.tolerancePct,
            seasonStartMonth: p.seasonStartMonth,
            seasonEndMonth: p.seasonEndMonth,
          }}
        />
      </Panel>
    </div>
  );
}
