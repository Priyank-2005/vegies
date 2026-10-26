import { config } from "dotenv";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// override: a machine-wide variable must never win over this project's .env
config({ override: true });

/** Apply all pending SQL migrations in ./drizzle. Usage: tsx src/server/db/migrate.ts [databaseUrl] */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && /migrate\.ts$/.test(process.argv[1])) {
  const url = process.argv[2] ?? process.env.HH_DATABASE_URL;
  if (!url) throw new Error("HH_DATABASE_URL is not set");
  runMigrations(url)
    .then(() => console.log("migrations applied"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
