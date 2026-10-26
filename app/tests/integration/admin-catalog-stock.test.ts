import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/permissions";
import { schema } from "@/server/db/client";
import { AdminError } from "@/server/services/admin/common";
import { addSaleUnit, createProduct, getProductAdmin, listProductsAdmin, saveCategory, setPrice, setProductActive, updateProduct, updateSaleUnit, type NewProductInput } from "@/server/services/admin/catalog";
import { getStockOverview, listRecentPurchases, listSuppliers, publishStock, receiveStock, recordWaste, saveSupplier } from "@/server/services/admin/stock";
import { queryProducts } from "@/server/services/catalog";
import { createOrder } from "@/server/services/orders";
import { NEAR, makeCustomer, makeStaff, makeWorld, setupCleanDb, testDb, type World } from "../helpers";
import type { StaffActor } from "@/server/services/delivery-ops";

setupCleanDb();

let n = 0;
async function actors() {
  const owner = await makeStaff(["OWNER"], `owner-${++n}@example.test`);
  const proc = await makeStaff(["PROCUREMENT"], `proc-${n}@example.test`);
  const packer = await makeStaff(["PACKER"], `packer-${n}@example.test`);
  const a = (s: { id: string }, roles: StaffActor["roles"]): StaffActor => ({ userId: s.id, roles });
  return { owner: a(owner, ["OWNER"]), proc: a(proc, ["PROCUREMENT"]), packer: a(packer, ["PACKER"]) };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    return e instanceof AdminError ? e.code : e instanceof ForbiddenError ? "FORBIDDEN" : `OTHER:${(e as Error).message}`;
  }
}

const newProduct = (w: World, over: Partial<NewProductInput> = {}): NewProductInput => ({
  name: "Green Peas (Matar)",
  nameHi: "हरी मटर",
  categoryId: w.product.categoryId,
  aliases: ["Matar", " matar ", "hari matar"],
  weightModel: "LOOSE_WEIGHT",
  baseUnit: "GRAM",
  tolerancePct: 0,
  unit: { unitBaseQty: 1000, minBase: 250, maxBase: 5000, stepBase: 250 },
  pricePaise: 6000,
  ...over,
});

describe("catalogue editor", () => {
  it("creates a product with a default unit, a first price and an audit row; procurement may, a packer may not", async () => {
    const w = await makeWorld();
    const a = await actors();
    expect(await code(createProduct(testDb(), { input: newProduct(w), actor: a.packer }))).toBe("FORBIDDEN");
    const p = await createProduct(testDb(), { input: newProduct(w), actor: a.proc });
    expect(p.slug).toBe("green-peas");
    const d = await getProductAdmin(testDb(), p.id);
    expect(d?.product).toMatchObject({ name: "Green Peas (Matar)", aliases: ["matar", "hari matar"], active: true });
    expect(d?.units).toHaveLength(1);
    expect(d?.units[0]).toMatchObject({ isDefault: true, pricePaise: 6000, salePricePaise: null });
    expect((await testDb().select().from(schema.auditLog)).some((x) => x.action === "product.create" && x.entityId === p.id)).toBe(true);
  });

  it("makes a unique web address for a second product with the same name", async () => {
    const w = await makeWorld();
    const a = await actors();
    await createProduct(testDb(), { input: newProduct(w), actor: a.owner });
    expect((await createProduct(testDb(), { input: newProduct(w), actor: a.owner })).slug).toBe("green-peas-2");
  });

  it("rejects bad input without saving anything", async () => {
    const w = await makeWorld();
    const a = await actors();
    const before = (await testDb().select().from(schema.product)).length;
    expect(await code(createProduct(testDb(), { input: newProduct(w, { nameHi: " " }), actor: a.owner }))).toBe("INVALID");
    expect(await code(createProduct(testDb(), { input: newProduct(w, { pricePaise: 0 }), actor: a.owner }))).toBe("INVALID");
    expect(await code(createProduct(testDb(), { input: newProduct(w, { pricePaise: 6000, salePricePaise: 7000 }), actor: a.owner }))).toBe("INVALID");
    expect(await code(createProduct(testDb(), { input: newProduct(w, { unit: { unitBaseQty: 1000, minBase: 300, maxBase: 5000, stepBase: 250 } }), actor: a.owner }))).toBe("INVALID");
    expect(await code(createProduct(testDb(), { input: newProduct(w, { tolerancePct: 80 }), actor: a.owner }))).toBe("INVALID");
    expect(await code(createProduct(testDb(), { input: newProduct(w, { seasonStartMonth: 11 }), actor: a.owner }))).toBe("INVALID");
    expect(await code(createProduct(testDb(), { input: newProduct(w, { categoryId: "00000000-0000-0000-0000-000000000000" }), actor: a.owner }))).toBe("INVALID");
    expect((await testDb().select().from(schema.product)).length).toBe(before);
  });

  it("changing a price keeps history with exactly one open row, and past orders keep their price", async () => {
    const w = await makeWorld();
    const a = await actors();
    const c = await makeCustomer();
    const o = await createOrder(testDb(), { customerId: c.id, customerName: "A B", idempotencyKey: "idem-price-abcdefgh", deliveryOption: "THREE_HOUR", address: { line: "12 Lake View Apartments", lat: NEAR.lat, lng: NEAR.lng }, paymentMode: "PAY_ON_DELIVERY", items: [{ saleUnitId: w.unit.id, qtyBase: 1000 }], transactionalConsent: true });
    await setPrice(testDb(), { saleUnitId: w.unit.id, pricePaise: 5500, salePricePaise: 5000, actor: a.proc });
    await setPrice(testDb(), { saleUnitId: w.unit.id, pricePaise: 5500, salePricePaise: 5000, actor: a.proc }); // unchanged: no new row
    const rows = await testDb().select().from(schema.price).where(eq(schema.price.saleUnitId, w.unit.id));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.validTo === null)).toHaveLength(1);
    const shown = (await queryProducts(testDb(), { serviceDate: w.serviceDate }))[0];
    expect(shown).toMatchObject({ pricePaise: 5500, salePricePaise: 5000, effectivePricePaise: 5000 });
    expect((await testDb().select().from(schema.order).where(eq(schema.order.id, o.orderId)))[0].subtotalPaise).toBe(4800);
    expect(await code(setPrice(testDb(), { saleUnitId: w.unit.id, pricePaise: 5000, salePricePaise: 5100, actor: a.proc }))).toBe("INVALID");
    expect(await code(setPrice(testDb(), { saleUnitId: w.unit.id, pricePaise: 5000, actor: a.packer }))).toBe("FORBIDDEN");
  });

  it("updates product details, hides and shows a product in the shop", async () => {
    const w = await makeWorld();
    const a = await actors();
    await updateProduct(testDb(), { id: w.product.id, input: { name: "Tomato (Desi)", nameHi: "देसी टमाटर", categoryId: w.product.categoryId, aliases: ["tamatar", "desi"], weightModel: "LOOSE_WEIGHT", baseUnit: "GRAM", tolerancePct: 0 }, actor: a.owner });
    expect((await getProductAdmin(testDb(), w.product.id))?.product).toMatchObject({ name: "Tomato (Desi)", aliases: ["tamatar", "desi"] });
    await setProductActive(testDb(), { id: w.product.id, active: false, actor: a.owner });
    expect(await queryProducts(testDb(), { serviceDate: w.serviceDate })).toHaveLength(0);
    expect(await listProductsAdmin(testDb())).toHaveLength(0);
    expect(await listProductsAdmin(testDb(), { includeInactive: true })).toHaveLength(1);
    await setProductActive(testDb(), { id: w.product.id, active: true, actor: a.owner });
    expect(await queryProducts(testDb(), { serviceDate: w.serviceDate })).toHaveLength(1);
    expect((await listProductsAdmin(testDb(), { q: "desi" }))[0]).toMatchObject({ name: "Tomato (Desi)", pricePaise: 4800, unitBaseQty: 1000 });
    expect(await listProductsAdmin(testDb(), { q: "zzz" })).toHaveLength(0);
    expect(await code(setProductActive(testDb(), { id: "00000000-0000-0000-0000-000000000000", active: true, actor: a.owner }))).toBe("NOT_FOUND");
  });

  it("edits order limits, adds a 500 g pack, and never switches off the default unit", async () => {
    const w = await makeWorld();
    const a = await actors();
    await updateSaleUnit(testDb(), { id: w.unit.id, rules: { unitBaseQty: 1000, minBase: 500, maxBase: 8000, stepBase: 250 }, actor: a.owner });
    expect((await testDb().select().from(schema.saleUnit).where(eq(schema.saleUnit.id, w.unit.id)))[0]).toMatchObject({ minBase: 500, maxBase: 8000 });
    expect(await code(updateSaleUnit(testDb(), { id: w.unit.id, rules: { unitBaseQty: 1000, minBase: 500, maxBase: 400, stepBase: 250 }, actor: a.owner }))).toBe("INVALID");
    expect(await code(updateSaleUnit(testDb(), { id: w.unit.id, rules: { unitBaseQty: 1000, minBase: 500, maxBase: 8000, stepBase: 250 }, active: false, actor: a.owner }))).toBe("INVALID");
    const id = await addSaleUnit(testDb(), { productId: w.product.id, rules: { unitBaseQty: 500, minBase: 500, maxBase: 2000, stepBase: 500 }, pricePaise: 2600, actor: a.owner });
    const d = await getProductAdmin(testDb(), w.product.id);
    expect(d?.units.map((u) => u.isDefault)).toEqual([true, false]);
    expect(d?.units.find((u) => u.id === id)?.pricePaise).toBe(2600);
  });

  it("creates and renames categories", async () => {
    await makeWorld();
    const a = await actors();
    const id = await saveCategory(testDb(), { name: "Fruit", nameHi: "फल", sortOrder: 4, active: true, actor: a.owner });
    await saveCategory(testDb(), { id, name: "Fresh fruit", nameHi: "ताज़े फल", sortOrder: 4, active: true, actor: a.owner });
    expect((await testDb().select().from(schema.category).where(eq(schema.category.id, id)))[0]).toMatchObject({ name: "Fresh fruit", slug: "fruit" });
    expect(await code(saveCategory(testDb(), { name: "", nameHi: "x", sortOrder: 0, active: true, actor: a.owner }))).toBe("INVALID");
  });
});

describe("stock and buying", () => {
  it("shows every active product, with zeros where nothing is recorded yet", async () => {
    const w = await makeWorld({ published: 5000 });
    const a = await actors();
    await createProduct(testDb(), { input: newProduct(w), actor: a.owner });
    const rows = await getStockOverview(testDb(), w.serviceDate);
    expect(rows.map((r) => [r.name, r.publishedQty])).toEqual([["Green Peas (Matar)", 0], ["Tomato", 5000]]);
  });

  it("publishing is all or nothing and never drops below what customers already ordered", async () => {
    const w = await makeWorld({ published: 5000 });
    const a = await actors();
    const c = await makeCustomer();
    await createOrder(testDb(), { customerId: c.id, customerName: "A B", idempotencyKey: "idem-pub-abcdefghijk", deliveryOption: "THREE_HOUR", address: { line: "12 Lake View Apartments", lat: NEAR.lat, lng: NEAR.lng }, paymentMode: "PAY_ON_DELIVERY", items: [{ saleUnitId: w.unit.id, qtyBase: 2000 }], transactionalConsent: true });
    const p2 = await createProduct(testDb(), { input: newProduct(w), actor: a.owner });
    // second item is fine, first goes below the 2000 reserved: nothing at all is saved
    expect(await code(publishStock(testDb(), { serviceDate: w.serviceDate, items: [{ productId: p2.id, publishedQty: 3000 }, { productId: w.product.id, publishedQty: 1500 }], actor: a.proc }))).toBe("CONFLICT");
    const rows = await getStockOverview(testDb(), w.serviceDate);
    expect(rows.find((r) => r.name === "Tomato")).toMatchObject({ publishedQty: 5000, reservedQty: 2000 });
    expect(rows.find((r) => r.productId === p2.id)?.publishedQty).toBe(0);

    expect(await publishStock(testDb(), { serviceDate: w.serviceDate, items: [{ productId: p2.id, publishedQty: 3000 }, { productId: w.product.id, publishedQty: 5000 }], actor: a.proc })).toBe(1);
    expect(await code(publishStock(testDb(), { serviceDate: w.serviceDate, items: [], actor: a.packer }))).toBe("FORBIDDEN");
    expect(await code(publishStock(testDb(), { serviceDate: "tomorrow", items: [], actor: a.proc }))).toBe("INVALID");
    expect(await code(publishStock(testDb(), { serviceDate: w.serviceDate, items: [{ productId: p2.id, publishedQty: -1 }], actor: a.proc }))).toMatch(/CONFLICT|OTHER/);
  });

  it("receiving goods records a purchase, a lot and the ledger, and can publish the accepted quantity", async () => {
    const w = await makeWorld({ published: 1000 });
    const a = await actors();
    const supplier = await saveSupplier(testDb(), { name: "Ram Mandi Traders", phone: "+919800000000", actor: a.proc });
    await receiveStock(testDb(), { input: { serviceDate: w.serviceDate, productId: w.product.id, supplierId: supplier, acceptedBase: 18_000, rejectedBase: 2000, rejectionReason: "bruised", costPaise: 72_000, publish: true }, actor: a.proc });
    const [d] = await testDb().select().from(schema.stockDay).where(eq(schema.stockDay.productId, w.product.id));
    expect(d).toMatchObject({ publishedQty: 19_000, receivedQty: 18_000 });
    const types = (await testDb().select().from(schema.stockMovement).where(eq(schema.stockMovement.productId, w.product.id))).map((m) => `${m.type}:${m.qtyBase}`);
    expect(types).toEqual(expect.arrayContaining(["RECEIVED:18000", "REJECTED:2000", "PUBLISHED:18000"]));
    expect(await testDb().select().from(schema.stockLot)).toHaveLength(1);
    const recent = await listRecentPurchases(testDb());
    expect(recent[0]).toMatchObject({ supplier: "Ram Mandi Traders", product: "Tomato", accepted: 18_000, rejected: 2000, costPaise: 72_000 });
    expect((await listSuppliers(testDb())).map((s) => s.name)).toEqual(["Ram Mandi Traders"]);
  });

  it("insists on a reason for rejected goods, uses a stand-in supplier when none is named, and checks permission", async () => {
    const w = await makeWorld();
    const a = await actors();
    const base = { serviceDate: w.serviceDate, productId: w.product.id, acceptedBase: 1000, costPaise: 3000 };
    expect(await code(receiveStock(testDb(), { input: { ...base, rejectedBase: 500 }, actor: a.proc }))).toBe("INVALID");
    expect(await code(receiveStock(testDb(), { input: { ...base, acceptedBase: 0 }, actor: a.proc }))).toBe("INVALID");
    expect(await code(receiveStock(testDb(), { input: { ...base, costPaise: 10.5 }, actor: a.proc }))).toBe("INVALID");
    expect(await code(receiveStock(testDb(), { input: base, actor: a.packer }))).toBe("FORBIDDEN");
    await receiveStock(testDb(), { input: base, actor: a.proc });
    expect((await listRecentPurchases(testDb()))[0].supplier).toBe("Market purchase (no named supplier)");
  });

  it("wastage comes out of what is sellable, never out of what is already promised", async () => {
    const w = await makeWorld({ published: 3000 });
    const a = await actors();
    const c = await makeCustomer();
    await createOrder(testDb(), { customerId: c.id, customerName: "A B", idempotencyKey: "idem-waste-abcdefghi", deliveryOption: "THREE_HOUR", address: { line: "12 Lake View Apartments", lat: NEAR.lat, lng: NEAR.lng }, paymentMode: "PAY_ON_DELIVERY", items: [{ saleUnitId: w.unit.id, qtyBase: 2000 }], transactionalConsent: true });
    expect(await code(recordWaste(testDb(), { serviceDate: w.serviceDate, productId: w.product.id, qtyBase: 1500, reason: "spoiled", actor: a.owner }))).toBe("CONFLICT");
    expect(await code(recordWaste(testDb(), { serviceDate: w.serviceDate, productId: w.product.id, qtyBase: 500, reason: " ", actor: a.owner }))).toBe("INVALID");
    await recordWaste(testDb(), { serviceDate: w.serviceDate, productId: w.product.id, qtyBase: 400, reason: "spoiled", actor: a.owner });
    const [d] = await testDb().select().from(schema.stockDay).where(and(eq(schema.stockDay.productId, w.product.id), eq(schema.stockDay.serviceDate, w.serviceDate)));
    expect(d).toMatchObject({ publishedQty: 2600, reservedQty: 2000, wastedQty: 400 });
    const m = await testDb().select().from(schema.stockMovement).where(and(eq(schema.stockMovement.productId, w.product.id), eq(schema.stockMovement.type, "WASTED")));
    expect(m).toHaveLength(1);
    expect(m[0].reason).toBe("spoiled");
    expect(await testDb().select().from(schema.price).where(isNull(schema.price.validTo))).toHaveLength(1);
  });
});
