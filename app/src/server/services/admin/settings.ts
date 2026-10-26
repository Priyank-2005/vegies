import { and, asc, eq } from "drizzle-orm";
import { audit } from "../../audit";
import { assertCan } from "../../auth/permissions";
import { schema, type Db, type DbOrTx } from "../../db/client";
import { loadSettings, saveSetting, type Settings } from "../../settings";
import { AdminError, type StaffActor } from "./common";

export interface HubSettings {
  id: string;
  name: string;
  nameHi: string | null;
  address: string | null;
  lat: number;
  lng: number;
  opensAtMinute: number;
  closesAtMinute: number;
  lastOrderBufferMinutes: number;
  active: boolean;
}

export interface OptionSettings {
  code: string;
  name: string;
  nameHi: string | null;
  feePaise: number;
  promisedMinutes: number;
  minOrderPaise: number;
  active: boolean;
  enabled: boolean;
  radiusM: number;
  maxActiveOrders: number;
}

export interface SettingsView {
  hub: HubSettings | null;
  options: OptionSettings[];
  business: Settings;
}

export async function getSettingsView(db: DbOrTx): Promise<SettingsView> {
  const [hub] = await db.select().from(schema.hub).where(eq(schema.hub.active, true)).orderBy(asc(schema.hub.createdAt)).limit(1);
  const options = hub
    ? await db
        .select({
          code: schema.deliveryOption.code,
          name: schema.deliveryOption.name,
          nameHi: schema.deliveryOption.nameHi,
          feePaise: schema.deliveryOption.feePaise,
          promisedMinutes: schema.deliveryOption.promisedMinutes,
          minOrderPaise: schema.deliveryOption.minOrderPaise,
          active: schema.deliveryOption.active,
          enabled: schema.hubDeliveryOption.enabled,
          radiusM: schema.hubDeliveryOption.radiusM,
          maxActiveOrders: schema.hubDeliveryOption.maxActiveOrders,
        })
        .from(schema.hubDeliveryOption)
        .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.hubDeliveryOption.optionCode))
        .where(eq(schema.hubDeliveryOption.hubId, hub.id))
        .orderBy(asc(schema.deliveryOption.sortOrder))
    : [];
  return {
    hub: hub ? { id: hub.id, name: hub.name, nameHi: hub.nameHi, address: hub.address, lat: hub.lat, lng: hub.lng, opensAtMinute: hub.opensAtMinute, closesAtMinute: hub.closesAtMinute, lastOrderBufferMinutes: hub.lastOrderBufferMinutes, active: hub.active } : null,
    options,
    business: await loadSettings(db),
  };
}

// Udaipur sits roughly within these bounds; a typo that puts the hub in the sea or in another state is caught here.
const UDAIPUR_BOX = { minLat: 24.2, maxLat: 25.0, minLng: 73.4, maxLng: 74.1 };

export async function updateHub(db: Db, args: { hub: HubSettings; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "delivery.manage");
  const h = args.hub;
  if (!h.name.trim()) throw new AdminError("INVALID", "The hub needs a name");
  if (![h.opensAtMinute, h.closesAtMinute, h.lastOrderBufferMinutes].every(Number.isInteger)) throw new AdminError("INVALID", "Hours must be whole minutes");
  if (h.opensAtMinute < 0 || h.closesAtMinute > 1440 || h.opensAtMinute >= h.closesAtMinute) throw new AdminError("INVALID", "Opening time must be before closing time");
  if (h.lastOrderBufferMinutes < 0 || h.lastOrderBufferMinutes >= h.closesAtMinute - h.opensAtMinute) throw new AdminError("INVALID", "The last-order buffer must be shorter than the opening hours");
  if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng) || h.lat < UDAIPUR_BOX.minLat || h.lat > UDAIPUR_BOX.maxLat || h.lng < UDAIPUR_BOX.minLng || h.lng > UDAIPUR_BOX.maxLng) {
    throw new AdminError("INVALID", "That location is not in the Udaipur area. Check the latitude and longitude.");
  }
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schema.hub).where(eq(schema.hub.id, h.id)).for("update").limit(1);
    if (!before) throw new AdminError("NOT_FOUND", "Hub not found");
    await tx
      .update(schema.hub)
      .set({ name: h.name.trim(), nameHi: h.nameHi?.trim() || null, address: h.address?.trim() || null, lat: h.lat, lng: h.lng, opensAtMinute: h.opensAtMinute, closesAtMinute: h.closesAtMinute, lastOrderBufferMinutes: h.lastOrderBufferMinutes })
      .where(eq(schema.hub.id, h.id));
    await audit(tx, {
      actorType: "staff",
      actorId: args.actor.userId,
      action: "hub.update",
      entity: "hub",
      entityId: h.id,
      before: { lat: before.lat, lng: before.lng, opens: before.opensAtMinute, closes: before.closesAtMinute, buffer: before.lastOrderBufferMinutes },
      after: { lat: h.lat, lng: h.lng, opens: h.opensAtMinute, closes: h.closesAtMinute, buffer: h.lastOrderBufferMinutes },
    });
  });
}

/** Fee, promise, minimum, reach and capacity of one delivery speed at the hub. */
export async function updateDeliveryOption(db: Db, args: { hubId: string; option: OptionSettings; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "delivery.manage");
  const o = args.option;
  const whole = [o.feePaise, o.promisedMinutes, o.minOrderPaise, o.radiusM, o.maxActiveOrders].every(Number.isInteger);
  if (!whole) throw new AdminError("INVALID", "Use whole numbers");
  if (o.feePaise < 0 || o.minOrderPaise < 0 || o.maxActiveOrders < 0) throw new AdminError("INVALID", "Fees, minimums and capacity cannot be negative");
  if (o.promisedMinutes < 5 || o.promisedMinutes > 24 * 60) throw new AdminError("INVALID", "The promised time must be between 5 minutes and 24 hours");
  if (o.radiusM < 500 || o.radiusM > 50_000) throw new AdminError("INVALID", "Reach must be between 0.5 km and 50 km");
  if (!o.name.trim()) throw new AdminError("INVALID", "The speed needs a name");
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schema.deliveryOption).where(eq(schema.deliveryOption.code, o.code)).for("update").limit(1);
    if (!before) throw new AdminError("NOT_FOUND", "Delivery speed not found");
    const hubScope = and(eq(schema.hubDeliveryOption.hubId, args.hubId), eq(schema.hubDeliveryOption.optionCode, o.code));
    const [hubOpt] = await tx.select().from(schema.hubDeliveryOption).where(hubScope).limit(1);
    if (!hubOpt) throw new AdminError("NOT_FOUND", "This hub does not offer that speed");
    await tx.update(schema.deliveryOption).set({ name: o.name.trim(), nameHi: o.nameHi?.trim() || null, feePaise: o.feePaise, promisedMinutes: o.promisedMinutes, minOrderPaise: o.minOrderPaise }).where(eq(schema.deliveryOption.code, o.code));
    await tx
      .update(schema.hubDeliveryOption)
      .set({ enabled: o.enabled, radiusM: o.radiusM, maxActiveOrders: o.maxActiveOrders })
      .where(hubScope);
    await audit(tx, {
      actorType: "staff",
      actorId: args.actor.userId,
      action: "delivery_option.update",
      entity: "delivery_option",
      entityId: o.code,
      before: { feePaise: before.feePaise, promisedMinutes: before.promisedMinutes, minOrderPaise: before.minOrderPaise, enabled: hubOpt.enabled, radiusM: hubOpt.radiusM, maxActiveOrders: hubOpt.maxActiveOrders },
      after: { feePaise: o.feePaise, promisedMinutes: o.promisedMinutes, minOrderPaise: o.minOrderPaise, enabled: o.enabled, radiusM: o.radiusM, maxActiveOrders: o.maxActiveOrders },
    });
  });
}

export type BusinessPatch = Partial<Pick<Settings, "minOrderPaise" | "holdMinutes" | "payOnDeliveryCapPaise" | "maxFailedDeliveriesForCod">>;

/** The owner-only business rules. Each key is validated by its schema before it is stored. */
export async function updateBusinessSettings(db: Db, args: { patch: BusinessPatch; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "settings.write");
  await db.transaction(async (tx) => {
    const before = await loadSettings(tx);
    const p = args.patch;
    try {
      if (p.minOrderPaise !== undefined) await saveSetting(tx, "orders.min_order_paise", p.minOrderPaise, args.actor.userId);
      if (p.holdMinutes !== undefined) await saveSetting(tx, "orders.hold_minutes", p.holdMinutes, args.actor.userId);
      if (p.payOnDeliveryCapPaise !== undefined) await saveSetting(tx, "payments.pay_on_delivery_cap_paise", p.payOnDeliveryCapPaise, args.actor.userId);
      if (p.maxFailedDeliveriesForCod !== undefined) await saveSetting(tx, "payments.max_failed_deliveries_for_cod", p.maxFailedDeliveriesForCod, args.actor.userId);
    } catch {
      throw new AdminError("INVALID", "One of the values is outside its allowed range");
    }
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "settings.update", entity: "setting", before, after: p });
  });
}
