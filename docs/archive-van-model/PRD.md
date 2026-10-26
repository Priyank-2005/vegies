# Product Requirements Document (PRD)

> Status: DRAFT v0.1 · 2026-10-23 · Companion docs: `BUSINESS_PLAN.md`, `OPERATIONS_PLAN.md`, `ARCHITECTURE.md`
> Priority legend: **P0** = essential for a safe, usable launch · **P1** = valuable improvement · **P2** = future.
> Requirement IDs (e.g. `CAT-03`) are stable so tests and tickets can reference them.

## 1. Product objectives

1. Let a household place a **correct, fairly-priced** produce order in under ~3 minutes on a mid-range phone.
2. Aggregate orders per **stop × slot** so the van route is economically viable.
3. Give operations everything needed to **procure, pack, load, hand over, reconcile** without spreadsheets.
4. Produce trustworthy **numbers** (orders, cash, refunds, wastage, route contribution) to decide whether to scale.
5. Keep the system small enough for one or two engineers to run.

**Non-goals for MVP:** instant (<60-min) delivery, native mobile app, AI voice agent, marketplace of third-party sellers, auto-recurring card charges, live GPS tracking for customers.

## 2. Users and personas

| Persona | Description | Key needs |
|---|---|---|
| **Meera, 34** (primary customer) | Working parent in a gated society; buys veg weekly, fruit twice/week; uses UPI, WhatsApp daily | Fast reorder, clear weights, reminders, no surprises |
| **Mr. Rao, 62** | Retired, prefers to choose in person, limited app comfort | Simple UI, large text, phone/WhatsApp ordering by staff (P1), cash/UPI at van |
| **Arjun, 27** | Hostel/PG resident, small baskets | Low minimum, quick pay |
| **Society secretary (RWA)** | Allows van entry; wants no disruption | Predictable schedule, orderly queue |
| **Owner/Ops manager** | Runs the business | Daily plan, margin visibility, exceptions |
| **Procurement manager** | Buys at market | Consolidated buy list with suggested quantities, actual cost entry |
| **Packer** | Packs orders | Pick list by SKU/order, weight entry, labels |
| **Driver / handover staff** | Drives, serves at stop | Offline-tolerant stop list, search, QR scan, payment recording |
| **Support agent** | Handles complaints | Order lookup, refund/credit within limit, templates |

## 3. User stories (selection; full list maps to requirement IDs)

**Customer**
- As Meera, I enter my pin code/society and see if I'm served and what the next slots are. (SVC-01..)
- I search "tomato", set 1.5 kg, and see the line total live. (CAT, CART)
- I check out as guest with phone OTP, pick a stop & slot, pay by UPI. (CHK)
- I get a WhatsApp/SMS confirmation with a pickup code and QR. (NTF, COL)
- I see "Packed", "Van left hub", "Arriving 5:40–6:00 PM". (TRK)
- I'm told a product is out of stock *before* the van comes and can accept a substitute or refund. (SUB)
- I reorder last week's basket in two taps. (RET, P1)
- If I'm not in an area, I join a waitlist. (SVC-05)

**Staff**
- As procurement, I see the buy list for tomorrow with suggested quantities and enter actual received quantity and cost per lot. (INV)
- As packer, I mark each order packed with actual weights; the system flags any item below ordered weight. (PCK)
- As driver, I open the stop, scan the customer's QR, confirm the handover, and record UPI/cash if payment is pending. (COL)
- As owner, I see yesterday's orders, collected cash vs prepaid, refunds, wastage, and route contribution. (ANL)

## 4. Functional requirements

### 4.1 Serviceability & slots (SVC)

| ID | Requirement | Pri |
|---|---|---|
| SVC-01 | Customer can check serviceability by pin code or by selecting an area/society from the configured list | P0 |
| SVC-02 | Show available collection stops, each with description, map link, arrival window, and remaining capacity | P0 |
| SVC-03 | Server rejects checkout for unsupported areas, closed/past-cutoff slots or full slots | P0 |
| SVC-04 | Slot capacity enforced on server using composite capacity (orders, packing minutes, dwell time, vehicle load units); see rules BR-07 | P0 |
| SVC-05 | Waitlist/"notify me" capture for unsupported areas with consent | P0 |
| SVC-06 | Admin can configure cutoff per route/slot/date and apply authorized exceptions | P0 |
| SVC-07 | Home delivery option for configured serviceable societies/gates only, feature-flagged and capacity-limited | P1 |
| SVC-08 | "Request earlier slot / different method" request form; ops approves or offers alternatives; customer must accept changes | P1 |
| SVC-09 | Society pages (SEO) with stop schedule | P1 |

### 4.2 Catalog (CAT)

| ID | Requirement | Pri |
|---|---|---|
| CAT-01 | Products with name (+ local-language name), category, images, description, storage guidance, origin (only if verified), grade | P0 |
| CAT-02 | **Configurable sale units** (kg, g-step, piece, bunch, pack), each with base unit (grams or pieces), min/max/step quantities | P0 |
| CAT-03 | Price stored per sellable unit as integer paise; sale price/promo with validity window | P0 |
| CAT-04 | Unit price always shown (e.g. "₹48 / kg") plus a comparison unit where different | P0 |
| CAT-05 | Weight model per product: `FIXED_PACK`, `APPROX_PIECE`, `LOOSE_WEIGHT` with tolerance settings | P0 |
| CAT-06 | Availability: active flag, seasonal window, per-day published stock; "unavailable today" shown (not hidden) | P0 |
| CAT-07 | Category, search (name, local name, transliteration), sort by price/popularity, filters | P0 |
| CAT-08 | Bundles (family veg basket, fruit basket) defined as a list of product-quantities, with bundle price and substitution rules | P0 |
| CAT-09 | Seasonal/discount collections | P1 |
| CAT-10 | Product variants/grades (e.g., "Premium") | P1 |
| CAT-11 | Real photography upload and image optimisation | P0 |
| CAT-12 | SEO: server-rendered product/category pages with structured data | P1 |

### 4.3 Cart & checkout (CART/CHK)

| ID | Requirement | Pri |
|---|---|---|
| CART-01 | Persisted cart (browser storage + server-side for logged-in/OTP-verified) | P0 |
| CART-02 | Stepper quantity control obeys min/max/step; quick +/- on mobile | P0 |
| CART-03 | Cart shows estimated subtotal, fees, minimum order progress; server **recomputes** all totals on every checkout call | P0 |
| CART-04 | Unavailable item behaviour: flagged in cart, blocked at checkout, offer alternative | P0 |
| CHK-01 | Guest checkout with phone OTP (WhatsApp/SMS) | P0 |
| CHK-02 | Steps: review → fulfilment (stop or delivery) → slot → contact → promo → summary with weight rules → payment → confirm | P0 |
| CHK-03 | Payment methods configurable per fulfilment mode: online (UPI/cards/netbanking via gateway), pay-at-van (cash/UPI) subject to rules | P0 |
| CHK-04 | **Idempotent order creation** (idempotency key); double-click/refresh cannot double-create | P0 |
| CHK-05 | Order is `CONFIRMED` only after verified payment (prepaid) or accepted COD rules; never from client redirect alone | P0 |
| CHK-06 | Stock reserved at confirmation with transactional locking; checkout-time soft hold (e.g. 10 min) for prepaid | P0 |
| CHK-07 | Promo code engine (percentage/fixed, min basket, first-order, usage limits, validity, per-phone limit) | P1 (P0 for first-order discount only if marketing needs it) |
| CHK-08 | Order confirmation page + message with pickup code/QR + order tracking link | P0 |
| CHK-09 | Variable-weight pricing explanation shown before payment (BR-03) | P0 |
| CHK-10 | Terms/refund policy acknowledgement recorded with timestamp and version | P0 |

### 4.4 Tracking & communications (TRK/NTF)

| ID | Requirement | Pri |
|---|---|---|
| TRK-01 | Public-but-unguessable tracking page per order (signed token) showing status, stop, window, payment status, cancel eligibility, refund status | P0 |
| TRK-02 | Statuses: Confirmed → Being prepared → Packed → Van departed → Arriving soon / At stop → Collected; plus Delayed, Cancelled, Refunded | P0 |
| TRK-03 | No driver private location, no other customers' data on tracking | P0 |
| TRK-04 | Stop status: scheduled / en route / arrived / delayed / completed | P0 |
| TRK-05 | Live map tracking of van | P2 (only if data shows it reduces support/no-shows) |
| NTF-01 | Transactional messages: confirmation, cutoff-related changes, packed, van departed, 30-min reminder, delay, substitution request, refund | P0 (email + SMS or WhatsApp; choose by cost/compliance, see ARCHITECTURE) |
| NTF-02 | Delay broadcast to all customers on affected stop within 2 minutes of status change | P0 |
| NTF-03 | Marketing messages only to opted-in customers with unsubscribe | P1 |

### 4.5 Collection at the van (COL)

| ID | Requirement | Pri |
|---|---|---|
| COL-01 | Stop sheet for driver/handover staff: list by name/code, search by code/last 4 digits/name | P0 |
| COL-02 | Verify customer by pickup code or QR (customer displays on phone); fall back to name + phone last-4 | P0 |
| COL-03 | Show packed items; staff confirm collected; record discrepancy/partial | P0 |
| COL-04 | Record outstanding payment (cash/UPI) at handover; UPI shown as dynamic QR or reference entry (see ARCHITECTURE) | P0 |
| COL-05 | Receipt/confirmation sent by message after collection | P0 |
| COL-06 | **Offline-tolerant** stop sheet (PWA; queue actions and sync) | P0 for read; P1 for write queue |
| COL-07 | Queue management: arrival-window splitting by sub-slot (e.g. 10-min micro-windows), "ready" ping when it's your turn | P1 |
| COL-08 | No-show handling: hold N minutes, mark `NO_SHOW`, policy-based refund/credit; unsold bag returns to hub or goes to walk-up | P0 |
| COL-09 | Walk-up sales of surplus (POS-like mode) | P1 |

### 4.6 Admin: catalog, inventory, procurement (ADM/INV)

| ID | Requirement | Pri |
|---|---|---|
| INV-01 | **Append-only inventory ledger** (`received`, `reserved`, `released`, `packed`, `sold`, `damaged`, `wasted`, `adjusted`, `returned`) per product per lot/date; balances derived | P0 |
| INV-02 | Goods received note: supplier, qty (actual weight), purchase cost, inspection result (accepted/rejected/partial) | P0 |
| INV-03 | Procurement suggestion: confirmed demand + buffer % (configurable per SKU) − stock on hand | P0 (formula-based); P1 demand forecasting |
| INV-04 | Shortage detection when received < reserved; identifies affected orders | P0 |
| INV-05 | Substitution workflow with customer approval (SUB) | P0 |
| INV-06 | Wastage entry with reason; end-of-day reconciliation | P0 |
| INV-07 | Fast/slow-mover report | P1 |
| INV-08 | Supplier master data, simple scorecard (quality rejections, price, on-time) | P1 |

### 4.7 Orders, packing, routes (ORD/PCK/RTE)

| ID | Requirement | Pri |
|---|---|---|
| ORD-01 | Order list/filters by date, stop, status, payment method/status | P0 |
| ORD-02 | State machine with validated transitions only; every transition audit-logged with actor | P0 |
| ORD-03 | Cancellation rules by stage (BR-08); refunds with permission tiers | P0 |
| ORD-04 | Order notes/history/audit trail | P0 |
| PCK-01 | Pick list (aggregated by SKU for buying; by order for packing) as printable/PDF; labels with order code, stop, customer first name, pack items | P0 |
| PCK-02 | Record actual packed weight per line; enforce tolerance rules | P0 |
| PCK-03 | Packing station screen on a tablet/phone, bag/crate IDs | P1 |
| RTE-01 | Create daily route: ordered list of stops, windows, dwell times, vehicle | P0 |
| RTE-02 | Assign orders to stops automatically from customer's chosen stop; manual override with audit | P0 |
| RTE-03 | Travel-time estimates using a maps API (cached matrix), manual overrides | P1 (P0 is manual time entry) |
| RTE-04 | Route optimization | P2 (stops are few; manual ordering with matrix suggestions is enough) |
| RTE-05 | Publish schedule change → messages to affected customers | P0 |
| RTE-06 | Van load plan: crates by stop, load order reverse of stops | P1 |

### 4.8 Staff, permissions, audit (STF)

| ID | Requirement | Pri |
|---|---|---|
| STF-01 | Roles: Owner, Ops Manager, Procurement/Inventory, Packer, Driver/Handover, Support | P0 |
| STF-02 | Permission checks on server for every mutation; deny by default | P0 |
| STF-03 | Staff login: email/phone + password + TOTP (Owner/Ops/Procurement mandatory); lockout & rate limit | P0 |
| STF-04 | Audit log for sensitive actions (price changes, refunds, stock adjustments, role changes, exceptions) with before/after | P0 |

### 4.9 Payments & reconciliation (PAY)

| ID | Requirement | Pri |
|---|---|---|
| PAY-01 | Gateway order created server-side; amount from server-calculated total | P0 |
| PAY-02 | Webhook with signature verification is the source of truth; idempotent processing by event ID | P0 |
| PAY-03 | Redirect/return page only *reads* state, never sets paid | P0 |
| PAY-04 | Payment ledger: payments, refunds, cash collections, adjustments as immutable rows | P0 |
| PAY-05 | Refund via gateway with status tracking; partial refunds | P0 |
| PAY-06 | Daily reconciliation view: gateway settlement vs internal ledger vs cash deposited | P0 (manual import of settlement CSV is fine) |
| PAY-07 | Store credit / wallet | P1 (prefer refund-to-source; credits only with consent) |
| PAY-08 | Outstanding balances (pay-at-van unpaid, no-show debt) | P1 |

### 4.10 Analytics (ANL)

P0: orders/day, GMV, AOV, cancellation rate, fulfilment rate, on-time arrival, refunds, wastage, product sales, orders per stop. P1: gross profit by order/product/route, contribution margin, repeat rate, CAC by channel (requires marketing spend entry), neighbourhood demand heatmap. Metrics must label **GMV vs net sales vs cash collected vs refunds vs gross profit vs contribution** distinctly (definitions in §8).

## 5. Business rules (BR)

- **BR-01 Money & quantity:** money stored as integer paise; quantities as integer base units (grams, pieces). No floats in money/quantity paths. Rounding: round half up at the line level, once.
- **BR-02 Server-authoritative pricing:** client totals are advisory; server recomputes from DB prices at checkout and at payment capture.
- **BR-03 Variable weight (recommended policy; needs your approval, DECISIONS D-007):**
  - `FIXED_PACK`: price fixed; weight within declared tolerance.
  - `APPROX_PIECE` (e.g. cabbage, pumpkin, watermelon): sold per piece or per "approx X kg"; **customer pays the price shown at order**; packed weight must fall within the published band (e.g. ±10%); below band → price-adjusted credit/refund automatically.
  - `LOOSE_WEIGHT` (e.g. 1.5 kg tomatoes): pack ≥ ordered weight; up to +5% over-pack is a free giveaway; **we never charge more than the amount agreed at checkout**; if short, pro-rata refund.
  - Charging by actual weight (above agreed price) is **out of scope for MVP** (P2) because it needs payment authorization/capture and explicit consent.
- **BR-04 Cutoff:** per route/slot/date configurable; after cutoff the next eligible slot is offered; exceptions need Ops Manager+ role and are logged.
- **BR-05 Inventory reservation:** confirmed orders reserve stock transactionally (`SELECT … FOR UPDATE` / atomic decrement); reservations released on cancel/expiry; goods received but not yet inspected are *not available to sell*.
- **BR-06 Shortage & substitution:** staff cannot substitute silently. The customer is notified and chooses: approved substitute / skip-and-refund / cancel order. If no response by deadline, default is **refund of that line** (never auto-substitute).
- **BR-07 Capacity:** slot is full if any limit is hit: max orders, max packing minutes (Σ per-order packing estimate), max stop dwell (orders × avg service seconds ≤ window), vehicle load units. Checked inside the order transaction.
- **BR-08 Cancellation (provisional, to be reviewed by counsel):** free and fully refunded until the slot cutoff; after cutoff but before the procurement lock (Ops-configured time) → still fully refunded, since nothing has been bought; after procurement/packing → at Ops discretion (cost of already-bought perishables may be non-refundable, policy to be published); after dispatch → treated as a no-show (BR-10). Quality and short-weight refunds are always honoured.
- **BR-09 Pay-at-van:** allowed only if: customer phone verified, order value ≤ cap (default ₹600, configurable), customer has no unpaid balance, and fewer than N no-shows. First-ever order should be prepaid (configurable).
- **BR-10 No-show:** bag held for window + grace; then marked `NO_SHOW`; prepaid → full refund on the first occurrence; credit or partial forfeit for repeat occurrences (policy to be set, published, and checked against consumer-protection requirements).
- **BR-11 Minimum order:** configurable, default none for collection; ₹ threshold for home delivery.
- **BR-12 Promotions:** apply only to eligible lines; never reduce price below cost without explicit override; usage limits per phone/device/address.
- **BR-13 Data retention:** order/payment data retained as legally required (confirm period with CA); marketing data per consent; deletion workflow for customer requests.

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Mobile LCP ≤ 2.5 s on mid-range Android over 4G for home/catalog (target, measured with Lighthouse) |
| Availability | Aim ≥ 99.5% monthly for customer site; no on-call in MVP, uptime alert + owner phone alert |
| Security | OWASP ASVS-aligned controls: server-side authz, validation, rate limits, CSRF, secure cookies, webhook verification, secrets in env, no card data stored |
| Privacy | Consent logging; minimal PII; no PII in logs; retention/deletion |
| Accessibility | WCAG 2.1 AA for customer flows; contrast; keyboard; large tap targets |
| Localisation | English first; Hindi/regional language names for products and later UI strings (i18n-ready) |
| Offline | Stop sheet usable with flaky connectivity |
| Observability | Structured logs, error tracking, business-event audit |
| Maintainability | TypeScript strict, tests on all P0 business rules, migrations versioned |

## 7. MVP scope vs deferred

**MVP (Release 1 / P0):** SVC-01..06, CAT-01..08/11, CART, CHK-01..06/08..10, TRK-01..04, NTF-01/02, COL-01..05/08, INV-01..06, ORD-01..04, PCK-01..02, RTE-01/02/05, STF-01..04, PAY-01..06, ANL P0 set, SUB workflow.

**Deferred with reason:**

| Feature | Why deferred | Revisit when |
|---|---|---|
| Home delivery (SVC-07) | Breaks route density; adds rider/cost | Pilot shows demand from non-walkers and economics |
| Route optimization (RTE-04) | 4–6 stops; manual ordering is fine | >8 stops/route or multiple vehicles |
| Live GPS (TRK-05) | Cost & privacy; windows suffice | Delay complaints >10% |
| Mobile app | Web + PWA is enough | Retention data justifies |
| AI voice agent | Needs stable catalog/inventory APIs first | Release 4 |
| Subscriptions with auto-charge | Mandate/consent complexity | Customer demand + legal review |
| Wallet/loyalty points | Accounting complexity | After repeat-rate data |
| Demand forecasting ML | Not enough data | ≥ 8–12 weeks of history |

## 8. Metric definitions (never interchangeable)

| Term | Definition |
|---|---|
| GMV | Σ list-price value of confirmed order lines |
| Net sales | GMV − discounts |
| Revenue collected | Cash+UPI+gateway money actually received, net of refunds |
| Refunds | Money returned (separately: credits issued) |
| Gross profit | Net sales − refunds − COGS (actual lot cost) − wastage allocated |
| Contribution profit | Gross profit − variable costs (packaging, payment fees, packing labour, messaging, route costs) |
| Operating profit | Contribution − fixed costs |

## 9. Acceptance criteria (representative; one set per P0 area)

- **AC-SVC:** Given pin code 999999 (unserved), checkout API returns 422 `AREA_NOT_SERVED`, UI shows waitlist form. Given a slot whose capacity is exhausted by a concurrent order, exactly one of two simultaneous checkouts succeeds.
- **AC-PRICE:** Tampering with a client-supplied price/total has no effect; response total equals DB-derived total to the paisa.
- **AC-UNIT:** A quantity of 0.3 kg for a product with step 0.5 kg is rejected with a clear message.
- **AC-STOCK:** 50 parallel checkouts against 10 units of stock produce exactly 10 reservations and 40 `OUT_OF_STOCK` responses.
- **AC-PAY:** A forged webhook (bad signature) returns 401 and changes nothing; replaying a valid webhook twice creates one payment row; visiting the success URL without a webhook leaves the order `PENDING_PAYMENT`.
- **AC-IDEMP:** Submitting the same checkout twice with the same idempotency key returns the same order.
- **AC-AUTHZ:** Packer token calling refund endpoint → 403; unauthenticated → 401; all privileged routes covered in an automated authorization matrix test.
- **AC-CANCEL:** Cancelling a confirmed prepaid order before cutoff releases reservation and creates a pending refund ledger entry; after dispatch it is rejected.
- **AC-SUB:** A substitution cannot be marked accepted without a customer response record (or explicit admin override with reason); default after deadline is refund.
- **AC-PICKUP:** Collection records actor, time, items, payment, and discrepancy; cannot be done twice.
- **AC-RECON:** Σ ledger entries = displayed totals on dashboard for any date; a test seeds data and asserts.
- **AC-ROUTE:** Moving a stop's window triggers notifications to exactly the affected orders once.
- **AC-MOBILE:** Home → add 3 items → checkout works at 360×640 viewport (Playwright).

## 10. Edge cases and failure scenarios

| Scenario | Required behaviour |
|---|---|
| Payment succeeds but customer closes the tab | Webhook confirms order; confirmation message sent |
| Payment succeeds *after* hold expired and stock gone | Auto-refund + apology message, or accept if stock available (configurable) |
| Webhook delayed | Order shows "Confirming payment"; poll gateway API status as fallback (reconciliation job) |
| Gateway outage | Show only pay-at-van (if eligible) with banner; otherwise "try again later" |
| Customer enters wrong phone | OTP prevents; changing phone requires re-verification |
| Same customer double-books two stops | Allowed but warned; separate orders |
| Item received below ordered quantity | Shortage flow (BR-06) |
| Price change after order | Order price locked at confirmation |
| Cutoff passes while customer is in checkout | Server rejects with next available slot suggestion |
| Van breakdown | Reassign orders to alternate vehicle/slot; notify; refund option |
| Stop closed by authorities/weather | Cancel/reschedule workflow with one-click notify |
| Customer disputes weight | Support can view recorded packed weight & photo (P1) |
| Duplicate/abusive orders | Rate limit by IP/phone; fraud flags (repeated no-shows) |
| Staff device loses network | Local queue then sync (P1); fallback paper stop sheet from printed export |
| Time zone/clock errors | All times stored UTC, displayed IST; cutoff logic server-side |

## 11. Success metrics (provisional targets [A])

| Phase | Metric | Target |
|---|---|---|
| Pilot | Orders per stop (week 4) | ≥ 15 |
| | AOV | ≥ ₹400 |
| | Week-2 repeat | ≥ 40% |
| | On-time arrival (within window) | ≥ 90% |
| | Refund+credit % of sales | ≤ 3% |
| | Wastage % of COGS | ≤ 6% |
| | Time at stop per customer | ≤ 90 s |
| | Checkout conversion (cart→paid) | measure first, then set target |
| | Support contacts per 100 orders | ≤ 8 |

## 12. Visual directions (to choose before UI build)

**Direction A: "Mandi Market" (warm, familiar, high-trust)**
- Palette: leaf green + turmeric yellow + tomato red accents on warm off-white; hand-stamped "weighed today" badges.
- Type: sturdy sans (e.g., Poppins/Inter) with a friendly display face for headings; supports Devanagari/regional script.
- Imagery: real photos on neutral backgrounds; price tags as hero element; "₹/kg" very large.
- Tone: neighbourly, vernacular-friendly ("Aaj ki taazi sabziyaan").

**Direction B: "Clean Fresh" (modern, minimal, quick-commerce-adjacent)**
- Palette: white + deep green, single accent; lots of whitespace; rounded cards.
- Type: geometric sans; icon-driven navigation.
- Tone: premium-convenient; risk of looking like a Blinkit clone and of weaker local trust.

**Recommendation: A, with B's cleanliness in the cart/checkout.** For first-time buyers in a pilot neighbourhood, the "local trusted market" feel and big price/weight transparency matter more than looking like a tech startup. Final choice and brand name are open decisions (D-012); both need real photography and a brand/trademark check before use.

## 13. Test matrix (condensed; full matrix to be built in Milestone 5)

| Area | Normal | Edge | Failure | Security |
|---|---|---|---|---|
| Serviceability | Served pin → slots | Pin boundary, society with no capacity | Maps/service down fallback | Pin enumeration rate limit |
| Catalog/units | 1 kg, 500 g | min/max/step edges | Missing image | XSS in product names |
| Pricing | Promo applied | Rounding, bundle + promo | Price changed mid-checkout | Client price tamper |
| Stock | Reserve/release | Last unit race | Negative stock attempt | Direct API calls to adjust |
| Checkout | Guest OTP | Back/forward, double-click | OTP provider down | OTP brute force |
| Payment | Success | Late webhook, partial refund | Gateway timeout | Forged webhook, replay |
| Orders | Full lifecycle | Cancel at each stage | Invalid transition | IDOR on tracking token |
| Admin | Each role's allowed actions | Role change mid-session | Session expiry | Authorization matrix |
| Collection | QR scan | Wrong person, partial | Offline | Code guessing |
| Reports | Totals reconcile | Refund after day close | Missing cost data | Role-limited financial views |
| Mobile/a11y | 360 px, keyboard | Long names, zoom 200% | Slow 3G | n/a |
