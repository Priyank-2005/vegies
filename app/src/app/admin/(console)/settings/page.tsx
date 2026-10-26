import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/parts";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { getSettingsView } from "@/server/services/admin/settings";
import { BusinessForm, HubForm, SpeedForm } from "./settings-forms";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "delivery.manage")) redirect("/admin");
  const v = await getSettingsView(db());
  const owner = can(ctx.user.roles, "settings.write");
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" sub="Store, delivery speeds and business rules. Changes apply to the next order straight away." />
      {v.hub ? (
        <>
          <Panel title="Store" sub="Where orders are packed and sent from, and when we take orders">
            <HubForm hub={v.hub} />
          </Panel>
          <Panel title="Delivery speeds" sub="What each speed costs, how fast we promise it, how far it reaches and how many orders we handle at once" flush>
            <ul className="divide-y divide-line">
              {v.options.map((o) => (
                <li key={o.code} className="p-5">
                  <SpeedForm hubId={v.hub!.id} option={o} />
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : (
        <Panel>
          <p className="text-muted">No store has been set up yet. Run the demo seed or ask the developer to create one.</p>
        </Panel>
      )}
      <Panel title="Business rules" sub={owner ? "Only the owner can change these" : "Only the owner can change these. You can see the current values."}>
        <BusinessForm values={v.business} canEdit={owner} />
      </Panel>
    </div>
  );
}
