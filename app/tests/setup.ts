import { config } from "dotenv";

config({ override: true });

// All server code reads HH_DATABASE_URL; point it at the test database for every test file.
process.env.HH_DATABASE_URL = process.env.HH_TEST_DATABASE_URL;
process.env.APP_URL = "http://localhost:3000";
process.env.OTP_PROVIDER = "console";
process.env.LOG_LEVEL = "silent";
// A fixed, test-only key so tests do not depend on a developer's .env secret.
process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
