/**
 * Turning what a person types into the integer base units the system stores, and back.
 * Weights are typed in kilograms or grams, counts in pieces; the database only ever sees whole grams or pieces.
 */
export type QtyUnit = "kg" | "g" | "pc";

export function parseQty(text: string, unit: QtyUnit): number | null {
  const t = text.trim().replace(/,/g, ".");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const v = Number(t);
  if (unit === "kg") return Math.round(v * 1000);
  if (!Number.isInteger(v)) return null; // grams and pieces must be whole
  return v;
}

/** Whole base units to what the input shows: grams -> "1.5" for kg, or "1500" for g. */
export function qtyToInput(base: number, unit: QtyUnit): string {
  if (unit === "kg") return String(base / 1000);
  return String(base);
}

/** The input unit that suits a product's base unit when entering stock (kg for weight, pieces for counts). */
export function stockUnit(baseUnit: "GRAM" | "PIECE"): QtyUnit {
  return baseUnit === "GRAM" ? "kg" : "pc";
}

/** Rupees typed as text ("42", "42.50") to paise, or null if it is not a valid amount. */
export function parseRupeesInput(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function paiseToInput(p: number): string {
  return (p / 100).toFixed(p % 100 === 0 ? 0 : 2);
}
