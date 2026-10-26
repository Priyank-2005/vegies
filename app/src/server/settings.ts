import { inArray } from "drizzle-orm";
import { z } from "zod";
import { schema, type DbOrTx } from "./db/client";

/**
 * Business rules that the owner can tune without a deploy. Stored in the `setting` table
 * (key -> JSON). Missing keys fall back to these defaults. An admin editor arrives in Milestone 3.
 * Delivery fees, speeds, radii and capacity are NOT here: they are rows in delivery_option / hub_delivery_option.
 */
const definition = {
  // A floor that applies to every delivery speed, on top of each speed's own minimum.
  "orders.min_order_paise": z.number().int().min(0).default(0),
  "orders.hold_minutes": z.number().int().min(1).max(120).default(15),
  // Prepaid needs the payment gateway (Milestone 4); off until then.
  "payments.prepaid_enabled": z.boolean().default(false),
  "payments.pay_on_delivery_cap_paise": z.number().int().min(0).default(60_000), // Rs 600
  // The first order must be prepaid. Only enforceable once prepaid is enabled.
  "payments.first_order_prepaid_required": z.boolean().default(true),
  "payments.max_failed_deliveries_for_cod": z.number().int().min(0).default(2),
  "policy.version": z.string().min(1).default("2026-10-delivery-draft"),
} as const;

export type SettingKey = keyof typeof definition;

export interface Settings {
  minOrderPaise: number;
  holdMinutes: number;
  prepaidEnabled: boolean;
  payOnDeliveryCapPaise: number;
  firstOrderPrepaidRequired: boolean;
  maxFailedDeliveriesForCod: number;
  policyVersion: string;
}

export async function loadSettings(db: DbOrTx): Promise<Settings> {
  const keys = Object.keys(definition) as SettingKey[];
  const rows = await db.select().from(schema.setting).where(inArray(schema.setting.key, keys));
  const raw = new Map(rows.map((r) => [r.key, r.value]));
  const get = <K extends SettingKey>(k: K): z.infer<(typeof definition)[K]> => {
    const parsed = definition[k].safeParse(raw.get(k) ?? undefined);
    // A malformed stored value must never take checkout down: fall back to the default.
    return (parsed.success ? parsed.data : definition[k].parse(undefined)) as z.infer<(typeof definition)[K]>;
  };
  return {
    minOrderPaise: get("orders.min_order_paise"),
    holdMinutes: get("orders.hold_minutes"),
    prepaidEnabled: get("payments.prepaid_enabled"),
    payOnDeliveryCapPaise: get("payments.pay_on_delivery_cap_paise"),
    firstOrderPrepaidRequired: get("payments.first_order_prepaid_required"),
    maxFailedDeliveriesForCod: get("payments.max_failed_deliveries_for_cod"),
    policyVersion: get("policy.version"),
  };
}

export async function saveSetting(db: DbOrTx, key: SettingKey, value: unknown, actorId?: string): Promise<void> {
  const parsed = definition[key].parse(value);
  await db
    .insert(schema.setting)
    .values({ key, value: parsed, updatedBy: actorId ?? null })
    .onConflictDoUpdate({ target: schema.setting.key, set: { value: parsed, updatedBy: actorId ?? null } });
}
