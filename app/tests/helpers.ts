import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { db, pool, schema, type Db } from "../src/server/db/client";
import { newTotpSecret } from "../src/server/auth/totp";
import { createStaffUser } from "../src/server/auth/staff-auth";
import type { Role } from "../src/server/auth/permissions";
import { istDate } from "../src/server/services/delivery";

export const TEST_PASSWORD = "correct horse battery staple";

export function testDb(): Db {
  return db();
}

/** Truncate every application table. Append-only triggers are row-level, so TRUNCATE is unaffected. */
export async function resetDb(): Promise<void> {
  const res = await pool().query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and tablename not like '\\_\\_%' and tablename <> 'drizzle_migrations'`,
  );
  const names = res.rows.map((r) => `"${r.tablename}"`);
  if (names.length) await pool().query(`truncate ${names.join(", ")} restart identity cascade`);
}

/** Call at the top of an integration test file. */
export function setupCleanDb(): void {
  beforeEach(resetDb);
  afterAll(async () => {
    await pool().end();
    globalThis.__hhPool = undefined;
  });
}

export async function makeStaff(roles: Role[], email = `${roles[0].toLowerCase()}@example.test`) {
  const id = await createStaffUser(db(), { email, name: `Test ${roles[0]}`, password: TEST_PASSWORD, roles });
  return { id, email };
}

export { newTotpSecret };

/** Test locations around a hub at the centre of Udaipur (approximate coordinates; tests only). */
export const HUB_POINT = { lat: 24.5854, lng: 73.7125 };
export const NEAR = { lat: 24.5904, lng: 73.7125 }; // ~0.6 km north: inside every speed
export const MID = { lat: 24.63, lng: 73.7125 }; // ~5 km: 1-hour and 3-hour only
export const FAR = { lat: 24.7, lng: 73.7125 }; // ~12.7 km: 3-hour only
export const JAIPUR = { lat: 26.9124, lng: 75.7873 }; // outside Udaipur
export const NOWHERE_IN_UDAIPUR_BOX = { lat: 24.79, lng: 73.94 }; // inside the box, ~30 km from the hub

let seq = 0;

export interface WorldOptions {
  maxInstant?: number;
  maxOneHour?: number;
  maxThreeHour?: number;
  published?: number;
  /** Opening hours, minutes after midnight IST. Default: open all day so tests are not clock-dependent. */
  opens?: number;
  closes?: number;
  buffer?: number;
  minOrders?: { INSTANT?: number; ONE_HOUR?: number; THREE_HOUR?: number };
}

/**
 * The smallest valid world: Udaipur, one hub (open all day), the three delivery speeds with the
 * fees from the brief (Rs 20 / Rs 10 / free), and one product (Tomato, Rs 48/kg) with stock for today.
 */
export async function makeWorld(opts: WorldOptions = {}) {
  const n = ++seq;
  const d = db();
  const [city] = await d.insert(schema.city).values({ name: "Udaipur", state: "Rajasthan" }).returning();
  const [hub] = await d
    .insert(schema.hub)
    .values({ cityId: city.id, slug: `hub-${n}`, name: `Test Hub ${n}`, address: "Test address", lat: HUB_POINT.lat, lng: HUB_POINT.lng, opensAtMinute: opts.opens ?? 0, closesAtMinute: opts.closes ?? 1440, lastOrderBufferMinutes: opts.buffer ?? 0 })
    .returning();
  const defs = [
    { code: "INSTANT", name: "Instant", nameHi: "तुरंत", feePaise: 2000, promisedMinutes: 25, sortOrder: 1, radius: 3000, max: opts.maxInstant ?? 6 },
    { code: "ONE_HOUR", name: "1 hour", nameHi: "1 घंटा", feePaise: 1000, promisedMinutes: 60, sortOrder: 2, radius: 7000, max: opts.maxOneHour ?? 20 },
    { code: "THREE_HOUR", name: "3 hours", nameHi: "3 घंटे", feePaise: 0, promisedMinutes: 180, sortOrder: 3, radius: 15000, max: opts.maxThreeHour ?? 60 },
  ];
  for (const o of defs) {
    await d.insert(schema.deliveryOption).values({ code: o.code, name: o.name, nameHi: o.nameHi, feePaise: o.feePaise, promisedMinutes: o.promisedMinutes, sortOrder: o.sortOrder, minOrderPaise: opts.minOrders?.[o.code as "INSTANT"] ?? 0 }).onConflictDoNothing();
    await d.insert(schema.hubDeliveryOption).values({ hubId: hub.id, optionCode: o.code, radiusM: o.radius, maxActiveOrders: o.max });
  }
  const serviceDate = istDate(new Date());
  const [cat] = await d.insert(schema.category).values({ slug: `veg-${n}`, name: "Vegetables", nameHi: "सब्ज़ियाँ" }).returning();
  const [product] = await d
    .insert(schema.product)
    .values({ categoryId: cat.id, slug: `tomato-${n}`, name: "Tomato", nameHi: "टमाटर", aliases: ["tamatar"] })
    .returning();
  const [unit] = await d
    .insert(schema.saleUnit)
    .values({ productId: product.id, unitBaseQty: 1000, minBase: 250, maxBase: 10_000, stepBase: 250, isDefault: true })
    .returning();
  await d.insert(schema.price).values({ saleUnitId: unit.id, pricePaise: 4800 });
  await d.insert(schema.stockDay).values({ productId: product.id, serviceDate, publishedQty: opts.published ?? 10_000 });
  return { city, hub, product, unit, serviceDate };
}

export type World = Awaited<ReturnType<typeof makeWorld>>;

/** Add another product (with default sale unit, price, and stock for the world's service date). */
export async function addProduct(
  world: World,
  p: { slug: string; name: string; nameHi: string; aliases?: string[]; pricePaise?: number | null; salePricePaise?: number; published?: number | null; active?: boolean; seasonStart?: number; seasonEnd?: number; min?: number; max?: number; step?: number; popularity?: number; categoryId?: string; unitBaseQty?: number },
) {
  const d = db();
  const [product] = await d
    .insert(schema.product)
    .values({ categoryId: p.categoryId ?? world.product.categoryId, slug: p.slug, name: p.name, nameHi: p.nameHi, aliases: p.aliases ?? [], active: p.active ?? true, seasonStartMonth: p.seasonStart, seasonEndMonth: p.seasonEnd, popularity: p.popularity ?? 0 })
    .returning();
  const [unit] = await d
    .insert(schema.saleUnit)
    .values({ productId: product.id, unitBaseQty: p.unitBaseQty ?? 1000, minBase: p.min ?? 250, maxBase: p.max ?? 10_000, stepBase: p.step ?? 250, isDefault: true })
    .returning();
  if (p.pricePaise !== null) await d.insert(schema.price).values({ saleUnitId: unit.id, pricePaise: p.pricePaise ?? 4000, salePricePaise: p.salePricePaise });
  if (p.published !== null) await d.insert(schema.stockDay).values({ productId: product.id, serviceDate: world.serviceDate, publishedQty: p.published ?? 10_000 });
  return { product, unit };
}

/** Change a sale unit's price the way the admin panel will: close the open row, open a new one. */
export async function setPrice(saleUnitId: string, pricePaise: number, salePricePaise?: number) {
  const d = db();
  const now = new Date();
  await d.update(schema.price).set({ validTo: now }).where(and(eq(schema.price.saleUnitId, saleUnitId), isNull(schema.price.validTo)));
  await d.insert(schema.price).values({ saleUnitId, pricePaise, salePricePaise, validFrom: new Date(now.getTime() - 1) });
}

let phoneSeq = 0;
/** A phone-verified customer (as if they had completed OTP). */
export async function makeCustomer(opts: { failedDeliveries?: number; blocked?: boolean } = {}) {
  const n = ++phoneSeq;
  const [c] = await db()
    .insert(schema.customer)
    .values({ phone: `+9190000${String(10_000 + n).slice(-5)}`, name: "Test Customer", phoneVerifiedAt: new Date(), noShowCount: opts.failedDeliveries ?? 0, blocked: opts.blocked ?? false })
    .returning();
  return c;
}

/** A minimal order + line, inserted directly, for tests of stock/state/ops that do not need checkout. */
export async function makeOrderLine(world: World, qtyBase = 1000, over: { status?: (typeof schema.orderStatus.enumValues)[number]; paymentMode?: "PREPAID" | "PAY_ON_DELIVERY"; riderId?: string | null; option?: string } = {}) {
  const d = db();
  const n = ++seq;
  const customer = await makeCustomer();
  const [order] = await d
    .insert(schema.order)
    .values({
      publicCode: `T${String(n).padStart(7, "0")}`,
      customerId: customer.id,
      hubId: world.hub.id,
      deliveryOption: over.option ?? "THREE_HOUR",
      addressLine: "12 Test Street, Udaipur",
      lat: NEAR.lat,
      lng: NEAR.lng,
      distanceM: 600,
      recipientName: "Test Customer",
      recipientPhone: customer.phone,
      promisedAt: new Date(Date.now() + 3 * 3_600_000),
      status: over.status ?? "CONFIRMED",
      paymentMode: over.paymentMode ?? "PAY_ON_DELIVERY",
      subtotalPaise: 4800,
      totalPaise: 4800,
      handoverCode: String(1000 + (n % 9000)),
      trackingTokenHash: `hash-${n}`,
      policyVersion: "test",
      riderId: over.riderId ?? null,
    })
    .returning();
  const [line] = await d
    .insert(schema.orderLine)
    .values({
      orderId: order.id,
      productId: world.product.id,
      saleUnitId: world.unit.id,
      nameEn: "Tomato",
      nameHi: "टमाटर",
      baseUnit: "GRAM",
      weightModel: "LOOSE_WEIGHT",
      unitBaseQty: 1000,
      unitPricePaise: 4800,
      qtyOrderedBase: qtyBase,
      lineTotalPaise: 4800,
      serviceDate: world.serviceDate,
    })
    .returning();
  return { customer, order, line, unit: world.unit };
}
