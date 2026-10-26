"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

interface ApiProblem {
  code?: string;
  detail?: string;
  retryAfterSeconds?: number;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(needTotp && totp ? { totp } : {}) }),
      });
      if (res.ok) {
        const data = (await res.json()) as { mfaSetupRequired: boolean };
        router.replace(data.mfaSetupRequired ? "/admin/security" : "/admin");
        router.refresh();
        return;
      }
      const p = (await res.json().catch(() => ({}))) as ApiProblem;
      if (p.code === "TOTP_REQUIRED") {
        // Only reachable for an account that enrolled in two-factor voluntarily.
        setNeedTotp(true);
        setError(null);
      } else if (p.code === "LOCKED" || p.code === "RATE_LIMITED") {
        const mins = Math.max(1, Math.ceil((p.retryAfterSeconds ?? 60) / 60));
        setError(`Too many attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`);
      } else {
        setError(p.detail ?? "Sign-in failed. Please try again.");
      }
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field id="email" label="Email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={needTotp} />
      </Field>
      <Field id="password" label="Password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={needTotp} />
      </Field>
      {needTotp ? (
        <Field id="totp" label="Authenticator code" hint="6 digits from your authenticator app">
          <Input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} />
        </Field>
      ) : null}
      <Button type="submit" size="lg" full disabled={busy || !email || !password}>
        {busy ? "Signing in…" : needTotp ? "Verify and sign in" : "Sign in"}
      </Button>
    </form>
  );
}
