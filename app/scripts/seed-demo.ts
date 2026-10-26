/**
 * DEMO DATA for local development only. Safe to re-run; refuses non-local databases.
 *
 * The vegetable list and per-kg prices below are SAMPLE DATA supplied by the founder on 2026-10-24
 * ("General Market Price", Rs/kg). They are NOT verified Udaipur prices and are used here as
 * placeholder shelf prices. Real catalogue and prices are entered through the admin panel (Milestone 3).
 * The hub (store) location is a PLACEHOLDER at the Udaipur city centre, not a real store. Delivery radii, capacity and hours are assumptions.
 */
import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import { env } from "../src/lib/env";
import { db, pool, schema } from "../src/server/db/client";

config({ override: true });

type Cat = "veg" | "leafy" | "roots";
interface Item {
  name: string;
  hi: string;
  aliases: string[];
  paise: number; // price per kg, from the founder's sample list
  cat: Cat;
  pop: number;
  fine?: boolean; // small-quantity item: min 100 g, step 50 g
  note?: string;
}

const ITEMS: Item[] = [
  { name: "Tomato", hi: "टमाटर", aliases: ["tamatar", "tomato"], paise: 1050, cat: "veg", pop: 100 },
  { name: "Potato", hi: "आलू", aliases: ["aloo", "alu", "batata"], paise: 3200, cat: "roots", pop: 97 },
  { name: "Onion", hi: "प्याज़", aliases: ["pyaz", "pyaaz", "kanda"], paise: 3000, cat: "roots", pop: 98 },
  { name: "Beetroot", hi: "चुकंदर", aliases: ["chukandar", "beet"], paise: 1750, cat: "roots", pop: 30 },
  { name: "Ladyfinger (Bhindi)", hi: "भिंडी", aliases: ["bhindi", "okra", "lady finger"], paise: 3000, cat: "veg", pop: 54 },
  { name: "Bottle Gourd (Lauki)", hi: "लौकी", aliases: ["lauki", "ghiya", "dudhi"], paise: 1150, cat: "veg", pop: 45 },
  { name: "Brinjal (Baingan)", hi: "बैंगन", aliases: ["baingan", "brinjal", "eggplant"], paise: 1500, cat: "veg", pop: 40 },
  { name: "Cabbage", hi: "पत्ता गोभी", aliases: ["patta gobhi", "band gobhi", "cabbage"], paise: 1250, cat: "veg", pop: 42 },
  { name: "Capsicum", hi: "शिमला मिर्च", aliases: ["shimla mirch", "simla mirch", "capsicum"], paise: 3750, cat: "veg", pop: 60 },
  { name: "Carrot", hi: "गाजर", aliases: ["gajar", "carrot"], paise: 2500, cat: "roots", pop: 65 },
  { name: "Cauliflower", hi: "फूलगोभी", aliases: ["phool gobhi", "gobhi", "gobi", "cauliflower"], paise: 2250, cat: "veg", pop: 55 },
  { name: "Cucumber (Kheera)", hi: "खीरा", aliases: ["kheera", "kheera", "cucumber"], paise: 2500, cat: "veg", pop: 58 },
  { name: "Bitter Gourd (Karela)", hi: "करेला", aliases: ["karela", "bitter gourd"], paise: 2250, cat: "veg", pop: 28 },
  { name: "Green Chilli", hi: "हरी मिर्च", aliases: ["hari mirch", "mirchi", "green chili"], paise: 3500, cat: "veg", pop: 85, fine: true },
  { name: "Ginger", hi: "अदरक", aliases: ["adrak", "ginger"], paise: 4000, cat: "roots", pop: 80, fine: true },
  { name: "Garlic", hi: "लहसुन", aliases: ["lahsun", "lasan", "garlic"], paise: 15700, cat: "roots", pop: 75, fine: true },
  { name: "Cluster Beans (Guar Phali)", hi: "ग्वार फली", aliases: ["gwar phali", "guar", "gavar", "cluster beans"], paise: 3000, cat: "veg", pop: 25 },
  { name: "Coriander Leaves", hi: "धनिया पत्ती", aliases: ["dhaniya", "hara dhaniya", "coriander"], paise: 2040, cat: "leafy", pop: 90, fine: true },
  { name: "Radish (Mooli)", hi: "मूली", aliases: ["mooli", "muli", "radish"], paise: 2300, cat: "roots", pop: 35 },
  { name: "Spinach (Palak)", hi: "पालक", aliases: ["palak", "spinach"], paise: 1750, cat: "leafy", pop: 50 },
  { name: "Fenugreek Leaves (Methi)", hi: "मेथी", aliases: ["methi", "fenugreek"], paise: 1200, cat: "leafy", pop: 38, fine: true },
  { name: "Spring Onion", hi: "हरा प्याज़", aliases: ["hara pyaz", "spring onion"], paise: 2000, cat: "leafy", pop: 32, fine: true },
  { name: "Green Peas (Matar)", hi: "हरी मटर", aliases: ["matar", "hari matar", "peas"], paise: 6000, cat: "veg", pop: 52 },
  { name: "Pumpkin (Kaddu)", hi: "कद्दू", aliases: ["kaddu", "sitaphal", "pumpkin"], paise: 2400, cat: "veg", pop: 30 },
  { name: "Ridge Gourd (Turai)", hi: "तोरई", aliases: ["turai", "tori", "torai"], paise: 3600, cat: "veg", pop: 26 },
  { name: "Colocasia (Arbi)", hi: "अरबी", aliases: ["arbi", "arvi", "colocasia"], paise: 1850, cat: "roots", pop: 27 },
  { name: "Sweet Potato", hi: "शकरकंद", aliases: ["shakarkand", "sweet potato"], paise: 3500, cat: "roots", pop: 24 },
  { name: "Lemon", hi: "नींबू", aliases: ["nimbu", "lemon", "lime"], paise: 11000, cat: "veg", pop: 70, fine: true },
  { name: "Mint Leaves (Pudina)", hi: "पुदीना", aliases: ["pudina", "mint"], paise: 500, cat: "leafy", pop: 44, fine: true, note: "Sample price Rs 5/kg looks like a per-bunch price: confirm with supplier." },
  { name: "Mushroom", hi: "मशरूम", aliases: ["mushroom", "khumb"], paise: 7700, cat: "veg", pop: 22, fine: true },
  { name: "Drumstick (Sahjan)", hi: "सहजन की फली", aliases: ["sahjan", "sehjan", "moringa", "drumstick"], paise: 5500, cat: "veg", pop: 29 },
  { name: "Kakdi", hi: "ककड़ी", aliases: ["kakdi", "long cucumber"], paise: 3000, cat: "veg", pop: 31 },
  { name: "French Beans", hi: "फ्रेंच बीन्स", aliases: ["french beans", "farasbi", "beans"], paise: 6700, cat: "veg", pop: 36 },
  { name: "Green Coriander", hi: "हरा धनिया", aliases: ["green coriander", "hara dhaniya"], paise: 1300, cat: "leafy", pop: 20, fine: true, note: "Overlaps with Coriander Leaves in the sample list: confirm whether both are needed." },
];

const CATEGORIES: Record<Cat, { name: string; hi: string; sort: number }> = {
  veg: { name: "Everyday vegetables", hi: "सब्ज़ियाँ", sort: 1 },
  leafy: { name: "Leafy greens & herbs", hi: "हरी पत्तियाँ", sort: 2 },
  roots: { name: "Roots, onions & garlic", hi: "कंद व प्याज़", sort: 3 },
};

const slug = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** IST calendar date (YYYY-MM-DD) offset from today. */
function istDate(offsetDays: number): string {
  const ist = new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000);
  return ist.toISOString().slice(0, 10);
}

async function main() {
  const host = new URL(env().HH_DATABASE_URL).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error(`Refusing to seed demo data into non-local database host: ${host}`);
  const d = db();

  // --- city, hub and the three delivery speeds (the brief: Instant Rs 20, 1 hour Rs 10, 3 hours free) ---
  let [city] = await d.select().from(schema.city).where(eq(schema.city.name, "Udaipur")).limit(1);
  if (!city) [city] = await d.insert(schema.city).values({ name: "Udaipur", state: "Rajasthan" }).returning();
  await d
    .insert(schema.hub)
    .values({ cityId: city.id, slug: "demo-hub", name: "Demo store (sample location)", nameHi: "डेमो स्टोर (नमूना)", address: "Placeholder at the Udaipur city centre: replace with the real store address", lat: 24.5854, lng: 73.7125, opensAtMinute: 7 * 60, closesAtMinute: 22 * 60, lastOrderBufferMinutes: 20 })
    .onConflictDoNothing();
  const [hub] = await d.select().from(schema.hub).where(eq(schema.hub.slug, "demo-hub")).limit(1);
  const speeds = [
    { code: "INSTANT", name: "Instant", nameHi: "तुरंत", feePaise: 2000, promisedMinutes: 25, sortOrder: 1, radiusM: 3000, maxActiveOrders: 6 },
    { code: "ONE_HOUR", name: "1 hour", nameHi: "1 घंटे में", feePaise: 1000, promisedMinutes: 60, sortOrder: 2, radiusM: 7000, maxActiveOrders: 20 },
    { code: "THREE_HOUR", name: "3 hours", nameHi: "3 घंटे में", feePaise: 0, promisedMinutes: 180, sortOrder: 3, radiusM: 15000, maxActiveOrders: 60 },
  ];
  for (const o of speeds) {
    await d.insert(schema.deliveryOption).values({ code: o.code, name: o.name, nameHi: o.nameHi, feePaise: o.feePaise, promisedMinutes: o.promisedMinutes, sortOrder: o.sortOrder }).onConflictDoNothing();
    await d.insert(schema.hubDeliveryOption).values({ hubId: hub.id, optionCode: o.code, radiusM: o.radiusM, maxActiveOrders: o.maxActiveOrders }).onConflictDoNothing();
  }

  // --- catalogue ---
  const catIds = new Map<Cat, string>();
  for (const [key, c] of Object.entries(CATEGORIES) as [Cat, (typeof CATEGORIES)[Cat]][]) {
    await d.insert(schema.category).values({ slug: `cat-${key}`, name: c.name, nameHi: c.hi, sortOrder: c.sort }).onConflictDoNothing();
    const [row] = await d.select().from(schema.category).where(eq(schema.category.slug, `cat-${key}`)).limit(1);
    catIds.set(key, row.id);
  }
  const unitIds: string[] = [];
  const productIds: string[] = [];
  for (const it of ITEMS) {
    const s = slug(it.name);
    await d
      .insert(schema.product)
      .values({
        categoryId: catIds.get(it.cat)!,
        slug: s,
        name: it.name,
        nameHi: it.hi,
        aliases: [...new Set(it.aliases.map((a) => a.toLowerCase()))],
        weightModel: "LOOSE_WEIGHT",
        baseUnit: "GRAM",
        popularity: it.pop,
        storageNote: it.note ?? null,
      })
      .onConflictDoNothing();
    const [p] = await d.select().from(schema.product).where(eq(schema.product.slug, s)).limit(1);
    productIds.push(p.id);
    const existingUnit = await d.select().from(schema.saleUnit).where(eq(schema.saleUnit.productId, p.id)).limit(1);
    let unitId = existingUnit[0]?.id;
    if (!unitId) {
      const [u] = await d
        .insert(schema.saleUnit)
        .values({ productId: p.id, unitBaseQty: 1000, minBase: it.fine ? 100 : 250, maxBase: it.fine ? 2000 : 10_000, stepBase: it.fine ? 50 : 250, isDefault: true })
        .returning();
      unitId = u.id;
    }
    unitIds.push(unitId);
    const open = await d.select().from(schema.price).where(and(eq(schema.price.saleUnitId, unitId), isNull(schema.price.validTo))).limit(1);
    if (open.length === 0) await d.insert(schema.price).values({ saleUnitId: unitId, pricePaise: it.paise });
  }

  // --- stock: 20 kg of everything for today and the next two days (India dates) ---
  for (const offset of [0, 1, 2]) {
    const date = istDate(offset);
    for (const pid of productIds) {
      await d.insert(schema.stockDay).values({ productId: pid, serviceDate: date, publishedQty: 20_000 }).onConflictDoNothing();
    }
  }
  console.log(`Demo data ready: ${ITEMS.length} products, 1 demo hub, 3 delivery speeds, stock for ${istDate(0)} to ${istDate(2)}.`);
  console.log("Prices are the founder's SAMPLE per-kg figures, not verified market prices.");
  await pool().end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
