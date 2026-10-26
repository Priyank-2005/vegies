import { formatQuantity, type BaseUnit } from "@/lib/units";

/** Customer-friendly wording for cart/checkout problems returned by the server. */
export function issueText(code: string, ctx: { maxAvailableBase?: number; baseUnit?: BaseUnit; minBase?: number; maxBase?: number; stepBase?: number } = {}): string {
  const q = (n?: number) => (n != null && ctx.baseUnit ? formatQuantity(n, ctx.baseUnit) : "");
  switch (code) {
    case "SOLD_OUT":
      return "Sold out for this day.";
    case "NOT_PUBLISHED":
      return "Not available on this day.";
    case "OUT_OF_SEASON":
      return "Out of season.";
    case "INSUFFICIENT_STOCK":
      return ctx.maxAvailableBase ? `Only ${q(ctx.maxAvailableBase)} left.` : "Not enough left.";
    case "BELOW_MIN":
      return `Minimum order is ${q(ctx.minBase)}.`;
    case "ABOVE_MAX":
      return `Maximum order is ${q(ctx.maxBase)}.`;
    case "NOT_STEP_MULTIPLE":
      return `Please order in steps of ${q(ctx.stepBase)}.`;
    case "INACTIVE":
    case "UNKNOWN_ITEM":
    case "NO_PRICE":
      return "No longer available.";
    default:
      return "Please review this item.";
  }
}
