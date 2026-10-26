import { config } from "dotenv";

// override: a machine-wide variable must never win over this project's .env
config({ override: true });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.HH_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
