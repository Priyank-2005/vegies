import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { db } from "../db/client";
import { HttpError } from "../http";
import { resolveCustomerSession, type CustomerPrincipal } from "./customer-auth";

export const CUSTOMER_COOKIE = "hh_customer_session";

export async function currentCustomer(): Promise<CustomerPrincipal | null> {
  const raw = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  return resolveCustomerSession(db(), raw);
}

export async function requireCustomer(): Promise<CustomerPrincipal> {
  const c = await currentCustomer();
  if (!c) throw new HttpError(401, "PHONE_NOT_VERIFIED", "Verify your phone number to continue");
  return c;
}

export async function setCustomerCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearCustomerCookie(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
