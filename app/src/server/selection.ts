import { db } from "./db/client";
import { primaryHub, serviceDateFor, istDate, getDeliveryOptions, type DeliveryOptionView, type HubInfo } from "./services/delivery";

/**
 * The date whose stock customers browse: today while the hub can take orders, otherwise the next
 * opening day (browsing at night shows tomorrow's stock). Falls back to today's India date with no hub.
 */
export async function currentServiceDate(now = new Date()): Promise<string> {
  const hub = await primaryHub(db());
  return hub ? serviceDateFor(hub, now) : istDate(now);
}

/** What the shop window shows before the customer shares a location: the hub and its speeds as if standing next to it. */
export async function storefrontSnapshot(now = new Date()): Promise<{ hub: HubInfo; options: DeliveryOptionView[] } | null> {
  const hub = await primaryHub(db());
  if (!hub) return null;
  return { hub, options: await getDeliveryOptions(db(), hub, 0, now) };
}
