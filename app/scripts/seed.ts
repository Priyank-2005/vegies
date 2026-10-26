/**
 * Development seed. Safe to re-run. Creates the owner login and the Udaipur area skeleton.
 * It refuses to run against anything that is not a local database.
 * Catalogue, hub and delivery-speed data are real operational data and are entered through the admin panel (Milestone 3).
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { env } from "../src/lib/env";
import { createStaffUser } from "../src/server/auth/staff-auth";
import { db, pool, schema } from "../src/server/db/client";

config({ override: true });

async function main() {
  const url = new URL(env().HH_DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error(`Refusing to seed non-local database host: ${url.hostname}`);

  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD in .env");

  const d = db();
  const existing = await d.select({ id: schema.staffUser.id }).from(schema.staffUser).where(eq(schema.staffUser.email, email)).limit(1);
  if (existing.length === 0) {
    await createStaffUser(d, { email, name: "Owner", password, roles: ["OWNER"] });
    console.log(`Created owner account ${email} (password is the value of SEED_OWNER_PASSWORD in .env)`);
  } else {
    console.log(`Owner ${email} already exists, leaving it unchanged`);
  }

  const [city] = await d.select().from(schema.city).where(eq(schema.city.name, "Udaipur")).limit(1);
  if (!city) {
    await d.insert(schema.city).values({ name: "Udaipur", state: "Rajasthan" });
    console.log("Created city Udaipur");
  }
  await pool().end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
