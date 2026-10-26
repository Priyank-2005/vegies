import { describe, expect, it } from "vitest";
import { TEMPLATE_KEYS, renderMessage, type MessageContext } from "@/server/notify/templates";

const base: MessageContext = {
  orderCode: "AB12CD34",
  orderUrl: "https://example.test/my-orders/xyz",
  speedName: "Instant",
  speedNameHi: "तुरंत",
  promisedAt: new Date("2026-10-25T06:30:00Z"), // 12:00 PM India
  amountDuePaise: 5800,
  totalPaise: 8200,
  cashOnDelivery: true,
  riderFirstName: "Ravi",
  handoverCode: "4821",
  paidOnline: false,
  supportPhone: null,
};

describe("customer message templates", () => {
  it.each(TEMPLATE_KEYS)("%s is written in English and Hindi, names the order, and has no leftover placeholders", (key) => {
    const m = renderMessage(key, base);
    expect(m.template).toBe(key);
    expect(m.text).toContain("AB12CD34");
    expect(m.text).toMatch(/[ऀ-ॿ]/); // Devanagari present
    expect(m.text).toMatch(/[A-Za-z]/);
    expect(m.text).not.toMatch(/undefined|null|NaN|\{|\}/);
    expect(m.text.length).toBeLessThan(700);
    expect(m.vars.every((v) => v.length > 0)).toBe(true);
  });

  it("the confirmation gives the speed, the promised time and what to pay", () => {
    const m = renderMessage("ORDER_CONFIRMED", base);
    expect(m.text).toContain("Instant delivery, expected by 12:00 PM");
    expect(m.text).toContain("₹82");
    expect(m.text).toContain("तुरंत डिलीवरी");
    expect(m.text).toContain(base.orderUrl);
    const prepaid = renderMessage("ORDER_CONFIRMED", { ...base, cashOnDelivery: false, amountDuePaise: 0 });
    expect(prepaid.text).not.toMatch(/cash or UPI/);
  });

  it("out for delivery carries the delivery code and the amount to keep ready, but nothing when already paid", () => {
    const m = renderMessage("ORDER_OUT_FOR_DELIVERY", base);
    expect(m.text).toContain("delivery code 4821");
    expect(m.text).toContain("कोड 4821");
    expect(m.text).toContain("₹58 ready");
    expect(m.text).toContain("(Ravi)");
    const paid = renderMessage("ORDER_OUT_FOR_DELIVERY", { ...base, cashOnDelivery: false, amountDuePaise: 0, riderFirstName: null });
    expect(paid.text).not.toContain("ready");
    expect(paid.text).not.toContain("(");
  });

  it("only promises a refund when the customer paid online, and shows a support number only when one is set", () => {
    expect(renderMessage("ORDER_CANCELLED", base).text).not.toMatch(/refund/i);
    expect(renderMessage("ORDER_CANCELLED", { ...base, paidOnline: true }).text).toMatch(/refund/i);
    expect(renderMessage("ORDER_DELIVERED", base).text).not.toMatch(/\+91/);
    expect(renderMessage("ORDER_DELIVERED", { ...base, supportPhone: "+919800000000" }).text).toContain("+919800000000");
  });

  it("the delivery code appears only in the out-for-delivery message", () => {
    for (const key of TEMPLATE_KEYS.filter((k) => k !== "ORDER_OUT_FOR_DELIVERY")) {
      expect(renderMessage(key, base).text).not.toContain("4821");
    }
  });
});
