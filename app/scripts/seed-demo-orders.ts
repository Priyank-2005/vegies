/**
 * Development helper: demo staff (manager, packer, rider) and a few sample orders in different stages, so the admin
 * screens have something to show. Local databases only. Safe to re-run (it adds more orders each time).
 *   npm run db:seed:orders
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { env } from "../src/lib/env";
import { createStaffUser } from "../src/server/auth/staff-auth";
import { db, pool, schema } from "../src/server/db/client";
import { startPacking } from "../src/server/services/admin/orders";
import { finishPacking, recordPackedLine } from "../src/server/services/admin/packing";
import { assignRider } from "../src/server/services/delivery-ops";
import { createOrder } from "../src/server/services/orders";
import { istDate } from "../src/server/services/delivery";
import { randomToken } from "../src/lib/ids";

config({ override: true });

const PASSWORD = "demo-password-1234";

async function ensureStaff(email: string, name: string, roles: Array<"OWNER" | "OPS_MANAGER" | "PACKER" | "RIDER">) {
  const [u] = await db().select().from(schema.staffUser).where(eq(schema.staffUser.email, email)).limit(1);
  if (u) return u.id;
  return createStaffUser(db(), { email, name, password: PASSWORD, roles });
}

async function main() {
  const url = new URL(env().HH_DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error(`Refusing to run against non-local database host: ${url.hostname}`);
  const d = db();
  await ensureStaff("owner-demo@example.test", "Omkar Owner", ["OWNER"]);
  const ops = await ensureStaff("manager@example.test", "Meera Manager", ["OPS_MANAGER"]);
  const packer = await ensureStaff("packer@example.test", "Pooja Packer", ["PACKER"]);
  const rider = await ensureStaff("rider@example.test", "Ravi Rider", ["RIDER"]);
  const actor = (userId: string, roles: ("OPS_MANAGER" | "PACKER" | "RIDER")[]) => ({ userId, roles });

  const [hub] = await d.select().from(schema.hub).limit(1);
  if (!hub) throw new Error("Run npm run db:seed:demo first (it creates the hub and the catalogue)");
  const serviceDate = istDate(new Date());
  const units = await d
    .select({ id: schema.saleUnit.id, productId: schema.saleUnit.productId, minBase: schema.saleUnit.minBase, name: schema.product.name })
    .from(schema.saleUnit)
    .innerJoin(schema.product, eq(schema.product.id, schema.saleUnit.productId))
    .where(eq(schema.saleUnit.isDefault, true))
    .limit(12);
  // make sure there is stock to sell today
  for (const u of units) await d.insert(schema.stockDay).values({ productId: u.productId, serviceDate, publishedQty: 30_000 }).onConflictDoNothing();

  const phone = `+9199${String(Date.now()).slice(-8)}`;
  const [customer] = await d.insert(schema.customer).values({ phone, name: "Asha Sharma", phoneVerifiedAt: new Date() }).returning();

  const make = async (option: string, picks: number[], qty: number[]) =>
    createOrder(d, {
      customerId: customer.id,
      customerName: "Asha Sharma",
      idempotencyKey: randomToken(16),
      deliveryOption: option,
      address: { line: "12 Lake View Apartments, Fatehpura", landmark: "Near the temple", lat: 24.5904, lng: 73.7125 },
      paymentMode: "PAY_ON_DELIVERY",
      items: picks.map((p, i) => ({ saleUnitId: units[p % units.length].id, qtyBase: qty[i] })),
      transactionalConsent: true,
    });

  const a = await make("INSTANT", [0, 1], [1000, 500]);
  const b = await make("ONE_HOUR", [2], [1500]);
  const c = await make("THREE_HOUR", [3, 4, 5], [500, 1000, 250]);
  const e = await make("ONE_HOUR", [6], [2000]);

  // b: packed and waiting for a rider; c: packed and assigned to the rider; e: being packed
  for (const [o, assign] of [[b, false], [c, true], [e, null]] as const) {
    await startPacking(d, { orderId: o.orderId, actor: actor(packer, ["PACKER"]) });
    if (assign === null) continue;
    const lines = await d.select().from(schema.orderLine).where(eq(schema.orderLine.orderId, o.orderId));
    for (const l of lines) await recordPackedLine(d, { orderId: o.orderId, lineId: l.id, packedBase: l.qtyOrderedBase, actor: actor(packer, ["PACKER"]) });
    await finishPacking(d, { orderId: o.orderId, actor: actor(packer, ["PACKER"]) });
    if (assign) await assignRider(d, { orderId: o.orderId, riderId: rider, actor: actor(ops, ["OPS_MANAGER"]) });
  }
  console.log(`Created orders ${[a, b, c, e].map((o) => o.publicCode).join(", ")}`);
  console.log(`Demo staff (password ${PASSWORD}): owner-demo@example.test, manager@example.test, packer@example.test, rider@example.test`);
  await pool().end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
