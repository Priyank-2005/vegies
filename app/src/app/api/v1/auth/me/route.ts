import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { maskPhoneDisplay } from "@/lib/phone";
import { revokeCustomerSession } from "@/server/auth/customer-auth";
import { CUSTOMER_COOKIE, clearCustomerCookie, currentCustomer } from "@/server/auth/customer-guards";
import { db } from "@/server/db/client";
import { route } from "@/server/http";

export const GET = route(async () => {
  const c = await currentCustomer();
  return NextResponse.json(
    { customer: c ? { name: c.name, phoneMasked: maskPhoneDisplay(c.phone) } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/** Sign the customer out of this browser. */
export const DELETE = route(async () => {
  await revokeCustomerSession(db(), (await cookies()).get(CUSTOMER_COOKIE)?.value);
  await clearCustomerCookie();
  return NextResponse.json({ ok: true });
});
