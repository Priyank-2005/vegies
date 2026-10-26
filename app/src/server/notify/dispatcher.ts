import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { maskPhone, logger } from "@/lib/logger";
import { schema, type Db, type DbOrTx } from "../db/client";
import { ACTIVE_STATUSES, type OrderStatus } from "../domain/order-state";
import { PermanentSendError, type MessageChannel } from "./channel";
import { renderMessage, type MessageContext, type TemplateKey } from "./templates";

/** Which messages an event produces. Events without an entry (for example `order.packed`) are internal and send nothing. */
const TOPIC_TEMPLATES: Record<string, TemplateKey[]> = {
  "order.created": ["ORDER_CONFIRMED"],
  // Written when an online payment is captured (Milestone 4, payment step): a prepaid order is only confirmed to the customer then.
  "order.confirmed": ["ORDER_CONFIRMED"],
  "order.out_for_delivery": ["ORDER_OUT_FOR_DELIVERY"],
  "order.delivered": ["ORDER_DELIVERED"],
  "order.cancelled": ["ORDER_CANCELLED"],
  "order.delivery_failed": ["ORDER_DELIVERY_FAILED"],
  "order.late": ["ORDER_DELAYED"],
};

/** A message only makes sense while the order is in the right state. A confirmation that is overtaken by a cancellation is dropped. */
const VALID_STATES: Record<TemplateKey, readonly OrderStatus[]> = {
  ORDER_CONFIRMED: ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED"],
  ORDER_OUT_FOR_DELIVERY: ["OUT_FOR_DELIVERY"],
  ORDER_DELIVERED: ["DELIVERED"],
  ORDER_CANCELLED: ["CANCELLED"],
  ORDER_DELIVERY_FAILED: ["DELIVERY_FAILED"],
  ORDER_DELAYED: ["CONFIRMED", "PACKING", "ATTENTION", "PACKED", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"],
};

export const MAX_ATTEMPTS = 6;
/** Wait before try 2, 3, 4...: 30 s, 2 min, 10 min, 1 h, 6 h. */
const BACKOFF_SECONDS = [30, 120, 600, 3600, 21_600];
export const backoffSeconds = (attempt: number): number => BACKOFF_SECONDS[Math.min(attempt - 1, BACKOFF_SECONDS.length - 1)];

/** How long a claimed event stays invisible to other workers. If a worker dies mid-send, the event comes back after this. */
const CLAIM_SECONDS = 120;

export interface BatchResult {
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
}

interface Row {
  id: string;
  topic: string;
  payload: unknown;
  attempts: number;
}

async function claim(db: Db, now: Date, limit: number): Promise<Row[]> {
  const res = await db.execute(sql`
    update outbox set available_at = ${new Date(now.getTime() + CLAIM_SECONDS * 1000).toISOString()}
    where id in (
      select id from outbox where processed_at is null and available_at <= ${now.toISOString()}
      order by available_at, created_at limit ${limit} for update skip locked
    )
    returning id, topic, payload, attempts`);
  return (res as unknown as { rows: Row[] }).rows;
}

async function finish(db: DbOrTx, id: string, now: Date, error?: string): Promise<void> {
  await db.update(schema.outbox).set({ processedAt: now, lastError: error ?? null }).where(eq(schema.outbox.id, id));
}

type Outcome = "sent" | "skipped" | "retry" | "failed";

/** Build the message context from the order as it is right now. */
async function loadContext(db: DbOrTx, orderId: string) {
  const [r] = await db
    .select({ o: schema.order, c: schema.customer, opt: schema.deliveryOption })
    .from(schema.order)
    .innerJoin(schema.customer, eq(schema.customer.id, schema.order.customerId))
    .innerJoin(schema.deliveryOption, eq(schema.deliveryOption.code, schema.order.deliveryOption))
    .where(eq(schema.order.id, orderId))
    .limit(1);
  if (!r) return null;
  const [refunds] = await db.select({ n: sql<number>`coalesce(sum(refunded_paise), 0)::int` }).from(schema.orderLine).where(eq(schema.orderLine.orderId, orderId));
  const [paid] = await db.select({ id: schema.payment.id }).from(schema.payment).where(and(eq(schema.payment.orderId, orderId), eq(schema.payment.status, "CAPTURED"))).limit(1);
  let riderFirstName: string | null = null;
  if (r.o.riderId) {
    const [rider] = await db.select({ name: schema.staffUser.name }).from(schema.staffUser).where(eq(schema.staffUser.id, r.o.riderId)).limit(1);
    riderFirstName = rider?.name.split(/\s+/)[0] ?? null;
  }
  const cod = r.o.paymentMode === "PAY_ON_DELIVERY";
  const ctx: MessageContext = {
    orderCode: r.o.publicCode,
    orderUrl: `${env().APP_URL.replace(/\/$/, "")}/my-orders/${r.o.id}`,
    speedName: r.opt.name,
    speedNameHi: r.opt.nameHi,
    promisedAt: r.o.promisedAt,
    amountDuePaise: cod ? Math.max(0, r.o.totalPaise - (refunds?.n ?? 0)) : 0,
    totalPaise: r.o.totalPaise,
    cashOnDelivery: cod,
    riderFirstName,
    handoverCode: r.o.handoverCode,
    paidOnline: !!paid,
    supportPhone: env().NEXT_PUBLIC_SUPPORT_PHONE ?? null,
  };
  return { order: r.o, customer: r.c, ctx };
}

async function hasConsent(db: DbOrTx, phone: string, channel: "WHATSAPP" | "SMS"): Promise<boolean> {
  const [latest] = await db
    .select({ granted: schema.consent.granted })
    .from(schema.consent)
    .where(and(eq(schema.consent.phone, phone), eq(schema.consent.channel, channel), eq(schema.consent.purpose, "TRANSACTIONAL")))
    .orderBy(sql`${schema.consent.createdAt} desc`)
    .limit(1);
  return latest?.granted === true;
}

async function sendOne(db: Db, channel: MessageChannel, orderId: string, template: TemplateKey, attempt: number, now: Date): Promise<Outcome> {
  const data = await loadContext(db, orderId);
  if (!data) return "skipped";
  const { order, customer, ctx } = data;

  // A message that no longer applies (the order was cancelled meanwhile, or a prepaid order is still unpaid) leaves no trace,
  // so the same message can still be sent later when it does apply.
  if (!VALID_STATES[template].includes(order.status)) return "skipped";

  // The row is the "already sent" memory: created once per order, template and channel.
  await db
    .insert(schema.notification)
    .values({ orderId, customerId: customer.id, channel: channel.name, template, toMasked: maskPhone(customer.phone) })
    .onConflictDoNothing();
  const [n] = await db
    .select()
    .from(schema.notification)
    .where(and(eq(schema.notification.orderId, orderId), eq(schema.notification.template, template), eq(schema.notification.channel, channel.name)))
    .limit(1);
  if (n.status === "SENT" || n.status === "SKIPPED" || n.status === "FAILED") return n.status === "SENT" ? "sent" : n.status === "FAILED" ? "failed" : "skipped";

  const skip = async (why: string): Promise<Outcome> => {
    await db.update(schema.notification).set({ status: "SKIPPED", error: why }).where(eq(schema.notification.id, n.id));
    return "skipped";
  };
  if (customer.blocked) return skip("customer is blocked");
  if (!(await hasConsent(db, customer.phone, channel.consentChannel))) return skip("no consent to transactional messages on this channel");

  const msg = renderMessage(template, ctx);
  try {
    const res = await channel.send({ to: customer.phone, template, text: msg.text, vars: msg.vars });
    await db
      .update(schema.notification)
      .set({ status: "SENT", providerMessageId: res.providerMessageId, sentAt: now, attempts: attempt, error: null, body: channel.keepsBody ? msg.text : null })
      .where(eq(schema.notification.id, n.id));
    return "sent";
  } catch (e) {
    const permanent = e instanceof PermanentSendError || attempt >= MAX_ATTEMPTS;
    const reason = (e instanceof Error ? e.message : "send failed").slice(0, 300);
    await db
      .update(schema.notification)
      .set({ status: permanent ? "FAILED" : "QUEUED", error: reason, attempts: attempt })
      .where(eq(schema.notification.id, n.id));
    logger.warn({ template, orderId, attempt, permanent, reason }, "message send failed");
    return permanent ? "failed" : "retry";
  }
}

/**
 * Work through due events: for each one, send the messages it calls for. Safe to run in several workers at once
 * (events are claimed with SKIP LOCKED) and safe to run twice (each message is recorded once per order).
 * A temporary failure is retried with growing waits; after MAX_ATTEMPTS, or on a permanent failure, the message is
 * marked FAILED so staff can see it on the order and phone the customer.
 */
export async function processOutbox(db: Db, args: { channel: MessageChannel; now?: Date; limit?: number }): Promise<BatchResult> {
  const now = args.now ?? new Date();
  const result: BatchResult = { claimed: 0, sent: 0, skipped: 0, retried: 0, failed: 0 };
  const rows = await claim(db, now, args.limit ?? 25);
  result.claimed = rows.length;
  for (const row of rows) {
    const templates = TOPIC_TEMPLATES[row.topic];
    const orderId = (row.payload as { orderId?: string } | null)?.orderId;
    if (!templates || !orderId) {
      await finish(db, row.id, now); // an internal event: nothing to send
      continue;
    }
    const attempt = row.attempts + 1;
    let retry = false;
    let error: string | undefined;
    for (const t of templates) {
      const o = await sendOne(db, args.channel, orderId, t, attempt, now);
      result[o === "retry" ? "retried" : o === "sent" ? "sent" : o === "skipped" ? "skipped" : "failed"]++;
      if (o === "retry") retry = true;
      if (o === "failed") error = "send failed permanently";
    }
    if (retry) {
      await db
        .update(schema.outbox)
        .set({ attempts: attempt, availableAt: new Date(now.getTime() + backoffSeconds(attempt) * 1000), lastError: "temporary failure, will retry" })
        .where(eq(schema.outbox.id, row.id));
    } else {
      await db.update(schema.outbox).set({ attempts: attempt }).where(eq(schema.outbox.id, row.id));
      await finish(db, row.id, now, error);
    }
  }
  return result;
}

/**
 * Orders that are past their promised time by more than `graceMinutes` and have not been told yet get one "running late"
 * message. It is queued as an outbox event so it goes through the same consent, retry and once-only rules.
 */
export async function queueLateOrderAlerts(db: Db, args: { now?: Date; graceMinutes?: number } = {}): Promise<number> {
  const now = args.now ?? new Date();
  const cutoff = new Date(now.getTime() - (args.graceMinutes ?? 5) * 60_000);
  const late = await db
    .select({ id: schema.order.id })
    .from(schema.order)
    .where(
      and(
        inArray(schema.order.status, ACTIVE_STATUSES.filter((s) => s !== "PENDING_PAYMENT")),
        sql`${schema.order.promisedAt} < ${cutoff.toISOString()}`,
        sql`not exists (select 1 from notification n where n.order_id = ${schema.order.id} and n.template = 'ORDER_DELAYED')`,
        sql`not exists (select 1 from outbox o where o.topic = 'order.late' and o.payload->>'orderId' = ${schema.order.id}::text)`,
      ),
    )
    .orderBy(asc(schema.order.promisedAt))
    .limit(200);
  for (const o of late) await db.insert(schema.outbox).values({ topic: "order.late", payload: { orderId: o.id } });
  return late.length;
}

export interface MessageHealth {
  waiting: number;
  failed: number;
}

/** For the Today screen: messages stuck in the queue and messages that failed for good. */
export async function messageHealth(db: DbOrTx): Promise<MessageHealth> {
  const [w] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.outbox).where(sql`${schema.outbox.processedAt} is null and ${schema.outbox.attempts} > 0`);
  const [f] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.notification).where(and(eq(schema.notification.status, "FAILED"), sql`${schema.notification.createdAt} > now() - interval '3 days'`));
  return { waiting: w?.n ?? 0, failed: f?.n ?? 0 };
}
