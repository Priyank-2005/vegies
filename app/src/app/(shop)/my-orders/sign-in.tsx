"use client";

import { useRouter } from "next/navigation";
import { OtpLogin } from "@/components/shop/otp-login";

export function MyOrdersSignIn() {
  const router = useRouter();
  return <OtpLogin onVerified={() => router.refresh()} />;
}
