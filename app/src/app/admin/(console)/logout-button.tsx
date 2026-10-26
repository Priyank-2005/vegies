"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLogout } from "@/components/icons";
import { Button } from "@/components/ui";

export function LogoutButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      full={!compact}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/v1/staff/logout", { method: "POST" }).catch(() => undefined);
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      <IconLogout size={15} />
      Sign out
    </Button>
  );
}
