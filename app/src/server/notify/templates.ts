import { BRAND } from "@/lib/brand";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";

/**
 * Customer messages. Each is written once in English and once in Hindi and sent as one bilingual text, because we
 * do not know which language a customer prefers. Real WhatsApp templates (Milestone 4, later step) are approved in
 * advance by Meta, so every message is a fixed sentence with a few named values: `vars` lists them in order.
 */
export type TemplateKey = "ORDER_CONFIRMED" | "ORDER_OUT_FOR_DELIVERY" | "ORDER_DELIVERED" | "ORDER_CANCELLED" | "ORDER_DELIVERY_FAILED" | "ORDER_DELAYED";

export const TEMPLATE_KEYS: readonly TemplateKey[] = ["ORDER_CONFIRMED", "ORDER_OUT_FOR_DELIVERY", "ORDER_DELIVERED", "ORDER_CANCELLED", "ORDER_DELIVERY_FAILED", "ORDER_DELAYED"];

/** Everything a template may use. Built from the order at send time, so a message always says what is true now. */
export interface MessageContext {
  orderCode: string;
  orderUrl: string;
  speedName: string;
  speedNameHi: string | null;
  promisedAt: Date;
  /** What the customer owes at the door, 0 for prepaid orders. */
  amountDuePaise: number;
  totalPaise: number;
  cashOnDelivery: boolean;
  riderFirstName: string | null;
  handoverCode: string;
  paidOnline: boolean;
  supportPhone: string | null;
}

export interface RenderedMessage {
  template: TemplateKey;
  /** The full text, English first, then Hindi. */
  text: string;
  /** Named values in the order a provider template expects them. */
  vars: string[];
}

const B = BRAND.name;
const BH = BRAND.nameHi;

function bilingual(en: string, hi: string): string {
  return `${en}\n\n${hi}`;
}

export function renderMessage(key: TemplateKey, c: MessageContext): RenderedMessage {
  const time = formatTime(c.promisedAt);
  const speedHi = c.speedNameHi ?? c.speedName;
  const support = c.supportPhone ? ` ${c.supportPhone}` : "";
  switch (key) {
    case "ORDER_CONFIRMED": {
      const payEn = c.cashOnDelivery ? ` Pay ${formatINR(c.totalPaise)} by cash or UPI on delivery.` : "";
      const payHi = c.cashOnDelivery ? ` डिलीवरी पर ${formatINR(c.totalPaise)} नकद या UPI से दें।` : "";
      return {
        template: key,
        vars: [c.orderCode, c.speedName, time, formatINR(c.totalPaise), c.orderUrl],
        text: bilingual(
          `${B}: order ${c.orderCode} is confirmed. ${c.speedName} delivery, expected by ${time}.${payEn} Track it: ${c.orderUrl}`,
          `${BH}: आपका ऑर्डर ${c.orderCode} कन्फ़र्म हो गया है। ${speedHi} डिलीवरी, ${time} तक।${payHi}`,
        ),
      };
    }
    case "ORDER_OUT_FOR_DELIVERY": {
      const rider = c.riderFirstName ? ` (${c.riderFirstName})` : "";
      const dueEn = c.amountDuePaise > 0 ? ` Please keep ${formatINR(c.amountDuePaise)} ready.` : "";
      const dueHi = c.amountDuePaise > 0 ? ` कृपया ${formatINR(c.amountDuePaise)} तैयार रखें।` : "";
      return {
        template: key,
        vars: [c.orderCode, c.riderFirstName ?? "our rider", c.handoverCode],
        text: bilingual(
          `${B}: order ${c.orderCode} is on its way${rider}. Tell the rider your delivery code ${c.handoverCode} when it arrives.${dueEn}`,
          `${BH}: आपका ऑर्डर ${c.orderCode} निकल चुका है${rider}। पहुँचने पर राइडर को डिलीवरी कोड ${c.handoverCode} बताएँ।${dueHi}`,
        ),
      };
    }
    case "ORDER_DELIVERED":
      return {
        template: key,
        vars: [c.orderCode],
        text: bilingual(
          `${B}: order ${c.orderCode} has been delivered. Thank you! If anything is not right, please tell us today${support ? ` on${support}` : ""}.`,
          `${BH}: ऑर्डर ${c.orderCode} डिलीवर हो गया है। धन्यवाद! कुछ ठीक न हो तो आज ही हमें बताएँ${support ? `:${support}` : ""}।`,
        ),
      };
    case "ORDER_CANCELLED":
      return {
        template: key,
        vars: [c.orderCode],
        text: bilingual(
          `${B}: order ${c.orderCode} has been cancelled.${c.paidOnline ? " Your refund will go back to the way you paid." : ""}`,
          `${BH}: ऑर्डर ${c.orderCode} रद्द कर दिया गया है।${c.paidOnline ? " आपका रिफ़ंड उसी तरीके से लौटाया जाएगा जिससे आपने भुगतान किया था।" : ""}`,
        ),
      };
    case "ORDER_DELIVERY_FAILED":
      return {
        template: key,
        vars: [c.orderCode],
        text: bilingual(
          `${B}: we could not deliver order ${c.orderCode}. Our team will call you shortly.`,
          `${BH}: ऑर्डर ${c.orderCode} डिलीवर नहीं हो सका। हमारी टीम जल्द ही आपको कॉल करेगी।`,
        ),
      };
    case "ORDER_DELAYED":
      return {
        template: key,
        vars: [c.orderCode, time],
        text: bilingual(
          `${B}: sorry, order ${c.orderCode} is taking longer than the ${time} we promised. We are working on it and it will reach you as soon as possible.`,
          `${BH}: क्षमा करें, ऑर्डर ${c.orderCode} में ${time} के वादे से ज़्यादा समय लग रहा है। हम इस पर काम कर रहे हैं और यह जल्द से जल्द आप तक पहुँचेगा।`,
        ),
      };
  }
}
