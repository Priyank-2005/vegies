import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import { currentStaff } from "@/server/auth/guards";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff sign-in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentStaff()) redirect("/admin");
  return (
    <main className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="hidden flex-col justify-between bg-brand-deep p-10 text-white lg:flex">
        <Logo tone="light" />
        <div className="max-w-md space-y-3">
          <p className="text-3xl font-semibold leading-tight">Run the day from one place.</p>
          <p className="text-white/70">Orders, packing, riders, stock and cash for {BRAND.city}. Staff access only.</p>
        </div>
        <p className="text-xs text-white/40">{BRAND.name} operations</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-4">
            <Logo className="lg:hidden" />
            <div className="space-y-1">
              <h1 className="text-[26px] font-extrabold tracking-tight">Staff sign-in</h1>
              <p className="text-sm text-muted">Use the email and password your manager gave you.</p>
            </div>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
