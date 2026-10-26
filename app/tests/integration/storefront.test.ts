import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schema } from "@/server/db/client";
import { getProductBySlug, listCategories, queryProducts } from "@/server/services/catalog";
import { priceCart } from "@/server/services/pricing";
import { addProduct, makeWorld, setPrice, setupCleanDb, testDb } from "../helpers";

setupCleanDb();

describe("catalogue search (Hindi, English and Hinglish)", () => {
  async function seed() {
    const w = await makeWorld();
    await addProduct(w, { slug: "potato", name: "Potato", nameHi: "आलू", aliases: ["aloo", "alu"], pricePaise: 3000, popularity: 50 });
    await addProduct(w, { slug: "onion", name: "Onion", nameHi: "प्याज़", aliases: ["pyaz", "pyaaz"], pricePaise: 3500, popularity: 90 });
    return w;
  }
  const names = (rows: { name: string }[]) => rows.map((r) => r.name);

  it("finds by English name, Hindi name and Hinglish alias", async () => {
    const w = await seed();
    const q = (text: string) => queryProducts(testDb(), { serviceDate: w.serviceDate, q: text }).then(names);
    expect(await q("tomato")).toEqual(["Tomato"]);
    expect(await q("TOMATO")).toEqual(["Tomato"]);
    expect(await q("टमाटर")).toEqual(["Tomato"]);
    expect(await q("टमा")).toEqual(["Tomato"]);
    expect(await q("tamatar")).toEqual(["Tomato"]);
    expect(await q("aloo")).toEqual(["Potato"]);
    expect(await q("pyaz")).toEqual(["Onion"]);
  });

  it("tolerates small typos", async () => {
    const w = await seed();
    expect(names(await queryProducts(testDb(), { serviceDate: w.serviceDate, q: "tomatto" }))).toContain("Tomato");
    expect(names(await queryProducts(testDb(), { serviceDate: w.serviceDate, q: "potatoe" }))).toContain("Potato");
  });

  it("treats LIKE wildcards literally and returns nothing for nonsense", async () => {
    const w = await seed();
    expect(await queryProducts(testDb(), { serviceDate: w.serviceDate, q: "%" })).toEqual([]);
    expect(await queryProducts(testDb(), { serviceDate: w.serviceDate, q: "_" })).toEqual([]);
    expect(await queryProducts(testDb(), { serviceDate: w.serviceDate, q: "zzzzqx" })).toEqual([]);
    expect(await queryProducts(testDb(), { serviceDate: w.serviceDate, q: "'; drop table product; --" })).toEqual([]);
    expect((await queryProducts(testDb(), { serviceDate: w.serviceDate })).length).toBe(3);
  });

  it("sorts by popularity, price and name", async () => {
    const w = await seed();
    const sort = async (s: "popular" | "price_asc" | "price_desc" | "name") => names(await queryProducts(testDb(), { serviceDate: w.serviceDate, sort: s }));
    expect(await sort("popular")).toEqual(["Onion", "Potato", "Tomato"]);
    expect(await sort("price_asc")).toEqual(["Potato", "Onion", "Tomato"]);
    expect(await sort("price_desc")).toEqual(["Tomato", "Onion", "Potato"]);
    expect(await sort("name")).toEqual(["Onion", "Potato", "Tomato"]);
  });

  it("price sort compares price per 1000 base units, not per pack", async () => {
    const w = await makeWorld();
    // Rs 30 per 500 g = Rs 60/kg is dearer than Rs 48/kg tomato even though 30 < 48
    await addProduct(w, { slug: "grapes", name: "Grapes", nameHi: "अंगूर", pricePaise: 3000, unitBaseQty: 500 });
    expect(names(await queryProducts(testDb(), { serviceDate: w.serviceDate, sort: "price_asc" }))).toEqual(["Tomato", "Grapes"]);
  });

  it("filters by category and hides inactive products and products without a price", async () => {
    const w = await seed();
    await addProduct(w, { slug: "ghost", name: "Ghost Pepper", nameHi: "भूत", active: false });
    await addProduct(w, { slug: "noprice", name: "No Price", nameHi: "बिना", pricePaise: null as unknown as number });
    const [fruit] = await testDb().insert(schema.category).values({ slug: "fruit", name: "Fruit", nameHi: "फल" }).returning();
    await addProduct(w, { slug: "banana", name: "Banana", nameHi: "केला", categoryId: fruit.id, pricePaise: 6000 });
    expect(names(await queryProducts(testDb(), { serviceDate: w.serviceDate, categorySlug: "fruit" }))).toEqual(["Banana"]);
    const all = names(await queryProducts(testDb(), { serviceDate: w.serviceDate }));
    expect(all).not.toContain("Ghost Pepper");
    expect(all).not.toContain("No Price");
    const cats = await listCategories(testDb());
    expect(Object.fromEntries(cats.map((c) => [c.slug.replace(/-\d+$/, ""), c.productCount]))).toEqual({ fruit: 1, veg: 3 });
  });

  it("reports availability for the service date and uses the sale price", async () => {
    const w = await makeWorld({ published: 900 }); // tomato: 900 g left, min 250 -> LOW (< 4 * min)
    await addProduct(w, { slug: "soldout", name: "Sold Out", nameHi: "ख़त्म", published: 0 });
    await addProduct(w, { slug: "unpub", name: "Unpublished", nameHi: "अप्रकाशित", published: null });
    await addProduct(w, { slug: "plenty", name: "Plenty", nameHi: "बहुत", published: 50_000, pricePaise: 5000, salePricePaise: 4200 });
    const rows = new Map((await queryProducts(testDb(), { serviceDate: w.serviceDate })).map((r) => [r.name, r]));
    expect(rows.get("Tomato")).toMatchObject({ availability: "LOW", availableBase: 900 });
    expect(rows.get("Sold Out")?.availability).toBe("SOLD_OUT");
    expect(rows.get("Unpublished")?.availability).toBe("NOT_PUBLISHED");
    expect(rows.get("Plenty")).toMatchObject({ availability: "AVAILABLE", pricePaise: 5000, salePricePaise: 4200, effectivePricePaise: 4200 });
    const noDate = await queryProducts(testDb(), { serviceDate: null });
    expect(noDate.every((p) => p.availability === "UNKNOWN")).toBe(true);
  });

  it("reserved stock reduces availability; seasonal products are out of season outside their window", async () => {
    const w = await makeWorld({ published: 1000 });
    await testDb().update(schema.stockDay).set({ reservedQty: 800 }).where(eq(schema.stockDay.productId, w.product.id));
    const month = Number(w.serviceDate.slice(5, 7));
    const other = (month % 12) + 1; // a one-month window that excludes the service month
    await addProduct(w, { slug: "mango", name: "Mango", nameHi: "आम", seasonStart: other, seasonEnd: other });
    const rows = new Map((await queryProducts(testDb(), { serviceDate: w.serviceDate })).map((r) => [r.name, r]));
    expect(rows.get("Tomato")).toMatchObject({ availability: "SOLD_OUT", availableBase: 200 });
    expect(rows.get("Mango")?.availability).toBe("OUT_OF_SEASON");
  });

  it("returns a product by slug", async () => {
    const w = await seed();
    expect((await getProductBySlug(testDb(), "potato", w.serviceDate))?.nameHi).toBe("आलू");
    expect(await getProductBySlug(testDb(), "nope", w.serviceDate)).toBeNull();
  });
});

describe("server-side pricing (acceptance AC-PRICE, AC-UNIT)", () => {
  it("computes totals from database prices with correct rounding", async () => {
    const w = await makeWorld();
    const r = await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: w.unit.id, qtyBase: 1500 }] });
    expect(r.ok).toBe(true);
    expect(r.lines[0]).toMatchObject({ qtyBase: 1500, unitPricePaise: 4800, lineTotalPaise: 7200 });
    expect(r.subtotalPaise).toBe(7200);
  });

  it("uses the sale price when active, and re-prices after the price changes (nothing is client-trusted)", async () => {
    const w = await makeWorld();
    const price = async () => (await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }] })).subtotalPaise;
    expect(await price()).toBe(4800);
    await setPrice(w.unit.id, 5000, 4500);
    expect(await price()).toBe(4500);
    await setPrice(w.unit.id, 5500);
    expect(await price()).toBe(5500);
  });

  it("ignores prices whose validity window is in the future or has ended", async () => {
    const w = await makeWorld();
    await testDb().insert(schema.price).values({ saleUnitId: w.unit.id, pricePaise: 9900, validFrom: new Date(Date.now() + 3_600_000) });
    const r = await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }] });
    expect(r.subtotalPaise).toBe(4800);
  });

  it("flags below-min, above-max, not-step-multiple, unknown ids", async () => {
    const w = await makeWorld();
    const run = async (qty: number, id = w.unit.id) => (await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: id, qtyBase: qty }] })).issues[0]?.code;
    expect(await run(100)).toBe("BELOW_MIN");
    expect(await run(10_250)).toBe("ABOVE_MAX");
    expect(await run(300)).toBe("NOT_STEP_MULTIPLE");
    expect(await run(0)).toBe("BELOW_MIN");
    expect(await run(-250)).toBe("BELOW_MIN");
    expect(await run(1000, "00000000-0000-4000-8000-000000000000")).toBe("UNKNOWN_ITEM");
    await expect(priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: w.unit.id, qtyBase: 1.5 }] })).rejects.toThrow(RangeError);
  });

  it("merges duplicate lines before checking limits", async () => {
    const w = await makeWorld();
    const r = await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: w.unit.id, qtyBase: 6000 }, { saleUnitId: w.unit.id, qtyBase: 6000 }] });
    expect(r.issues.map((i) => i.code)).toEqual(["ABOVE_MAX"]);
  });

  it("reports stock problems with what is left", async () => {
    const w = await makeWorld({ published: 1000 });
    const r = await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: w.unit.id, qtyBase: 2000 }] });
    expect(r.ok).toBe(false);
    expect(r.issues[0]).toMatchObject({ code: "INSUFFICIENT_STOCK", maxAvailableBase: 1000 });
    const gone = await addProduct(w, { slug: "x", name: "X", nameHi: "एक्स", published: 0 });
    expect((await priceCart(testDb(), { serviceDate: w.serviceDate, items: [{ saleUnitId: gone.unit.id, qtyBase: 250 }] })).issues[0].code).toBe("SOLD_OUT");
  });

  it("an empty cart is not ok", async () => {
    const w = await makeWorld();
    expect((await priceCart(testDb(), { serviceDate: w.serviceDate, items: [] })).ok).toBe(false);
  });
});
