# Hari Haat (हरी हाट): fresh produce delivery, Udaipur

Customers share their location, fill a cart and choose a delivery speed: **Instant ₹20 · within 1 hour ₹10 · within 3 hours free** (no platform charges). One packing hub in Udaipur; riders deliver; customers prove receipt with a 4-digit code.
Planning documents are one level up: `../PIVOT_PLAN.md` (read first), `../BUSINESS_PLAN.md`, `../PRD.md`, `../OPERATIONS_PLAN.md`, `../ARCHITECTURE.md`, `../UNIT_ECONOMICS.md`, `../ROADMAP.md`, `../DECISIONS.md`.

**Status:** Milestones 1 to 3 are done (foundation, customer ordering, operations panel). Milestone 4 has begun: a background worker sends order messages through a fake channel (step 1) and address-search adapters are prepared (step 2). **No online payment, no real WhatsApp/SMS, no hosting yet.** See `../FEATURES_AND_PROGRESS.md` for the full picture. The name "Hari Haat" is a working name and is not trademark-checked.

## What a customer can do today
Tap **Use my current location** (or search an address if permission is denied), see which speeds are open at their address with fee and arrival time, browse and search the catalogue in English, Hindi or Hinglish, build a cart (prices are always computed on the server), verify their phone with an OTP, place a pay-on-delivery order, follow it on an order page with a delivery code, and cancel free until packing starts. People outside Udaipur can join a waitlist.

## What staff can do today (admin panel at `/admin`)
Dispatch board, order search and detail, packing screen (weights, short-weight adjustment, hold), a phone-friendly rider screen (delivery code, cash/UPI, failed delivery), cash hand-in, catalogue and price editor, stock and buying (publish, receive, wastage, suppliers), settings (store, hours, speeds, business rules), reports with CSV, and staff management. Each screen only appears for roles that need it; permissions are checked again on the server for every action.

## Requirements
Node 24, npm, PostgreSQL binaries (`psql`, `initdb`, `pg_ctl`) on this machine, Windows PowerShell for the helper script.

## First-time setup
```powershell
cd app
npm install
copy .env.example .env      # fill in APP_ENCRYPTION_KEY and SEED_OWNER_PASSWORD (dev-only values)
npm run db:start            # private dev Postgres on 127.0.0.1:5433 (harihaat_dev, harihaat_test)
npm run db:migrate
npm run db:seed             # owner login from .env + city
npm run db:seed:demo        # sample catalogue + a PLACEHOLDER hub + the three delivery speeds
npm run dev                 # http://localhost:3000  (staff sign-in: /admin/login)
```
Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
After a reboot just run `npm run db:start` then `npm run dev`.

### Trying the location flow locally
- `http://localhost:3000` counts as a secure context, so the browser's location prompt works. In production the site **must** be served over HTTPS or location detection is refused by browsers.
- The demo hub is a placeholder at the Udaipur city centre (24.5854, 73.7125) and opens 07:00-22:00 India time. Outside those hours every speed shows "closed" (browsing and carts still work). To test at night, temporarily widen the hours: `update hub set opens_at_minute=0, closes_at_minute=1440, last_order_buffer_minutes=0;`.
- Address suggestions/search use the free public OpenStreetMap Nominatim service when `GEOCODER_PROVIDER=nominatim` (the default in `.env.example`). It is for development only and is refused in production; set `none` to disable. See DECISIONS D-040.
- Browser dev tools can simulate a position (Sensors) if you want to test GPS from a desktop.
- The demo catalogue uses the founder's SAMPLE price list (DECISIONS D-028). In development the OTP is shown on screen and printed in the server log.

## Trying the admin panel locally
```bash
npm run db:seed:demo      # catalogue, store, delivery speeds
npm run db:seed:orders    # demo staff and a few orders at different stages
```
Sign in at `/admin/login` with `owner-demo@example.test`, `manager@example.test`, `packer@example.test` or `rider@example.test` (local demo password: `demo-password-1234`; these accounts exist only in your local database). The demo store is only open 7:00 AM to 10:00 PM; widen the hours in Settings to try it at night.

## Order messages and the background worker
```bash
npm run worker     # sends order messages, releases expired unpaid orders, queues "running late" notices
```
With `NOTIFY_CHANNEL=fake` (the default for development) messages are only recorded: open an order in the admin panel and read them under "Messages to the customer". `NOTIFY_CHANNEL=disabled` leaves messages queued. The fake channel is refused in production. Real WhatsApp and SMS channels come in a later step and need paid accounts, which I will ask you about first.

## Choosing the address-search provider
A ready-made file built from public web pages is in `app/data/udaipur-addresses.public-web.csv`. To test with your own addresses, put them in `app/data/udaipur-addresses.csv` (kept private; copy `udaipur-addresses.example.csv`; columns `address,lat,lng`, where lat and lng are optional and are the true spot copied from a Google Maps pin). Add the keys you have to `.env` (`OLA_MAPS_API_KEY`, `GOOGLE_MAPS_API_KEY`), then:
```bash
npm run geocoder:compare -- data/udaipur-addresses.public-web.csv --raw --reverse
```
It runs every provider that has a key (the free OpenStreetMap one always runs), prints a summary and writes a full report to `app/reports/`. The Ola adapter's request and answer format is **assumed and unverified**: the `--raw` option prints Ola's real answer so it can be checked and fixed first.

## Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | 251 unit + integration tests (needs `db:start`; uses `harihaat_test`, refuses any database not ending in `_test`) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run build` | Production build. `next start` refuses `OTP_PROVIDER=console` and `GEOCODER_PROVIDER=nominatim` by design |
| `npm run db:generate` | Generate a migration after changing `src/server/db/schema/*` |
| `npm run db:migrate` | Apply migrations to `HH_DATABASE_URL` |
| `npm run db:start` / `db:stop` | Start/stop the private dev Postgres |

## Conventions
- Money is integer **paise**, quantities integer **grams/pieces**; never floats (`src/lib/money.ts`, `src/lib/units.ts`).
- Prices, delivery fees, totals and capacity are decided on the server, inside one database transaction, with an audit/ledger row. Clients send ids and quantities only.
- Every privileged action calls `requireStaff(permission)` (routes) or `assertCan` (services). Hiding a button is cosmetic.
- Delivery speeds, fees, radii, capacity and hub hours are **rows in the database**, not code (`delivery_option`, `hub_delivery_option`, `hub`).
- Env variables are validated in `src/lib/env.ts`; this project uses the `HH_` prefix (e.g. `HH_DATABASE_URL`) because another project on this machine defines a system-wide `DATABASE_URL`.
- Location data is personal data: do not log coordinates; the waitlist keeps ~1 km precision only.
- The brand name is one constant: `src/lib/brand.ts`.

## Security notes
- **Staff authenticator (TOTP) is switched off** (`MFA_ENFORCED = false` in `src/server/auth/permissions.ts`, decision D-047). Admin sign-in is password-only. Turn it back on before any real data: set the flag to `true`.
- Minimum order value is ₹0 (D-046). It is a per-speed database value (`hub_delivery_option.min_order_paise`).
- UI: design tokens live in `src/app/globals.css`; shared primitives in `src/components/ui`; product illustrations are drawn in `src/components/shop/product-art.tsx` (add a keyword row there for each new vegetable; unknown names get a generic fruit shape); hero banners are in `src/components/shop/hero-banners.tsx`.
- Do not log PII; use `maskPhone()` and the logger's redaction list.
- `drizzle-kit` (dev-only) pulls an old `esbuild` flagged by `npm audit` (dev-server request issue). It is not part of the production bundle; track the upstream fix.
