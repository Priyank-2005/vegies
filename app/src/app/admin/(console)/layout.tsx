import Link from "next/link";
import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/admin/kit";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";
import { currentStaff } from "@/server/auth/guards";
import { can, mfaRequired, type Permission } from "@/server/auth/permissions";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

// Navigation is a convenience only: every page and action it leads to enforces permissions on the server.
const NAV: Array<{ href: string; label: string; permission: Permission }> = [
  { href: "/admin", label: "Today", permission: "delivery.manage" },
  { href: "/admin/dispatch", label: "Dispatch board", permission: "delivery.manage" },
  { href: "/admin/orders", label: "Orders", permission: "customer.read" },
  { href: "/admin/packing", label: "Packing", permission: "order.pack" },
  { href: "/admin/rider", label: "My deliveries", permission: "order.deliver" },
  { href: "/admin/catalog", label: "Catalogue", permission: "catalog.write" },
  { href: "/admin/stock", label: "Stock & buying", permission: "stock.read" },
  { href: "/admin/money", label: "Cash", permission: "delivery.manage" },
  { href: "/admin/reports", label: "Reports", permission: "report.read" },
  { href: "/admin/staff", label: "Staff", permission: "staff.manage" },
  { href: "/admin/settings", label: "Settings", permission: "delivery.manage" },
];

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", OPS_MANAGER: "Ops manager", PROCUREMENT: "Procurement", PACKER: "Packer", RIDER: "Rider", SUPPORT: "Support" };

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (mfaRequired(ctx.user.roles) && !ctx.session.mfaVerifiedAt) redirect("/admin/security");
  if (ctx.user.mustChangePassword) redirect("/admin/account");

  const links = NAV.filter((n) => can(ctx.user.roles, n.permission)).map(({ href, label }) => ({ href, label }));
  return (
    <ToastProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:py-5">
            <Logo />
            <div className="flex items-center gap-2 lg:hidden">
              <LogoutButton compact />
            </div>
          </div>
          <div className="px-4 pb-2 lg:flex-1 lg:overflow-y-auto lg:px-3 lg:py-2">
            <AdminNav items={links} />
          </div>
          <div className="hidden border-t border-line p-4 lg:block">
            <p className="truncate text-sm font-bold">{ctx.user.name}</p>
            <div className="mb-3 mt-1 flex flex-wrap gap-1">
              {ctx.user.roles.map((r) => (
                <Badge key={r} tone="neutral">
                  {ROLE_LABEL[r] ?? r}
                </Badge>
              ))}
            </div>
            <Link href="/admin/account" className="mb-2 block text-[13px] font-semibold text-brand hover:underline">
              Change password
            </Link>
            <LogoutButton />
          </div>
        </aside>
        <main className="min-w-0 px-4 py-6 lg:px-9 lg:py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
