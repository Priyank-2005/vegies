import { LocationGate } from "@/components/shop/location-gate";

export const metadata = { title: "Where should we deliver?" };

export default function LocationPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-[26px] font-extrabold tracking-tight sm:text-3xl">Where should we deliver?</h1>
          <p className="text-muted">Share your location and we will show which delivery speeds are open at your address.</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5">
          <LocationGate />
        </div>
      </div>
    </main>
  );
}
