import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { route, throttle } from "@/server/http";
import { listCategories } from "@/server/services/catalog";

export const GET = route(async (req) => {
  await throttle(req, "catalog", 240, 60);
  return NextResponse.json({ categories: await listCategories(db()) }, { headers: { "Cache-Control": "no-store" } });
});
