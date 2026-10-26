import { and, asc, desc, eq, sql } from "drizzle-orm";
import { audit } from "../../audit";
import { assertCan } from "../../auth/permissions";
import { schema, type Db, type DbOrTx } from "../../db/client";
import { ReservationStateError, setPublishedQty } from "../../domain/inventory";
import { AdminError, assertDate, type StaffActor } from "./common";

export interface StockRow {
  productId: string;
  name: string;
  nameHi: string;
  categoryName: string;
  baseUnit: "GRAM" | "PIECE";
  active: boolean;
  publishedQty: number;
  reservedQty: number;
  receivedQty: number;
  packedQty: number;
  wastedQty: number;
}

/** Every product's stock position for one service date (products with no row yet show zeros). */
export async function getStockOverview(db: DbOrTx, serviceDate: string): Promise<StockRow[]> {
  assertDate(serviceDate, "date");
  const rows = await db
    .select({
      productId: schema.product.id,
      name: schema.product.name,
      nameHi: schema.product.nameHi,
      categoryName: schema.category.name,
      baseUnit: schema.product.baseUnit,
      active: schema.product.active,
      publishedQty: sql<number>`coalesce(${schema.stockDay.publishedQty}, 0)::int`,
      reservedQty: sql<number>`coalesce(${schema.stockDay.reservedQty}, 0)::int`,
      receivedQty: sql<number>`coalesce(${schema.stockDay.receivedQty}, 0)::int`,
      packedQty: sql<number>`coalesce(${schema.stockDay.packedQty}, 0)::int`,
      wastedQty: sql<number>`coalesce(${schema.stockDay.wastedQty}, 0)::int`,
    })
    .from(schema.product)
    .innerJoin(schema.category, eq(schema.category.id, schema.product.categoryId))
    .leftJoin(schema.stockDay, and(eq(schema.stockDay.productId, schema.product.id), eq(schema.stockDay.serviceDate, serviceDate)))
    .where(eq(schema.product.active, true))
    .orderBy(asc(schema.category.sortOrder), asc(schema.product.name));
  return rows;
}

/**
 * Set how much of each product customers may order for a date. All or nothing: if any product would go below what
 * is already reserved, nothing is saved and the message names that product.
 */
export async function publishStock(db: Db, args: { serviceDate: string; items: Array<{ productId: string; publishedQty: number }>; actor: StaffActor }): Promise<number> {
  assertCan(args.actor.roles, "stock.adjust");
  assertDate(args.serviceDate);
  return db.transaction(async (tx) => {
    let changed = 0;
    for (const it of args.items) {
      const [cur] = await tx.select({ published: schema.stockDay.publishedQty }).from(schema.stockDay).where(and(eq(schema.stockDay.productId, it.productId), eq(schema.stockDay.serviceDate, args.serviceDate))).limit(1);
      if ((cur?.published ?? 0) === it.publishedQty) continue;
      try {
        await setPublishedQty(tx, { productId: it.productId, serviceDate: args.serviceDate, publishedQty: it.publishedQty, actorId: args.actor.userId });
      } catch (e) {
        if (e instanceof ReservationStateError || e instanceof RangeError) {
          const [p] = await tx.select({ name: schema.product.name }).from(schema.product).where(eq(schema.product.id, it.productId)).limit(1);
          throw new AdminError("CONFLICT", `${p?.name ?? "A product"}: ${e.message}`);
        }
        throw e;
      }
      changed++;
    }
    if (changed > 0) await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "stock.publish", entity: "stock_day", entityId: args.serviceDate, after: { products: changed } });
    return changed;
  });
}

export interface ReceiveInput {
  serviceDate: string;
  productId: string;
  supplierId?: string | null;
  acceptedBase: number;
  rejectedBase?: number;
  costPaise: number;
  grade?: string | null;
  rejectionReason?: string | null;
  invoiceRef?: string | null;
  /** Also add the accepted quantity to what customers can order. */
  publish?: boolean;
}

/** Record goods received from a supplier: a purchase, its stock lot, and the ledger. Optionally publishes the accepted quantity. */
export async function receiveStock(db: Db, args: { input: ReceiveInput; actor: StaffActor }): Promise<{ purchaseId: string }> {
  assertCan(args.actor.roles, "purchase.write");
  const i = args.input;
  assertDate(i.serviceDate);
  const rejected = i.rejectedBase ?? 0;
  if (![i.acceptedBase, rejected, i.costPaise].every(Number.isSafeInteger) || i.acceptedBase < 0 || rejected < 0 || i.costPaise < 0) throw new AdminError("INVALID", "Quantities and cost must be whole, non-negative numbers");
  if (i.acceptedBase + rejected <= 0) throw new AdminError("INVALID", "Enter how much was received");
  if (rejected > 0 && !i.rejectionReason?.trim()) throw new AdminError("INVALID", "Say why part of the delivery was rejected");
  if (i.publish) assertCan(args.actor.roles, "stock.adjust");

  return db.transaction(async (tx) => {
    const [p] = await tx.select({ id: schema.product.id, name: schema.product.name }).from(schema.product).where(eq(schema.product.id, i.productId)).limit(1);
    if (!p) throw new AdminError("NOT_FOUND", "Product not found");
    if (i.supplierId) {
      const [s] = await tx.select({ id: schema.supplier.id }).from(schema.supplier).where(eq(schema.supplier.id, i.supplierId)).limit(1);
      if (!s) throw new AdminError("NOT_FOUND", "Supplier not found");
    }
    const [purchase] = await tx
      .insert(schema.purchase)
      .values({ supplierId: i.supplierId ?? (await ensureWalkInSupplier(tx)), purchaseDate: i.serviceDate, invoiceRef: i.invoiceRef?.trim() || null, totalPaise: i.costPaise, paidPaise: 0, createdBy: args.actor.userId })
      .returning({ id: schema.purchase.id });
    const [line] = await tx
      .insert(schema.purchaseLine)
      .values({ purchaseId: purchase.id, productId: p.id, qtyReceivedBase: i.acceptedBase + rejected, qtyAcceptedBase: i.acceptedBase, qtyRejectedBase: rejected, costPaise: i.costPaise, grade: i.grade?.trim() || null, rejectionReason: i.rejectionReason?.trim() || null })
      .returning({ id: schema.purchaseLine.id });
    await tx.insert(schema.stockDay).values({ productId: p.id, serviceDate: i.serviceDate, publishedQty: 0 }).onConflictDoNothing();
    if (i.acceptedBase > 0) {
      const [lot] = await tx.insert(schema.stockLot).values({ productId: p.id, purchaseLineId: line.id, serviceDate: i.serviceDate, qtyBase: i.acceptedBase, costPaise: i.costPaise, grade: i.grade?.trim() || null }).returning({ id: schema.stockLot.id });
      await tx.update(schema.stockDay).set({ receivedQty: sql`${schema.stockDay.receivedQty} + ${i.acceptedBase}` }).where(and(eq(schema.stockDay.productId, p.id), eq(schema.stockDay.serviceDate, i.serviceDate)));
      await tx.insert(schema.stockMovement).values({ productId: p.id, serviceDate: i.serviceDate, lotId: lot.id, type: "RECEIVED", qtyBase: i.acceptedBase, refType: "purchase_line", refId: line.id, actorId: args.actor.userId });
    }
    if (rejected > 0) {
      await tx.insert(schema.stockMovement).values({ productId: p.id, serviceDate: i.serviceDate, type: "REJECTED", qtyBase: rejected, refType: "purchase_line", refId: line.id, reason: i.rejectionReason?.trim(), actorId: args.actor.userId });
    }
    if (i.publish && i.acceptedBase > 0) {
      const [cur] = await tx.select({ published: schema.stockDay.publishedQty }).from(schema.stockDay).where(and(eq(schema.stockDay.productId, p.id), eq(schema.stockDay.serviceDate, i.serviceDate))).limit(1);
      await setPublishedQty(tx, { productId: p.id, serviceDate: i.serviceDate, publishedQty: (cur?.published ?? 0) + i.acceptedBase, actorId: args.actor.userId });
    }
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "purchase.receive", entity: "purchase", entityId: purchase.id, after: { product: p.name, accepted: i.acceptedBase, rejected, costPaise: i.costPaise } });
    return { purchaseId: purchase.id };
  });
}

async function ensureWalkInSupplier(tx: DbOrTx): Promise<string> {
  const [s] = await tx.select({ id: schema.supplier.id }).from(schema.supplier).where(eq(schema.supplier.name, "Market purchase (no named supplier)")).limit(1);
  if (s) return s.id;
  const [n] = await tx.insert(schema.supplier).values({ name: "Market purchase (no named supplier)" }).returning({ id: schema.supplier.id });
  return n.id;
}

/** Throw away stock (spoiled, damaged). It is taken out of what customers can order and recorded as wastage. */
export async function recordWaste(db: Db, args: { serviceDate: string; productId: string; qtyBase: number; reason: string; actor: StaffActor }): Promise<void> {
  assertCan(args.actor.roles, "stock.adjust");
  assertDate(args.serviceDate);
  if (!Number.isSafeInteger(args.qtyBase) || args.qtyBase <= 0) throw new AdminError("INVALID", "Enter how much was thrown away");
  if (!args.reason.trim()) throw new AdminError("INVALID", "Say why (spoiled, damaged, other)");
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.stockDay).where(and(eq(schema.stockDay.productId, args.productId), eq(schema.stockDay.serviceDate, args.serviceDate))).for("update").limit(1);
    if (!row) throw new AdminError("INVALID", "There is no stock recorded for that product on that date");
    const unreserved = row.publishedQty - row.reservedQty;
    if (args.qtyBase > unreserved) throw new AdminError("CONFLICT", `Only ${unreserved} is not already promised to customers. Resolve those orders first.`);
    await setPublishedQty(tx, { productId: args.productId, serviceDate: args.serviceDate, publishedQty: row.publishedQty - args.qtyBase, actorId: args.actor.userId });
    await tx.update(schema.stockDay).set({ wastedQty: sql`${schema.stockDay.wastedQty} + ${args.qtyBase}` }).where(and(eq(schema.stockDay.productId, args.productId), eq(schema.stockDay.serviceDate, args.serviceDate)));
    await tx.insert(schema.stockMovement).values({ productId: args.productId, serviceDate: args.serviceDate, type: "WASTED", qtyBase: args.qtyBase, refType: "stock_day", reason: args.reason.trim(), actorId: args.actor.userId });
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "stock.waste", entity: "product", entityId: args.productId, after: { qtyBase: args.qtyBase, reason: args.reason.trim() } });
  });
}

export async function listSuppliers(db: DbOrTx) {
  return db.select().from(schema.supplier).orderBy(desc(schema.supplier.active), asc(schema.supplier.name));
}

export async function saveSupplier(db: Db, args: { id?: string; name: string; contactName?: string; phone?: string; address?: string; notes?: string; active?: boolean; actor: StaffActor }): Promise<string> {
  assertCan(args.actor.roles, "supplier.write");
  if (!args.name.trim()) throw new AdminError("INVALID", "A supplier name is required");
  const values = { name: args.name.trim(), contactName: args.contactName?.trim() || null, phone: args.phone?.trim() || null, address: args.address?.trim() || null, notes: args.notes?.trim() || null, active: args.active ?? true };
  return db.transaction(async (tx) => {
    if (args.id) {
      const res = await tx.update(schema.supplier).set(values).where(eq(schema.supplier.id, args.id)).returning({ id: schema.supplier.id });
      if (res.length === 0) throw new AdminError("NOT_FOUND", "Supplier not found");
      await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "supplier.update", entity: "supplier", entityId: args.id });
      return args.id;
    }
    const [s] = await tx.insert(schema.supplier).values(values).returning({ id: schema.supplier.id });
    await audit(tx, { actorType: "staff", actorId: args.actor.userId, action: "supplier.create", entity: "supplier", entityId: s.id });
    return s.id;
  });
}

export async function listRecentPurchases(db: DbOrTx, limit = 25) {
  return db
    .select({
      id: schema.purchase.id,
      purchaseDate: schema.purchase.purchaseDate,
      supplier: schema.supplier.name,
      product: schema.product.name,
      accepted: schema.purchaseLine.qtyAcceptedBase,
      rejected: schema.purchaseLine.qtyRejectedBase,
      costPaise: schema.purchaseLine.costPaise,
      baseUnit: schema.product.baseUnit,
      createdAt: schema.purchase.createdAt,
    })
    .from(schema.purchaseLine)
    .innerJoin(schema.purchase, eq(schema.purchase.id, schema.purchaseLine.purchaseId))
    .innerJoin(schema.supplier, eq(schema.supplier.id, schema.purchase.supplierId))
    .innerJoin(schema.product, eq(schema.product.id, schema.purchaseLine.productId))
    .orderBy(desc(schema.purchase.createdAt))
    .limit(limit);
}
