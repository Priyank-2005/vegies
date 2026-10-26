"use server";

import { z } from "zod";
import { runAction } from "../admin-action";
import { db } from "../db/client";
import { publishStock, receiveStock, recordWaste, saveSupplier } from "../services/admin/stock";

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const qty = z.number().int().min(0).max(100_000_000);

export async function publishStockAction(input: { serviceDate: string; items: Array<{ productId: string; publishedQty: number }> }) {
  return runAction("stock.adjust", async ({ actor }) => {
    const i = z.object({ serviceDate: date, items: z.array(z.object({ productId: id, publishedQty: qty })).max(500) }).parse(input);
    const changed = await publishStock(db(), { ...i, actor });
    return { data: changed, message: changed === 0 ? "Nothing to change" : `Saved ${changed} product${changed === 1 ? "" : "s"}` };
  });
}

export async function receiveStockAction(input: unknown) {
  return runAction("purchase.write", async ({ actor }) => {
    const i = z
      .object({
        serviceDate: date,
        productId: id,
        supplierId: id.nullable().optional(),
        acceptedBase: qty,
        rejectedBase: qty.optional(),
        costPaise: z.number().int().min(0).max(1_000_000_000),
        grade: z.string().max(40).nullable().optional(),
        rejectionReason: z.string().max(200).nullable().optional(),
        invoiceRef: z.string().max(60).nullable().optional(),
        publish: z.boolean().optional(),
      })
      .parse(input);
    await receiveStock(db(), { input: i, actor });
    return null;
  }, "Stock received");
}

export async function recordWasteAction(input: { serviceDate: string; productId: string; qtyBase: number; reason: string }) {
  return runAction("stock.adjust", async ({ actor }) => {
    const i = z.object({ serviceDate: date, productId: id, qtyBase: qty, reason: z.string().max(200) }).parse(input);
    await recordWaste(db(), { ...i, actor });
    return null;
  }, "Wastage recorded");
}

export async function saveSupplierAction(input: { id?: string; name: string; contactName?: string; phone?: string; address?: string; notes?: string; active?: boolean }) {
  return runAction("supplier.write", async ({ actor }) => {
    const i = z.object({ id: id.optional(), name: z.string().max(120), contactName: z.string().max(120).optional(), phone: z.string().max(30).optional(), address: z.string().max(300).optional(), notes: z.string().max(500).optional(), active: z.boolean().optional() }).parse(input);
    await saveSupplier(db(), { ...i, actor });
    return null;
  }, "Supplier saved");
}
