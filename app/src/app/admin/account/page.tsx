import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { currentStaff } from "@/server/auth/guards";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Change password" };

export default async function AccountPage() {
  const ctx = await currentStaff();
  if (!ctx) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Logo className="mb-8" />
      <h1 className="text-[26px] font-extrabold tracking-tight">{ctx.user.mustChangePassword ? "Choose your own password" : "Change password"}</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        {ctx.user.mustChangePassword ? "You signed in with a temporary password. Pick a new one that only you know before you continue." : "Other devices will be signed out when you change it."}
      </p>
      <PasswordForm forced={ctx.user.mustChangePassword} />
      {!ctx.user.mustChangePassword ? (
        <Link href="/admin" className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">
          Back to the console
        </Link>
      ) : null}
    </main>
  );
}
