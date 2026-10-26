import type { ReactNode } from "react";
import { Badge, cx } from "@/components/ui";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
        {sub ? <p className="mt-0.5 text-[14px] text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, sub, action, children, className, flush }: { title?: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-extrabold">{title}</h2>
            {sub ? <p className="text-[13px] text-muted">{sub}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: "danger" | "brand" | "accent" }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={cx("mt-1 text-[28px] font-extrabold leading-none tabular-nums", tone === "danger" && "text-danger", tone === "brand" && "text-brand")}>{value}</p>
      {sub ? <p className="mt-1.5 text-[12.5px] text-muted">{sub}</p> : null}
    </div>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "New",
  PACKING: "Packing",
  ATTENTION: "On hold",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_TONE: Record<string, "neutral" | "brand" | "accent" | "danger"> = {
  CONFIRMED: "accent",
  PACKING: "neutral",
  ATTENTION: "danger",
  PACKED: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "brand",
  DELIVERY_FAILED: "danger",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function SpeedBadge({ name, code }: { name: string; code?: string }) {
  return <Badge tone={code === "INSTANT" ? "accent" : "outline"}>{name}</Badge>;
}

export const tableClass = "w-full text-left text-[14px]";
export const thClass = "border-b border-line px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-muted";
export const tdClass = "border-b border-line px-4 py-3 align-middle last:border-b-0";

/** Whole base units to a readable amount for staff: "1.5 kg", "750 g", "6 pcs". */
export function formatBase(qty: number, baseUnit: string): string {
  if (baseUnit === "PIECE") return `${qty} pc${qty === 1 ? "" : "s"}`;
  return qty >= 1000 ? `${Number((qty / 1000).toFixed(3))} kg` : `${qty} g`;
}
