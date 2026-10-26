"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";

export function CancelButton({ url }: { url: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      if (res.ok) return router.refresh();
      const d = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(d.detail ?? "Could not cancel. Please try again.");
    } catch {
      setError("Cannot reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={busy} onClick={cancel}>
            {busy ? "Cancelling…" : "Yes, cancel my order"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Keep my order
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Cancel order
        </Button>
      )}
    </div>
  );
}
