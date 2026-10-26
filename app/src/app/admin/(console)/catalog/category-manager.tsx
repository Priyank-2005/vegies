"use client";

import { useState } from "react";
import { Dialog, useRunner } from "@/components/admin/kit";
import { Badge, Button, Field, Input } from "@/components/ui";
import { saveCategoryAction } from "@/server/actions/catalog";

interface Cat {
  id: string;
  name: string;
  nameHi: string;
  sortOrder: number;
  active: boolean;
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const [edit, setEdit] = useState<Cat | "new" | null>(null);
  return (
    <>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-5 py-3">
            <span className="font-semibold">{c.name}</span>
            <span className="deva text-muted">{c.nameHi}</span>
            {!c.active ? <Badge tone="outline">Hidden</Badge> : null}
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setEdit(c)}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-5 py-3">
        <Button size="sm" variant="secondary" onClick={() => setEdit("new")}>
          Add a category
        </Button>
      </div>
      {edit ? <CategoryDialog cat={edit === "new" ? null : edit} nextOrder={categories.length + 1} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function CategoryDialog({ cat, nextOrder, onClose }: { cat: Cat | null; nextOrder: number; onClose: () => void }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(cat?.name ?? "");
  const [nameHi, setNameHi] = useState(cat?.nameHi ?? "");
  const [order, setOrder] = useState(String(cat?.sortOrder ?? nextOrder));
  const [active, setActive] = useState(cat?.active ?? true);
  return (
    <Dialog open onClose={onClose} title={cat ? "Edit category" : "New category"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCategoryAction({ id: cat?.id, name, nameHi, sortOrder: Number.parseInt(order, 10) || 0, active }), onClose);
        }}
      >
        <Field label="Name" id="cname">
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Name in Hindi" id="cnamehi">
          <Input id="cnamehi" value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
        </Field>
        <Field label="Position in the shop" id="corder" hint="Lower numbers come first">
          <Input id="corder" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Show in the shop
        </label>
        <Button type="submit" size="lg" full disabled={pending || !name.trim() || !nameHi.trim()}>
          {pending ? "Saving…" : "Save category"}
        </Button>
      </form>
    </Dialog>
  );
}
