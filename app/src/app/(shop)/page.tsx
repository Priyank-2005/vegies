import Link from "next/link";
import { IconArrowRight, IconBolt, IconCheck, IconChevronDown, IconClock, IconLeaf, IconRefund, IconScale, IconTag, IconTruck } from "@/components/icons";
import { HeroBanners } from "@/components/shop/hero-banners";
import { LocationGate } from "@/components/shop/location-gate";
import { ProductArt, artTint } from "@/components/shop/product-art";
import { ProductCard } from "@/components/shop/product-card";
import { SectionHeading } from "@/components/ui";
import { formatServiceDate, formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { db } from "@/server/db/client";
import { currentServiceDate, storefrontSnapshot } from "@/server/selection";
import { listCategories, queryProducts } from "@/server/services/catalog";
import { hubClock } from "@/server/services/delivery";

export const dynamic = "force-dynamic";

const WHY = [
  [IconScale, "Honest weights", "You never pay more than you agreed. If a bag is packed short, the difference is refunded."],
  [IconTag, "No hidden charges", "The delivery charge is shown before you order. No platform or handling fees."],
  [IconTruck, "Free if you can wait", "Choose delivery within 3 hours and pay nothing for delivery."],
  [IconRefund, "Easy refunds", "Something not right? Tell the rider or message us the same day."],
] as const;

const STEPS = [
  ["Share your location", "One tap, and we check that we deliver to you and which speeds are open."],
  ["Fill your basket", "Prices are per kg or per piece. Search in English, Hindi or Hinglish."],
  ["Choose a speed", "Instant, within 1 hour or within 3 hours. You see the charge and arrival time first."],
  ["Receive and pay", "Give the rider your 4-digit code. Pay by cash or UPI on delivery."],
];

/** The vegetable drawn on each category tile. */
const CATEGORY_ART: Record<string, string> = { "cat-veg": "capsicum", "cat-leafy": "spinach", "cat-roots": "carrot" };

const FAQ = [
  ["How fast is Instant delivery?", "We aim for about 25 minutes and show the exact arrival time before you order. Instant is available close to our store; further away you will see it greyed out and the slower speeds open."],
  ["What does delivery cost?", "Instant ₹20, within 1 hour ₹10, within 3 hours free. There are no other platform or handling charges."],
  ["Which areas do you deliver to?", "Udaipur only for now. Share your location and we will tell you straight away."],
  ["How do I pay?", "For now you pay the rider by cash or UPI when your order arrives. Online payment will be added; we will tell you when it opens."],
  ["Why does a speed say busy?", "We limit how many orders we take at once for each speed so we can keep our promise. Try a slower speed, or try again in a few minutes."],
  ["Can I cancel?", "Yes, free of charge until we start packing your order, from your order page."],
  ["What if something is sold out?", "We tell you before we pack. You can accept a substitute we suggest or take a refund for that item. We never swap anything silently."],
];

export default async function Home() {
  const [date, snap] = await Promise.all([currentServiceDate(), storefrontSnapshot()]);
  const [popular, categories] = await Promise.all([queryProducts(db(), { serviceDate: date, sort: "popular", limit: 10 }), listCategories(db())]);
  const clock = snap ? hubClock(snap.hub, new Date()) : null;
  const dayLabel = formatServiceDate(date);

  return (
    <main>
      <div className="mx-auto max-w-6xl space-y-6 px-3 pt-4 sm:px-4 sm:pt-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <HeroBanners options={snap ? snap.options.map((o) => ({ code: o.code, name: o.name, feePaise: o.feePaise, promisedMinutes: o.promisedMinutes })) : []} />
          <div className="flex flex-col rounded-[22px] border border-line bg-surface p-4 shadow-card sm:p-5">
            <h2 className="mb-3 text-[17px] font-extrabold">Do we deliver to you?</h2>
            <LocationGate compact />
            {clock && !clock.acceptingOrders ? <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent-ink">We are not taking orders right now. We open at {formatTime(clock.nextAcceptingAt)}. You can still browse and fill your cart.</p> : null}
            <ul className="mt-auto space-y-2 border-t border-line pt-4 text-[13.5px] text-muted lg:mt-5">
              {["Pay by cash or UPI when it arrives", "Cancel free until we start packing", "A 4-digit code keeps the handover safe"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <IconCheck size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {snap ? (
          <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Delivery speeds">
            {snap.options.map((o, i) => {
              const Icon = i === 0 ? IconBolt : IconClock;
              const free = o.feePaise === 0;
              return (
                <li key={o.code} className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3 text-center shadow-card sm:flex-row sm:gap-3.5 sm:p-3.5 sm:text-left">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12 sm:rounded-2xl ${i === 0 ? "bg-accent text-accent-ink" : free ? "bg-brand text-brand-ink" : "bg-brand-soft text-brand"}`}>
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[14px] font-extrabold sm:text-[15px]">{o.name}</span>
                    <span className="block text-[11.5px] text-muted sm:text-[13px]">
                      {o.promisedMinutes < 60 ? `~${o.promisedMinutes} min` : `${o.promisedMinutes / 60} hr`}
                      <span className="hidden sm:inline"> · up to {o.radiusM / 1000} km</span>
                    </span>
                  </span>
                  <span className={`text-[17px] font-extrabold tabular-nums sm:text-[20px] ${free ? "text-brand" : ""}`}>{free ? "FREE" : formatINR(o.feePaise)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {categories.some((c) => c.productCount > 0) ? (
        <section className="mx-auto max-w-6xl space-y-4 px-3 pt-9 sm:px-4" aria-labelledby="cats">
          <SectionHeading title="Shop by category" />
          <ul id="cats" className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {categories
              .filter((c) => c.productCount > 0)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/shop?category=${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card transition-shadow hover:shadow-pop">
                    <span className="relative flex aspect-[5/4] items-center justify-center overflow-hidden sm:aspect-[16/9]" style={{ background: artTint(CATEGORY_ART[c.slug] ?? "tomato") }} aria-hidden>
                      <span className="absolute -right-8 -top-8 size-28 rounded-full bg-[var(--orb)]" />
                      <ProductArt slug={CATEGORY_ART[c.slug] ?? "tomato"} className="relative h-[82%] transition-transform group-hover:scale-105" />
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 p-2.5 sm:p-3.5">
                      <span className="text-[13px] font-extrabold leading-tight sm:text-[16px]">{c.name}</span>
                      <span className="deva text-[12px] text-muted sm:text-[13px]">{c.nameHi}</span>
                      <span className="mt-auto pt-1 text-[11.5px] font-semibold text-brand sm:text-[13px]">{c.productCount} items</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl space-y-4 px-3 pt-10 sm:px-4" aria-labelledby="popular">
        <SectionHeading
          title="Most ordered"
          sub={`In stock for ${dayLabel}`}
          action={
            <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
              See all <IconArrowRight size={16} />
            </Link>
          }
        />
        {popular.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">The catalogue is being prepared.</p>
        ) : (
          <div id="popular" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} serviceDateLabel={dayLabel} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-3 pt-14 sm:px-4" aria-labelledby="why">
        <div className="overflow-hidden rounded-[26px] bg-brand-deep p-5 text-white sm:p-9">
          <div className="flex items-center gap-2 text-accent">
            <IconLeaf size={20} />
            <span className="text-[12px] font-extrabold uppercase tracking-[0.14em]">Why Hari Haat</span>
          </div>
          <h2 id="why" className="mt-2 max-w-xl text-[26px] font-extrabold leading-tight sm:text-[34px]">
            Fresh, fair and on time
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(([Icon, t, d]) => (
              <li key={t} className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-ink">
                  <Icon size={21} />
                </span>
                <p className="mt-3 font-extrabold">{t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/75">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-white/70">
            Read the full{" "}
            <Link className="font-bold text-white underline underline-offset-2" href="/policies">
              delivery, refund and weight policy
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-3 pt-14 sm:px-4" aria-labelledby="how-h">
        <SectionHeading title="How it works" />
        <ol id="how-h" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
              <span className="absolute -right-2 -top-4 select-none text-[84px] font-extrabold leading-none text-brand-soft" aria-hidden>
                {i + 1}
              </span>
              <p className="relative font-extrabold">{t}</p>
              <p className="relative mt-1.5 text-[14px] leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-3 pt-14 sm:px-4" aria-labelledby="faq">
        <SectionHeading title="Questions" />
        <div id="faq" className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-4 py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-bold">
                {q}
                <IconChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 pr-8 text-[14.5px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
