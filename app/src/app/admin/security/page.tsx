import { redirect } from "next/navigation";
import { currentStaff } from "@/server/auth/guards";
import { MFA_ENFORCED, mfaRequired } from "@/server/auth/permissions";
import { TotpSetup } from "./totp-setup";

export const metadata = { title: "Two-factor authentication" };
export const dynamic = "force-dynamic";

/**
 * Two-factor set-up. Hidden while staff two-factor is switched off (MFA_ENFORCED in permissions.ts):
 * the page, the API routes and the login check are all intact, so turning the flag on brings it back.
 */
export default async function SecurityPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  if (!MFA_ENFORCED) redirect("/admin");
  if (ctx.user.totpEnabled && ctx.session.mfaVerifiedAt) redirect("/admin");
  const required = mfaRequired(ctx.user.roles);

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-[26px] font-extrabold tracking-tight">Set up two-factor authentication</h1>
        <p className="text-sm text-muted">
          {required ? "Your role handles orders and money, so a second step at sign-in is required before you can continue." : "Add a second step at sign-in for extra protection."}
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5">
        <TotpSetup />
      </div>
    </main>
  );
}
