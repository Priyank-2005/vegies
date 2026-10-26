# Hari Haat: everything we are building, and how far along it is

> Status as of 2026-10-26. This page is a plain-language map of the whole product. The detailed requirements are in `PRD.md`, the reasoning behind choices in `DECISIONS.md`, and the plan for what comes next in `ROADMAP.md` and `M4_PLAN.md`.

## 1. What this is

**Hari Haat (हरी हाट)** is a fresh vegetable and fruit delivery service for **Udaipur, Rajasthan**. Customers order on their phone and get delivery from one local hub in three speeds:

| Speed | Delivery charge | Promise |
|---|---:|---|
| Instant | Rs 20 | about 25 minutes |
| 1 hour | Rs 10 | within 60 minutes |
| 3 hours | Free | within 180 minutes |

There are no platform, handling or packaging charges. Customers pay the rider in cash or UPI when the order arrives. The shop is in English with Hindi product names, and customers can search in English, Hindi or Hinglish.

The product has three faces: the **customer shop** (a website that works well on a phone), the **operations panel** where the owner and staff run the day (dispatch, packing, riders, stock, prices, reports), and the **background worker** that sends messages and tidies up in the background.

## 2. How far along it is

**In one line:** the software a first pilot needs is about **82% built** (counting the launch-critical software features; a partly finished feature counts as half). Nothing can be sold to real customers yet, because the legal registration, the real hub, the rider arrangement, real prices and the live message and hosting accounts are still open.

| Measure | Result |
|---|---|
| Launch-critical (P0) software features done | 30 done and 6 partly done, out of 40 |
| All launch-critical items including your business tasks | 30 done and 6 partly done, out of 46 (72%) |
| All features, including nice-to-haves and later ideas | 52% |
| Automated tests | 251, all passing (they run against a real database) |
| Size of the code | about 14,600 lines of application code and 3,300 lines of tests, 157 source files, 28 screens, 20 API endpoints, 41 database tables |

### Milestones

| Milestone | What it covers | Progress |
|---|---|---|
| M1 Foundation | Database, sign-in, roles, audit trail, money and stock rules, design kit | **Done** |
| M2 Customer ordering | Location, serviceability, shop, search, cart, checkout, order tracking, cancel | **Done** (real-phone GPS untried) |
| M3 Operations panel | Dispatch, packing, riders, catalogue, stock, cash, settings, reports, staff | **Done** for the planned screens (about 95%: substitution proposals, bundles, promos, audit viewer and customer screen are not built) |
| M4 Integrations | Message worker, address search provider, online payment, real WhatsApp, hosting | **About 20%.** Step 1 (message worker with a fake channel) is done; step 2 (address search) is prepared and waits for free keys; payments, hosting and live messaging are next |
| M5 Hardening | Security review, backups, monitoring, phone-size browser tests, load test | Not started |
| M6 Pilot | Real hub, dry run with staff, then friends and family | Not started; blocked on registration and a real hub |

## 3. What is built, what is next

Status words: **Done** (built and tested here), **Partly** (built, with a named gap), **Planned** (scheduled), **Blocked** (waiting for your input or a third party), **Later** (only if data shows it is needed). P0 means launch-critical, P1 useful soon after, P2 later.

### Customer shop (12 done, 5 partly, 24 in total)

| Feature | Priority | Status | Notes |
|---|---|---|---|
| One-tap location detection (browser GPS, only after a tap) | P0 | Done | Denied-permission path tested for real; the success path was tested with a simulated position. Real phone GPS not yet tried |
| Address search when location is denied or unsupported | P0 | Partly | Works with the free OpenStreetMap service, which found only 5 of 35 test addresses. Production provider being chosen (Ola Maps vs Google) |
| Pin to address (reverse lookup) to pre-fill the address | P0 | Partly | Free service often answers just "Udaipur". Same provider decision |
| Serviceability: distance, opening hours, last-order buffer, per-speed capacity | P0 | Done | Server-side; concurrent orders cannot over-book a speed |
| Three delivery speeds: Instant Rs 20, 1 hour Rs 10, 3 hours free; no platform fees | P0 | Done | Fees, promises, reach and capacity are database rows the owner edits in Settings |
| Waitlist for customers outside Udaipur (rough location only) | P0 | Done |  |
| Bilingual catalogue (English + Hindi) and search in English, Hindi or Hinglish | P0 | Done | 34 sample vegetables from the founder's price list |
| Professional design: banners, illustrated product images, categories, dark mode, mobile-first | P1 | Done | Product pictures are original illustrations, not photos. Real photos need licensed images |
| Cart with server-side pricing (the browser never sends a price) | P0 | Done |  |
| Checkout with phone-number code (OTP), guest-friendly | P0 | Partly | The code is only shown in development. Real delivery of the code needs the WhatsApp or SMS provider |
| Pay on delivery (cash or UPI to the rider), capped at Rs 600 including the fee | P0 | Done | Cap and failed-delivery limit are editable settings |
| Order page: status steps, arrival time, 4-digit delivery code, items, totals | P0 | Done |  |
| Cancel for free until packing starts | P0 | Done | Releases the reserved stock |
| My orders (sign in with phone number) | P0 | Done |  |
| Short-weight and missing-item adjustment shown to the customer | P0 | Done | Customer never pays more than agreed; shortfalls are taken off the bill |
| Policies page (delivery, refunds, weights) | P0 | Partly | Written; needs review by a professional before launch |
| Order messages: confirmed, out for delivery, delivered, cancelled, failed, running late | P0 | Partly | Message system, bilingual texts, consent and retries are built and tested with a fake channel. Real WhatsApp sending not yet connected |
| Online payment and refunds | P1 | Planned | Will be built in test mode and kept switched off at launch (cash and UPI to the rider cost nothing) |
| Bundles (family baskets) | P1 | Planned |  |
| Promo codes | P2 | Later |  |
| Saved addresses | P2 | Later |  |
| Map pin confirmation and drag to adjust | P2 | Later | Needs a map provider |
| Live rider map for customers | P2 | Later | Only if it measurably reduces support calls |
| Schedule delivery for later | P2 | Later |  |

### Operations panel (11 done, 0 partly, 19 in total)

| Feature | Priority | Status | Notes |
|---|---|---|---|
| Today dashboard: new, in progress, late, needs a decision, sales, cash with riders, message failures | P0 | Done | Refreshes itself |
| Dispatch board: four lanes, countdown to each promise, assign rider, send out | P0 | Done |  |
| Orders: search by code, name or phone; full detail with timeline, payment and messages | P0 | Done | Cancel, and complete without code (manager only, with a note) |
| Packing screen: weigh each item, free 5% extra, short weight refunded pro rata, put on hold | P0 | Done |  |
| Rider screen (phone): call, navigate, delivery code, cash or UPI, could-not-deliver | P0 | Done | Riders see only their own orders; can take unclaimed packed orders |
| Cash hand-in: cash each rider holds, mark handed in | P0 | Done |  |
| Catalogue editor: products, Hindi names, spellings, units, limits, price history, offers, categories | P0 | Done | A price change shows in the shop straight away |
| Stock and buying: daily published quantity, receiving, rejections, wastage, suppliers | P0 | Done | Cannot publish below what is already ordered |
| Settings: store location and hours, each speed's fee, promise, reach, capacity; business rules (owner only) | P0 | Done |  |
| Reports: sales, fees, on-time %, by speed, top products, day by day, cash, wastage; CSV download | P0 | Done |  |
| Staff: add people with a one-time password, roles, switch off, reset; first-sign-in password change | P0 | Done | The last owner cannot be removed |
| Substitution proposals to customers (accept a substitute or refund) | P1 | Planned | Today a packer can only mark an item unavailable |
| Refund screen and payment reconciliation | P1 | Planned | Comes with online payment |
| Customer screen (notes, block a customer) | P1 | Planned |  |
| Audit log viewer | P1 | Planned | Every change is already recorded; there is no screen to read it yet |
| Bundles and promo-code screens | P1 | Planned |  |
| Support inbox / WhatsApp replies | P2 | Later |  |
| Demand forecast and buy list suggestions | P2 | Later | Only with real sales data |
| Rider batching and route suggestions | P2 | Later | Only with real delivery data |

### Platform and safety (8 done, 2 partly, 16 in total)

| Feature | Priority | Status | Notes |
|---|---|---|---|
| Roles with server-side permissions (Owner, Ops manager, Procurement, Packer, Rider, Support) | P0 | Done | Riders and packers cannot see customer lists |
| Staff sign-in: strong password hashing, lockout, sessions, rate limits | P0 | Done |  |
| Staff authenticator app (two-factor) | P0 | Partly | Built and tested, switched off by the founder's decision. Must be switched on before real data (one setting) |
| Audit trail for every important change | P0 | Done |  |
| Stock engine: no overselling, reservations, append-only ledger | P0 | Done | Tested with simultaneous orders |
| Money and quantities as whole numbers (paise, grams) | P0 | Done | Never decimals |
| Request protection: rate limits, same-site checks, logs without personal data | P0 | Done |  |
| Background worker: send messages, release unpaid orders, late-order notices | P0 | Done | Run with npm run worker |
| Automated tests (251) with a real database | P0 | Done | Last run: all pass |
| Continuous checks on GitHub (typecheck, lint, tests, build) | P1 | Partly | Written; its first real run happens when this code is pushed |
| Hosting, domain, HTTPS and a staging copy | P0 | Planned | Needs your decision and payment (M4 step 4) |
| Browser end-to-end tests on a phone-size screen | P1 | Planned | M5 |
| Independent security review | P0 | Planned | M5 |
| Backups with a tested restore | P0 | Planned | M5 |
| Monitoring and alerts | P0 | Planned | M5 |
| Load test of checkout; accessibility and speed audit | P1 | Planned | M5 |

### Business and launch (0 done, 0 partly, 7 in total)

| Feature | Priority | Status | Notes |
|---|---|---|---|
| Legal registration and food licence (FSSAI) for the first real sale | P0 | Blocked | Founder with a professional (D-023). Also gates SMS registration and the payment account |
| Real hub address, lease and opening hours | P0 | Blocked | Founder input |
| Rider model and cost (employed, per-delivery, or partner) | P0 | Blocked | Founder input; changes the economics |
| Real selling prices and mandi buying prices | P0 | Blocked | The sample list looks like wholesale prices |
| WhatsApp business number and verification | P0 | Blocked | Founder input (M4) |
| Hindi wording review of customer messages and policies | P1 | Blocked | Needs a native speaker |
| Pilot: staff-only dry run, then friends-and-family orders with capped capacity | P0 | Planned | M6 |

## 4. What we have checked, and what we have not

**Checked automatically (251 tests, real database):** pricing and delivery fees, stock reservations with simultaneous orders, serviceability by distance, hours and capacity, order and delivery state rules, proof of delivery with the code, short-weight adjustments, cash receipts, permissions for each role, the message system (consent, once-only, retries, late notices), address-search adapters, reports, staff rules.

**Checked by hand in a browser:** the shop on a phone-size and desktop screen and in dark mode; a full order placed through the shop; the operations panel screens, including packing an order short, handing it to a rider and completing the delivery with the code.

**Not checked yet:**
- A real phone's GPS (the browser used here cannot grant it).
- Any real WhatsApp or SMS message, any real payment, any real hosting. Nothing has been bought or registered.
- Ola Maps: the way our code talks to it is an assumption, to be confirmed with a real key.
- Real orders with real staff, real riders and real produce.
- Security by an independent reviewer, load, and long-running reliability.

## 5. Things you should know

- **The economics are thin.** At a Rs 300 basket the model earns about Rs 3 per order after rider, packing, packaging, wastage and payment costs, and your sample price list gives baskets of Rs 150-250 (see `UNIT_ECONOMICS.md`). No minimum order is set by your choice; a Rs 199-299 minimum is recommended. The pilot is how we find out.
- **Two-factor sign-in for staff is switched off** by your decision. Turn it back on (one setting) before any real customer or money data goes in.
- **No real sale before registration.** The software can be finished first; selling needs the registration questions in `BUSINESS_PLAN.md` answered by a professional.
- **Pictures are illustrations.** Real product photos can be added later through the catalogue.
- **Hindi text** in messages and the policies page was written by the developer and needs a native speaker's review.

## 6. What happens next

1. Choose the address-search provider with real keys (needs two free accounts from you): `M4_PLAN.md` step 2.
2. Online payment in test mode, kept switched off at launch (step 3).
3. Staging server, domain and backups (step 4, needs your decision and payment).
4. Real WhatsApp messages (step 5, needs a business number and registration).
5. Hardening, then the pilot.

Your own tasks that take calendar time and should start now: the legal registration path and FSSAI, the real hub address, the rider arrangement, real selling prices, and a WhatsApp business number.
