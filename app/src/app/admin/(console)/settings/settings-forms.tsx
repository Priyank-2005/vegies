"use client";

import { useState } from "react";
import { useRunner } from "@/components/admin/kit";
import { Button, Field, Input } from "@/components/ui";
import { paiseToInput, parseRupeesInput } from "@/lib/qty-input";
import { updateBusinessAction, updateHubAction, updateOptionAction } from "@/server/actions/settings";

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromTime = (t: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const num = (t: string): number | null => (t.trim() !== "" && Number.isFinite(Number(t)) ? Number(t) : null);

interface Hub {
  id: string;
  name: string;
  nameHi: string | null;
  address: string | null;
  lat: number;
  lng: number;
  opensAtMinute: number;
  closesAtMinute: number;
  lastOrderBufferMinutes: number;
  active: boolean;
}

export function HubForm({ hub }: { hub: Hub }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(hub.name);
  const [nameHi, setNameHi] = useState(hub.nameHi ?? "");
  const [address, setAddress] = useState(hub.address ?? "");
  const [lat, setLat] = useState(String(hub.lat));
  const [lng, setLng] = useState(String(hub.lng));
  const [opens, setOpens] = useState(toTime(hub.opensAtMinute));
  const [closes, setCloses] = useState(toTime(hub.closesAtMinute === 1440 ? 1439 : hub.closesAtMinute));
  const [buffer, setBuffer] = useState(String(hub.lastOrderBufferMinutes));
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function useHere() {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError("This device cannot share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setGeoError("Could not get the location. Allow location access, or type the numbers in.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    run(() =>
      updateHubAction({
        id: hub.id,
        name,
        nameHi: nameHi.trim() || null,
        address: address.trim() || null,
        lat: num(lat) ?? NaN,
        lng: num(lng) ?? NaN,
        opensAtMinute: fromTime(opens) ?? -1,
        closesAtMinute: fromTime(closes) ?? -1,
        lastOrderBufferMinutes: Number.parseInt(buffer, 10),
        active: hub.active,
      }),
    );
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Store name" id="hname">
        <Input id="hname" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Name in Hindi" id="hnamehi" optional>
        <Input id="hnamehi" value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address" id="haddr" hint="What riders and staff see. Delivery distances are measured from the location below, not from this text.">
          <Input id="haddr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>
      <Field label="Latitude" id="hlat">
        <Input id="hlat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
      </Field>
      <Field label="Longitude" id="hlng">
        <Input id="hlng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="button" variant="secondary" size="sm" onClick={useHere} disabled={locating}>
          {locating ? "Finding location…" : "Use this device's location"}
        </Button>
        <span className="text-[13px] text-muted">Stand at the store and tap this, or right-click the store on Google Maps and copy the two numbers.</span>
        {geoError ? <span className="text-[13px] font-semibold text-danger">{geoError}</span> : null}
      </div>
      <Field label="Opens at" id="hopen">
        <Input id="hopen" type="time" value={opens} onChange={(e) => setOpens(e.target.value)} />
      </Field>
      <Field label="Closes at" id="hclose" hint="Orders for the last few minutes are stopped (see below)">
        <Input id="hclose" type="time" value={closes} onChange={(e) => setCloses(e.target.value)} />
      </Field>
      <Field label="Stop taking orders this many minutes before closing" id="hbuf">
        <Input id="hbuf" inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save store"}
        </Button>
      </div>
    </form>
  );
}

interface Option {
  code: string;
  name: string;
  nameHi: string | null;
  feePaise: number;
  promisedMinutes: number;
  minOrderPaise: number;
  active: boolean;
  enabled: boolean;
  radiusM: number;
  maxActiveOrders: number;
}

export function SpeedForm({ hubId, option: o }: { hubId: string; option: Option }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(o.name);
  const [nameHi, setNameHi] = useState(o.nameHi ?? "");
  const [fee, setFee] = useState(paiseToInput(o.feePaise));
  const [minutes, setMinutes] = useState(String(o.promisedMinutes));
  const [minOrder, setMinOrder] = useState(paiseToInput(o.minOrderPaise));
  const [km, setKm] = useState(String(o.radiusM / 1000));
  const [cap, setCap] = useState(String(o.maxActiveOrders));
  const [enabled, setEnabled] = useState(o.enabled);

  function save(e: React.FormEvent) {
    e.preventDefault();
    run(() =>
      updateOptionAction({
        hubId,
        option: {
          code: o.code,
          name,
          nameHi: nameHi.trim() || null,
          feePaise: parseRupeesInput(fee) ?? -1,
          promisedMinutes: Number.parseInt(minutes, 10),
          minOrderPaise: parseRupeesInput(minOrder) ?? -1,
          active: o.active,
          enabled,
          radiusM: Math.round((num(km) ?? 0) * 1000),
          maxActiveOrders: Number.parseInt(cap, 10),
        },
      }),
    );
  }

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="col-span-2 flex items-center justify-between sm:col-span-4">
        <h3 className="text-[16px] font-extrabold">
          {o.name} <span className="ml-1 font-mono text-[12px] font-normal text-muted">{o.code}</span>
        </h3>
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4" />
          Available to customers
        </label>
      </div>
      <Field label="Name" id={`n-${o.code}`}>
        <Input id={`n-${o.code}`} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Name in Hindi" id={`h-${o.code}`} optional>
        <Input id={`h-${o.code}`} value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
      </Field>
      <Field label="Delivery fee (₹)" id={`f-${o.code}`} hint="0 for free delivery">
        <Input id={`f-${o.code}`} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
      </Field>
      <Field label="Promised time (minutes)" id={`m-${o.code}`}>
        <Input id={`m-${o.code}`} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label="Minimum order (₹)" id={`o-${o.code}`} hint="0 for no minimum">
        <Input id={`o-${o.code}`} inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
      </Field>
      <Field label="Reach (km from store)" id={`r-${o.code}`}>
        <Input id={`r-${o.code}`} inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
      </Field>
      <Field label="Orders at once" id={`c-${o.code}`} hint="When this many are in progress, the speed shows as busy">
        <Input id={`c-${o.code}`} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : `Save ${o.name}`}
        </Button>
      </div>
    </form>
  );
}

export function BusinessForm({ values, canEdit }: { values: { minOrderPaise: number; holdMinutes: number; payOnDeliveryCapPaise: number; maxFailedDeliveriesForCod: number }; canEdit: boolean }) {
  const { run, pending } = useRunner();
  const [minOrder, setMinOrder] = useState(paiseToInput(values.minOrderPaise));
  const [hold, setHold] = useState(String(values.holdMinutes));
  const [cap, setCap] = useState(paiseToInput(values.payOnDeliveryCapPaise));
  const [failed, setFailed] = useState(String(values.maxFailedDeliveriesForCod));

  function save(e: React.FormEvent) {
    e.preventDefault();
    run(() =>
      updateBusinessAction({
        minOrderPaise: parseRupeesInput(minOrder) ?? -1,
        holdMinutes: Number.parseInt(hold, 10),
        payOnDeliveryCapPaise: parseRupeesInput(cap) ?? -1,
        maxFailedDeliveriesForCod: Number.parseInt(failed, 10),
      }),
    );
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Minimum order for every speed (₹)" id="bmin" hint="On top of each speed's own minimum. 0 means none.">
        <Input id="bmin" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="Largest pay-on-delivery order (₹)" id="bcap" hint="Bigger orders must be paid online (when online payment is on)">
        <Input id="bcap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field label="Hold unpaid orders for (minutes)" id="bhold">
        <Input id="bhold" inputMode="numeric" value={hold} onChange={(e) => setHold(e.target.value.replace(/\D/g, ""))} disabled={!canEdit} />
      </Field>
      <Field label="Failed deliveries before cash is refused" id="bfail" hint="After this many customer-fault failures, a customer must pay online">
        <Input id="bfail" inputMode="numeric" value={failed} onChange={(e) => setFailed(e.target.value.replace(/\D/g, ""))} disabled={!canEdit} />
      </Field>
      {canEdit ? (
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save business rules"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
