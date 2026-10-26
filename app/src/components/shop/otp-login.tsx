"use client";

import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

interface Problem {
  detail?: string;
  devCode?: string;
}

/** Phone + one-time code sign-in for customers. Calls onVerified() once the server has set the session cookie. */
export function OtpLogin({ onVerified }: { onVerified: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Problem };
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/v1/auth/otp/request", { phone });
      if (!r.ok) return setError(r.data.detail ?? "Could not send the code.");
      setSent(true);
      setDevCode(r.data.devCode ?? null);
    } catch {
      setError("Cannot reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/v1/auth/otp/verify", { phone, code });
      if (!r.ok) return setError(r.data.detail ?? "That code is not correct.");
      onVerified();
    } catch {
      setError("Cannot reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return sent ? (
    <form onSubmit={verify} className="space-y-3" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field id="otp" label="Enter the 6-digit code" hint={`We sent it to ${phone}`}>
        <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus className="tracking-[0.4em] tabular-nums" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </Field>
      {devCode ? <Alert tone="warn">Development mode: your code is <strong className="tabular-nums">{devCode}</strong></Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Change number</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void send()}>Resend code</Button>
      </div>
    </form>
  ) : (
    <form onSubmit={send} className="space-y-3" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field id="phone" label="Mobile number" hint="We send a 6-digit code to confirm it is you. No password needed.">
        <div className="flex">
          <span className="flex min-h-11 items-center rounded-l-[var(--radius-ctl)] border border-r-0 border-line bg-surface-2 px-3 text-[15px] text-muted">+91</span>
          <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" className="rounded-l-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </Field>
      <Button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 10}>{busy ? "Sending…" : "Send code"}</Button>
    </form>
  );
}
