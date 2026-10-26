"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCrosshair, IconPin, IconSearch } from "@/components/icons";
import { Alert, Button, Field, Input, buttonClass } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import type { GeocodeResult } from "@/server/geo/geocoder";
import { DeliveryOptionCards } from "./delivery-options";
import { useShop } from "./shop-context";
import { GEO_MESSAGES, useGeolocation } from "./use-geolocation";
import { currentData, useServiceability } from "./use-serviceability";

/**
 * "Where should we deliver?": detects the customer's location (only when they press the button),
 * falls back to an address search, then shows whether we deliver there and which speeds are open.
 */
export function LocationGate({ showStartShopping = true, compact = false }: { showStartShopping?: boolean; compact?: boolean }) {
  const { location, setLocation, ready } = useShop();
  const { locate, busy, error, clearError } = useGeolocation();
  const svcState = useServiceability();
  const data = currentData(svcState);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  async function useMyLocation() {
    clearError();
    const fix = await locate();
    if (!fix) return setSearchOpen(true); // permission denied etc.: offer the search box
    setSearchOpen(false);
    setLocation({ lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, source: "gps" });
    // Suggest a readable address (best effort; the customer edits it at checkout).
    try {
      const res = await fetch(`/api/v1/geo/reverse?lat=${fix.lat}&lng=${fix.lng}`);
      if (res.ok) {
        const d = (await res.json()) as { result: GeocodeResult | null };
        if (d.result?.addressLine) setLocation({ lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, source: "gps", addressLine: d.result.addressLine });
      }
    } catch {
      /* the address box will simply start empty */
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setResults(null);
    try {
      const res = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(query.trim())}`);
      const d = (await res.json()) as { results?: GeocodeResult[]; attribution?: string | null };
      setResults(d.results ?? []);
      setAttribution(d.attribution ?? null);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pick(r: GeocodeResult) {
    setLocation({ lat: r.lat, lng: r.lng, source: "search", addressLine: r.addressLine });
    setResults(null);
    setSearchOpen(false);
    setQuery("");
  }

  if (!ready) {
    return <div className="skeleton h-12 w-full" aria-label="Loading" />;
  }

  return (
    <div className="space-y-4">
      {!location || searchOpen ? (
        <div className="space-y-3">
          {!location ? (
            <Button size="lg" full onClick={useMyLocation} disabled={busy}>
              <IconCrosshair size={19} />
              {busy ? "Finding your location…" : "Use my current location"}
            </Button>
          ) : null}
          {error ? <Alert tone="warn">{GEO_MESSAGES[error]}</Alert> : null}

          {!searchOpen ? (
            <button type="button" className="text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-hover" onClick={() => setSearchOpen(true)}>
              Or search for your address
            </button>
          ) : (
            <form onSubmit={search} className="space-y-2.5" noValidate>
              <Field id="addr-search" label="Search your address" hint="Area, colony or landmark in Udaipur">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input id="addr-search" autoComplete="street-address" placeholder="e.g. Hiran Magri Sector 4" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                  <Button type="submit" variant="secondary" disabled={searching || query.trim().length < 3}>
                    {searching ? "Searching…" : "Search"}
                  </Button>
                </div>
              </Field>
              {results && results.length === 0 ? <Alert tone="warn">No matching places found in Udaipur. Try a nearby landmark, or use your current location.</Alert> : null}
              {results && results.length > 0 ? (
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-ctl)] border border-line bg-surface">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button type="button" className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => pick(r)}>
                        <IconPin size={16} className="mt-0.5 shrink-0 text-muted" />
                        <span>{r.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {attribution ? <p className="text-xs text-muted">{attribution}</p> : null}
              <div className="flex gap-2">
                {!location ? (
                  <Button variant="ghost" size="sm" onClick={useMyLocation} disabled={busy}>
                    <IconCrosshair size={15} /> Use my location instead
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setSearchOpen(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
          {!compact ? <p className="text-xs leading-relaxed text-muted">We use your location only to check delivery and fill in your address. It stays in your browser until you place an order.</p> : null}
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-ctl)] border border-line bg-surface-2/50 px-3 py-2.5">
          <IconPin size={18} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-[12px] text-muted">Delivering to</p>
            <p className="truncate font-semibold">{location.addressLine ?? "Your current location"}</p>
            {location.source === "gps" && location.accuracyM ? <p className="text-[12px] text-muted">Detected by GPS, about {location.accuracyM} m accuracy</p> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-[13px] font-medium sm:flex-row sm:gap-3">
            <button type="button" className="text-brand underline underline-offset-2" onClick={() => setSearchOpen(true)}>
              Change
            </button>
            <button type="button" className="text-brand underline underline-offset-2 disabled:opacity-50" onClick={useMyLocation} disabled={busy}>
              {busy ? "Locating…" : "Re-detect"}
            </button>
          </div>
        </div>
      )}

      {location && svcState.status === "loading" && !data ? <div className="skeleton h-28 w-full" aria-label="Checking delivery" /> : null}
      {location && svcState.status === "error" ? <Alert tone="danger">We could not check delivery right now. Please try again.</Alert> : null}

      {location && data ? (
        data.served ? (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm">
              <span className="font-semibold">We deliver to you</span>
              <span className="text-muted"> from {data.hub.name}, {formatDistance(data.distanceM)} away.</span>
            </p>
            {!data.orderingOpen && data.nextOpensAt ? <Alert tone="warn">We are not taking orders right now. We open at {formatTime(data.nextOpensAt)}. You can fill your cart now.</Alert> : null}
            <DeliveryOptionCards options={data.options} nextOpensAt={data.nextOpensAt} />
            {showStartShopping ? (
              <Link href="/shop" className={buttonClass({ full: true, size: "lg" })}>
                Start shopping
              </Link>
            ) : null}
          </div>
        ) : (
          <NotServed reason={data.reason} lat={location.lat} lng={location.lng} />
        )
      ) : null}
    </div>
  );
}

function NotServed({ reason, lat, lng }: { reason: "INVALID_LOCATION" | "OUTSIDE_AREA"; lat: number; lng: number }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, name: name || undefined, cityText: city || undefined, lat, lng, consent }) });
      const d = (await res.json().catch(() => ({}))) as { detail?: string; alreadyRegistered?: boolean };
      setMsg(res.ok ? { ok: true, text: d.alreadyRegistered ? "You are already on our list. We will message you when we reach your area." : "Thank you. We will message you on WhatsApp when we reach your area." } : { ok: false, text: d.detail ?? "Something went wrong. Please try again." });
    } catch {
      setMsg({ ok: false, text: "Cannot reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div>
        <h3 className="font-semibold">{reason === "INVALID_LOCATION" ? "We could not read that location" : "We deliver only in Udaipur for now"}</h3>
        <p className="text-sm text-muted">Leave your number and we will tell you when we reach your area. We open new areas based on how many people ask.</p>
      </div>
      {msg ? <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert> : null}
      {msg?.ok ? null : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field id="wl-phone" label="Mobile number">
            <Input id="wl-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="wl-name" label="Name" optional>
              <Input id="wl-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field id="wl-city" label="City or area" optional>
              <Input id="wl-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-start gap-2.5 text-[13px] leading-snug text-muted">
            <input type="checkbox" className="mt-0.5 size-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Message me on WhatsApp when you start delivering to my area. Only about this. We save your area to about 1 km, not your exact location.</span>
          </label>
          <Button type="submit" disabled={busy || !consent || phone.replace(/\D/g, "").length < 10}>
            {busy ? "Saving…" : "Notify me"}
          </Button>
        </form>
      )}
    </div>
  );
}
