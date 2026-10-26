import { logger } from "@/lib/logger";
import type { Db } from "../db/client";
import type { MessageChannel } from "../notify/channel";
import { processOutbox, queueLateOrderAlerts, type BatchResult } from "../notify/dispatcher";
import { expirePendingOrders } from "../services/orders";

export interface TickSummary {
  expired: number;
  lateQueued: number;
  messages: BatchResult;
}

const EMPTY: BatchResult = { claimed: 0, sent: 0, skipped: 0, retried: 0, failed: 0 };

/**
 * One pass of the background jobs: release unpaid orders whose hold ran out, queue "running late" messages,
 * then send everything that is due. With no channel configured the messages stay queued (nothing is lost).
 */
export async function tick(db: Db, args: { channel: MessageChannel | null; now?: Date }): Promise<TickSummary> {
  const now = args.now ?? new Date();
  const expired = await expirePendingOrders(db, now);
  const lateQueued = await queueLateOrderAlerts(db, { now });
  const messages: BatchResult = { ...EMPTY };
  if (args.channel) {
    // Keep going while batches come back full, but never loop forever inside one tick.
    for (let i = 0; i < 20; i++) {
      const r = await processOutbox(db, { channel: args.channel, now, limit: 25 });
      for (const k of Object.keys(messages) as Array<keyof BatchResult>) messages[k] += r[k];
      if (r.claimed < 25) break;
    }
  }
  return { expired, lateQueued, messages };
}

/** Run ticks until the signal aborts. A failing tick is logged and tried again on the next beat; the worker never dies from it. */
export async function runWorker(db: Db, args: { channel: MessageChannel | null; intervalMs?: number; signal: AbortSignal }): Promise<void> {
  const interval = args.intervalMs ?? 5000;
  logger.info({ channel: args.channel?.name ?? "none", intervalMs: interval }, "worker started");
  while (!args.signal.aborted) {
    try {
      const t = await tick(db, { channel: args.channel });
      if (t.expired || t.lateQueued || t.messages.claimed) logger.info(t, "worker tick");
    } catch (err) {
      logger.error({ err }, "worker tick failed");
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, interval);
      args.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
  logger.info("worker stopped");
}
