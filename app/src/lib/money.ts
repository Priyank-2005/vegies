/**
 * Money is ALWAYS an integer number of paise (1 INR = 100 paise). Never use floats for money.
 * Multiplication/division goes through BigInt so intermediate products cannot lose precision.
 */
export type Paise = number;

export function assertPaise(n: number, label = "amount"): Paise {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${label} must be an integer number of paise, got ${n}`);
  return n;
}

/** round(a * b / d), rounding half away from zero. d must be > 0. */
export function mulDivRound(a: number, b: number, d: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(d) || d <= 0) {
    throw new RangeError(`mulDivRound needs safe integers and d > 0 (got ${a}, ${b}, ${d})`);
  }
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(d);
  const neg = num < 0n;
  const abs = neg ? -num : num;
  const q = (2n * abs + den) / (2n * den); // floor((abs/den) + 1/2)
  const res = Number(neg ? -q : q);
  if (!Number.isSafeInteger(res)) throw new RangeError("mulDivRound overflow");
  return res;
}

/** Percentage expressed in basis points (1% = 100 bps). */
export function percentOf(amount: Paise, bps: number): Paise {
  return mulDivRound(amount, bps, 10_000);
}

export function sum(values: readonly Paise[]): Paise {
  let t = 0;
  for (const v of values) t += assertPaise(v);
  return assertPaise(t, "sum");
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** "₹1,234.50"; whole rupees drop the decimals ("₹48"). */
export function formatINR(p: Paise): string {
  assertPaise(p);
  return p % 100 === 0 ? inrWhole.format(p / 100) : inr.format(p / 100);
}

/** Parse "48", "48.5", "₹1,234.50" into paise. Returns null for anything ambiguous. */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const frac = (m[2] ?? "").padEnd(2, "0");
  return Number(m[1]) * 100 + Number(frac);
}
