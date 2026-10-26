"use client";

import Link from "next/link";
import { Alert } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { useShop } from "./shop-context";
import { currentData, useServiceability } from "./use-serviceability";

/**
 * A notice that appears only when something needs the customer's attention:
 * no location yet, not delivering there, or the store is closed / fully busy. Otherwise it renders nothing
 * (the header pill already shows where and how soon).
 */
export function LocationBanner() {
  const { location, ready } = useShop();
  const data = currentData(useServiceability());
  if (!ready) return null;
  if (!location) {
    return (
      <Alert tone="info">
        Tell us where to deliver to see arrival times and delivery charges. <Link className="font-semibold underline underline-offset-2" href="/location">Use my location</Link>
      </Alert>
    );
  }
  if (!data) return null;
  if (!data.served) {
    return (
      <Alert tone="warn">
        We do not deliver to this location yet. <Link className="font-semibold underline underline-offset-2" href="/location">Change location</Link>
      </Alert>
    );
  }
  if (!data.orderingOpen) {
    return <Alert tone="warn">{data.nextOpensAt ? `We are not taking orders right now. We open at ${formatTime(data.nextOpensAt)}. You can fill your cart now.` : "Every speed is very busy right now. Please try again in a few minutes."}</Alert>;
  }
  return null;
}
