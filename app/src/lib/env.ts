import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  HH_DATABASE_URL: z.string().min(1),
  APP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 random bytes, base64-encoded"),
  SESSION_COOKIE_NAME: z.string().min(1).default("hh_staff_session"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(60),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(12),
  OTP_PROVIDER: z.enum(["console", "disabled"]).default("console"),
  // Order messages. "fake" only records them (development and tests). Real WhatsApp / SMS channels arrive in a later step.
  NOTIFY_CHANNEL: z.enum(["fake", "disabled"]).default("fake"),
  NEXT_PUBLIC_SUPPORT_PHONE: z.string().optional(),
  // Address lookup. "nominatim" is the free public OpenStreetMap service: development / very low volume only.
  GEOCODER_PROVIDER: z.enum(["nominatim", "ola", "google", "none"]).default("none"),
  // Only needed for the provider you choose. Keep them out of the repository and out of logs.
  OLA_MAPS_API_KEY: z.string().min(8).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(8).optional(),
  GEOCODER_USER_AGENT: z.string().min(5).default("HariHaat-dev/0.1"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment. Throws one readable error at first use if anything is missing or malformed. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.OTP_PROVIDER === "console") {
    throw new Error("OTP_PROVIDER=console is not allowed in production");
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.NOTIFY_CHANNEL === "fake") {
    throw new Error("NOTIFY_CHANNEL=fake is not allowed in production: customers would never receive their messages");
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.GEOCODER_PROVIDER === "nominatim") {
    throw new Error("GEOCODER_PROVIDER=nominatim (free public OpenStreetMap service) is not allowed in production: choose a production geocoder");
  }
  if (parsed.data.GEOCODER_PROVIDER === "ola" && !parsed.data.OLA_MAPS_API_KEY) throw new Error("GEOCODER_PROVIDER=ola needs OLA_MAPS_API_KEY");
  if (parsed.data.GEOCODER_PROVIDER === "google" && !parsed.data.GOOGLE_MAPS_API_KEY) throw new Error("GEOCODER_PROVIDER=google needs GOOGLE_MAPS_API_KEY");
  cached = parsed.data;
  return cached;
}

/** For tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}
