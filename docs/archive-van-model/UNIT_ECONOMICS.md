# Unit Economics & Financial Model

> Status: DRAFT v0.1 · 2026-10-23 · Currency: Indian rupees (₹).
> **Every input below is a provisional assumption [A], not a market fact.** The numbers exist to show *which levers matter* and *what must be true*, so the pilot can measure them. Nothing here is a forecast.
> The model is code: [`tools/unit_economics.py`](tools/unit_economics.py). Edit the `SCENARIOS` / `FIXED` blocks and run `python tools/unit_economics.py`. The latest full output is saved in [`tools/unit_economics_output.md`](tools/unit_economics_output.md). Tables below were produced by that script.

## 1. Headline finding

With the base assumptions, **one van running one route-shift per day loses money** (≈ −₹2,250 per route-shift at 50 orders). The business only turns clearly profitable when *several* levers move at once. Combined (AOV ₹500, 32% list margin, 2% discounts, 4% wastage, 2 route-shifts per van-day) **break-even drops to ≈ 30 orders per route-shift**, but those are exactly the things that the pilot must prove.

> If the pilot shows contribution below ~₹40 per order *and* fewer than ~30 orders per route-shift, the van model is not viable as designed and we should pivot (e.g., society-hub weekly baskets, farm-direct subscriptions, or larger-basket B2B/community orders) *before* building the full platform.

## 2. Editable assumptions (all [A])

| Assumption | Conservative | Base | Optimistic | Notes / how to measure |
|---|---:|---:|---:|---|
| Average order value at list price (₹) | 300 | 400 | 500 | Pilot orders; bundles push this up |
| Gross margin at list price (1 − cost/list) | 22% | 28% | 32% | Actual lot cost vs list price; mandi vs direct sourcing |
| Discounts (% of list value) | 6% | 4% | 2% | First-order and promo spend |
| Refunds / credits (% of net sales) | 3% | 2% | 1% | Complaint log |
| Spoilage & wastage (% of COGS) | 8% | 6% | 4% | Closing wastage entries |
| Share paid online | 50% | 70% | 80% | Payment mix |
| Gateway fee on online orders | 2.36% | 2.36% | 2.36% | 2% + 18% GST per older Razorpay posts **[unverified]** |
| Packaging per order (₹) | 10 | 9 | 8 | Bags, labels, ties |
| Packing labour per order (₹) | 12 | 10 | 8 | Part-time packers / orders per hour |
| Messaging per order (₹) | 1.0 | 0.8 | 0.6 | ~4 utility messages × ~₹0.12–0.15 **[V, secondary]** + email |
| Support/misc per order (₹) | 4 | 3 | 2 | |
| Orders per route-shift | 25 | 50 | 80 | **The key unknown** |
| Stops per route | 5 | 5 | 5 | → 5 / 10 / 16 orders per stop |
| Van hire per van-day (₹) | 2,000 | 2,000 | 2,000 | Hire/EMI-equivalent incl. insurance; get quotes |
| Fuel per route-shift (₹) | 700 | 700 | 700 | ~60–80 km loop; verify local fuel price |
| Driver per van-day (₹) | 900 | 900 | 900 | |
| Handover helper per route-shift (₹) | 600 | 600 | 600 | |
| Parking/tolls/misc per route-shift (₹) | 150 | 150 | 150 | |
| Route-shifts per van-day | 1 | 1 | 2 | Morning + evening only if each has enough orders |
| Marketing cost per new customer (CAC, ₹) | 200 | 150 | 100 | Channel data |
| Orders per customer in first 6 months | 4 | 8 | 12 | Repeat behaviour |

**Fixed monthly costs (same in all scenarios) [A]:**

| Item | ₹ / month |
|---|---:|
| Packing hub / small godown rent | 20,000 |
| Ops & procurement lead (salary; founders unpaid) | 25,000 |
| Software, hosting, tools | 6,000 |
| Accounting & compliance | 6,000 |
| Phone, internet, misc | 3,000 |
| Always-on marketing/content | 8,000 |
| **Total** | **68,000** |

Operating days: 26 per month.

## 3. Per-order economics (₹)

| Line | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| List basket value (AOV) | 300.0 | 400.0 | 500.0 |
| Net sales after discount | 282.0 | 384.0 | 490.0 |
| Refunds / credits | −8.5 | −7.7 | −4.9 |
| Revenue collected | 273.5 | 376.3 | 485.1 |
| COGS | −234.0 | −288.0 | −340.0 |
| Spoilage / wastage | −18.7 | −17.3 | −13.6 |
| Payment gateway fees | −3.2 | −6.2 | −9.2 |
| Packaging | −10.0 | −9.0 | −8.0 |
| Packing labour | −12.0 | −10.0 | −8.0 |
| Messaging | −1.0 | −0.8 | −0.6 |
| Support / misc | −4.0 | −3.0 | −2.0 |
| **Contribution before route costs** | **−9.4** | **42.0** | **103.7** |
| Contribution as % of AOV | −3.1% | 10.5% | 20.7% |

Observations:
- Gross margin at list (22–32%) shrinks to roughly 10% of AOV after discounts, refunds, wastage, packing and fees. Produce is a thin-margin category; there is little room for discounting.
- In the conservative case, every order loses money *before* the van even leaves.

## 4. Route-shift economics (₹)

| Line | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| Orders per route-shift | 25 | 50 | 80 |
| Orders per stop | 5 | 10 | 16 |
| Route cost per shift (van+driver+fuel+helper+parking) | 4,350 | 4,350 | 2,900 |
| Route cost per order | 174 | 87 | 36 |
| Contribution per route-shift before route cost | −235 | 2,101 | 8,299 |
| **Route-shift profit / (loss)** | **−4,585** | **−2,249** | **5,399** |
| **Break-even orders per route-shift** | never | 104 | 28 |

**Can neighbourhood density support a van route?** Only in the optimistic case (16 orders per stop, 80 per shift, 2 shifts per van-day). 16 orders/stop in a 20-minute window requires ~75 s per customer with two service lanes: feasible but tight. Base density (10 per stop) loses ≈ ₹2,250 per route-shift. **Density, AOV and margin must all improve together; any one alone is insufficient.**

## 5. Monthly P&L (26 days)

| Line | Cons ×1 | Cons ×2 | Base ×1 | Base ×2 | Opt ×1 | Opt ×2 |
|---|---:|---:|---:|---:|---:|---:|
| Orders/day | 25 | 50 | 50 | 100 | 80 | 160 |
| GMV (list) | 195,000 | 390,000 | 520,000 | 1,040,000 | 1,040,000 | 2,080,000 |
| Revenue collected | 177,801 | 355,602 | 489,216 | 978,432 | 1,009,008 | 2,018,016 |
| Contribution before route | −6,115 | −12,230 | 54,630 | 109,260 | 215,782 | 431,564 |
| Route costs | 113,100 | 226,200 | 113,100 | 226,200 | 75,400 | 150,800 |
| Fixed costs | 68,000 | 68,000 | 68,000 | 68,000 | 68,000 | 68,000 |
| **Operating profit / (loss)** | **−187,215** | **−306,430** | **−126,470** | **−184,940** | **72,382** | **212,764** |

(×2 = two route-shifts per day. For the Base and Conservative columns this is shown at their *own* route cost, i.e. one shift cost each, not the cheaper two-shifts-per-van-day costing used for the optimistic scenario.)

**Fixed-cost break-even (one route-shift/day):** Conservative never; Base ≈ 166 orders/day (not reachable with one 5-stop route); Optimistic ≈ 53 orders/day.

## 6. Customer payback

| Scenario | CAC | Orders in 6 months | Lifetime contribution before route | Net of CAC |
|---|---:|---:|---:|---:|
| Conservative | 200 | 4 | −38 | −238 |
| Base | 150 | 8 | 336 | 186 |
| Optimistic | 100 | 12 | 1,245 | 1,145 |

Even where a customer "pays back" CAC at the order level, the route fixed costs must also be covered. Rule of thumb for decisions: *contribution per order × expected orders per customer ≥ 2 × CAC* before scaling paid acquisition.

## 7. Sensitivity analysis (Base scenario, per route-shift)

### 7.1 Order density × basket size (route-shift profit/(loss), ₹)

| Orders \ AOV | 300 | 350 | 400 | 450 | 500 | 600 |
|---|---:|---:|---:|---:|---:|---:|
| 25 | −3,705 | −3,502 | −3,299 | −3,097 | −2,894 | −2,489 |
| 35 | −3,446 | −3,163 | −2,879 | −2,596 | −2,312 | −1,745 |
| 50 | −3,059 | −2,654 | −2,249 | −1,844 | −1,439 | −628 |
| 65 | −2,672 | −2,145 | −1,618 | −1,092 | −565 | 488 |
| 80 | −2,285 | −1,636 | −988 | −340 | 308 | 1,605 |
| 100 | −1,768 | −958 | −148 | 663 | 1,473 | 3,093 |

*Low order density is the dominant risk*: at 25 orders the route loses ₹2,500–3,700 whatever the basket.

### 7.2 One-at-a-time shocks (50 orders/route-shift)

| Shock | Route-shift result (₹) | Change vs base (₹) |
|---|---:|---:|
| Base | −2,249 | 0 |
| Fuel +30% | −2,459 | −210 |
| Fuel +60% | −2,669 | −420 |
| Spoilage 12% of COGS (vs 6%) | −3,113 | −864 |
| Spoilage 3% of COGS | −1,817 | +432 |
| Discounts 10% of list (vs 4%) | −3,405 | −1,157 |
| Discounts 0% | −1,478 | +771 |
| List margin 24% (vs 28%) | −3,097 | −848 |
| List margin 34% (direct sourcing) | −977 | +1,272 |
| Refunds 5% (vs 2%) | −2,815 | −566 |
| 2 shifts per van-day | −799 | +1,450 |
| ₹25 collection fee on half of orders (illustrative; ignores demand loss) | −1,624 | +625 |

Reading it: **fuel is a minor risk** (even +60% costs only ₹420 per shift). **Discounting, buying margin and wastage are bigger** than fuel. **Route density and doubling vehicle utilisation dominate.** Heavy discounting (10%) costs more than the whole fuel bill.

### 7.3 Combined-lever case (AOV 500, margin 32%, discount 2%, wastage 4%, 2 shifts/van-day)

| Orders per route-shift | Profit/(loss) ₹ |
|---|---:|
| 25 | −503 |
| 35 | 455 |
| 45 | 1,414 |
| 60 | 2,852 |
| 80 | 4,769 |

Break-even ≈ 30 orders per route-shift.

## 8. Twelve-month ramp (illustrative)

Orders per shift ramp linearly over nine months; fixed costs as above; **CAC beyond the ₹8,000/month marketing line is not charged** (see §9).

| Case | Orders/shift (start→end) | Shifts/day | Month-12 operating profit | Peak cumulative operating cash need* |
|---|---|---:|---:|---:|
| G1 Base as-is | 15→50 | 1 | −₹126,470 / month | **≈ ₹16.9 lakh and still growing** (never breaks even) |
| G2 Combined levers | 15→45 | 2 | +₹5,529 / month | **≈ ₹6.3 lakh** (cumulative at month 12: −₹6.07 lakh) |
| G3 Optimistic | 15→80 | 2 | +₹212,764 / month | **≈ ₹2.9 lakh** (cumulative positive from month 8) |

*Operating cash need before capex and working capital. G2 also assumes one van can really serve 90 orders/day over two shifts with staff for both; staffing for the second shift is only partly captured (the model prices the helper per shift, the driver per van-day).

## 9. Initial capital and working capital (planning ranges [A])

| Item | ₹ range | Note |
|---|---:|---|
| Phase 0 pilot (hired vehicle, scales, crates, labels, small ad test, 4–6 weeks) | 60,000–1.5 lakh | Spend this first |
| Legal/registration/professional fees (FSSAI, GST, entity, CA/lawyer review) | 30,000–1 lakh | Depends on entity and licence class |
| Packing hub fit-out, cold-handling basics, hygiene kit | 50,000–2 lakh | |
| Vehicle: deposit for hired vehicle (or down payment if buying) | 25,000–1 lakh hired; far more if bought | Do not buy a van before validation |
| Scales, POS/UPI hardware, printer, branded signage, uniforms | 40,000–1 lakh | |
| Website/software build (if outsourced) or founder time | 0–6 lakh | Biggest swing factor |
| Brand/photography | 30,000–1 lakh | Real produce photography |
| **Operating loss during ramp** (from §8) | 3–17 lakh | G3 ≈ 2.9 lakh; G2 ≈ 6.3 lakh; G1 unbounded |
| **Working capital** | see below | |
| **Rough total to reach month 12 under G2** | **≈ 12–20 lakh** | Wide range because of software, vehicle and legal choices; **not a quote** |

**Working capital.** Prepaid orders are received *before* produce is purchased, so float helps; but Pay-at-van, supplier cash terms and refunds reverse it. A simple rule: hold cash ≥ 3 days of procurement + one week of refunds + 2 weeks of payroll/fixed costs. At ~₹30,000/day procurement (≈90–100 orders/day × ~₹290–340 COGS) this is roughly ₹1.5–2.5 lakh [A].

**CAC budget the ramp ignores.** Reaching ~800 active customers with CAC ₹150 ≈ ₹1.2 lakh of acquisition spend beyond the ₹8,000/month marketing line; referrals and society partnerships should keep this lower, but plan for it.

## 10. What must be true (decision thresholds from this model)

| Must-be-true | Pilot measure | Go threshold [A] |
|---|---|---|
| Contribution per order before route | Actual margin − discounts − wastage − packing | ≥ ₹60 (≥ 12% of AOV) |
| Orders per stop | Stop sheet counts | ≥ 12 by week 6 |
| AOV | Order data | ≥ ₹450 |
| Wastage | Closing logs | ≤ 5% of COGS |
| Discount rate | Promo spend | ≤ 3% of list |
| Route utilisation | Two shifts each ≥ break-even | Shift 2 ≥ 30 orders |
| Repeat | Week-over-week | ≥ 45% |

## 12. Warning from the founder's sample price list (added 2026-10-24)

The 34-item sample list (e.g. tomato ₹10.50/kg, potato ₹32, onion ₹30, carrot ₹25, cabbage ₹12.50) is what the demo shop currently charges. Pricing a plain household basket from it: 1 kg each of tomato, potato, onion, cabbage, bottle gourd and carrot is about **₹122**; 1.5 kg of each is about **₹182**. That is far below the ₹400 average order value the model assumed.

Re-running the Base scenario at lower baskets (same margin and cost assumptions, 1 route-shift):

| AOV | Contribution per order before route cost | Orders per route-shift needed to cover the route |
|---:|---:|---:|
| ₹150 | ₹1.5 | ~2,900 (not achievable) |
| ₹200 | ₹9.6 | ~450 |
| ₹250 | ₹17.7 | ~250 |
| ₹400 | ₹42.0 | ~104 |

**What this means.** Either (a) the list is wholesale/market rates and shelf prices will be higher (then margin is better but customers pay more than street vendors), or (b) the shelf prices really are this low and the van model cannot pay for itself on vegetables alone. Fixed costs per order (packing, packaging, route) do not shrink with the basket, so low-priced produce hurts hard. Questions to settle with real data: what do street vendors and supermarkets in Udaipur charge for these items on the same morning, what do you pay at the mandi, and what is a family's real weekly basket in rupees. Levers if (b): bigger minimum baskets or bundles, a small collection/handling fee, add higher-value items (fruit, dry fruit, staples, eggs), group orders per society, or a weekly pre-paid basket.

## 11. Limitations

- All numbers are assumptions. No supplier prices, van quotes, wages, or competitor prices were gathered, because the city is undecided.
- Linear ramp and constant fixed costs; no seasonality (monsoon/summer price swings) and no price-volatility modelling.
- Taxes (income tax, any GST effects on fees/margins), depreciation, interest, and owner pay beyond the ops lead are excluded.
- Route cost treats the second shift as sharing van and driver cost; if a second driver or helper is needed, base economics worsen.
- Gateway fee assumption is unverified; UPI at the van costs ~0 but creates reconciliation work.
