"use server";

import { z } from "zod";
import { runAction } from "../admin-action";
import { db } from "../db/client";
import { addSaleUnit, createProduct, saveCategory, setPrice, setProductActive, updateProduct, updateSaleUnit } from "../services/admin/catalog";

const id = z.string().uuid();
const pricePaise = z.number().int().positive().max(100_000_000);
const rules = z.object({ unitBaseQty: z.number().int().positive().max(1_000_000), minBase: z.number().int().positive().max(10_000_000), maxBase: z.number().int().positive().max(10_000_000), stepBase: z.number().int().positive().max(10_000_000) });
const product = z.object({
  name: z.string().max(120),
  nameHi: z.string().max(120),
  categoryId: id,
  aliases: z.array(z.string().max(60)).max(20).optional(),
  descriptionEn: z.string().max(600).nullable().optional(),
  storageNote: z.string().max(300).nullable().optional(),
  weightModel: z.enum(["FIXED_PACK", "APPROX_PIECE", "LOOSE_WEIGHT"]),
  baseUnit: z.enum(["GRAM", "PIECE"]),
  tolerancePct: z.number().int().min(0).max(50),
  seasonStartMonth: z.number().int().min(1).max(12).nullable().optional(),
  seasonEndMonth: z.number().int().min(1).max(12).nullable().optional(),
});

export async function createProductAction(input: unknown) {
  return runAction("catalog.write", async ({ actor }) => {
    const i = product.extend({ unit: rules, pricePaise, salePricePaise: pricePaise.nullable().optional() }).parse(input);
    return createProduct(db(), { input: i, actor });
  }, "Product created");
}

export async function updateProductAction(input: unknown) {
  return runAction("catalog.write", async ({ actor }) => {
    const i = z.object({ id, input: product }).parse(input);
    await updateProduct(db(), { id: i.id, input: i.input, actor });
    return null;
  }, "Product saved");
}

export async function setProductActiveAction(input: { id: string; active: boolean }) {
  return runAction("catalog.write", async ({ actor }) => {
    const i = z.object({ id, active: z.boolean() }).parse(input);
    await setProductActive(db(), { ...i, actor });
    return null;
  }, input.active ? "Shown in the shop" : "Hidden from the shop");
}

export async function setPriceAction(input: { saleUnitId: string; pricePaise: number; salePricePaise?: number | null }) {
  return runAction("price.write", async ({ actor }) => {
    const i = z.object({ saleUnitId: id, pricePaise, salePricePaise: pricePaise.nullable().optional() }).parse(input);
    await setPrice(db(), { ...i, actor });
    return null;
  }, "Price saved");
}

export async function updateUnitAction(input: { id: string; rules: unknown; active?: boolean }) {
  return runAction("catalog.write", async ({ actor }) => {
    const i = z.object({ id, rules, active: z.boolean().optional() }).parse(input);
    await updateSaleUnit(db(), { ...i, actor });
    return null;
  }, "Unit saved");
}

export async function addUnitAction(input: { productId: string; rules: unknown; pricePaise: number; salePricePaise?: number | null }) {
  return runAction("catalog.write", async ({ actor }) => {
    const i = z.object({ productId: id, rules, pricePaise, salePricePaise: pricePaise.nullable().optional() }).parse(input);
    await addSaleUnit(db(), { ...i, actor });
    return null;
  }, "Unit added");
}

export async function saveCategoryAction(input: { id?: string; name: string; nameHi: string; sortOrder: number; active: boolean }) {
  return runAction("catalog.write", async ({ actor }) => {
    const i = z.object({ id: id.optional(), name: z.string().max(80), nameHi: z.string().max(80), sortOrder: z.number().int().min(0).max(1000), active: z.boolean() }).parse(input);
    await saveCategory(db(), { ...i, actor });
    return null;
  }, "Category saved");
}
