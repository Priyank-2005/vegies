"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { lineTotal } from "@/lib/units";

/** Where the customer is. Kept only in this browser (localStorage); the server receives it per request. */
export interface ShopLocation {
  lat: number;
  lng: number;
  /** "gps" = the browser's location permission, "search" = the customer picked an address. */
  source: "gps" | "search";
  /** GPS accuracy radius in metres, when known. */
  accuracyM?: number;
  /** Suggested or typed address line, editable at checkout. */
  addressLine?: string;
}

/** Last price we showed for a cart line, kept only to display an estimated total in the header. The server re-prices everything. */
export interface PriceHint {
  p: number; // price in paise for b base units
  b: number; // base units the price refers to
}

interface ShopState {
  cart: Record<string, number>; // saleUnitId -> qtyBase
  hints: Record<string, PriceHint>;
  location: ShopLocation | null;
  deliveryOption: string | null; // delivery_option.code
}

interface ShopApi extends ShopState {
  ready: boolean;
  lineCount: number;
  /** Rough items total from the last prices shown (display only). */
  estimatedTotalPaise: number;
  setQty: (saleUnitId: string, qtyBase: number, hint?: PriceHint) => void;
  clearCart: () => void;
  setLocation: (l: ShopLocation | null) => void;
  setAddressLine: (line: string) => void;
  setDeliveryOption: (code: string | null) => void;
}

const KEY = "hh_shop_v2";
const Ctx = createContext<ShopApi | null>(null);

const EMPTY: ShopState = { cart: {}, hints: {}, location: null, deliveryOption: null };

function load(): ShopState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<ShopState>;
    const cart: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.cart ?? {})) if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) cart[k] = v;
    const hints: Record<string, PriceHint> = {};
    for (const [k, v] of Object.entries(p.hints ?? {})) if (v && Number.isSafeInteger(v.p) && Number.isSafeInteger(v.b) && v.b > 0) hints[k] = v;
    const l = p.location;
    const location = l && typeof l.lat === "number" && typeof l.lng === "number" && Number.isFinite(l.lat) && Number.isFinite(l.lng) ? l : null;
    return { cart, hints, location, deliveryOption: typeof p.deliveryOption === "string" ? p.deliveryOption : null };
  } catch {
    return EMPTY; // storage blocked or corrupted: start empty
  }
}

function persist(s: ShopState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota: everything still works for this page view */
  }
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ShopState>(EMPTY);
  const [ready, setReady] = useState(false);

  // Hydrating from localStorage after mount is a legitimate sync with an external system (the server render
  // cannot know the cart or location), so the cascading-render warning does not apply here.
  useEffect(() => {
    const s = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(s);
    setReady(true);
  }, []);

  const update = useCallback((fn: (s: ShopState) => ShopState) => {
    setState((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const api = useMemo<ShopApi>(() => {
    let est = 0;
    for (const [id, qty] of Object.entries(state.cart)) {
      const h = state.hints[id];
      if (h) est += lineTotal(qty, h.p, h.b);
    }
    return {
      ...state,
      ready,
      lineCount: Object.keys(state.cart).length,
      estimatedTotalPaise: est,
      setQty: (id, qty, hint) =>
        update((s) => {
          const cart = { ...s.cart };
          const hints = hint ? { ...s.hints, [id]: hint } : s.hints;
          if (qty > 0) cart[id] = qty;
          else delete cart[id];
          return { ...s, cart, hints };
        }),
      clearCart: () => update((s) => ({ ...s, cart: {} })),
      setLocation: (location) => update((s) => ({ ...s, location, deliveryOption: location ? s.deliveryOption : null })),
      setAddressLine: (line) => update((s) => (s.location ? { ...s, location: { ...s.location, addressLine: line } } : s)),
      setDeliveryOption: (deliveryOption) => update((s) => ({ ...s, deliveryOption })),
    };
  }, [state, ready, update]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useShop(): ShopApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useShop must be used inside <ShopProvider>");
  return v;
}
