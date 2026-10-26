import { describe, expect, it } from "vitest";
import { formatINR, mulDivRound, parseRupees, percentOf, sum } from "@/lib/money";
import {
  checkQuantity,
  evaluatePackedWeight,
  formatQuantity,
  lineTotal,
  unitLabel,
  validateQuantityRule,
} from "@/lib/units";

describe("money", () => {
  it("rounds half away from zero, once", () => {
    expect(mulDivRound(1, 1, 2)).toBe(1); // 0.5 -> 1
    expect(mulDivRound(1, 1, 3)).toBe(0);
    expect(mulDivRound(2, 1, 3)).toBe(1);
    expect(mulDivRound(-1, 1, 2)).toBe(-1);
    expect(mulDivRound(-1, 1, 3)).toBe(0);
  });

  it("does not lose precision where floats would", () => {
    // 0.1 + 0.2 style trap: 1500 g of a Rs 49.90/kg item
    expect(lineTotal(1500, 4990, 1000)).toBe(7485);
    // large intermediate product beyond 2^53 would break float math
    expect(mulDivRound(9_000_000_000, 9_000_000_000, 1_000_000_000)).toBe(81_000_000_000);
  });

  it("rejects non-integers and bad divisors", () => {
    expect(() => mulDivRound(1.5, 2, 3)).toThrow(RangeError);
    expect(() => mulDivRound(1, 2, 0)).toThrow(RangeError);
    expect(() => sum([100, 0.5])).toThrow(RangeError);
  });

  it("percentOf uses basis points", () => {
    expect(percentOf(10_000, 500)).toBe(500); // 5% of Rs 100
    expect(percentOf(333, 1000)).toBe(33); // 10% of Rs 3.33 -> 33 paise
  });

  it("formats rupees", () => {
    expect(formatINR(4800)).toBe("₹48");
    expect(formatINR(4850)).toBe("₹48.50");
    expect(formatINR(123_456_700)).toBe("₹12,34,567");
  });

  it("parses rupee strings strictly", () => {
    expect(parseRupees("48")).toBe(4800);
    expect(parseRupees("₹1,234.5")).toBe(123_450);
    expect(parseRupees("12.345")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
});

describe("units & quantity rules", () => {
  const rule = { minBase: 500, maxBase: 5000, stepBase: 250 };

  it("validates rule configuration", () => {
    expect(validateQuantityRule(rule)).toBeNull();
    expect(validateQuantityRule({ ...rule, minBase: 300 })).toMatch(/multiple of step/);
    expect(validateQuantityRule({ ...rule, maxBase: 100 })).toMatch(/max/);
    expect(validateQuantityRule({ ...rule, stepBase: 0 })).toMatch(/step/);
  });

  it("enforces min, max and step (acceptance: 300 g with 250 g step is rejected)", () => {
    expect(checkQuantity(rule, 500)).toBeNull();
    expect(checkQuantity(rule, 1250)).toBeNull();
    expect(checkQuantity(rule, 250)).toBe("BELOW_MIN");
    expect(checkQuantity(rule, 5250)).toBe("ABOVE_MAX");
    expect(checkQuantity(rule, 600)).toBe("NOT_STEP_MULTIPLE");
    expect(checkQuantity(rule, 750.5)).toBe("NOT_INTEGER");
  });

  it("formats quantities and unit prices in English and Hindi", () => {
    expect(formatQuantity(1500, "GRAM")).toBe("1.5 kg");
    expect(formatQuantity(250, "GRAM")).toBe("250 g");
    expect(formatQuantity(2000, "GRAM", "hi")).toBe("2 किलो");
    expect(formatQuantity(3, "PIECE")).toBe("3 pcs");
    expect(formatQuantity(1, "PIECE")).toBe("1 pc");
    expect(unitLabel(1000, "GRAM")).toBe("per kg");
    expect(unitLabel(500, "GRAM")).toBe("per 500 g");
    expect(unitLabel(1, "PIECE", "hi")).toBe("प्रति नग");
  });
});

describe("BR-03 variable-weight policy (customer never pays more than agreed)", () => {
  const base = { orderedBase: 2000, lineTotalPaise: 9600, tolerancePct: 10 };

  it("LOOSE_WEIGHT: at or above ordered weight is fine, small overpack is a free giveaway", () => {
    expect(evaluatePackedWeight({ ...base, model: "LOOSE_WEIGHT", packedBase: 2000 })).toEqual({ kind: "OK", giveawayBase: 0 });
    expect(evaluatePackedWeight({ ...base, model: "LOOSE_WEIGHT", packedBase: 2100 })).toEqual({ kind: "OK", giveawayBase: 100 });
  });

  it("LOOSE_WEIGHT: more than +5% asks the packer to repack", () => {
    expect(evaluatePackedWeight({ ...base, model: "LOOSE_WEIGHT", packedBase: 2200 })).toEqual({ kind: "OVERPACKED", giveawayBase: 200 });
  });

  it("LOOSE_WEIGHT: any shortfall is refunded pro-rata", () => {
    const r = evaluatePackedWeight({ ...base, model: "LOOSE_WEIGHT", packedBase: 1900 });
    expect(r).toEqual({ kind: "SHORT", shortBase: 100, refundPaise: 480 }); // 5% of Rs 96
  });

  it("APPROX_PIECE: within the tolerance band there is no compensation", () => {
    expect(evaluatePackedWeight({ ...base, model: "APPROX_PIECE", packedBase: 1850 }).kind).toBe("OK");
  });

  it("APPROX_PIECE: below the band, refund is pro-rata from the nominal weight", () => {
    const r = evaluatePackedWeight({ ...base, model: "APPROX_PIECE", packedBase: 1600 });
    expect(r).toEqual({ kind: "SHORT", shortBase: 400, refundPaise: 1920 });
  });

  it("refund never exceeds the line total", () => {
    const r = evaluatePackedWeight({ ...base, model: "LOOSE_WEIGHT", packedBase: 0 });
    expect(r.kind === "SHORT" && r.refundPaise).toBe(9600);
  });

  it("rejects nonsense input", () => {
    expect(() => evaluatePackedWeight({ ...base, model: "LOOSE_WEIGHT", orderedBase: 0, packedBase: 1 })).toThrow(RangeError);
  });
});
