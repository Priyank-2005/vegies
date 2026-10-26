"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconArrowRight, IconBolt, IconClock, IconWallet } from "@/components/icons";
import { cx } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { ArtShape } from "./product-art";

export interface BannerOption {
  code: string;
  name: string;
  feePaise: number;
  promisedMinutes: number;
}

/** Several illustrations placed on one 420x300 canvas. */
function Cluster({ items }: { items: Array<{ slug: string; x: number; y: number; s: number; r?: number }> }) {
  return (
    <svg viewBox="0 0 420 300" aria-hidden focusable="false" className="h-full w-full">
      {items.map((it) => (
        <g key={it.slug} transform={`translate(${it.x} ${it.y}) rotate(${it.r ?? 0} ${100 * it.s} ${100 * it.s}) scale(${it.s})`}>
          <ArtShape slug={it.slug} />
        </g>
      ))}
    </svg>
  );
}

interface Slide {
  key: string;
  bg: string;
  dark: boolean;
  chip: ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
  art: ReactNode;
}

function buildSlides(options: BannerOption[]): Slide[] {
  const fast = options.find((o) => o.code === "INSTANT") ?? options[0];
  const free = options.find((o) => o.feePaise === 0);
  return [
    {
      key: "instant",
      bg: "linear-gradient(120deg,#053b27 0%,#0b7a45 70%,#14a05a 100%)",
      dark: true,
      chip: (
        <>
          <IconBolt size={14} /> {fast ? `${fast.name} · ${fast.feePaise === 0 ? "free" : formatINR(fast.feePaise)}` : "Instant"}
        </>
      ),
      title: fast ? `Fresh vegetables in about ${fast.promisedMinutes} minutes` : "Fresh vegetables at your door",
      body: "From our store in Udaipur straight to your kitchen. Pick the speed that suits you.",
      cta: { href: "/shop", label: "Shop now" },
      art: (
        <Cluster
          items={[
            { slug: "cauliflower", x: 150, y: 40, s: 1.25 },
            { slug: "tomato", x: 20, y: 120, s: 1.0, r: -8 },
            { slug: "carrot", x: 290, y: 90, s: 1.05, r: 6 },
            { slug: "capsicum", x: 224, y: 150, s: 0.95 },
            { slug: "spinach", x: 96, y: 170, s: 0.8 },
          ]}
        />
      ),
    },
    {
      key: "free",
      bg: "linear-gradient(120deg,#ffb703 0%,#ffcf40 60%,#ffe08a 100%)",
      dark: false,
      chip: (
        <>
          <IconClock size={14} /> {free ? `${free.name} · ${formatINR(0)} delivery` : "No delivery charge"}
        </>
      ),
      title: "Can wait a little? Delivery is on us",
      body: "Choose the 3-hour slot for free delivery. No platform fees, no handling fees, ever.",
      cta: { href: "/shop", label: "Start shopping" },
      art: (
        <Cluster
          items={[
            { slug: "pumpkin", x: 120, y: 90, s: 1.2 },
            { slug: "brinjal", x: 10, y: 110, s: 0.95, r: -6 },
            { slug: "green-peas", x: 250, y: 130, s: 1.0 },
            { slug: "lemon", x: 300, y: 40, s: 0.7, r: 8 },
            { slug: "cabbage", x: 20, y: 30, s: 0.6 },
          ]}
        />
      ),
    },
    {
      key: "pay",
      bg: "linear-gradient(120deg,#0f3d4a 0%,#1b6a73 65%,#2b8a8a 100%)",
      dark: true,
      chip: (
        <>
          <IconWallet size={14} /> Pay on delivery
        </>
      ),
      title: "Honest weights. Pay when it arrives",
      body: "Cash or UPI to the rider. If a bag is packed short, you only pay for what you got.",
      cta: { href: "/policies", label: "How we weigh" },
      art: (
        <Cluster
          items={[
            { slug: "ladyfinger", x: 150, y: 50, s: 1.2 },
            { slug: "mushroom", x: 10, y: 120, s: 0.9 },
            { slug: "ginger", x: 270, y: 130, s: 0.95, r: -6 },
            { slug: "onion", x: 250, y: 30, s: 0.7 },
            { slug: "green-chilli", x: 60, y: 30, s: 0.6, r: 10 },
          ]}
        />
      ),
    },
  ];
}

export function HeroBanners({ options }: { options: BannerOption[] }) {
  const slides = buildSlides(options);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [active, setActive] = useState(0);

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      const el = track.current;
      if (!el || paused.current) return;
      const n = Math.round(el.scrollLeft / el.clientWidth);
      el.scrollTo({ left: ((n + 1) % 3) * el.clientWidth, behavior: "smooth" });
    }, 5500);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section aria-roledescription="carousel" aria-label="Offers" className="relative" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)} onFocus={() => (paused.current = true)} onBlur={() => (paused.current = false)}>
      <div
        ref={track}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto rounded-[22px]"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {slides.map((s, i) => (
          <div key={s.key} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`} className={cx("relative flex min-h-[188px] w-full flex-none snap-center items-stretch overflow-hidden sm:min-h-[260px] lg:min-h-[320px]", s.dark ? "text-white" : "text-[#2b2000]")} style={{ background: s.bg }}>
            <div className="bg-dots absolute inset-0 opacity-70" aria-hidden />
            <span className="absolute -right-16 -top-20 size-72 rounded-full bg-white/10" aria-hidden />
            <span className="absolute -bottom-24 right-1/3 size-64 rounded-full bg-white/[0.07]" aria-hidden />
            <div className="relative z-10 flex w-[56%] flex-col justify-center gap-2.5 py-5 pl-5 sm:w-1/2 sm:gap-4 sm:pl-10 lg:pl-14">
              <span className={cx("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider sm:text-xs", s.dark ? "bg-white/15 text-white" : "bg-[#2b2000]/10 text-[#2b2000]")}>{s.chip}</span>
              <h2 className="text-[21px] font-extrabold leading-[1.12] sm:text-[34px] lg:text-[44px]">{s.title}</h2>
              <p className={cx("hidden max-w-md text-[15px] leading-relaxed sm:block lg:text-base", s.dark ? "text-white/80" : "text-[#2b2000]/80")}>{s.body}</p>
              <Link href={s.cta.href} className={cx("mt-1 inline-flex w-fit items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold sm:px-5 sm:text-[15px]", s.dark ? "bg-accent text-accent-ink hover:bg-accent-hover" : "bg-[#053b27] text-white hover:bg-[#03281a]")}>
                {s.cta.label} <IconArrowRight size={16} />
              </Link>
            </div>
            <div className="float-slow pointer-events-none absolute inset-y-0 -right-1 flex w-[56%] items-center justify-end sm:right-0 sm:w-[56%] sm:pr-4" aria-hidden>
              <div className="h-[96%] w-full max-w-[520px]">{s.art}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-1.5 sm:bottom-4">
        {slides.map((s, i) => (
          <button key={s.key} type="button" aria-label={`Show offer ${i + 1}`} aria-current={active === i} onClick={() => go(i)} className={cx("h-1.5 rounded-full transition-all", active === i ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80")} />
        ))}
      </div>
    </section>
  );
}
