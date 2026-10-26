/**
 * The background worker: sends order messages, releases expired unpaid orders and queues late-order alerts.
 * Run it next to the web app:  npm run worker
 */
import { config } from "dotenv";
import { env } from "../src/lib/env";
import { logger } from "../src/lib/logger";
import { db, pool } from "../src/server/db/client";
import { configuredChannel } from "../src/server/notify/channel";
import { runWorker } from "../src/server/worker/run";

config({ override: true });

async function main() {
  env(); // fail fast on a bad configuration
  const channel = configuredChannel();
  if (!channel) logger.warn("NOTIFY_CHANNEL=disabled: messages will wait in the queue until a channel is configured");
  const stop = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => stop.abort());
  await runWorker(db(), { channel, signal: stop.signal });
  await pool().end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
