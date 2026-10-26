const TZ = "Asia/Kolkata";

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

/** "25 Oct, Sun" style label for a YYYY-MM-DD service date (a calendar date, not an instant). */
export function formatServiceDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Noon UTC avoids any day shift when formatted in IST.
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatTime(iso: string | Date): string {
  return timeFmt.format(new Date(iso)).replace(/\s?(am|pm)/i, (s) => s.toUpperCase());
}

/** "5:00 – 5:25 PM" */
export function formatWindow(startIso: string | Date, endIso: string | Date): string {
  const a = formatTime(startIso);
  const b = formatTime(endIso);
  const ap = a.slice(-2);
  return ap === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** True if `date` is within the last `seconds` (used to show a one-off "thank you" after placing an order). */
export function isRecent(date: Date, seconds: number): boolean {
  return Date.now() - date.getTime() < seconds * 1000;
}

export function formatDateTime(iso: string | Date): string {
  return `${dayFmt.format(new Date(iso))}, ${formatTime(iso)}`;
}
