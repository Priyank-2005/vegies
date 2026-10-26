"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

export function TotpSetup() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/staff/totp/begin", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Could not start setup. Please sign in again.");
    const data = (await res.json()) as { qr: string; secret: string };
    setQr(data.qr);
    setSecret(data.secret);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/staff/totp/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    const p = res ? ((await res.json().catch(() => ({}))) as { detail?: string }) : {};
    setError(p.detail ?? "Could not verify the code. Please try again.");
  }

  if (!qr) {
    return (
      <div className="space-y-3">
        <p className="text-sm">You will need an authenticator app such as Google Authenticator, Microsoft Authenticator or Authy.</p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button onClick={begin} disabled={busy}>
          {busy ? "Preparing…" : "Start setup"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <p className="text-sm">1. Scan this code with your authenticator app.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-lg border border-line bg-white" />
      <p className="text-sm">
        Can&apos;t scan? Enter this key manually: <code className="break-all font-mono font-semibold">{secret}</code>
      </p>
      <p className="text-sm">2. Enter the 6-digit code it shows.</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field id="code" label="Authenticator code">
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
        {busy ? "Checking…" : "Turn on two-factor"}
      </Button>
    </form>
  );
}
