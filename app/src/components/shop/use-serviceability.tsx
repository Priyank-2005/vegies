"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ServiceabilityResult } from "@/server/services/serviceability";
import { useShop } from "./shop-context";

export type ServiceabilityState = { status: "idle" } | { status: "loading"; previous?: ServiceabilityResult } | { status: "ready"; data: ServiceabilityResult } | { status: "error" };

interface Api {
  state: ServiceabilityState;
  refresh: () => void;
}
const Ctx = createContext<Api | null>(null);

/**
 * One shared check of "do we deliver to the saved location, and which speeds are open right now?".
 * Refreshes every minute because "busy" and "closed" change while a page is open; `refresh()` forces a check.
 */
export function ServiceabilityProvider({ children, refreshMs = 60_000 }: { children: React.ReactNode; refreshMs?: number }) {
  const { location, ready } = useShop();
  const [state, setState] = useState<ServiceabilityState>({ status: "idle" });
  const [nonce, setNonce] = useState(0);
  const lat = location?.lat;
  const lng = location?.lng;

  useEffect(() => {
    if (!ready || lat == null || lng == null) return;
    let cancelled = false;
    const ctrl = new AbortController();
    async function run() {
      try {
        const res = await fetch(`/api/v1/serviceability?lat=${lat}&lng=${lng}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ServiceabilityResult;
        if (!cancelled) setState({ status: "ready", data });
      } catch (e) {
        if (!cancelled && (e as Error).name !== "AbortError") setState((s) => (s.status === "ready" ? s : { status: "error" }));
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.status === "ready" ? { status: "loading", previous: s.data } : { status: "loading" }));
    void run();
    const timer = setInterval(run, refreshMs);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(timer);
    };
  }, [ready, lat, lng, refreshMs, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const value = useMemo<Api>(() => ({ state: lat == null || lng == null ? { status: "idle" } : state, refresh }), [lat, lng, state, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServiceabilityRefresh(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useServiceability must be used inside <ServiceabilityProvider>");
  return v;
}

export function useServiceability(): ServiceabilityState {
  return useServiceabilityRefresh().state;
}

/** The data to show right now, even while a refresh is in flight. */
export function currentData(s: ServiceabilityState): ServiceabilityResult | undefined {
  return s.status === "ready" ? s.data : s.status === "loading" ? s.previous : undefined;
}
