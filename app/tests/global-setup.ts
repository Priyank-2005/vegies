import { config } from "dotenv";
import { runMigrations } from "../src/server/db/migrate";

export default async function setup(): Promise<void> {
  config({ override: true });
  const url = process.env.HH_TEST_DATABASE_URL;
  if (!url) throw new Error("HH_TEST_DATABASE_URL is not set (see .env.example)");
  // Safety: tests TRUNCATE every table, so refuse anything that is not clearly a test database.
  if (!/\/[a-z0-9_]*_test(\?|$)/i.test(url)) throw new Error(`Refusing to run tests against non-test database: ${new URL(url).pathname}`);
  await runMigrations(url);
}
