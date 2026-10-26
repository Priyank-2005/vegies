"use client";

import { IconBolt, IconCheck } from "@/components/icons";
import { cx } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { DeliveryOptionView } from "@/server/services/delivery";

export function promiseText(minutes: number): string {
  if (minutes < 60) return `about ${minutes} min`;
  const h = minutes / 60;
  return `within ${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}

export function feeText(feePaise: number): string {
  return feePaise === 0 ? "Free" : formatINR(feePaise);
}

/** Why a speed cannot be chosen right now, in plain words. */
export function unavailableReason(o: DeliveryOptionView, nextOpensAt: string | null): string | null {
  switch (o.status) {
    case "AVAILABLE":
      return null;
    case "BUSY":
      return "Very busy right now. Try a slower speed.";
    case "CLOSED":
      return nextOpensAt ? `Closed. Opens ${formatTime(nextOpensAt)}.` : "Closed right now.";
    case "OUT_OF_RANGE":
      return "Too far from our store for this speed.";
    default:
      return "Not available.";
  }
}

/**
 * The delivery speeds as a rate card: one row per speed with its fee and arrival time.
 * Selectable (checkout) or read-only (home, location page).
 */
export function DeliveryOptionCards({
  options,
  nextOpensAt,
  selected,
  onSelect,
  subtotalPaise,
}: {
  options: DeliveryOptionView[];
  nextOpensAt: string | null;
  selected?: string | null;
  onSelect?: (code: string) => void;
  /** When given, warns on speeds whose minimum order is not met yet. */
  subtotalPaise?: number;
}) {
  const selectable = !!onSelect;
  return (
    <ul className="space-y-2" role={selectable ? "radiogroup" : undefined} aria-label="Delivery speed">
      {options.map((o) => {
        const reason = unavailableReason(o, nextOpensAt);
        const disabled = o.status !== "AVAILABLE";
        const isSel = selected === o.code;
        const belowMin = subtotalPaise != null && o.minOrderPaise > subtotalPaise;
        const row = (
          <>
            {selectable ? (
              <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full border-2", isSel ? "border-brand bg-brand text-brand-ink" : "border-line-strong")} aria-hidden>
                {isSel ? <IconCheck size={12} strokeWidth={3} /> : null}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[15px] font-semibold text-ink">{o.name}</span>
                {o.code === "INSTANT" && !disabled ? (
                  <span className="inline-flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-ink">
                    <IconBolt size={11} /> Fastest
                  </span>
                ) : null}
                {o.feePaise === 0 ? <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">No delivery charge</span> : null}
              </span>
              <span className={cx("mt-0.5 block text-[13px]", reason ? "text-muted" : "text-muted")}>
                {reason ?? `Arrives by ${formatTime(o.etaAt)} (${promiseText(o.promisedMinutes)})`}
              </span>
              {o.minOrderPaise > 0 ? <span className={cx("block text-[12px]", belowMin ? "font-semibold text-danger" : "text-muted")}>Minimum order {formatINR(o.minOrderPaise)}</span> : null}
            </span>
            <span className={cx("shrink-0 text-[16px] font-bold tabular-nums", o.feePaise === 0 ? "text-brand" : "text-ink")}>{feeText(o.feePaise)}</span>
          </>
        );
        const cls = cx(
          "flex w-full items-center gap-3 rounded-[var(--radius-card)] border px-3.5 py-3 text-left transition-colors",
          disabled ? "border-line bg-surface-2/60 opacity-70" : isSel ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-surface",
          selectable && !disabled && !isSel && "hover:border-line-strong hover:bg-surface-2",
        );
        return (
          <li key={o.code}>
            {selectable ? (
              <button type="button" role="radio" aria-checked={isSel} disabled={disabled} onClick={() => onSelect?.(o.code)} className={cx(cls, "disabled:cursor-not-allowed")}>
                {row}
              </button>
            ) : (
              <div className={cls}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
