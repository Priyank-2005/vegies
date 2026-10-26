# Product Requirements Document (PRD): Hari Haat delivery

> Status: v2.1 · 2026-10-26 (statuses brought up to date after Milestone 3 and M4 steps 1-2; see also `FEATURES_AND_PROGRESS.md`) · Rewritten for hub delivery (Instant / 1 hour / 3 hours). The van-collection PRD is archived in `docs/archive-van-model/`.
> Priority: **P0** essential for a safe, usable launch · **P1** valuable · **P2** future. **Built** = implemented and tested in the repository today; **Planned** = not built yet.
> IDs are stable so tests and tickets can reference them.

## 1. Objectives
1. A household in Udaipur finds out in seconds whether we deliver to them and which speeds are open, then places a **correct, fairly priced** order in about 3 minutes on a mid-range phone.
2. Never promise what the hub cannot do: per-speed distance, hours and capacity limits enforced on the server.
3. Give the owner everything needed to receive, pack, dispatch, deliver, reconcile and analyse, without spreadsheets (admin panel: **Built**, Milestone 3).
4. Produce trustworthy numbers (contribution per order by speed/distance/basket) to decide whether the model works.
5. Stay small enough for one or two engineers to run.

**Non-goals now:** delivery outside Udaipur, multiple hubs, native app, AI voice agent, marketplace sellers, auto-recurring charges, live rider map for customers, scheduled-for-later delivery, third-party rider integration.

## 2. Delivery speeds and rules (the brief)
| Speed | Customer fee | Promise [A] | Reach from hub [A] | Max orders in progress [A] |
|---|---:|---|---:|---:|
| Instant | ₹20 | ~25 min | 3 km | 6 |
| 1 hour | ₹10 | within 60 min | 7 km | 20 |
| 3 hours | **Free** | within 180 min | 15 km | 60 |
No platform, handling or packaging charges on any speed. All values are rows in the database (editable by the owner once the admin panel exists); defaults come from `scripts/seed-demo.ts`. Hub hours default 07:00-22:00 IST, last order 20 minutes before closing.

## 3. Personas
Meera (working parent, orders from the phone); Mr. Rao (prefers phone/WhatsApp ordering, Hindi); Arjun (PG resident, small baskets, price-sensitive); the **owner/ops manager** (runs the day); **packer**; **rider**; **procurement**; **support agent**. Business buyers (hotels/restaurants) are a later segment.

## 4. Functional requirements

### 4.1 Location and serviceability (LOC)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| LOC-01 | "Use my current location" button uses the browser Geolocation API **only after a tap**; the browser's own permission prompt applies | P0 | Built |
| LOC-02 | Serviceability is computed on the server from coordinates (distance to the hub) with no external service; Udaipur-only via hub radius plus a sanity bounding box | P0 | Built |
| LOC-03 | Reverse-geocode a suggested address from coordinates (best effort, editable) | P0 | Built (dev provider; production provider open: D-040) |
| LOC-04 | If permission is denied/unsupported/insecure/timeout: clear message and an address **search** limited to Udaipur | P0 | Built |
| LOC-05 | Outside Udaipur or invalid location: clear message + waitlist with consent; store only a ~1 km location | P0 | Built |
| LOC-06 | Location kept in the customer's browser only until an order is placed; the order stores the delivery address and coordinates | P0 | Built |
| LOC-07 | Map pin confirmation / drag-to-adjust | P1 | Planned (needs a map provider) |
| LOC-08 | Saved addresses | P1 | Planned |

### 4.2 Delivery options and capacity (DLV)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| DLV-01 | Show every speed with fee, arrival time (clock time and "about N min"), and status AVAILABLE / BUSY / CLOSED / OUT_OF_RANGE | P0 | Built |
| DLV-02 | Enforce reach, hours, last-order buffer and per-speed capacity **on the server at order time** (advisory lock per hub so concurrent checkouts cannot over-book) | P0 | Built |
| DLV-03 | Arrival promise = now + promised minutes, never later than closing; if closed, from next opening | P0 | Built |
| DLV-04 | Delivery fee added to the total; no other fees | P0 | Built |
| DLV-05 | Per-speed and global minimum order values | P0 | Built (settings); recommended to use |
| DLV-06 | Admin editing of fees, promises, radii, capacities, hours | P0 | Built (Settings screen) |
| DLV-07 | Schedule for later / choose a time window | P2 | Planned |

### 4.3 Catalogue, cart, checkout (CAT/CART/CHK)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| CAT-01..07 | Bilingual products (English + Hindi), configurable units (grams/pieces, min/max/step), per-unit price history, seasonal windows, availability per day, search by name/Hindi/Hinglish with typo tolerance, categories, sorting | P0 | Built |
| CAT-08 | Bundles (family baskets) | P1 | Planned (tables exist; no screens yet) |
| CART-01..03 | Persistent cart; quantity rules; **server re-prices every call; the API has no client price field** | P0 | Built |
| CHK-01 | Guest checkout with phone OTP; no passwords | P0 | Built (OTP delivery by real provider: M4) |
| CHK-02 | Address (required), landmark, rider note; speed selection with default = cheapest open speed | P0 | Built |
| CHK-03 | Pay on delivery (cash/UPI to rider) capped at ₹600 **including the delivery fee**; online payment disabled until the gateway exists | P0 | Built |
| CHK-04 | Idempotent order creation (Idempotency-Key); double-tap creates one order | P0 | Built |
| CHK-05 | Stock reserved transactionally at confirmation; concurrent checkouts cannot oversell | P0 | Built |
| CHK-06 | Order updates consent and policy acknowledgement recorded (consent row, policy version on the order) | P0 | Built |
| CHK-07 | Promo codes | P1 | Planned |
| CHK-08 | Online payment (webhook-verified), refunds | P0 | Planned (M4) |

### 4.4 Tracking and notifications (TRK/NTF)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| TRK-01 | Order page by secret link or signed-in "My orders": status steps, arrival-by time, address, 4-digit **delivery code**, items, totals, payment status | P0 | Built |
| TRK-02 | Rider's **first name only**, only while out for delivery; no rider phone/location | P0 | Built |
| TRK-03 | Customer cancel free until packing starts | P0 | Built |
| TRK-04 | Live rider map | P2 | Planned (only if it measurably helps) |
| NTF-01 | Confirmation, out for delivery, delay, delivered, cancelled, failed-delivery messages (WhatsApp/SMS/email) | P0 | Partly: message worker, bilingual texts, consent, once-only and retries built with a fake channel (M4 step 1); real WhatsApp/SMS pending; refund messages come with payments |
| NTF-02 | "Running late" message when a promise is missed | P0 | Built (sent once, 5 minutes after the promised time; real channel pending) |

### 4.5 Dispatch and delivery (DEL)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| DEL-01 | Order lifecycle: CONFIRMED → PACKING → PACKED → OUT_FOR_DELIVERY → DELIVERED / DELIVERY_FAILED (+ ATTENTION, CANCELLED, EXPIRED) with validated transitions and audit | P0 | Built |
| DEL-02 | Assign rider (managers); rider dispatches; riders only touch orders assigned to them | P0 | Built (service and screens) |
| DEL-03 | Proof of delivery: customer's 4-digit code; 5 wrong codes lock the code path; manager override requires a note | P0 | Built (service and screens) |
| DEL-04 | Pay-on-delivery: rider records cash/UPI; amount must equal the amount due (the total less short-weight adjustments; partial delivery allowed with a note) | P0 | Built (service and screens) |
| DEL-05 | Failed delivery with reason; retry or cancel; customer-at-fault counts toward the pay-on-delivery limit | P0 | Built (service and screens) |
| DEL-06 | Dispatch board (live orders by status/speed/rider, SLA timers), phone-friendly rider screen | P0 | Built; batching suggestions are P2 and Later |
| DEL-07 | Third-party rider partner integration | P2 | Planned |

### 4.6 Inventory, procurement, admin (INV/ADM)
Stock ledger with daily counters and reservations is built and tested (append-only movements, atomic reserve/release, publish-below-reserved refused). Goods receiving, wastage entry, supplier records, catalogue/price editor, hub/option settings, staff management and reports are **Built (Milestone 3)**; buy-list suggestions are Later. Roles and server-side permissions are built (Owner, Ops manager, Procurement, Packer, **Rider**, Support). TOTP for Owner/Ops/Procurement is built but **switched off by the founder's decision (D-047)**; switch it on before real data.

### 4.7 Payments (PAY)
Payment, webhook-event, refund and cash-receipt tables with constraints (one captured payment per order, deduplicated webhooks) are built; refund queued automatically when a paid order is cancelled. Gateway integration and reconciliation: **Planned (M4, step 3)**; built in test mode and kept switched off at launch (D-055).

## 5. Business rules
- **BR-01 Money/quantity:** integer paise and integer grams/pieces; no floats. Rounding half away from zero, once per line.
- **BR-02 Server pricing:** prices, fees and totals are computed on the server from database rows; stored on the order.
- **BR-03 Variable weight (approved):** customer never pays more than agreed; pack ≥ ordered weight (up to +5% free); short weight refunded pro-rata; piece items have a tolerance band.
- **BR-04 Hours:** hub opening hours and last-order buffer; closed hub: browse and fill cart, cannot order; stock shown for the next opening day.
- **BR-05 Reach:** each speed has a radius; beyond it that speed is unavailable but slower speeds may be.
- **BR-06 Capacity:** orders in progress per speed ≤ the hub's limit; otherwise BUSY.
- **BR-07 Stock reservation:** reserve at confirmation; release on cancel/expiry; received-but-uninspected stock is not sellable.
- **BR-08 Shortage and substitution:** never silent; customer chooses substitute or refund of that line.
- **BR-09 Cancellation:** free until packing starts; afterwards only by staff (quality issue, ops decision).
- **BR-10 Pay on delivery:** ≤ ₹600 including fee; blocked after 2 customer-fault failed deliveries; first order must be prepaid **only once online payment exists**.
- **BR-11 Minimum order:** global setting plus per-speed minimum, compared against items (not fees).
- **BR-12 Delivery code:** required to complete a delivery; manual override needs a manager and a note; all audited.
- **BR-13 Location privacy:** coordinates only on explicit tap; not logged; waitlist stores ~1 km precision; order stores exact delivery position for the rider; retention schedule to be set (DPDP).

## 6. Non-functional
Mobile-first, LCP ≤ 2.5 s on mid-range Android over 4G (target); WCAG 2.1 AA for customer flows; server-side authorisation everywhere; rate limits on OTP, checkout, geocoding, tracking; secrets in env; no card data stored; structured logs without PII; English UI with bilingual product names; uptime target 99.5% with phone alert; backups with a tested restore (M5).

## 7. Acceptance criteria (representative; the automated tests encode them)
- Outside Udaipur → not served, waitlist offered; inside but beyond a speed's radius → that speed unavailable, slower speeds open.
- Closed hub or last-order buffer → no order can be placed; the API returns `HUB_CLOSED` with the next opening time.
- 12 simultaneous Instant orders with a limit of 3 → exactly 3 succeed, the rest `OPTION_BUSY`.
- 20 simultaneous orders for 5 kg of stock → exactly 5 orders; reserved = 5 kg; no negative counters.
- Instant adds ₹20, 1 hour ₹10, 3 hours ₹0; total = items + fee; stored on the order.
- Double-submitting an order creates one order; an identical retry returns it.
- A wrong delivery code never completes a delivery; after 5 wrong codes only a manager override with a note works.
- Pay-on-delivery completion without the exact amount is refused.
- A rider cannot act on another rider's order or cancel an order; a packer cannot refund.
- Tracking pages never expose other customers' data, raw phone numbers or coordinates.

## 8. Edge cases (selected)
Customer moves after detecting location (address is editable; server re-checks range at order time) · GPS accuracy is poor (shown as ±m; customer can search instead) · stock sells out while the cart is open (cart flags it; server refuses) · hub becomes busy between page view and order (clear message, pick another speed) · rider cannot find the address (call, then failed delivery with reason) · customer unreachable (failed delivery; retry or cancel) · price changes after ordering (order price is locked) · geocoder down (address typed manually; serviceability unaffected) · rain/traffic delays (admin can raise delay notices: M3/M4).

## 9. Success metrics [A targets]
On-time within promise ≥ 90% per speed · median basket ≥ ₹300 (target ₹380) · wastage ≤ 6% · refund+credit ≤ 3% of sales · delivery-code success ≥ 98% · repeat within 14 days ≥ 40% · contribution per order > 0 (the number that decides everything).
