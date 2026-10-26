import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle has the same query API as the database. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

declare global {
  var __hhPool: Pool | undefined;
}

function makePool(): Pool {
  const url = process.env.HH_DATABASE_URL;
  if (!url) throw new Error("HH_DATABASE_URL is not set");
  return new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, application_name: "harihaat" });
}

/** One pool per process (survives Next.js dev hot reloads). */
export function pool(): Pool {
  if (!globalThis.__hhPool) globalThis.__hhPool = makePool();
  return globalThis.__hhPool;
}

let _db: Db | undefined;
export function db(): Db {
  if (!_db) _db = drizzle(pool(), { schema });
  return _db;
}

export { schema };
