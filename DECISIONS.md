# Decision Log

> Status: v0.1 · 2026-10-23. IDs are stable. "Proposed" = my recommendation awaiting your approval; "Provisional" = I will proceed on this assumption until you say otherwise; "Open" = needs your input.

## 1. Decisions recorded

| ID | Decision | Alternatives considered | Reasoning | Status |
|---|---|---|---|---|
| D-001 | Run a **Phase 0 concierge pilot** before building the full platform | Build the whole app first (as in the brief) | Unit economics show route density is the make-or-break variable and can be tested without software; building first risks ₹3–6 lakh of effort on an unvalidated assumption | **Overruled by founder 2026-10-24:** build the full production-ready website. Pilot stops run in parallel using founder's local contacts; the go/no-go thresholds still gate *scaling spend* (vans, ads), not the build. |
| D-002 | Collection-first MVP; **home delivery deferred (P1, feature-flagged)** | Home delivery in MVP | Separate delivery trips destroy route density; delivery only inside already-served societies later | Proposed |
| D-003 | **Modular monolith**: Next.js (App Router) + TypeScript + PostgreSQL | Separate API (NestJS), Django, serverless microservices | Fewest moving parts; SEO + admin in one repo; easiest to hire for and operate | Proposed |
| D-004 | Hosting: choose between PaaS (A) and India-region container + managed Postgres (B) **after price/region check**; PITR backups mandatory | Free tiers only | Free tiers often lack PITR, have idle sleeps and commercial-use limits **[unverified]**. Backups and latency matter for a transactional business | **Open** (no paid services registered until you approve) |
| D-005 | **Drizzle ORM** (+ drizzle-kit SQL migrations) with guarded `UPDATE … WHERE` statements for stock/slot counters. *Revised in Milestone 1 from "Prisma".* | Prisma; Kysely | No codegen step; closer to SQL; verified by the concurrency tests | Implemented |
| D-006 | Inventory = **append-only ledger + daily availability counters**; sold per service date | Mutable `stock` column | Auditability, reconciliation, per-day perishability | Provisional |
| D-007 | **Variable-weight policy:** customer never pays more than agreed at checkout; pack ≥ ordered weight (≤ +5% free); short weight → automatic pro-rata refund; actual-weight billing deferred (P2) | Charge by actual weight with payment authorisation/capture | Simplest trust-building rule; avoids payment-auth complexity and consent needs | **Approved 2026-10-24** (affects margin: ~1–2% give-away) |
| D-008 | Payments: one Indian gateway behind an interface; online prepaid + capped pay-at-van | Multi-gateway, COD-only | Webhook-verified; limited no-show risk; first order prepaid | Proposed (gateway choice pending merchant eligibility) |
| D-009 | Customer auth: phone-OTP guest checkout; staff: password + TOTP | Mandatory accounts; social login | Conversion; Indian norms | Provisional |
| D-010 | No live GPS in MVP; driver taps stop events; windows + reminders | Real-time tracking | Cost/privacy; windows suffice until data shows otherwise | Provisional |
| D-011 | No Redis, Kafka, separate queue service; pg-boss on Postgres | BullMQ/Redis | Complexity not justified at <1,000 orders/day | Provisional |
| D-012 | **Visual direction A "Mandi Market"** (warm, local trust) with clean checkout; **brand name/logo/domain not final**; placeholder "FreshVan" | Direction B "Clean Fresh"; choosing a name now | Trust and price transparency matter most for first buyers; names need trademark/domain/social-handle checks | Proposed: needs your choice |
| D-013 | Walk-up surplus sales at stops (P1) to reduce wastage | Discard/donate only | Converts spoilage to margin | Proposed (legal metrology & billing check [?]) |
| D-014 | Timeline variant: **evening route** (cutoff 9 PM D-1, buy 5–7 AM, stops 4–8 PM) | Morning route | Customers home; freshest purchase; more packing time | Provisional (validate with survey) |
| D-015 | No auto-recurring charges; recurring baskets are customer-confirmed each time (until legal/payment mandate review) | UPI AutoPay / card mandates | Consent and regulatory complexity | Provisional |
| D-016 | Maps: map links first; Routes/matrix API later; no route-optimisation engine | Fleet routing from day 1 | 4–6 stops; manual ordering enough | Provisional |
| D-017 | All times stored UTC and shown IST; money in integer paise; quantity in integer grams/pieces | Floats/decimals | Correctness | Provisional |

### Decisions added 2026-10-24 (from founder answers)

| ID | Decision | Reasoning | Status |
|---|---|---|---|
| D-018 | **Launch city: Udaipur (Rajasthan).** Neighbourhood not chosen. Candidate localities to field-check (unverified, from general descriptions): Hiran Magri sectors, Bhuwana corridor, Sukher, Bhupalpura, Fatehpura, Pratap Nagar. Also test hotel/restaurant demand (tourism city) as a density lever, a hypothesis only. | Founder has local contacts; rubric in BUSINESS_PLAN §7 applies | Approved |
| D-019 | **UI language English; product names bilingual (English + Hindi in Devanagari)**, search matches both plus Hinglish transliteration (e.g. "pyaz", "aloo") | Founder choice; fits local shoppers | Approved |
| D-020 | **Founder runs daily ops and needs an admin panel covering every operational detail** → admin/ops tooling is promoted to equal priority with the storefront and is built in the same milestones, not left to the end | Founder is the operator | Approved |
| D-021 | **Developer: Claude builds** the full site in the milestones of ROADMAP.md; all work is local and free until you approve any paid service (hosting, gateway, messaging, domain) | Founder choice; budget unknown | Approved; budget still **Open** |
| D-022 | **BR-09 pay-at-van caps approved** (₹600 cap, first order prepaid, no-show strikes) | Founder said yes | Approved |
| D-023 | **Build before registering is allowed; selling is not.** No real customer order is taken until the entity/FSSAI/GST questions in BUSINESS_PLAN §13 are resolved by a professional. Cheapest compliant path (e.g. proprietorship + FSSAI basic registration) is a founder/CA decision | Founder plans to register only if idea works; registration is a prerequisite for the very first paid sale, not a post-validation step | **Open: flagged** |
| D-024 | Brand name still open; shortlist in `BRAND_NAMES.md`; availability checks pending | | Open |
| D-025 | Next.js 16 **Cache Components / partial prefetching left OFF** (the scaffold enabled them). The app is mostly per-user dynamic (cart, orders, admin); enabling it forces Suspense/`use cache` boundaries everywhere for little gain. Public catalogue pages will use classic revalidation. Revisit when the storefront is built. | Keep scaffold default | Simplicity and correctness first | Implemented |
| D-026 | Env variables for this app are prefixed `FV_` where a generic name could collide (`FV_DATABASE_URL`, `FV_TEST_DATABASE_URL`); `.env` always overrides machine-wide variables in scripts. **Why:** this machine has a system-wide `DATABASE_URL` for another project; my first migrate run picked it up (auth failed, nothing was changed). | Keep `DATABASE_URL` | Prevents ever pointing this app at another project's database | Implemented |
| D-027 | Development Postgres is a **private cluster on port 5433** under `D:\SU\.dev\pgdata` (`npm run db:start`), not the machine's existing Postgres on 5432. Trust auth, listens on 127.0.0.1 only, throw-away data. Production uses managed Postgres (D-004). | Use the existing 5432 server (needs credentials I do not have) | Isolation from other projects | Implemented |

### Decisions added during Milestone 2 (2026-10-24)

| ID | Decision | Reasoning | Status |
|---|---|---|---|
| D-028 | **Sample catalogue**: the founder's 34-item per-kg price list (tomato 10.50 … lemon 110) is loaded as demo shelf prices by `npm run db:seed:demo`, with fictional "Demo" stops and slots. These are NOT verified Udaipur prices and look like wholesale/market rates. | Founder asked to use it as sample data | Implemented; **see UNIT_ECONOMICS §12 before relying on it** |
| D-029 | Prepaid is switched off by a setting (`payments.prepaid_enabled=false`) until the gateway exists (M4). Because BR-09's "first order must be prepaid" cannot be met yet, it is enforced **only when prepaid is enabled**; until then every order is pay-at-van, capped at Rs 600, with the no-show limit. The prepaid order path (pending payment, stock hold, expiry job) is built and tested but not reachable from the UI. | Cannot take online payments without a gateway; do not fake it | Implemented |
| D-030 | Customer sessions: phone OTP creates a 30-day cookie session (token stored hashed). Order links: a 192-bit secret tracking token can view **and cancel** that one order (guest-order model); a signed-in customer can also open/cancel their own orders by id. A retry after a network failure returns the existing order (never a second one) and sends the customer to "My orders". | Guest checkout without passwords; recoverable after failures | Implemented |
| D-031 | Product bundles (CAT-08) move to Milestone 3: they need the admin screen that defines them; the tables already exist. Promo codes remain P1. | Avoid a customer feature with no way to manage it | Deferred |
| D-032 | Customer OTP delivery is a console provider in development only. `OTP_PROVIDER=console` is refused in production. Real delivery (WhatsApp authentication template or DLT-registered SMS) is M4 and needs your approval of a paid provider. | No paid services without approval | Implemented (dev only) |

### Pivot decisions: van collection → hub delivery (2026-10-24, founder instruction)

> Founder: "We are not doing this van idea anymore." Delivery in three speeds: Instant ₹20, 1 hour ₹10, 3 hours free with no delivery or platform charges; Udaipur only; detect location automatically instead of pincode entry; new name. See `PIVOT_PLAN.md`.

| ID | Decision | Reasoning | Status |
|---|---|---|---|
| D-033 | **Business model changes to on-demand delivery from one hub** in Udaipur. Van, stops, routes, slots, collection, pre-order cut-offs and pincode coverage are removed from the product and the database (schema re-baselined, pre-launch, no data). Van-era documents are archived in `docs/archive-van-model/`. | Founder instruction | Implemented |
| D-034 | Speeds and fees as instructed (Instant ₹20, 1 hour ₹10, 3 hours ₹0; no platform charges). **Minimum order defaults to ₹0 as instructed, but I recommend ₹199-₹299 at least on the free 3-hour speed**; it is a per-speed setting already built. | Unit economics: ₹3 contribution per order at a ₹300 basket (`UNIT_ECONOMICS.md`) | Implemented; founder to decide on minimums |
| D-035 | "Instant" = promise of **25 minutes**; 1 hour = 60; 3 hours = 180. Reach from the hub: 3 km / 7 km / 15 km. Capacity: 6 / 20 / 60 orders in progress. Hub hours 07:00-22:00, last order 20 minutes before closing. All are data, not code. | You did not define "instant"; these protect the promise | Provisional; replace with real hub data |
| D-036 | Name changed to **Hari Haat (हरी हाट)**. Searches found no existing business of that name; Tokri (existing Pune company and others), Fatafat (existing Jugnoo service) and Jhatpat (near "Jhutpat", a Delhi delivery startup) were rejected. Not a trademark search. The name lives in `app/src/lib/brand.ts`. | Founder asked for a new name | Provisional pending trademark/domain check |
| D-037 | **Location detection:** browser Geolocation API, only after a button tap; serviceability computed server-side by haversine distance to hub radii (no external service); fallback = address search; address text always editable. | Founder: no manual pincode | Implemented |
| D-038 | **Capacity model:** per-speed cap on orders in progress per hub, enforced under a per-hub advisory lock; replaces slot/stop/van capacity. Serialising checkouts per hub is fine for one hub; revisit with multiple hubs. | Prevents over-promising Instant | Implemented, tested under concurrency |
| D-039 | **Proof of delivery = customer's 4-digit code**; wrong-code limit (5/hour/order); manager override needs a note; riders may only act on their assigned orders; rider role replaces driver; permissions renamed (`order.deliver`, `delivery.read`, `delivery.manage`). | Replaces QR pickup; cheap, offline-friendly | Implemented (services); UI in M3 |
| D-040 | **Geocoder:** development uses the free public OpenStreetMap Nominatim service behind an interface (its policy: ~1 request/second, identifying User-Agent, caching; not for production traffic: secondhand summary, verify the official policy). **Production provider is OPEN** (Google, Ola Maps, MapMyIndia, or self-hosted Nominatim): needs your approval because it is a paid service and sends customer coordinates to a third party. The app refuses `GEOCODER_PROVIDER=nominatim` in production. | Cost and privacy | **Open** |
| D-041 | Cancellation rule: free until packing starts (no clock cut-off). | On-demand: the hub's progress, not the clock, is what matters | Implemented |
| D-042 | Pay on delivery (cash/UPI to the rider), cap ₹600 **including the delivery fee**, blocked after 2 customer-fault failed deliveries; online payment and "first order prepaid" arrive with the gateway (M4). | Same risk control as before | Implemented |
| D-043 | Stock is held at the hub and published daily; the buy-against-orders idea is dropped. Wastage assumption rises to 8% of COGS. | On-demand delivery cannot wait for a cut-off | Implemented in the model |
| D-044 | Local development databases renamed `harihaat_dev` / `harihaat_test`; env prefix `HH_` (e.g. `HH_DATABASE_URL`); cookies `hh_staff_session`, `hh_customer_session`. | Rename; still avoids the machine-wide `DATABASE_URL` collision (D-026) | Implemented |
| D-045 | The legal checklist now also covers rider engagement (employee vs contractor), vehicle insurance/licences, and location-data handling under DPDP. | New risks from delivery | Open (needs professional advice) |
| D-046 | No minimum order value for now (all speeds `min_order_paise = 0`), by founder choice. The field and the check stay in code; changing it is a data edit. | Founder decision. **Risk flagged:** at ₹150–250 baskets the delivery model loses money per order (see UNIT_ECONOMICS); ₹199–299 minimum recommended | Implemented (reversible) |
| D-047 | Staff authenticator (TOTP) step switched off by one flag, `MFA_ENFORCED = false` in `src/server/auth/permissions.ts`. Code, tables and tests are kept; `/admin/security` redirects to `/admin`. Staff sign in with email + password (Argon2id, lockout, rate limits) only. | Founder request to remove it for now. **Re-enable before any real staff, customer or payment data** (flip the flag, no other change) | Implemented (temporary) |
| D-048 | Storefront and admin UI redesigned: DM Sans + Hind, neutral palette with one deep-green brand and a saffron accent reserved for "fast", custom icons, per-vegetable colour tiles with Hindi names as an honest stand-in for photography, mobile-first (sticky header, location pill, bottom cart bar), light and dark tokens. | Founder feedback that the first UI looked generic. Real product photos are still needed to finish the look | Implemented |
| D-049 | Second UI pass: Plus Jakarta Sans (+ Hind for Devanagari); dark-green header with marigold cart button; rounded 18px cards; hero banner carousel; hand-drawn SVG illustrations for every product (34) and the three categories, replacing the colour tiles. Illustrations are original vector art made for this project, not photographs. | Founder feedback: still too plain, wanted banners, product images, a different font and a Blinkit/Zepto-style feel | Implemented. Real photography would still be better; swap in per product via `imageKey` once photos exist (licensing is the founder's call) |
| D-050 | Milestone 3 admin panel built: dispatch board, orders, packing, rider screen, catalogue and prices, stock and buying, cash hand-in, settings, reports (with CSV), staff, "Today". Every action is a server action that checks sign-in and permission again; screens only hide what a role does not need. | Founder runs operations from one panel | Implemented and tested (216 tests); not yet used with real orders |
| D-051 | Short or missing items at packing reduce what the customer owes (pro rata, BR-03). Pay-on-delivery orders simply collect less; prepaid orders queue a refund. A rider collects exactly "amount due". | Keeps D-007: never charge more than agreed, refund shortfalls | Implemented |
| D-052 | Riders and packers cannot see the Orders pages (customer names, phones, addresses). Riders see full details only for orders assigned to them (or ones they take); packers see items only. Completing a delivery without the customer's code is a manager-only action and needs a note. | Privacy and proof-of-delivery integrity | Implemented |
| D-053 | New staff get a one-time generated password and must choose their own at first sign-in; resetting signs the person out everywhere. The last active owner cannot be removed or switched off. | Founder creates rider and packer accounts without a developer | Implemented |
| D-054 | Not built in M3: proposing substitutes to customers (a packer can only mark an item unavailable and the customer is not charged for it), bundles and promo codes screens, notifications to customers, online payment and refunds. | Scope kept to what the founder listed | Open (M4 and later) |
| D-055 | M4 plan written (`M4_PLAN.md`). **Approved by the founder 2026-10-25 (all five recommendations):** build online payment in test mode but keep it off at launch (cash and UPI to the rider cost no fees); WhatsApp first for OTP and order updates, SMS later; compare Ola Maps and Google with 30 real Udaipur addresses before choosing a geocoder (D-040); hosting shape and region chosen after a short price check (D-004). | Margin is about Rs 3 an order, so avoid fixed and per-order costs until demand is proven | **Approved.** Step 1 built (D-056) |
| D-056 | M4 step 1 built: a message framework and background worker, with a fake channel only (no accounts, no cost). Each order event sends a bilingual (English + Hindi) message at most once per order, only with the customer's recorded consent, only while it still applies, retried with growing waits (30 s, 2 min, 10 min, 1 h, 6 h) and marked failed after 6 tries or a permanent error. One "running late" message goes out 5 minutes after the promised time. Failed messages show on the order page and on Today. The delivery code is sent only to the customer's own phone, only in the "out for delivery" message. | M4_PLAN.md step 1 | Implemented and tested (241 tests). **The Hindi wording needs review by a native speaker before launch** |
| D-057 | M4 step 2 prepared: address-search adapters for Google (format taken from Google's documentation) and Ola Maps (format **assumed, unverified**: Ola's reference pages could not be read), both scoped to Udaipur, cached, timed out at 4 s, results outside Udaipur dropped, keys never logged. A comparison script (`npm run geocoder:compare`) scores providers on your real addresses. Nothing is chosen yet; production still refuses the free OpenStreetMap service. | Choose the geocoder on evidence (D-040) | Prepared; waiting for the founder's addresses and free keys. **Open: Google may require a billing card even within its free allowance, and displays "Powered by Google"; Ola's terms and attribution not checked** |
| D-058 | Test addresses for the geocoder comparison were collected from public web pages (business listings, Wikipedia, hospital directories) instead of from the founder: 35 rows in `app/data/udaipur-addresses.public-web.csv`, 18 with a reference pin (business-published or Wikipedia; not surveyed), plus Hindi-script, short and misspelt variants. They are business addresses, not residents'. They are easier than apartment-society addresses, so the founder's own list is still worth adding later. First baseline of the free OpenStreetMap service: found 5 of 35 addresses; pin-to-address mostly returned just "Udaipur". | Founder asked me to find them myself | Done. Free OSM search is not good enough for address entry |

**Superseded by the pivot:** D-002 (collection-first), D-010 (no GPS: replaced by D-037), D-013 (walk-up surplus at stops), D-014 (evening route), D-016 (maps/routes), D-018 (Udaipur neighbourhood launch: now one hub), D-022 (BR-09 pay-at-van: now D-042), D-029/D-030 (slot-based wording; the OTP/session parts still apply), D-031/D-032 partly. D-001 (build) and D-007 (weight rule) still stand.

## 2. Alternatives rejected (with reasons)

- **Competing head-on with quick commerce on speed:** loss-making at scale for the largest player (Zepto Q4 FY26 adj. EBITDA loss ≈ ₹1,247.5 cr per secondary reports) **[V, secondary]**; we lack capital and dark-store density.
- **Own dark stores:** fixed rent per neighbourhood contradicts the lean model.
- **Subscription-first:** requires trust and a repeat base we don't have yet.
- **Marketplace of third-party sellers:** adds quality/legal complexity.
- **Buying a van now:** capital lock-in before validation. Hire first.

## 3. Facts I could not verify (and why they matter)

| Item | What I found | Why it matters |
|---|---|---|
| FSSAI licence class for an online-order, van-collected produce seller | Conflicting secondary sources; official PDFs could not be opened (certificate error); a March 2026 order reportedly raised turnover thresholds; e-commerce listed under central licence with no turnover limit | May change legal timeline and cost (central licence fee reported ₹7,500) |
| GST registration need | Fresh unbranded produce widely reported nil-rated; registration threshold values conflict across sources | Invoicing, ITC, registration timing |
| Razorpay India pricing | Older posts ~2% + GST; live page not confirmed | Unit economics (≈₹6 per order at 70% prepaid) |
| WhatsApp India per-message prices | Sources conflict (marketing ₹0.86 vs ₹1.09; utility ₹0.115–0.145) | Messaging budget (small) |
| Hosting plan limits/PITR/India regions | Not verified | Backup/latency decisions |
| Legal metrology for loose and pre-packed produce, weighing instruments | Nothing found | Scales, labels, billing at van |
| DLT/SMS rules, municipal/parking/vehicle permits | Not researched (city unknown) | OTP delivery, operating permission |
| Competitor prices, produce wholesale prices, van/driver wages | Deliberately not invented | Pricing and economics |

## 4. Open questions for you (ordered by impact)

> **Answered 2026-10-24:** 1 Udaipur · 2 budget unsure (still open) · 3 founder runs ops, wants a very capable admin panel · 4 build the full site · 5 Claude builds · 6 founder manages suppliers/vehicle/society contacts · 7 not registered yet (see D-023) · 8 approved · 9 wants name suggestions · 10 English UI, bilingual product names. The original list is kept below for reference.

1. **City and candidate neighbourhoods.** Drives supplier, price, permit and wage data. *If unknown, I'll continue with generic placeholders.*
2. **Budget and runway.** How much can you invest before month 12 (UNIT_ECONOMICS §9 suggests ₹12–20 lakh under the combined-lever case; Phase 0 alone is ₹60k–1.5 lakh)?
3. **Who runs daily operations**, and are you (and any co-founders) full-time?
4. **Do you approve D-001** (Phase 0 pilot first), or do you want to build in parallel?
5. **Developer resources:** will you hire a developer/agency, or am I to build it all? (Affects effort and the build-cost line.)
6. **Existing relationships:** any supplier, vehicle, society or RWA contacts already available?
7. **Business structure** (proprietorship/LLP/Pvt Ltd) and bank account status.
8. **Variable-weight policy D-007** and **pay-at-van caps (BR-09)**: approve or adjust.
9. **Brand:** are you attached to any name? (I'll run availability checks on shortlisted names only.)
10. **Language:** English-only UI at launch, or English + Hindi/regional from day 1?

## 5. Proactive improvement register

| Idea | Problem | Complexity | Financial/ops impact | Risk | Priority | Decision |
|---|---|---|---|---|---|---|
| Family bundles | Low AOV | Low | + AOV, + planning | Substitution complexity | P0 | Implement in MVP |
| Walk-up surplus sales | Wastage | Medium | Recovers margin | Billing/compliance | P1 | Defer; manual in pilot |
| Digital pickup token (QR) | Queue speed | Low | −dwell time | None | P0 | Implement |
| Micro-windows per stop | Queues | Low | Better service | Customer confusion | P1 | Pilot manually |
| Cutoff-aware reminders | Late orders | Low | + conversion | Over-messaging | P1 | Implement with consent |
| Neighbourhood demand heatmap | Expansion choice | Medium | Better stop choice | Low data | P2 | Defer; waitlist table now |
| Waitlist for unsupported areas | Expansion demand | Low | Free demand data | Privacy | P0 | Implement |
| Customer-selected substitutions | Shortages | Medium | Fewer refunds | Complexity | P1 | Basic version P0 (approve/refund) |
| Route-level profitability | Unit economics | Medium | Core decision metric | Needs cost entry | P1 (simple version P0) | Implement simple |
| Supplier scorecards | Quality | Low | Better buying | Data entry | P1 | Defer |
| Weekly scheduled baskets | Retention | Medium | + frequency | Consent | P2 | Defer |
