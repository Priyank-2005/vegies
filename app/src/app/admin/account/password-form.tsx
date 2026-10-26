"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { changeOwnPasswordAction } from "@/server/actions/settings";

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== again) return setError("The two new passwords do not match");
    start(async () => {
      const r = await changeOwnPasswordAction({ current, next });
      if (!r.ok) return setError(r.message);
      setDone(true);
      if (forced) router.replace("/admin");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {done ? <Alert tone="success">Password changed.</Alert> : null}
      <Field label={forced ? "Temporary password" : "Current password"} id="cur">
        <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password" id="new" hint="At least 12 characters">
        <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={12} />
      </Field>
      <Field label="New password again" id="again">
        <Input id="again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
      </Field>
      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
