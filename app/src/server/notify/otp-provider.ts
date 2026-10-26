import { env } from "@/lib/env";
import { maskPhone } from "@/lib/logger";

/**
 * How a one-time code reaches the customer. Real delivery (WhatsApp authentication template or a
 * DLT-registered SMS sender) is wired in Milestone 4 behind this same interface.
 */
export interface OtpProvider {
  send(phone: string, code: string): Promise<void>;
}

// Development only: lets tests and the local browser flow read the last code. Never populated in production.
const devCodes = new Map<string, string>();

export function lastDevOtp(phone: string): string | undefined {
  return devCodes.get(phone);
}

const consoleProvider: OtpProvider = {
  async send(phone, code) {
    if (env().NODE_ENV === "production") throw new Error("console OTP provider must not run in production");
    devCodes.set(phone, code);
    if (env().NODE_ENV !== "test") console.log(`[dev otp] ${maskPhone(phone)} -> ${code}`);
  },
};

const disabledProvider: OtpProvider = {
  async send() {
    throw new Error("OTP delivery is not configured (OTP_PROVIDER=disabled)");
  },
};

export function otpProvider(): OtpProvider {
  return env().OTP_PROVIDER === "console" ? consoleProvider : disabledProvider;
}

/** The API may echo the code back only in local development, to make the browser flow testable. */
export function echoDevCode(): boolean {
  return env().OTP_PROVIDER === "console" && env().NODE_ENV === "development";
}
