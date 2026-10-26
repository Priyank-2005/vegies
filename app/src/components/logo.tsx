import { BRAND } from "@/lib/brand";
import { cx } from "@/components/ui";

/** Leaf mark: two overlapping leaves on a rounded tile. Pure SVG, no raster assets. */
export function LogoMark({ size = 34, tone = "default", className }: { size?: number; tone?: "default" | "light"; className?: string }) {
  const tile = tone === "light" ? "var(--accent)" : "var(--brand)";
  const leaf = tone === "light" ? "#053b27" : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden className={className}>
      <rect width="36" height="36" rx="11" fill={tile} />
      <path d="M9 27c-1-10 5-18 18-19 1 11-5 19-18 19Z" fill={leaf} />
      <path d="M9.5 26.5 19 17" stroke={tile} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 28c4-1 7-4 7-9" stroke={leaf} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".55" />
    </svg>
  );
}

export function Logo({ tone = "default", className, mark = true }: { tone?: "default" | "light"; className?: string; mark?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      {mark ? <LogoMark tone={tone} /> : null}
      <span className={cx("text-[20px] font-extrabold leading-none tracking-tight", tone === "light" ? "text-white" : "text-ink")}>{BRAND.name}</span>
    </span>
  );
}
