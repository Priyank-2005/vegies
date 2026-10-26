"use client";

import Link from "next/link";
import { useId } from "react";
import { usePathname } from "next/navigation";
import { IconArrowRight, IconBag, IconChevronDown, IconPin, IconSearch } from "@/components/icons";
import { Logo } from "@/components/logo";
import { cx } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { useShop } from "./shop-context";
import { currentData, useServiceability } from "./use-serviceability";

function shortAddress(line?: string): string {
  if (!line) return "Current location";
  const first = line.split(",").slice(0, 2).join(",").trim();
  return first.length > 34 ? `${first.slice(0, 33)}…` : first;
}

/** The delivery pill: where we deliver and how soon, from the shared serviceability check. */
export function LocationPill({ className, onDark }: { className?: string; onDark?: boolean }) {
  const { location, ready } = useShop();
  const data = currentData(useServiceability());

  let top = "Set your delivery location";
  let bottom = "Check delivery to your address";
  if (ready && location) {
    bottom = shortAddress(location.addressLine);
    if (data?.served) {
      const open = data.options.filter((o) => o.status === "AVAILABLE").sort((a, b) => a.promisedMinutes - b.promisedMinutes)[0];
      top = open ? `${open.name} · by ${formatTime(open.etaAt)}` : data.nextOpensAt ? `Opens ${formatTime(data.nextOpensAt)}` : "Very busy right now";
    } else if (data && !data.served) {
      top = "Not delivering here yet";
    } else {
      top = "Checking delivery…";
    }
  }
  return (
    <Link
      href="/location"
      className={cx("flex min-w-0 items-center gap-2.5 rounded-[var(--radius-ctl)] px-2.5 py-1.5 text-left", onDark ? "text-white hover:bg-white/10" : "border border-line bg-surface hover:border-line-strong", className)}
      aria-label={`Delivery location: ${bottom}. ${top}`}
    >
      <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", onDark ? "bg-white/12 text-accent" : "bg-brand-soft text-brand")}>
        <IconPin size={19} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className={cx("block truncate text-[11.5px] font-semibold", onDark ? "text-accent" : "text-muted")}>{top}</span>
        <span className={cx("block truncate text-[14px] font-bold", onDark ? "text-white" : "text-ink")}>{bottom}</span>
      </span>
      <IconChevronDown size={16} className={cx("shrink-0", onDark ? "text-white/70" : "text-muted")} />
    </Link>
  );
}

export function SearchBox({ className, autoFocus, onDark }: { className?: string; autoFocus?: boolean; onDark?: boolean }) {
  const id = useId();
  return (
    <form action="/shop" method="get" role="search" className={cx("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search vegetables and fruit
      </label>
      <IconSearch size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id={id}
        name="q"
        type="search"
        autoFocus={autoFocus}
        placeholder="Search tomato, aloo, टमाटर"
        className={cx("min-h-12 w-full rounded-[14px] border bg-surface pl-11 pr-3 text-[15px] font-medium placeholder:font-normal placeholder:text-muted/80", onDark ? "border-transparent shadow-[0_2px_10px_rgba(0,0,0,.18)]" : "border-line hover:border-line-strong")}
      />
    </form>
  );
}

export function Header() {
  const { lineCount, estimatedTotalPaise, ready } = useShop();
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-brand-deeper to-brand-deep text-white shadow-[0_6px_20px_rgba(3,40,26,.25)]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 pb-2 pt-2.5 sm:px-4 lg:gap-4 lg:py-3">
        <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0">
          <Logo tone="light" className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>
        <LocationPill onDark className="min-w-0 flex-1 md:w-72 md:flex-none lg:w-80" />
        <SearchBox onDark className="hidden max-w-xl flex-1 md:block" />
        <nav className="ml-auto flex shrink-0 items-center gap-1.5" aria-label="Shop">
          <Link href="/my-orders" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white lg:block">
            My orders
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart, ${ready ? lineCount : 0} item${lineCount === 1 ? "" : "s"}`}
            className="relative flex min-h-11 items-center gap-2 rounded-[var(--radius-ctl)] bg-accent px-3.5 text-[14px] font-extrabold text-accent-ink hover:bg-accent-hover"
          >
            <IconBag size={20} />
            <span className="hidden sm:inline">Cart</span>
            {ready && lineCount > 0 ? (
              <>
                <span className="rounded-md bg-brand-deep px-1.5 text-[12px] font-bold leading-5 text-white tabular-nums">{lineCount}</span>
                {estimatedTotalPaise > 0 ? <span className="hidden tabular-nums lg:inline">{formatINR(estimatedTotalPaise)}</span> : null}
              </>
            ) : null}
          </Link>
        </nav>
      </div>
      <div className="px-3 pb-3 sm:px-4 md:hidden">
        <SearchBox onDark className="w-full" />
      </div>
    </header>
  );
}

/** Mobile cart bar pinned to the bottom edge while the cart has items. */
export function CartBar() {
  const { lineCount, estimatedTotalPaise, ready } = useShop();
  const path = usePathname();
  if (!ready || lineCount === 0 || /^\/(cart|checkout|order|my-orders|policies)/.test(path)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3 lg:hidden">
      <Link href="/cart" className="pointer-events-auto flex items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-brand-ink shadow-pop ring-1 ring-white/10">
        <span className="leading-tight">
          <span className="block text-[12px] font-medium opacity-85">
            {lineCount} item{lineCount === 1 ? "" : "s"}
          </span>
          <span className="block text-[17px] font-extrabold tabular-nums">{estimatedTotalPaise > 0 ? `≈ ${formatINR(estimatedTotalPaise)}` : "View cart"}</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-[14px] font-bold">
          View cart <IconArrowRight size={18} />
        </span>
      </Link>
    </div>
  );
}

export function Footer() {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  return (
    <footer className="mt-16 bg-brand-deeper text-white/80">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Logo tone="light" />
          <p className="max-w-xs text-white/70">
            Fresh vegetables and fruit delivered from our store to your door in {BRAND.city}, {BRAND.state}.
          </p>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-white/50">Help</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-white" href="/policies">Delivery, refunds and weights</Link></li>
            <li><Link className="hover:text-white" href="/location">Check delivery to your address</Link></li>
            <li><Link className="hover:text-white" href="/my-orders">My orders</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-white/50">Contact</p>
          {phone ? <p><a className="hover:text-white" href={`tel:${phone}`}>{phone}</a></p> : <p className="text-white/60">Contact details will be published before launch.</p>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/50">Business registration and food-licence details will appear here once registered. Prices are in Indian rupees.</p>
      </div>
    </footer>
  );
}
