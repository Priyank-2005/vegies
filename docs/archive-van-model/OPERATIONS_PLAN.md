# Operations Plan: The Real-World Workflow

> Status: DRAFT v0.1 · 2026-10-23. Times, ratios and costs are **provisional [A]** until the Phase 0 pilot measures them. Software is a tool for this workflow, not the other way round: every step below should work on paper/WhatsApp first.

## 1. Daily rhythm (reference timeline, evening-route variant)

| Time | Activity | Owner | System record |
|---|---|---|---|
| D-1 21:00 | **Order cutoff** for day D evening route | System | Slot locks |
| D-1 21:15 | Consolidated demand report + buy list generated; prices for D reviewed | Procurement + Ops | Buy list v1 |
| D 05:00–07:00 | Market/farm purchasing against buy list (+ buffer) | Procurement | Receipts, photos |
| D 07:00–08:30 | Goods received at hub; inspection; weighing in | Procurement/QC | GRN, ledger `received` |
| D 08:30 | Shortage check → substitution/refund messages sent; catalogue for "walk-up" decided | Ops | Shortage list |
| D 09:00–13:00 | Order packing (batch by stop), labels, crate assignment | Packers | `PACKED` + weights |
| D 13:00–15:00 | Final QC sampling; load planning; vehicle prep | Ops/Driver | Load sheet |
| D 15:30 | Load van (last stop first); departure message | Driver | `VAN_DEPARTED` |
| D 16:00–20:00 | Stops (5 × ~30–40 min windows incl. travel) | Driver + helper | Stop events, collections |
| D 20:30 | Return; unsold stock count; cash/UPI count | Driver + Ops | Closing |
| D 21:00 | Daily close: reconciliation, wastage entry, next-day cutoff | Ops | Close report |

*Morning-route variant:* cutoff D-1 18:00, buy at 03:30–05:30, pack 06:00–08:00, stops 08:30–11:30. Decide the variant after surveying customer preference (MARKETING_PLAN E2). **Pilot recommendation: evening** (customers home, produce bought same morning, more time to pack).

## 2. Supplier discovery and evaluation

**Supplier types to evaluate** (no specific names assumed): wholesale/commission agents at the local produce market (mandi), farmer producer organizations (FPOs)/farmer groups, large wholesalers/aggregators, cold-chain distributors for specific items (exotic fruits, leafy greens).

**Process:**
1. Walk the market at the actual buying time for 3 mornings; note price ranges per SKU; photograph quality grades.
2. Shortlist ≥ 2 suppliers for each of the top-30 SKUs; ≥ 1 backup for every category.
3. Score (1–5): quality consistency, price vs benchmark, ability to deliver/load early, credit terms, GST/FSSAI documentation, willingness to supply grades/weights consistently, relationship/reliability.
4. Trial buy for 1 week; track rejection %, price drift, shortages.
5. Agree: price-fixing method (daily rate board, margin on mandi rate), payment terms, rejection/return policy, weights (who weighs; dispute rule).

**Supplier documentation [?]:** collect FSSAI licence/registration (for those who require it) and GST details; confirm requirements with consultant.

## 3. Procurement planning

- Input: confirmed orders by SKU (grams/pieces) + **buffer %** per SKU (default 5% for robust items, 8–10% for leafy/ripening fruit) + planned walk-up stock.
- Output: buy list by supplier with target price, quantity, quality notes.
- Rule: **buy against confirmed demand**; buffer is the only speculation. Raise buffer only where history shows rejections or shrinkage.
- Authorised price caps per SKU; purchase above cap needs Ops Manager approval (logged).
- Weekly review: SKU margin, rejection, wastage → adjust buffer/assortment.
- Cash planning: day's procurement cash/UPI float pre-agreed; prepaid receipts usually arrive before purchase (working-capital benefit).

## 4. Daily availability & price updates

1. By D-1 17:00 Procurement posts tomorrow's rate board (indicative mandi rates).
2. Ops sets customer prices using target margin rule (price = max(cost × (1 + target markup), floor price), rounded to a clean price like ₹5). Prices are **frozen at order time** for that order.
3. Items with uncertain supply are marked "limited" with a stock cap; never oversell.
4. Price change log is retained (audit). Large day-to-day swings (e.g., tomatoes) → consider "price locked per week" bundles.

## 5. Quality inspection (QC) at receipt

Checklist per lot (photo evidence for rejections):
- Freshness (colour, firmness, leaf turgor), no rot/fungus, size uniformity, ripeness stage for fruit, foreign matter, sprouting (potato/onion), temperature touch for greens.
- Grades: A (sell as listed), B (walk-up/discount/bundle filler if customer-safe), Reject (return to supplier or waste).
- Decision recorded: accepted qty, rejected qty, reason. Only accepted qty becomes available stock.
- Final **QC at packing** (random 10% of packs) and **at load** (visual).
- Quality failure → stop-pack rule: if a batch fails, Ops decides substitute/refund and customers are notified before the van leaves.

## 6. Weighing and packing

- Equipment: calibrated digital scales (accuracy suitable for 5 g–30 kg; legal-metrology verification/stamping requirements **[?]**), tare handling, food-grade crates/bags, clean tables, handwashing, hairnets/gloves per FSSAI hygiene guidance **[?]**.
- Packing rule per BR-03: pack ≥ ordered weight; ≤ +5% free; mark actual weight on the label (recommended; supports transparency and disputes).
- Pack by order, leafy greens last and on top; fragile fruits protected; keep wet/dry separate; cold items in insulated bag with ice where needed (eggs/cut items are P2).
- One packer per ~10–15 orders/hour [A: to be measured]; track average seconds per line to feed capacity model.

## 7. Order labeling and sorting

- Label: order code (e.g., `K7-0423`), first name + initial, stop, window, pickup code (4–6 digits), "packed at" time, items count, payment status (PREPAID / COLLECT ₹xxx).
- Sorting: bag → stop crate (colour-coded) → within crate alphabetical by order code. Load sheet lists crates in **reverse stop order** so the first stop is loaded last (closest to door).
- Big orders (>2 bags) tied with a cable tie.

## 8. Inventory reconciliation

- **Opening count → receipts → packed → returned/unsold → wastage → closing count.**
- Variance rule: |ledger − physical| ≤ 2% by weight per SKU without explanation; larger → investigate (shrinkage, mis-weigh, theft, spoilage).
- Every adjustment requires a reason code; adjustments above a threshold need Ops approval.
- Weekly cycle count of top 10 SKUs.

## 9. Route and stop planning

- Stop attributes: location (+ photographed spot), society permission status, max orders/slot, service duration (seconds per customer × orders), arrival window (e.g., 20-min), parking constraints, contact person.
- Route design: 4–6 stops, total drive time ≤ ~35% of shift; buffer 10–15% for traffic; avoid right-hand turns/narrow lanes at peak (local knowledge) [E].
- Dwell model: window length ≥ (orders × avg service seconds) / (parallel service lanes) + 5 min buffer. If helper + driver serve in parallel, lanes = 2.
- Publish schedule T-24h; **no change inside T-3h except for disruptions** (then notify).
- Start manual (Google Maps/spreadsheet) in Phase 0; add matrix assistance in the app only if it saves measurable planning time.

## 10. Van capacity and load planning

- Capacity measured in crate/volume units and kg; typical small commercial vehicle categories exist (I have not verified models/payloads; verify RC and payload).
- Load units per order estimated by line volumes (e.g., leafy bunch = 0.5, 1 kg bag = 1, watermelon = 2) [A]; slot capacity includes Σ load units ≤ 85% of van capacity.
- Segregate: leafy/fruit separate from heavy roots; keep cool/shade; cover from sun and rain; hygiene of cargo floor.

## 11. Collection-point scheduling

- Micro-windows: split 20-min stop window into 10-min sub-windows when order count > ~12 so people arrive staggered (P1 in software, but you can print "Group A/B" on labels from day 1).
- Handover layout: 1 table at the van's rear; two lanes max (A–M / N–Z or sub-window A/B); QR/pickup code ready; separate queue for walk-up/payment.
- Dwell target: ≤ 90 s per customer; at 12 customers/10-min window with 2 lanes ≈ 9 minutes (feasible) [A].
- Society rules: no horn, no blocking gate, written permission, driver contact for guards.

## 12. Customer notifications (operational triggers)

| Trigger | Message | Channel |
|---|---|---|
| Order confirmed | Summary, pickup code, policy link | WhatsApp/SMS + email |
| Shortage detected | "Item X unavailable: substitute (Y) / refund / cancel" with deadline | WhatsApp/SMS |
| Packed | "Ready, van leaves at HH:MM" | WhatsApp |
| Van departed | Window per stop | WhatsApp |
| T-30 min | "Arriving at 5:40–6:00 PM" | WhatsApp |
| Delay > 10 min | Updated window + apology | WhatsApp |
| Collected | Receipt | WhatsApp/email |
| Refund initiated/completed | Amount, timeline | WhatsApp/email |

## 13. Order handover and proof of collection

1. Customer shows QR or says 5-digit code.
2. Staff opens order (search by code/last 4 phone).
3. Staff **verifies contents against label**, hands bag; customer can open and check.
4. Records: collected (full), partial (missing items listed), refused item(s) with reason.
5. If payment outstanding: UPI QR or cash; staff records method + amount (+ UPI reference).
6. System timestamps and stores actor; receipt message sent.
7. Photo of handover is **not** required by default (privacy); discrepancy disputes use label weights and loading photos.

## 14. Cash and UPI reconciliation

- Cash: every collection logged; end-of-day count by driver and Ops; deposit slip; variance > ₹50 triggers investigation.
- UPI at van: use a business UPI QR tied to the business account; record transaction ref; match to bank SMS/statement next morning.
- Gateway: daily settlement CSV vs internal paid orders vs refunds.
- Outstanding balances list reviewed daily.
- Rule: **no one handles both cash counting and ledger entry without a second check** at the beginning (small-business internal control).

## 15. Returns, refunds, missing items, substitutions

| Case | Handling |
|---|---|
| Quality complaint (rot, stale) | Photo via WhatsApp → refund/credit of line; supplier chargeback log; no argument for first claims under a threshold (e.g., ≤ ₹150) |
| Short weight | Refund pro-rata; review packer/scale |
| Missing item at handover | Refund immediately or deliver next stop/day (customer choice) |
| Wrong item | Replace at next stop or refund |
| Substitution | Customer-approved only; price difference handled per rule (customer never pays more than the original line unless they accept) |
| Cancellation | Per BR-08 |
| Refund method | Prepaid → original method via gateway (with expected timeline communicated); cash → UPI payout or credit as customer elects (record) |
| Refund authority | Support: ≤ ₹300 per order; Ops: ≤ ₹1,500; Owner: above (configurable) |

## 16. Unsold inventory and spoilage

1. At stops, sell surplus as walk-up (P1 feature; manual billing in pilot) at set discount after the last scheduled stop.
2. Donate/discount-sell near-expiry safe items to staff/community kitchens where permitted [?].
3. Compost/disposal for unfit items; log weight and reason.
4. Do **not** reuse unsold produce in tomorrow's orders unless it passes inspection and is clearly Grade A (policy: leafy never reused; hardy roots/onions allowed).
5. Weekly wastage review by SKU, supplier, buffer.

## 17. Supplier payments

- Payment terms: pay on delivery (cash/UPI) in Phase 0; 1–3 day credit later with suppliers who accept.
- Every purchase has a receipt/photo; goods received note ties to payment; supplier ledger.
- Disputes (weights/quality) resolved at receipt, not afterwards.
- Never pay in cash above amount thresholds legal rules allow **[?]**: confirm with CA.

## 18. Daily operational closing checklist

- [ ] All orders in terminal state (collected / no-show / cancelled).
- [ ] No-show bags handled (hold, walk-up, or waste).
- [ ] Unsold + returned stock counted; wastage logged with reasons.
- [ ] Cash counted; UPI/Gateway entries matched; outstanding balances listed.
- [ ] Vehicle: fuel, odometer, cleanliness, issues.
- [ ] Complaints logged and assigned.
- [ ] Next-day stops/windows confirmed; cutoff scheduled.
- [ ] KPIs recorded: orders, AOV, orders/stop, on-time %, refunds, wastage %.

## 19. Customer complaint handling

- Channels: WhatsApp Business number + phone + form; grievance officer listed in footer (E-Commerce Rules; check legal specifics **[?]**).
- SLAs: acknowledge ≤ 2 h in operating hours (< 48 h legal outer bound reported **[V, secondary]**); resolve ≤ 24 h for quality; refunds initiated same day.
- Categories & root-cause tags: quality, weight, missing, wrong, lateness, payment, staff behaviour, policy.
- Weekly complaint review → supplier/packer/route actions.

## 20. Contingency procedures

| Event | Immediate action | Customer comms | Recovery |
|---|---|---|---|
| Vehicle breakdown | Call backup (hire cab/tempo list kept ready), transfer crates, reorder stops by priority | Delay SMS/WhatsApp within 10 min; offer refund if >60 min | Post-mortem; maintenance schedule |
| Heavy delay (traffic/event) | Skip lowest-volume stop? or compress windows | Updated windows; apology | Adjust windows next week |
| Bad weather (rain/heat) | Rain cover, tent at stop; decide go/no-go by 14:00 | Proactive reschedule notice | Weather-aware cutoff |
| Supplier shortage/failure | Switch to backup supplier; shortage workflow | Substitution/refund options | Supplier scorecard |
| Quality issue discovered | Stop pack; QC re-sort; replace or refund | Notify before departure | Return to supplier |
| Payment gateway outage | Switch to pay-at-van (eligible only), banner on site | Banner + messages | Post-outage reconciliation |
| Network/connectivity at stop | Use printed stop sheet + offline PWA; record later | None unless delay | Sync and reconcile |
| Society denies entry | Alternate nearby public spot (pre-approved) | Message with new point | Fix permission |
| Staff absent | Cross-trained backup; reduce route | If needed, delay | Hiring buffer |
| Accident/safety | Safety first, insurance contact, communicate | Cancel/refund | Review |

## 21. Pre-launch readiness checklist (must exist before accepting real customer orders)

**Legal & registration [?] (see BUSINESS_PLAN §13)**
- [ ] Business entity & bank account.
- [ ] FSSAI licence/registration type confirmed by a professional **and obtained**.
- [ ] GST position confirmed.
- [ ] Legal metrology position confirmed; scales verified as needed.
- [ ] Vehicle: commercial registration/permits, insurance, parking permissions.
- [ ] Grievance officer appointed; refund/cancellation/privacy/terms pages published.
- [ ] Payment gateway account approved (test + live).
- [ ] Messaging approvals (WhatsApp templates; SMS sender/DLT as applicable).

**Operations**
- [ ] ≥ 2 suppliers for top-30 SKUs, rate board process, payment method.
- [ ] Packing hub: hygiene set-up, water, scales, crates, labels, printer.
- [ ] SOPs 1–20 above written (1-page each) and rehearsed in a dry-run.
- [ ] Dry-run with staff-only orders: 2 full days, with reconciliation sign-off.
- [ ] Refund test with real small amounts on live gateway.
- [ ] Contingency contact list (backup vehicle, supplier, society contacts).
- [ ] Staff briefed on customer-service script and complaint log.

**Software (if Phase 1 is approved)**
- [ ] Backup/restore tested; admin 2FA; audit log; uptime alert.

## 22. Staffing (pilot, provisional [A])

| Role | Count | Notes |
|---|---|---|
| Founder/Ops lead | 1 | Cannot be the only trained person |
| Procurement | 0.5–1 | Founder initially |
| Packers | 1–2 | Part-time possible |
| Driver | 1 | Licensed, vehicle-experienced |
| Handover helper | 1 | Cash/UPI handling, customer-friendly |
| Customer support | 0.5 | Shared with ops initially |
