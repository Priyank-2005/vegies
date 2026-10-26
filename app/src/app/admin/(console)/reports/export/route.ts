import { currentStaff } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { AdminError } from "@/server/services/admin/common";
import { ordersCsv } from "@/server/services/admin/reports";

export const dynamic = "force-dynamic";

/** Orders placed in a date range as a CSV file. Same permission as the report screen. */
export async function GET(req: Request) {
  const ctx = await currentStaff();
  if (!ctx) return new Response("Sign in required", { status: 401 });
  if (!can(ctx.user.roles, "report.read")) return new Response("Not allowed", { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  try {
    const csv = await ordersCsv(db(), { range: { from, to }, actor: { userId: ctx.user.id, roles: ctx.user.roles } });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${from}-to-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AdminError) return new Response(e.message, { status: 400 });
    throw e;
  }
}
