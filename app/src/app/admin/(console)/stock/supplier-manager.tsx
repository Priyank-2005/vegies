"use client";

import { useState } from "react";
import { Dialog, useRunner } from "@/components/admin/kit";
import { Badge, Button, Field, Input } from "@/components/ui";
import { saveSupplierAction } from "@/server/actions/stock";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
}

export function SupplierManager({ suppliers, canEdit }: { suppliers: Supplier[]; canEdit: boolean }) {
  const [edit, setEdit] = useState<Supplier | "new" | null>(null);
  return (
    <>
      {suppliers.length === 0 ? <p className="px-5 py-6 text-center text-muted">No suppliers yet.</p> : null}
      <ul className="divide-y divide-line">
        {suppliers.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
            <span className="font-semibold">{s.name}</span>
            {s.contactName ? <span className="text-[13.5px] text-muted">{s.contactName}</span> : null}
            {s.phone ? (
              <a href={`tel:${s.phone}`} className="text-[13.5px] font-semibold text-brand hover:underline">
                {s.phone}
              </a>
            ) : null}
            {!s.active ? <Badge tone="outline">Inactive</Badge> : null}
            {canEdit ? (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setEdit(s)}>
                Edit
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="border-t border-line px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => setEdit("new")}>
            Add a supplier
          </Button>
        </div>
      ) : null}
      {edit ? <SupplierDialog s={edit === "new" ? null : edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function SupplierDialog({ s, onClose }: { s: Supplier | null; onClose: () => void }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(s?.name ?? "");
  const [contact, setContact] = useState(s?.contactName ?? "");
  const [phone, setPhone] = useState(s?.phone ?? "");
  const [address, setAddress] = useState(s?.address ?? "");
  const [notes, setNotes] = useState(s?.notes ?? "");
  const [active, setActive] = useState(s?.active ?? true);
  return (
    <Dialog open onClose={onClose} title={s ? "Edit supplier" : "New supplier"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSupplierAction({ id: s?.id, name, contactName: contact, phone, address, notes, active }), onClose);
        }}
      >
        <Field label="Name" id="sup-name">
          <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Contact person" id="sup-contact" optional>
          <Input id="sup-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Phone" id="sup-phone" optional>
          <Input id="sup-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Address" id="sup-addr" optional>
          <Input id="sup-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Notes" id="sup-notes" optional>
          <Input id="sup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Still buying from them
        </label>
        <Button type="submit" size="lg" full disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save supplier"}
        </Button>
      </form>
    </Dialog>
  );
}
