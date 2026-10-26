"use client";

import { useState } from "react";
import { Dialog, useRunner } from "@/components/admin/kit";
import { Panel, tableClass, tdClass, thClass } from "@/components/admin/parts";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { createStaffAction, resetPasswordAction, updateStaffAction } from "@/server/actions/settings";

const ROLES: Array<[string, string, string]> = [
  ["OWNER", "Owner", "Everything, including staff and business rules"],
  ["OPS_MANAGER", "Ops manager", "Dispatch, orders, riders, stock, catalogue, reports"],
  ["PROCUREMENT", "Procurement", "Catalogue, prices, stock and buying"],
  ["PACKER", "Packer", "Packing screen only"],
  ["RIDER", "Rider", "Own deliveries only"],
  ["SUPPORT", "Support", "Orders, customers and cancellations"],
];
const ROLE_LABEL = Object.fromEntries(ROLES.map(([k, l]) => [k, l]));

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
  active: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export function StaffManager({ staff, meId }: { staff: Row[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [secret, setSecret] = useState<{ title: string; password: string } | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdding(true)}>Add staff member</Button>
      </div>
      <Panel flush>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Roles</th>
                <th className={thClass}>Last sign-in</th>
                <th className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-55"}>
                  <td className={tdClass}>
                    <p className="font-semibold">
                      {s.name} {s.id === meId ? <span className="text-[12px] font-normal text-muted">(you)</span> : null}
                    </p>
                    <p className="text-[13px] text-muted">{s.email}</p>
                    {!s.active ? <Badge tone="danger">Switched off</Badge> : s.mustChangePassword ? <Badge tone="accent">Has not set a password yet</Badge> : null}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-1">
                      {s.roles.map((r) => (
                        <Badge key={r} tone="neutral">
                          {ROLE_LABEL[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-[13px] text-muted`}>{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "Never"}</td>
                  <td className={`${tdClass} text-right`}>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding ? <AddDialog onClose={() => setAdding(false)} onCreated={(title, password) => setSecret({ title, password })} /> : null}
      {editing ? <EditDialog row={editing} isMe={editing.id === meId} onClose={() => setEditing(null)} onReset={(password) => setSecret({ title: `New password for ${editing.name}`, password })} /> : null}
      {secret ? <SecretDialog title={secret.title} password={secret.password} onClose={() => setSecret(null)} /> : null}
    </>
  );
}

function RolePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium">Roles</legend>
      {ROLES.map(([k, label, hint]) => (
        <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2 hover:bg-surface-2">
          <input type="checkbox" className="mt-1 size-4" checked={value.includes(k)} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
          <span>
            <span className="block text-[14px] font-bold">{label}</span>
            <span className="block text-[12.5px] text-muted">{hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function AddDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (title: string, password: string) => void }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  return (
    <Dialog open onClose={onClose} title="Add a staff member">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createStaffAction({ name, email, phone: phone.trim() || undefined, roles }), (r) => {
            onClose();
            onCreated(`Temporary password for ${name}`, r.password);
          });
        }}
      >
        <Field label="Name" id="sname">
          <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (their sign-in)" id="semail">
          <Input id="semail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone" id="sphone" optional>
          <Input id="sphone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <RolePicker value={roles} onChange={setRoles} />
        <Button type="submit" size="lg" full disabled={pending || !name.trim() || !email.trim() || roles.length === 0}>
          {pending ? "Adding…" : "Add and show password"}
        </Button>
      </form>
    </Dialog>
  );
}

function EditDialog({ row, isMe, onClose, onReset }: { row: Row; isMe: boolean; onClose: () => void; onReset: (password: string) => void }) {
  const { run, pending } = useRunner();
  const [name, setName] = useState(row.name);
  const [phone, setPhone] = useState(row.phone ?? "");
  const [roles, setRoles] = useState(row.roles);
  return (
    <Dialog open onClose={onClose} title={row.name}>
      <div className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateStaffAction({ id: row.id, name, phone: phone.trim() || null, roles }), onClose);
          }}
        >
          <Field label="Name" id="ename">
            <Input id="ename" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone" id="ephone" optional>
            <Input id="ephone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <RolePicker value={roles} onChange={setRoles} />
          <Button type="submit" full disabled={pending || roles.length === 0 || !name.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
        <div className="space-y-2 border-t border-line pt-4">
          <Button
            variant="secondary"
            full
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Create a new temporary password for ${row.name}? They will be signed out everywhere.`)) run(() => resetPasswordAction(row.id), (r) => { onClose(); onReset(r.password); });
            }}
          >
            Reset password
          </Button>
          {!isMe ? (
            <Button
              variant={row.active ? "danger" : "primary"}
              full
              disabled={pending}
              onClick={() => run(() => updateStaffAction({ id: row.id, active: !row.active }), onClose)}
            >
              {row.active ? "Switch off (sign them out)" : "Switch back on"}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function SecretDialog({ title, password, onClose }: { title: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onClose={onClose} title={title}>
      <div className="space-y-4">
        <Alert tone="warn">Share this once, privately (for example by phone). It is not stored anywhere and cannot be shown again. They must choose their own password at first sign-in.</Alert>
        <p className="select-all rounded-xl bg-surface-2 px-4 py-3 text-center font-mono text-[22px] font-bold tracking-wider">{password}</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            full
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button full onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
