# Unit Economics: hub delivery (Instant ₹20 / 1 hour ₹10 / 3 hours free)

> Status: v2 · 2026-10-24 · Replaces the van-model economics (archived in `docs/archive-van-model/`).
> **Every input is a provisional assumption [A], not a market fact.** The model is code: [`tools/delivery_economics.py`](tools/delivery_economics.py); full output in [`tools/delivery_economics_output.md`](tools/delivery_economics_output.md). Edit the assumptions in the `Model` class and re-run `python tools/delivery_economics.py`.

## 1. Headline

**At a ₹300 basket and 28% gross margin, one order earns about ₹3 after rider, packing, packaging, wastage and payment costs.** Covering ₹95,000/month of fixed costs would need roughly **1,100 orders per day**. At the baskets your sample price list produces (₹150-250) the model **never breaks even**.

The delivery fees do not pay for the delivery: the most generous reading of reported rider pay (₹25-40 per quick-commerce order, sources conflict, some reports lower) is above the ₹20 / ₹10 / ₹0 you charge. What decides the business is **basket size, buying margin, wastage and rider batching**: not volume alone.

## 2. Assumptions (all [A]; change in the script)

| Item | Value | Basis |
|---|---:|---|
| Basket at list price (AOV) | ₹300 | Varied in the tables; your sample prices give ₹150-250 |
| Gross margin at list price | 28% | Guess; mandi-to-retail margin to be measured |
| Discounts | 3% | |
| Refunds | 2% of net sales | |
| Wastage | 8% of COGS | Higher than the old pre-order model (stock is bought ahead of orders) |
| Picking + packing labour | ₹10 per order | |
| Packaging | ₹9 | |
| Messaging + support | ₹1 + ₹3 | WhatsApp utility messages ~₹0.12-0.15 each [V, secondary] |
| Online payment share | 50% at 2.36% | Gateway fee unverified; cash on delivery today |
| Rider cost per delivery | Instant ₹45 · 1 hour ₹32 · 3 hours ₹22 | Instant: one order per trip and idle capacity; 3 hours: batched 2-3 per trip. Reported payouts ₹15-50 per order, **conflicting [V, secondary]** |
| Option mix | 20% / 35% / 45% | Guess |
| Fixed costs | ₹95,000 / month | Hub rent 25k + 2 packers 30k + manager 25k + tools 8k + misc 7k |

## 3. Per order, by speed (AOV ₹300, margin 28%)

| Line | Instant (₹20) | 1 hour (₹10) | 3 hours (free) |
|---|---:|---:|---:|
| Revenue collected incl. delivery fee | 305.2 | 295.2 | 285.2 |
| COGS | −216.0 | −216.0 | −216.0 |
| Wastage | −17.3 | −17.3 | −17.3 |
| Gateway fee | −3.6 | −3.5 | −3.4 |
| Rider cost | −45.0 | −32.0 | −22.0 |
| Packing + packaging + messaging + support | −23.0 | −23.0 | −23.0 |
| **Contribution per order** | **≈ 0.3** | **≈ 3.4** | **≈ 3.5** |

The three speeds all earn almost nothing at this basket. The ₹20 fee on Instant roughly cancels the extra rider cost; the free 3-hour option is no worse than the paid ones only because riders batch it.

## 4. Basket size × buying margin

**Blended contribution per order (₹):**

| AOV \ list margin | 22% | 28% | 35% | 40% |
|---|---:|---:|---:|---:|
| ₹150 | −31 | −21 | −10 | −2 |
| ₹200 | −26 | −13 | 2 | 13 |
| ₹300 | −17 | 3 | 26 | 42 |
| ₹400 | −7 | 19 | 49 | 71 |
| ₹600 | 13 | 51 | 97 | 129 |
| ₹800 | 32 | 84 | 144 | 187 |

**Orders per day to cover ₹95,000/month of fixed costs:**

| AOV \ list margin | 22% | 28% | 35% | 40% |
|---|---:|---:|---:|---:|
| ₹150 | never | never | never | never |
| ₹200 | never | never | 1,771 | 252 |
| ₹300 | never | 1,113 | 124 | 76 |
| ₹400 | never | 166 | 64 | 45 |
| ₹600 | 253 | 62 | 33 | 25 |
| ₹800 | 99 | 38 | 22 | 17 |

## 5. Levers (AOV ₹300, margin 28% unless stated)

| Change | Contribution per order (₹) | Break-even orders/day |
|---|---:|---:|
| Base | 3 | 1,113 |
| Minimum order ₹199 (basket becomes ~₹380) | 16 | 201 |
| Wastage 4% instead of 8% | 11 | 276 |
| Buying margin 35% (direct sourcing) | 26 | 124 |
| Riders batch more (cost 36 / 26 / 16) | 9 | 335 |
| Everyone chooses 3 hours | 4 | 896 |
| Instant ₹40, 1 hour ₹20 | 10 | 309 |
| **Combined:** basket ₹380, margin 35%, wastage 4%, batching | **61** | **52** |

**Reading it.** No single lever rescues the model. A combination does: a ₹380+ basket, 35% buying margin, 4% wastage and batching gets to roughly 50 orders a day. That is a realistic target for one hub only if the assortment widens beyond vegetables (fruit, dairy, eggs, staples carry larger baskets) and if you set minimum order values.

## 6. What the founder's sample price list implies

The 34-item list (tomato ₹10.50/kg, potato ₹32, onion ₹30, carrot ₹25, cabbage ₹12.50…) prices 1 kg each of six staples at about **₹122** and 1.5 kg each at about **₹182**. At those baskets, rider and packing costs per order cannot be recovered. Either the list is wholesale/market rates (then shelf prices and margins will be higher) or vegetables alone cannot carry home delivery. **Collect real Udaipur data first:** same-morning prices at street vendors, supermarkets and Instamart for a standard basket; your actual mandi purchase prices; a real rider quote; a typical family's weekly spend.

## 7. How the product reflects this

- Per-speed **minimum order** and a global minimum are settings (default ₹0 as you asked). **I recommend ₹199-₹299 at least for the free 3-hour speed.**
- Per-speed **capacity** (orders in progress) caps rider and packer load so the Instant promise holds.
- Per-speed **radius** keeps Instant to short, cheap trips.
- Speeds are data (fee, promise, minimum): you can change ₹20 / ₹10 / free without a deploy once the admin panel exists (Milestone 3).
- Order values and fees are stored per order, so margin reports (Milestone 3) can show contribution by speed, by distance and by basket.

## 8. Not modelled

Hub rent/utilities beyond the fixed line, vehicles and fuel for owned riders (a flat per-delivery cost is used), rider insurance/benefits, GST on delivery fees (to confirm with a CA), income tax, owner pay, marketing spend (CAC), seasonality (summer/monsoon price swings), peak-hour rider shortages, and stock holding cost. Capital and working-capital needs are not re-estimated here: they depend on the hub lease, rider model and opening stock.

## 9. Competitive context (for pricing)

- Quick-commerce scale (FY26): Blinkit ~916.6M orders, Zepto ~640.2M, Swiggy Instamart ~412.2M [V, secondary]. Blinkit reported an adjusted EBITDA profit of about ₹37 cr in Q4 FY26 while Zepto reported a loss of about ₹1,247.5 cr [V, secondary]: speed is expensive even at scale.
- Swiggy Instamart was reported to have launched in Udaipur (undated article; verify on the app) [V, weak]. Treat Udaipur as contested.
