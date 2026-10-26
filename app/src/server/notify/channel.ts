import { env } from "@/lib/env";

/** How a message physically reaches a phone. The WhatsApp and SMS providers (later steps) implement this. */
export interface OutgoingMessage {
  /** E.164 phone number. */
  to: string;
  template: string;
  text: string;
  vars: string[];
}

export interface SendResult {
  providerMessageId: string | null;
}

/** The provider said no and trying again will not help (number not on WhatsApp, template rejected, blocked). */
export class PermanentSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentSendError";
  }
}

/** Anything else (timeout, provider outage, rate limit) is assumed temporary and retried later. */
export interface MessageChannel {
  /** Stored on the notification row; also decides which consent applies. */
  readonly name: "WHATSAPP" | "SMS" | "FAKE";
  /** The consent channel a customer must have agreed to. */
  readonly consentChannel: "WHATSAPP" | "SMS";
  /** Keep the text on the notification row (only for the test channel: real texts can hold the delivery code). */
  readonly keepsBody: boolean;
  send(msg: OutgoingMessage): Promise<SendResult>;
}

/** Messages sent through the fake channel in this process, newest last. Tests and local development read it. */
const sentLog: OutgoingMessage[] = [];
export const fakeSent = (): readonly OutgoingMessage[] => sentLog;
export const clearFakeSent = (): void => {
  sentLog.length = 0;
};

let fakeSeq = 0;

/** Pretends to send: records the text so it can be read. No network, no cost, no real person is contacted. */
export const fakeChannel: MessageChannel = {
  name: "FAKE",
  consentChannel: "WHATSAPP",
  keepsBody: true,
  async send(msg) {
    if (env().NODE_ENV === "production") throw new PermanentSendError("the fake message channel must not run in production");
    sentLog.push(msg);
    return { providerMessageId: `fake-${++fakeSeq}` };
  },
};

/** The channel the worker uses, chosen by NOTIFY_CHANNEL. Null means "do not send" (messages wait in the queue). */
export function configuredChannel(): MessageChannel | null {
  return env().NOTIFY_CHANNEL === "fake" ? fakeChannel : null;
}
