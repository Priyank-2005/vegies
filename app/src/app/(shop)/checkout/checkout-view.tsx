"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconPin } from "@/components/icons";
import { DeliveryOptionCards, feeText } from "@/components/shop/delivery-options";
import { issueText } from "@/components/shop/issue-text";
import { OtpLogin } from "@/components/shop/otp-login";
import { useShop } from "@/components/shop/shop-context";
import { currentData, useServiceabilityRefresh } from "@/components/shop/use-serviceability";
import { Alert, Button, Field, Input, Skeleton, buttonClass, cx } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { formatQuantity } from "@/lib/units";
import type { PricingResult } from "@/server/services/pricing";

type Priced = PricingResult & { minOrderPaise: number; payOnDeliveryCapPaise: number; prepaidEnabled: boolean };
interface Problem {
  code?: string;
  detail?: string;
  issues?: Array<{ saleUnitId: string; code: string; maxAvailableBase?: number }>;
  nextOpensAt?: string;
  minOrderPaise?: number;
}

const IDEM_KEY = "hh_idem_v1";

/** One key per checkout attempt: a retry (double tap, flaky network) returns the same order instead of a second one. */
function idempotencyKey(): string {
  try {
    let k = sessionStorage.getItem(IDEM_KEY);
    if (!k) {
      k = crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
      sessionStorage.setItem(IDEM_KEY, k);
    }
    return k;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}
const clearIdempotencyKey = () => {
  try {
    sessionStorage.removeItem(IDEM_KEY);
  } catch {
    /* ignore */
  }
};

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-4 flex items-center gap-3 text-[17px] font-semibold">
        <span className={cx("flex size-7 items-center justify-center rounded-full text-[13px] font-bold", done ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted")}>{done ? <IconCheck size={15} strokeWidth={3} /> : n}</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const { cart, location, deliveryOption, setDeliveryOption, setAddressLine, ready, clearCart } = useShop();
  const { state: svc, refresh: refreshSvc } = useServiceabilityRefresh();
  const svcData = currentData(svc);
  const items = useMemo(() => Object.entries(cart).map(([saleUnitId, qtyBase]) => ({ saleUnitId, qtyBase })), [cart]);

  const [priced, setPriced] = useState<Priced | null>(null);
  const [me, setMe] = useState<{ name: string | null; phoneMasked: string } | null | undefined>(undefined);

  const [line, setLine] = useState("");
  const [lineTouched, setLineTouched] = useState(false);
  const [landmark, setLandmark] = useState("");
  const [riderNote, setRiderNote] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [policyOk, setPolicyOk] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemIssues, setProblemIssues] = useState<Problem["issues"]>([]);

  async function reprice() {
    if (items.length === 0) return;
    const res = await fetch("/api/v1/cart/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) }).catch(() => null);
    if (res?.ok) setPriced((await res.json()) as Priced);
  }

  async function loadMe() {
    try {
      const d = (await (await fetch("/api/v1/auth/me")).json()) as { customer: { name: string | null; phoneMasked: string } | null };
      setMe(d.customer);
      if (d.customer?.name) setName((n) => n || d.customer!.name!);
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (items.length > 0) {
      fetch("/api/v1/cart/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Priced | null) => d && setPriced(d))
        .catch(() => undefined);
    }
    fetch("/api/v1/auth/me")
      .then((r) => r.json())
      .then((d: { customer: { name: string | null; phoneMasked: string } | null }) => {
        setMe(d.customer);
        if (d.customer?.name) setName((n) => n || d.customer!.name!);
      })
      .catch(() => setMe(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Start the address box with the suggestion from location detection, until the customer edits it.
  const suggested = location?.addressLine ?? "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!lineTouched && suggested) setLine(suggested);
  }, [suggested, lineTouched]);

  const served = svcData?.served ? svcData : null;
  const options = served?.options ?? [];
  // Default to the cheapest speed that is open, so nobody pays a fee they did not choose.
  const selected = options.find((o) => o.code === deliveryOption && o.status === "AVAILABLE") ?? null;
  useEffect(() => {
    if (!served || selected) return;
    const cheapest = [...served.options].filter((o) => o.status === "AVAILABLE").sort((a, b) => a.feePaise - b.feePaise || b.promisedMinutes - a.promisedMinutes)[0];
    if (cheapest) setDeliveryOption(cheapest.code);
  }, [served, selected, setDeliveryOption]);

  async function placeOrder() {
    if (!location || !selected || !priced) return;
    setBusy(true);
    setError(null);
    setProblemIssues([]);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({
          deliveryOption: selected.code,
          address: { line: line.trim(), landmark: landmark.trim() || undefined, note: riderNote.trim() || undefined, lat: location.lat, lng: location.lng },
          paymentMode: "PAY_ON_DELIVERY",
          customerName: name,
          transactionalConsent: consent,
          items,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Problem & { trackingToken?: string | null; orderId?: string };
      if (res.ok && data.trackingToken) {
        clearIdempotencyKey();
        clearCart();
        router.replace(`/order/${data.trackingToken}`);
        return;
      }
      if (res.ok && data.orderId) {
        // A retry of an order we already created: the secret link is only returned once, but the signed-in customer can always open their own order.
        clearIdempotencyKey();
        clearCart();
        router.replace(`/my-orders/${data.orderId}`);
        return;
      }
      clearIdempotencyKey();
      switch (data.code) {
        case "UNAUTHENTICATED":
        case "PHONE_NOT_VERIFIED":
          setMe(null);
          return setError("Please verify your phone number again.");
        case "CART_INVALID":
          setProblemIssues(data.issues ?? []);
          await reprice();
          return setError("Some items changed since you added them. Please review your cart.");
        case "OUT_OF_STOCK":
          await reprice();
          return setError("An item just sold out. Please review your cart.");
        case "OPTION_BUSY":
          refreshSvc();
          return setError("That speed just got busy. Please pick another speed.");
        case "HUB_CLOSED":
          refreshSvc();
          return setError(data.nextOpensAt ? `We are closed right now. We open at ${formatTime(data.nextOpensAt)}.` : "We are closed right now.");
        case "OPTION_UNAVAILABLE":
        case "OUT_OF_AREA":
          refreshSvc();
          return setError(data.detail ?? "We cannot deliver that speed to your location.");
        case "BELOW_MINIMUM_ORDER":
          return setError(`The minimum order for this speed is ${formatINR(data.minOrderPaise ?? 0)}. Add a little more or choose another speed.`);
        default:
          setError(data.detail ?? "We could not place your order. Please try again.");
      }
    } catch {
      setError("Connection problem. Your order was not lost: tap Place order again and it will not be duplicated.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || me === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Alert tone="info">
        Your cart is empty. <Link className="font-semibold underline underline-offset-2" href="/shop">Go shopping</Link>
      </Alert>
    );
  }
  if (!location) {
    return (
      <Alert tone="warn">
        Tell us where to deliver first. <Link className="font-semibold underline underline-offset-2" href="/location">Use my location</Link>
      </Alert>
    );
  }

  const lineBy = new Map((priced?.lines ?? []).map((l) => [l.saleUnitId, l]));
  const subtotal = priced?.subtotalPaise ?? 0;
  const fee = selected?.feePaise ?? 0;
  const total = subtotal + fee;
  const minForOption = Math.max(priced?.minOrderPaise ?? 0, selected?.minOrderPaise ?? 0);
  const overCap = !!priced && !priced.prepaidEnabled && total > priced.payOnDeliveryCapPaise;
  const addrOk = line.trim().length >= 6;
  const blocked = !priced || !priced.ok || !selected || subtotal < minForOption || overCap || !addrOk;
  const canPlace = !!me && name.trim().length >= 2 && consent && policyOk && !blocked;
  const hint = !selected ? "Choose a delivery speed." : !addrOk ? "Enter your full address." : !me ? "Verify your phone number." : name.trim().length < 2 ? "Enter your name." : !consent || !policyOk ? "Tick both boxes to continue." : "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-4">
        <Step n={1} title="Delivery address" done={addrOk}>
          <div className="flex items-start gap-2.5 rounded-[var(--radius-ctl)] bg-surface-2/60 px-3 py-2.5 text-[13px] text-muted">
            <IconPin size={16} className="mt-0.5 shrink-0 text-brand" />
            <p>
              Location set{location.accuracyM ? ` (GPS ±${location.accuracyM} m)` : ""}. Add the details the rider needs to find you.{" "}
              <Link className="font-medium text-brand underline underline-offset-2" href="/location">Change location</Link>
            </p>
          </div>
          <Field id="addr" label="Full address" hint="House or flat number, building or society, street" error={lineTouched && !addrOk ? "Please enter your full address" : null}>
            <Input
              id="addr"
              autoComplete="street-address"
              value={line}
              maxLength={200}
              onChange={(e) => {
                setLineTouched(true);
                setLine(e.target.value);
                setAddressLine(e.target.value);
              }}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="landmark" label="Landmark" optional>
              <Input id="landmark" maxLength={120} placeholder="Near the temple" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
            </Field>
            <Field id="rnote" label="Note for the rider" optional>
              <Input id="rnote" maxLength={200} placeholder="Gate code, call on arrival" value={riderNote} onChange={(e) => setRiderNote(e.target.value)} />
            </Field>
          </div>
        </Step>

        <Step n={2} title="Delivery speed" done={!!selected}>
          {svc.status === "loading" && !svcData ? <Skeleton className="h-40 w-full" /> : null}
          {svc.status === "error" ? <Alert tone="danger">We could not check delivery right now. Please try again.</Alert> : null}
          {svcData && !svcData.served ? (
            <Alert tone="warn">
              We do not deliver to this location yet. <Link className="font-semibold underline underline-offset-2" href="/location">Change location</Link>
            </Alert>
          ) : null}
          {served ? (
            <>
              {!served.orderingOpen && served.nextOpensAt ? <Alert tone="warn">We are not taking orders right now. We open at {formatTime(served.nextOpensAt)}.</Alert> : null}
              <DeliveryOptionCards options={options} nextOpensAt={served.nextOpensAt} selected={selected?.code ?? null} onSelect={setDeliveryOption} subtotalPaise={subtotal} />
            </>
          ) : null}
        </Step>

        <Step n={3} title="Your phone number" done={!!me}>
          {me ? (
            <p className="flex items-center gap-2 text-[15px]">
              <IconCheck size={18} className="text-brand" /> Verified <strong className="tabular-nums">{me.phoneMasked}</strong>
            </p>
          ) : (
            <OtpLogin onVerified={() => void loadMe()} />
          )}
          <Field id="name" label="Your name" hint="So the rider knows who to ask for">
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </Step>

        <Step n={4} title="Payment">
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border border-brand bg-brand-soft p-3.5">
            <input type="radio" checked readOnly className="mt-1 size-4" />
            <span>
              <span className="block font-semibold">Pay on delivery</span>
              <span className="text-[13px] text-muted">Cash or UPI to the rider when your order arrives. Please keep the exact amount or UPI ready.</span>
            </span>
          </label>
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line p-3.5 opacity-60">
            <input type="radio" disabled className="mt-1 size-4" />
            <span>
              <span className="block font-semibold">Pay online</span>
              <span className="text-[13px] text-muted">Coming soon</span>
            </span>
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <label className="flex items-start gap-2.5 text-[14px] leading-snug">
              <input type="checkbox" className="mt-0.5 size-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Send me updates about this order on WhatsApp or SMS: confirmation, rider on the way, delays.</span>
            </label>
            <label className="flex items-start gap-2.5 text-[14px] leading-snug">
              <input type="checkbox" className="mt-0.5 size-4" checked={policyOk} onChange={(e) => setPolicyOk(e.target.checked)} />
              <span>
                I have read the <Link className="font-medium text-brand underline underline-offset-2" href="/policies" target="_blank">delivery, refund and weight policy</Link>.
              </span>
            </label>
          </div>
        </Step>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Order summary">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5">
          <h2 className="mb-3 text-[17px] font-semibold">Order summary</h2>
          <ul className="divide-y divide-line border-y border-line">
            {items.map(({ saleUnitId, qtyBase }) => {
              const info = priced?.units[saleUnitId];
              const l = lineBy.get(saleUnitId);
              const issue = (problemIssues ?? []).find((i) => i.saleUnitId === saleUnitId) ?? priced?.issues.find((i) => i.saleUnitId === saleUnitId);
              return (
                <li key={saleUnitId} className="flex justify-between gap-3 py-2.5 text-[14px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{info?.nameEn ?? "Item"}</p>
                    <p className="text-[12.5px] text-muted tabular-nums">{info ? formatQuantity(qtyBase, info.baseUnit) : ""}</p>
                    {issue ? <p className="text-[12.5px] font-medium text-danger">{issueText(issue.code, { ...info, maxAvailableBase: issue.maxAvailableBase })}</p> : null}
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">{l ? formatINR(l.lineTotalPaise) : "…"}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 space-y-1.5 text-[14px]">
            <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="tabular-nums">{priced ? formatINR(subtotal) : "…"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery{selected ? ` · ${selected.name}` : ""}</dt><dd className={cx("tabular-nums", selected && fee === 0 && "font-semibold text-brand")}>{selected ? feeText(fee) : "…"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Platform charges</dt><dd className="tabular-nums">₹0</dd></div>
            <div className="flex justify-between border-t border-line pt-2.5 text-[17px] font-semibold"><dt>Total to pay</dt><dd className="tabular-nums">{priced ? formatINR(total) : "…"}</dd></div>
          </dl>
          {selected ? <p className="mt-2 text-[13px] text-muted">Arrives by <strong className="text-ink">{formatTime(selected.etaAt)}</strong></p> : null}
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">You pay the total above, never more. We pack at least the weight you ordered; if a bag is ever short, the difference is refunded.</p>

          {priced && selected && subtotal < minForOption ? <Alert tone="warn" className="mt-3">The minimum order for {selected.name} is {formatINR(minForOption)}. <Link className="font-semibold underline underline-offset-2" href="/cart">Edit cart</Link></Alert> : null}
          {overCap && priced ? <Alert tone="warn" className="mt-3">Pay on delivery is limited to {formatINR(priced.payOnDeliveryCapPaise)} until online payment opens. <Link className="font-semibold underline underline-offset-2" href="/cart">Edit cart</Link></Alert> : null}
          {error ? (
            <Alert tone="danger" className="mt-3">
              {error} {error.includes("review your cart") ? <Link className="font-semibold underline underline-offset-2" href="/cart">Open cart</Link> : null}
            </Alert>
          ) : null}

          <Button size="lg" full className="mt-4" disabled={!canPlace || busy} onClick={placeOrder}>
            {busy ? "Placing order…" : priced && selected ? `Place order · ${formatINR(total)}` : "Place order"}
          </Button>
          {!canPlace && !busy && hint ? <p className="mt-2 text-center text-[13px] text-muted">{hint}</p> : null}
        </section>
        <Link href="/cart" className={buttonClass({ variant: "ghost", full: true, size: "sm" })}>
          Back to cart
        </Link>
      </aside>
    </div>
  );
}
