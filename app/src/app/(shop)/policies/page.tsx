import { Alert } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Delivery, refunds and weights" };

// DRAFT policy text for launch review. It states how the product behaves today (see PRD business rules).
// It must be reviewed by the owner and a qualified adviser before launch.
const SECTIONS: Array<{ id: string; title: string; points: React.ReactNode[] }> = [
  {
    id: "delivery",
    title: "Where and how fast",
    points: [
      <>We deliver in {BRAND.city} only, from our store. When you share your location we show exactly which speeds are open at your address.</>,
      <><strong>Instant</strong> costs ₹20 and aims for about 25 minutes. <strong>Within 1 hour</strong> costs ₹10. <strong>Within 3 hours</strong> is free. There are no platform or handling charges.</>,
      <>The arrival time shown at checkout is our promise for that order. Traffic, weather or a very busy period can cause delays; we will tell you if your order will be late.</>,
      <>To keep our promise we limit how many orders we take at once for each speed. If a speed says &quot;busy&quot;, choose another or try again shortly.</>,
      <>Each speed has a maximum distance from our store. Faster speeds are available closer to it.</>,
    ],
  },
  {
    id: "weights",
    title: "What you pay, and weights",
    points: [
      <>Every price is shown per kg, per piece or per pack before you order.</>,
      <>The total at checkout is the most you will pay. We never charge more because a bag came out heavier.</>,
      <>For items sold by weight we pack at least the weight you ordered. A little extra (up to 5%) is on us.</>,
      <>If a bag is packed short, we refund the difference automatically.</>,
      <>For items sold per piece, weights vary a little. If a piece is much lighter than described, we refund the difference.</>,
    ],
  },
  {
    id: "paying",
    title: "Paying",
    points: [<>For now you pay the rider by cash or UPI when your order arrives, up to a limit per order that is shown at checkout. Online payment will be added later.</>],
  },
  {
    id: "cancel",
    title: "Cancelling an order",
    points: [
      <>You can cancel free of charge from your order page until we start packing it.</>,
      <>After packing starts, online cancellation closes because the items are already picked. Contact us and we will do our best to help.</>,
      <>If you already paid online, a cancelled order is refunded to the same payment method.</>,
    ],
  },
  {
    id: "problems",
    title: "If something is not right",
    points: [
      <>Check your bag when it arrives. If an item is stale, damaged, missing or wrong, tell the rider or message us the same day with a photo. We will refund or replace it.</>,
      <>If an item cannot be supplied, we tell you before we pack. You can accept a substitute we suggest or take a refund for that item. We never swap anything without asking.</>,
    ],
  },
  {
    id: "code",
    title: "Delivery code and failed deliveries",
    points: [
      <>Each order has a 4-digit delivery code on your order page. Tell it to the rider when your order arrives. It proves the order reached you.</>,
      <>If nobody is available to receive the order, the rider will call you. If we cannot deliver, the order may be cancelled. Repeated failed deliveries may mean we ask for online payment on future orders.</>,
    ],
  },
  {
    id: "privacy",
    title: "Your location and phone number",
    points: [
      <>We ask for your location only when you tap the button, and your browser asks your permission first. We use it to check delivery and to pre-fill your address. It stays in your browser until you place an order; your delivery address and its map position are then saved with that order so we can deliver it.</>,
      <>To suggest an address from your position, we may send your coordinates to a map service (OpenStreetMap) and show their attribution. You can always type your address instead.</>,
      <>We use your phone number to confirm your order and to message you about it. We only send offers if you ask us to. You can ask us to delete your details at any time.</>,
    ],
  },
];

export default function PoliciesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <div className="mb-8 max-w-2xl space-y-3">
        <h1 className="text-[30px] font-extrabold tracking-tight">Delivery, refunds and weights</h1>
        <Alert tone="warn">Draft policy. It will be reviewed and finalised before {BRAND.name} starts taking real orders.</Alert>
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 border-l border-line text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-muted hover:border-brand hover:text-ink" href={`#${s.id}`}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-2xl space-y-9">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="mb-3 text-xl font-extrabold tracking-tight">{s.title}</h2>
              <ul className="space-y-2.5 text-[15.5px] leading-relaxed">
                {s.points.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
