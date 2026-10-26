/** Normalise an Indian mobile number to E.164 ("+919876543210"), or null if it cannot be one. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string;
  if (/^\+91\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^91\d{10}$/.test(digits)) national = digits.slice(2);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  // Indian mobile numbers start with 6-9.
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}

/** "+919876543210" -> "+91 98765 43210" for display to the owner of that number. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** "+919876543210" -> "+91 ••••• ••210" (safe to show on a tracking page). */
export function maskPhoneDisplay(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ••••• ••${m[2].slice(-3)}` : "••••";
}

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
