import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { IconAlert, IconCheck, IconInfo } from "@/components/icons";

/** Tiny class joiner (no dependency needed). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover border border-transparent shadow-[0_1px_0_rgba(255,255,255,.18)_inset]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface-2",
  danger: "bg-danger text-white border border-transparent hover:brightness-95",
  accent: "bg-accent text-accent-ink border border-transparent hover:bg-accent-hover",
};
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-[13px]",
  md: "min-h-11 px-4 text-[15px]",
  lg: "min-h-12 px-6 text-base",
};

/** Class string for anything that should look like a button (links included). */
export function buttonClass({ variant = "primary", size = "md", full = false, className }: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {}): string {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-ctl)] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    full && "w-full",
    className,
  );
}

export function Button({ variant, size, full, className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; full?: boolean }) {
  return <button type={type} {...props} className={buttonClass({ variant, size, full, className })} />;
}

export function Field({ label, hint, error, id, children, optional }: { label: string; hint?: string; error?: string | null; id: string; children: ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted">Optional</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-[13px] text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL = "min-h-11 w-full rounded-[var(--radius-ctl)] border bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 transition-colors hover:border-line-strong disabled:bg-surface-2 disabled:text-muted";

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={cx(CONTROL, invalid ? "border-danger" : "border-line", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL, "border-line", className)} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card", className)} />;
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "brand" | "accent" | "danger" | "outline"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-ink",
    brand: "bg-brand-soft text-brand",
    accent: "bg-accent-soft text-accent-ink",
    danger: "bg-danger-soft text-danger",
    outline: "border border-line-strong text-muted",
  } as const;
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "danger" | "warn" | "success"; children: ReactNode; className?: string }) {
  const style = {
    info: "border-line-strong bg-surface-2 text-ink",
    success: "border-brand/40 bg-brand-soft text-ink",
    warn: "border-accent/60 bg-accent-soft text-ink",
    danger: "border-danger/50 bg-danger-soft text-ink",
  }[tone];
  const Icon = tone === "danger" || tone === "warn" ? IconAlert : tone === "success" ? IconCheck : IconInfo;
  const iconColor = tone === "danger" ? "text-danger" : tone === "success" ? "text-brand" : tone === "warn" ? "text-accent-ink" : "text-muted";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-2.5 rounded-[var(--radius-ctl)] border px-3.5 py-3 text-sm", style, className)}>
      <Icon size={18} className={cx("mt-0.5 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

/** Page section heading with an optional right-hand link. */
export function SectionHeading({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight sm:text-[26px]">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}
