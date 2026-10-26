import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { throttle, route } from "@/server/http";
import { queryProducts } from "@/server/services/catalog";

const query = z.object({
  q: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  sort: z.enum(["popular", "price_asc", "price_desc", "name"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(5000).optional(),
});

export const GET = route(async (req) => {
  await throttle(req, "catalog", 240, 60);
  const p = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const products = await queryProducts(db(), { serviceDate: p.date ?? null, q: p.q, categorySlug: p.category, sort: p.sort, limit: p.limit, offset: p.offset });
  return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
});
