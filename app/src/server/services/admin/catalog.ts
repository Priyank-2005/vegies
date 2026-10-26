import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { validateQuantityRule, type BaseUnit, type WeightModel } from "@/lib/units";
import { audit } from "../../audit";
import { assertCan } from "../../auth/permissions";
import { schema, type Db, type DbOrTx, type Tx } from "../../db/client";
import { AdminError, slugify, type StaffActor } from "./common";

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  categoryName: string;
  active: boolean;
  weightModel: WeightModel;
  baseUnit: BaseUnit;
  unitBaseQty: number | null;
  pricePaise: number | null;
  salePricePaise: number | null;
}

/** All products for the catalogue list, with each one's default unit and current price. */
export async function listProductsAdmin(db: DbOrTx, opts: { q?: string; categoryId?: string; includeInactive?: boolean } = {}): Promise<AdminProductRow[]> {
  const conds = [];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(schema.product.name, like), ilike(schema.product.nameHi, like), sql`exists (select 1 from unnest(${schema.product.aliases}) a where a ilike ${like})`));
  }
  if (opts.categoryId) conds.push(eq(schema.product.categoryId, opts.categoryId));
  if (!opts.includeInactive) conds.push(eq(schema.product.active, true));
  const rows = await db
    .select({
      id: schema.product.id,
      slug: schema.product.slug,
      name: schema.product.name,
      nameHi: schema.product.nameHi,
      categoryName: schema.category.name,
      active: schema.product.active,
      weightModel: schema.product.weightModel,
      baseUnit: schema.product.baseUnit,
      unitBaseQty: schema.saleUnit.unitBaseQty,
      pricePaise: schema.price.pricePaise,
      salePricePaise: schema.price.salePricePaise,
    })
    .from(schema.product)
    .innerJoin(schema.category, eq(schema.category.id, schema.product.categoryId))
    .leftJoin(schema.saleUnit, and(eq(schema.saleUnit.productId, schema.product.id), eq(schema.saleUnit.isDefault, true), eq(schema.saleUnit.active, true)))
    .leftJoin(schema.price, and(eq(schema.price.saleUnitId, schema.saleUnit.id), isNull(schema.price.validTo)))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(schema.category.sortOrder), asc(schema.product.name));
  return rows;
}

export interface AdminProductDetail {
  product: typeof schema.product.$inferSelect;
  units: Array<typeof schema.saleUnit.$inferSelect & { pricePaise: number | null; salePricePaise: number | null; history: Array<{ pricePaise: number; salePricePaise: number | null; validFrom: Date; validTo: Date | null }> }>;
}

export async function getProductAdmin(db: DbOrTx, id: string): Promise<AdminProductDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [product] = await db.select().from(schema.product).where(eq(schema.product.id, id)).limit(1);
  if (!product) return null;
  const units = await db.select().from(schema.saleUnit).where(eq(schema.saleUnit.productId, id)).orderBy(desc(schema.saleUnit.isDefault), asc(schema.saleUnit.unitBaseQty));
  const out: AdminProductDetail["units"] = [];
  for (const u of units) {
    const history = await db.select({ pricePaise: schema.price.pricePaise, salePricePaise: schema.price.salePricePaise, validFrom: schema.price.validFrom, validTo: schema.price.validTo }).from(schema.price).where(eq(schema.price.saleUnitId, u.id)).orderBy(desc(schema.price.validFrom)).limit(8);
    const current = history.find((h) => h.validTo === null);
    out.push({ ...u, pricePaise: current?.pricePaise ?? null, salePricePaise: current?.salePricePaise ?? null, history });
  }
  return { product, units: out };
}

export async function listCategoriesAdmin(db: DbOrTx) {
  return db.select().from(schema.category).orderBy(asc(schema.category.sortOrder), asc(schema.category.name));
}

const cleanAliases = (a: string[] | undefined) => [...new Set((a ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

function checkPrices(price: number, sale: number | null | undefined) {
  if (!Number.isSafeInteger(price) || price <= 0) throw new AdminError("INVALID", "Enter a price above zero");
  if (sale != null && (!Number.isSafeInteger(sale) || sale <= 0 || sale > price)) throw new AdminError("INVALID", "The offer price must be above zero and not more than the normal price");
}

function checkUnit(u: { unitBaseQty: number; minBase: number; maxBase: number; stepBase: number }) {
  const err = validateQuantityRule({ minBase: u.minBase, maxBase: u.maxBase, stepBase: u.stepBase });
  if (err) throw new AdminError("INVALID", `Order limits: ${err}`);
  if (!Number.isSafeInteger(u.unitBaseQty) || u.unitBaseQty <= 0) throw new AdminError("INVALID", "The price unit must be above zero");
}

async function uniqueSlug(tx: Tx, base: string): Promise<string> {
  const root = base || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [hit] = await tx.select({ id: schema.product.id }).from(schema.product).where(eq(schema.product.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  throw new AdminError("CONFLICT", "Could not make a unique web address for this product");
}

export interface ProductInput {
  name: string;
  nameHi: string;
  categoryId: string;
  aliases?: string[];
  descriptionEn?: string | null;
  storageNote?: string | null;
  weightModel: WeightModel;
  baseUnit: BaseUnit;
  tolerancePct: number;
  seasonStartMonth?: number | null;
  seasonEndMonth?: number | null;
}

function checkProduct(p: ProductInput) {
  if (!p.name.trim() || !p.nameHi.trim()) throw new AdminError("INVALID", "Both the English and the Hindi name are required");
  if (!Number.isInteger(p.tolerancePct) || p.tolerancePct < 0 || p.tolerancePct > 50) throw new AdminError("INVALID", "Tolerance must be between 0 and 50 percent");
  const m = [p.seasonStartMonth, p.seasonEndMonth];
  if (m.some((x) => x != null && (!Number.isInteger(x) || x < 1 || x > 12))) throw new AdminError("INVALID", "Season months must be 1 to 12");
  if ((p.seasonStartMonth == null) !== (p.seasonEndMonth == null)) throw new AdminError("INVALID", "Set both season months, or neither");
}

export interface NewProductInput extends ProductInput {
  unit: { unitBaseQty: number; minBase: number; maxBase: number; stepBase: number };
  pricePaise: number;
  salePricePaise?: number | null;
}

/** Create a product with its first (default) way of buying it and a first price. */
export async function createProduct(db: Db, args: { input: NewProductInput; actor: StaffActor }): Promise<{ id: string; slug: string }> {
  assertCan(args.actor.roles, "catalog.write");
  assertCan(args.actor.roles, "price.write");
  const i = args.input;
  checkProduct(i);
  checkUnit(i.unit);
  checkPrices(i.pricePaise, i.salePricePaise);
  return db.transaction(async (tx) => {
    const [cat] = await tx.select({ id: schema.category.id }).from(schema.category).where(eq(schema.category.id, i.categoryId)).limit(1);
    if (!cat) throw new AdminError("INVALID", "Choose a category");
    const slug = await uniqueSlug(tx, slugify(i.name));
    const [p] = await tx
      .insert(schema.product)
      .values({ categoryId: i.categoryId, slug, name: i.name.trim(), nameHi: i.nameHi.trim(), aliases: cleanAliases(i.aliases), descriptionEn: i.descriptionEn?.trim() || null, storageNote: i.storageNote?.trim() || null, weightModel: i.weightModel, baseUnit: i.baseUnit, tolerancePct: i.tolerancePct, seasonStartMonth: i.seasonStartMonth ?? null, seasonEndMonth: i.seasonEndMonth ?? null })
      .returning({ id: schema.product.id });
    const [u] = await tx.insert(schema.saleUnit).values({ productId: p.id, ...i.unit, isDefault: true }).returning({ id: schema.saleUnit.id });
    await tx.insert(schema.price).values({ saleUnitId: u.id, pricePaise: i.pricePaise, salePricePaise: i.salePricePaise ?? null, createdBy: args.actor.userId });
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "product.create", entity: "product", entityId: p.id, after: { name: i.name, slug, pricePaise: i.pricePaise } });
    return { id: p.id, slug };
  });
}

export async function updateProduct(db: Db, args: { id: string; input: ProductInput; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "catalog.write");
  const i = args.input;
  checkProduct(i);
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schema.product).where(eq(schema.product.id, args.id)).for("update").limit(1);
    if (!before) throw new AdminError("NOT_FOUND", "Product not found");
    // Quantities are stored in the product's base unit, so it can never change once units and orders exist.
    if (before.baseUnit !== i.baseUnit) throw new AdminError("INVALID", "A product cannot switch between weight and pieces. Create a new product instead.");
    await tx
      .update(schema.product)
      .set({ categoryId: i.categoryId, name: i.name.trim(), nameHi: i.nameHi.trim(), aliases: cleanAliases(i.aliases), descriptionEn: i.descriptionEn?.trim() || null, storageNote: i.storageNote?.trim() || null, weightModel: i.weightModel, baseUnit: i.baseUnit, tolerancePct: i.tolerancePct, seasonStartMonth: i.seasonStartMonth ?? null, seasonEndMonth: i.seasonEndMonth ?? null })
      .where(eq(schema.product.id, args.id));
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "product.update", entity: "product", entityId: args.id, before: { name: before.name, nameHi: before.nameHi, weightModel: before.weightModel }, after: { name: i.name, nameHi: i.nameHi, weightModel: i.weightModel } });
  });
}

/** Show or hide a product in the shop. Existing orders are unaffected (they keep their own snapshot). */
export async function setProductActive(db: Db, args: { id: string; active: boolean; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "catalog.write");
  await db.transaction(async (tx) => {
    const res = await tx.update(schema.product).set({ active: args.active }).where(eq(schema.product.id, args.id)).returning({ id: schema.product.id });
    if (res.length === 0) throw new AdminError("NOT_FOUND", "Product not found");
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: args.active ? "product.show" : "product.hide", entity: "product", entityId: args.id });
  });
}

/** Change a price the way history demands: close the open row, open a new one. Past orders keep their own price. */
export async function setPrice(db: Db, args: { saleUnitId: string; pricePaise: number; salePricePaise?: number | null; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "price.write");
  checkPrices(args.pricePaise, args.salePricePaise);
  await db.transaction(async (tx) => {
    const [u] = await tx.select({ id: schema.saleUnit.id }).from(schema.saleUnit).where(eq(schema.saleUnit.id, args.saleUnitId)).for("update").limit(1);
    if (!u) throw new AdminError("NOT_FOUND", "Unit not found");
    const [open] = await tx.select().from(schema.price).where(and(eq(schema.price.saleUnitId, u.id), isNull(schema.price.validTo))).limit(1);
    if (open && open.pricePaise === args.pricePaise && (open.salePricePaise ?? null) === (args.salePricePaise ?? null)) return; // nothing changed
    const now = new Date();
    if (open) await tx.update(schema.price).set({ validTo: now }).where(eq(schema.price.id, open.id));
    await tx.insert(schema.price).values({ saleUnitId: u.id, pricePaise: args.pricePaise, salePricePaise: args.salePricePaise ?? null, validFrom: new Date(now.getTime()), createdBy: args.actor.userId });
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "price.update", entity: "sale_unit", entityId: u.id, before: open ? { pricePaise: open.pricePaise, salePricePaise: open.salePricePaise } : null, after: { pricePaise: args.pricePaise, salePricePaise: args.salePricePaise ?? null } });
  });
}

export interface UnitRules {
  unitBaseQty: number;
  minBase: number;
  maxBase: number;
  stepBase: number;
}

export async function updateSaleUnit(db: Db, args: { id: string; rules: UnitRules; active?: boolean; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "catalog.write");
  checkUnit(args.rules);
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(schema.saleUnit).where(eq(schema.saleUnit.id, args.id)).for("update").limit(1);
    if (!u) throw new AdminError("NOT_FOUND", "Unit not found");
    if (args.active === false && u.isDefault) throw new AdminError("INVALID", "The default unit cannot be switched off. Make another unit the default first.");
    await tx
      .update(schema.saleUnit)
      .set({ ...args.rules, ...(args.active === undefined ? {} : { active: args.active }) })
      .where(eq(schema.saleUnit.id, u.id));
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "sale_unit.update", entity: "sale_unit", entityId: u.id, before: { minBase: u.minBase, maxBase: u.maxBase, stepBase: u.stepBase, unitBaseQty: u.unitBaseQty }, after: args.rules });
  });
}

/** Add another way to buy a product (for example a 500 g pack), with its own price. */
export async function addSaleUnit(db: Db, args: { productId: string; rules: UnitRules; pricePaise: number; salePricePaise?: number | null; actor: StaffActor }): Promise<string> {
  assertCan(args.actor.roles, "catalog.write");
  assertCan(args.actor.roles, "price.write");
  checkUnit(args.rules);
  checkPrices(args.pricePaise, args.salePricePaise);
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ id: schema.product.id }).from(schema.product).where(eq(schema.product.id, args.productId)).limit(1);
    if (!p) throw new AdminError("NOT_FOUND", "Product not found");
    const [u] = await tx.insert(schema.saleUnit).values({ productId: p.id, ...args.rules, isDefault: false }).returning({ id: schema.saleUnit.id });
    await tx.insert(schema.price).values({ saleUnitId: u.id, pricePaise: args.pricePaise, salePricePaise: args.salePricePaise ?? null, createdBy: args.actor.userId });
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "sale_unit.create", entity: "sale_unit", entityId: u.id, after: { ...args.rules, pricePaise: args.pricePaise } });
    return u.id;
  });
}

export async function saveCategory(db: Db, args: { id?: string; name: string; nameHi: string; sortOrder: number; active: boolean; actor: StaffActor }): Promise<string> {
  assertCan(args.actor.roles, "catalog.write");
  if (!args.name.trim() || !args.nameHi.trim()) throw new AdminError("INVALID", "Both names are required");
  return db.transaction(async (tx) => {
    if (args.id) {
      const res = await tx.update(schema.category).set({ name: args.name.trim(), nameHi: args.nameHi.trim(), sortOrder: args.sortOrder, active: args.active }).where(eq(schema.category.id, args.id)).returning({ id: schema.category.id });
      if (res.length === 0) throw new AdminError("NOT_FOUND", "Category not found");
      await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "category.update", entity: "category", entityId: args.id });
      return args.id;
    }
    let slug = slugify(args.name) || "category";
    const [taken] = await tx.select({ id: schema.category.id }).from(schema.category).where(eq(schema.category.slug, slug)).limit(1);
    if (taken) slug = `${slug}-${Date.now().toString(36)}`;
    const [c] = await tx.insert(schema.category).values({ slug, name: args.name.trim(), nameHi: args.nameHi.trim(), sortOrder: args.sortOrder, active: args.active }).returning({ id: schema.category.id });
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "category.create", entity: "category", entityId: c.id });
    return c.id;
  });
}
