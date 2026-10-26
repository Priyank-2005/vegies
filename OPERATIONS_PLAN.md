# Operations Plan: hub delivery in Udaipur

> Status: v2 · 2026-10-24 · Real-world workflow behind the software. Times, ratios and costs are **[A]** until measured in a trial. The van-model plan is archived in `docs/archive-van-model/`.

## 1. The hub
A small, clean, cool-as-possible packing room ("dark store"): receiving table, crates/shelving by category, a leafy-greens cold corner, scales, packing table, order shelves by speed (Instant bay nearest the door), handwashing, water and drainage, space for riders to park and load. Location drives everything: **Instant only works within ~3 km** [A]. Get the real address, lease and permissions before launch **[?]**.

## 2. Daily rhythm (reference; hours editable)
| Time | Activity | Owner |
|---|---|---|
| 04:30-06:30 | Market/mandi buying against the buy list (forecast + buffer) | Procurement |
| 06:30-07:00 | Receiving, weighing in, inspection (accept / reject / grade) | Procurement + QC |
| 07:00 | Hub opens: stock published for the day; orders accepted | Manager |
| 07:00-21:40 | Orders: pick → pack → rider handover → delivery | Packers, riders |
| Midday | Re-stock top sellers if needed; markdown ageing items | Procurement |
| 21:40 | Last order (20 min before closing) | System |
| 22:00 | Hub closes: last handovers; rider cash/UPI count | Manager + riders |
| 22:00-22:30 | Close: stock count, wastage entry, reconciliation, next-day buy list | Manager |

## 3. Procurement and stock (on-demand model)
- **Stock is bought ahead of demand**, so wastage is the central risk. Start with a short list (30-40 fast movers) and small, frequent buys.
- Daily **buy list** = forecast (moving average of the last 2-3 same weekdays) + safety buffer by SKU (more for leafy/perishable) − stock on hand. First 2 weeks: forecast by judgement, record actual sales to build history.
- **Publish** per SKU the quantity available for the day (the app's "published quantity"). It can never go below what is already reserved.
- Receiving: weigh, inspect, record accepted/rejected with a reason; only accepted stock becomes sellable.
- **Rate board:** daily mandi price → shelf price by a stated margin rule; changes are logged; an order keeps the price it was placed at.
- Suppliers: ≥ 2 per top-30 SKU; scorecard (quality rejections, price drift, lateness); agree weights and rejection rules up front. Collect FSSAI/GST documents where relevant **[?]**.

## 4. Order handling
1. Order **CONFIRMED** (customer can still cancel free).
2. **PACKING** starts (cancel closes): packer takes the pick list, collects items by SKU, weighs each line to **at least the ordered weight, up to +5%** (BR-03), seals the bag/crate with a label: order code, first name, speed, promised-by time, payment (PAID / COLLECT ₹xxx), address area.
3. **PACKED**: staged by speed (Instant bay first). A line that cannot be filled → **ATTENTION**: call the customer; offer a substitute or refund of that line; never swap silently.
4. **Manager assigns a rider** (batch 2-3 nearby 3-hour orders on one trip; Instant goes alone).
5. Rider scans/marks **OUT_FOR_DELIVERY**.

## 5. Capacity management
- Each speed has a cap on orders in progress. When Instant is at its cap the app shows it as busy and offers slower speeds.
- Manager tunes caps by watching: Instant orders late > 10%, packer idle time, riders waiting. Raise caps only when riders and packers are idle; lower them when the promise is missed.
- At closing time pressure, the last-order buffer protects riders and packers.

## 6. Riders
- Model to decide **[?]**: own salaried/part-time riders vs. a delivery partner vs. gig contractors (legal and cost implications: `BUSINESS_PLAN.md` §11). Requirements: licence, vehicle, insurance, phone with the staff web app, helmet, insulated bag.
- **Delivery procedure:** call/WhatsApp on arrival if needed; ask for the **4-digit delivery code**; hand over; show contents if the customer wants to check; collect cash/UPI **before leaving**; mark delivered. No code → call the customer; after repeated wrong codes a manager decides.
- Failed delivery: wait a short time, call twice, then mark failed with a reason; return the order; ops decides retry or cancel. Customer-fault failures count toward the pay-on-delivery limit.
- Rider conduct: no tips demanded, no price changes, no leaving orders unattended without a manager's approval and a photo.

## 7. Cash and UPI
- Rider records every payment in the app (method, amount, UPI reference). Daily: rider hands cash to the manager, who counts it against the app total; variance > ₹50 is investigated. UPI collected to the business QR is matched with the bank statement next morning.
- Float: none in the first weeks (riders do not carry change; ask for exact amounts) to limit risk.
- When online payment arrives (M4) the gateway settlement CSV is reconciled against orders and refunds.

## 8. Returns, refunds, quality
- Quality complaint (photo within the same day) → refund or replacement of the line; first claims under a small threshold (e.g. ≤ ₹150) approved without argument.
- Short weight → automatic pro-rata refund; review packer/scale.
- Refund authority (server-enforced): support ≤ ₹300, ops ≤ ₹1,500, owner above.
- Weekly review: complaints by SKU, supplier, packer, rider.

## 9. Wastage control
- Count and weigh wasted stock daily with a reason (spoiled, trimmed, damaged, expired); target ≤ 6% of cost [A].
- Markdown ageing produce in the evening (ensure legal/pricing rules **[?]**); donate safe surplus where permitted; compost the rest.
- Rotate stock FIFO; keep leafy greens cold; buy smaller, more often.

## 10. Contingencies
| Event | Action | Customer message |
|---|---|---|
| Rider shortage / late rider | Reduce Instant cap or pause Instant; move orders to 1-hour | Updated arrival time |
| Rain / extreme heat | Slow speeds, cover bags, raise promises temporarily (manager sets) | Delay notice |
| Supplier failure / stock-out | Mark SKU unavailable; ATTENTION flow for affected orders | Substitute or refund |
| Hub power cut / equipment | Switch to manual pick lists printed earlier; pause new orders if needed | Closed/busy banner |
| App or network outage | Take orders by phone/WhatsApp into the admin screen when available; paper log | n/a |
| Payment gateway outage (later) | Pay on delivery only | Banner |
| Accident or safety incident | Safety first; insurance; incident log | Cancel/refund as needed |

## 11. Readiness checklist before the first real order
**Legal/registration [?]:** entity and bank account; FSSAI licence/registration type decided **and obtained**; GST position; legal-metrology position and scale verification; hub trade licence/premises permission; rider engagement model, licences and vehicle insurance; grievance officer; policies reviewed by a professional.
**Operations:** 2+ suppliers for top SKUs; hub hygiene set-up; scales; packing materials; labels and printer; rider kit; SOPs for sections 2-9 rehearsed in a **2-day dry run** with staff-only orders and a cash reconciliation; phone/WhatsApp support number.
**Software (when built):** admin panel (M3), real OTP/WhatsApp delivery (M4), production geocoder decision (D-040), backups tested (M5).

## 12. Staffing (trial, [A])
Manager 1 (founder initially) · Packers 2 (part-time possible) · Riders 2-3 · Procurement 0.5-1 · Support 0.5 (shared). Cross-train: nobody is a single point of failure for opening the hub.
