import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/parts";
import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { listStaff } from "@/server/services/admin/staff";
import { StaffManager } from "./staff-manager";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.roles, "staff.manage")) redirect("/admin");
  const staff = await listStaff(db());
  return (
    <div className="max-w-5xl">
      <PageHeader title="Staff" sub="Who can sign in, and what they can do. People only see the screens their role needs." />
      <StaffManager
        meId={ctx.user.id}
        staff={staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null }))}
      />
    </div>
  );
}
