import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/parts";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { listCategoriesAdmin } from "@/server/services/admin/catalog";
import { ProductForm } from "../product-form";

export const metadata = { title: "Add a product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "catalog.write") || !can(ctx.user.roles, "price.write")) redirect("/admin");
  const categories = await listCategoriesAdmin(db());
  return (
    <div className="max-w-3xl">
      <Link href="/admin/catalog" className="mb-3 inline-block text-[13px] font-semibold text-brand hover:underline">
        ← Catalogue
      </Link>
      <PageHeader title="Add a product" sub="It appears in the shop as soon as it has stock published for the day." />
      <Panel>
        <ProductForm
          mode="new"
          categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          initial={{ name: "", nameHi: "", categoryId: "", aliases: "", descriptionEn: "", storageNote: "", weightModel: "LOOSE_WEIGHT", baseUnit: "GRAM", tolerancePct: 0, seasonStartMonth: null, seasonEndMonth: null }}
        />
      </Panel>
    </div>
  );
}
