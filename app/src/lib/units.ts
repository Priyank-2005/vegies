import { mulDivRound, type Paise } from "./money";

/**
 * Quantities are ALWAYS integers in a product's base unit: grams (GRAM) or pieces (PIECE).
 * A "sale unit" describes how a product is priced and what quantities can be ordered.
 */
export type BaseUnit = "GRAM" | "PIECE";
export type WeightModel = "FIXED_PACK" | "APPROX_PIECE" | "LOOSE_WEIGHT";

export interface QuantityRule {
  minBase: number;
  maxBase: number;
  stepBase: number;
}

export type QuantityError = "NOT_INTEGER" | "BELOW_MIN" | "ABOVE_MAX" | "NOT_STEP_MULTIPLE";

export function validateQuantityRule(rule: QuantityRule): string | null {
  const { minBase, maxBase, stepBase } = rule;
  if (![minBase, maxBase, stepBase].every(Number.isSafeInteger)) return "rule values must be integers";
  if (stepBase <= 0) return "step must be > 0";
  if (minBase <= 0) return "min must be > 0";
  if (maxBase < minBase) return "max must be >= min";
  if (minBase % stepBase !== 0) return "min must be a multiple of step";
  return null;
}

export function checkQuantity(rule: QuantityRule, qtyBase: number): QuantityError | null {
  if (!Number.isSafeInteger(qtyBase)) return "NOT_INTEGER";
  if (qtyBase < rule.minBase) return "BELOW_MIN";
  if (qtyBase > rule.maxBase) return "ABOVE_MAX";
  if (qtyBase % rule.stepBase !== 0) return "NOT_STEP_MULTIPLE";
  return null;
}

/** line total = qty / unitBaseQty * unitPrice, rounded half away from zero, once. */
export function lineTotal(qtyBase: number, unitPricePaise: Paise, unitBaseQty: number): Paise {
  return mulDivRound(qtyBase, unitPricePaise, unitBaseQty);
}

export type Lang = "en" | "hi";

/** 1500 GRAM -> "1.5 kg"; 250 GRAM -> "250 g"; 3 PIECE -> "3 pcs". */
export function formatQuantity(qtyBase: number, base: BaseUnit, lang: Lang = "en"): string {
  if (base === "PIECE") return lang === "hi" ? `${qtyBase} नग` : `${qtyBase} ${qtyBase === 1 ? "pc" : "pcs"}`;
  if (qtyBase >= 1000) {
    const kg = qtyBase / 1000;
    const text = Number.isInteger(kg) ? String(kg) : String(Number(kg.toFixed(3)));
    return `${text} ${lang === "hi" ? "किलो" : "kg"}`;
  }
  return `${qtyBase} ${lang === "hi" ? "ग्राम" : "g"}`;
}

/** The label a customer sees next to a price: "per kg", "per 500 g", "per piece". */
export function unitLabel(unitBaseQty: number, base: BaseUnit, lang: Lang = "en"): string {
  if (base === "PIECE") {
    if (unitBaseQty === 1) return lang === "hi" ? "प्रति नग" : "per piece";
    return lang === "hi" ? `प्रति ${unitBaseQty} नग` : `per ${unitBaseQty} pcs`;
  }
  const q = formatQuantity(unitBaseQty, base, lang);
  return unitBaseQty === 1000 ? (lang === "hi" ? "प्रति किलो" : "per kg") : lang === "hi" ? `प्रति ${q}` : `per ${q}`;
}

// ---------------------------------------------------------------------------
// BR-03 variable-weight policy (approved D-007): the customer never pays more than
// agreed at checkout; shortfalls below the allowed band are refunded pro-rata.
// ---------------------------------------------------------------------------

export type PackedWeightOutcome =
  | { kind: "OK"; giveawayBase: number }
  | { kind: "OVERPACKED"; giveawayBase: number } // more than the free allowance: repack
  | { kind: "SHORT"; shortBase: number; refundPaise: Paise };

export const FREE_OVERPACK_PCT = 5;

export function evaluatePackedWeight(args: {
  model: WeightModel;
  orderedBase: number;
  packedBase: number;
  lineTotalPaise: Paise;
  tolerancePct: number; // used for FIXED_PACK / APPROX_PIECE bands
}): PackedWeightOutcome {
  const { model, orderedBase, packedBase, lineTotalPaise, tolerancePct } = args;
  if (!Number.isSafeInteger(orderedBase) || orderedBase <= 0 || !Number.isSafeInteger(packedBase) || packedBase < 0) {
    throw new RangeError("ordered/packed quantities must be non-negative integers (ordered > 0)");
  }
  // Lowest packed weight that is still acceptable without compensation.
  const floorBase = model === "LOOSE_WEIGHT" ? orderedBase : Math.ceil((orderedBase * (100 - tolerancePct)) / 100);
  if (packedBase < floorBase) {
    const shortBase = orderedBase - packedBase;
    return { kind: "SHORT", shortBase, refundPaise: mulDivRound(lineTotalPaise, shortBase, orderedBase) };
  }
  const giveawayBase = Math.max(0, packedBase - orderedBase);
  const allowance = Math.floor((orderedBase * FREE_OVERPACK_PCT) / 100);
  if (model === "LOOSE_WEIGHT" && giveawayBase > allowance) return { kind: "OVERPACKED", giveawayBase };
  return { kind: "OK", giveawayBase };
}
