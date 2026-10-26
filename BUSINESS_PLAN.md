# Business Plan: on-demand fresh produce delivery in Udaipur (Hari Haat)

> Status: v2 · 2026-10-24 · Rewritten after the pivot from van collection to hub delivery. The earlier plan is archived in `docs/archive-van-model/`. Read `PIVOT_PLAN.md` first.
> Tags: **[V]** verified from a public source I opened this session (often secondary: re-check before relying) · **[E]** estimate · **[A]** assumption · **[?]** needs confirmation.
> **Name:** "Hari Haat" (हरी हाट) is a working name. Web searches found no existing business of that name, but this is not a trademark search.

## 1. The business in one paragraph
Hari Haat sells fresh fruit and vegetables for home delivery in Udaipur from one packing hub ("dark store"). Customers share their location, fill a cart and choose a speed: **Instant (₹20, promise ~25 min)**, **within 1 hour (₹10)** or **within 3 hours (free)**. There are no platform charges. Riders deliver; customers pay cash/UPI on delivery for now and prove receipt with a 4-digit code.

## 2. Value proposition
- Fresh produce at the door, with a choice of speed and a clear price for each.
- **Honest weights:** you never pay more than you agreed; short bags are refunded.
- **Free delivery if you can wait 3 hours**; a small fee only when you want it fast.
- Hindi and English product names; simple phone-OTP checkout without passwords.

## 3. Customers
| Segment | Why | Risk |
|---|---|---|
| Working households in Udaipur's residential areas | Need produce without a market trip | Already use Instamart [V, weak] and local vendors |
| Older residents and families who prefer to order, not shop | Convenience, honest weights | Phone ordering preference: add WhatsApp/phone ordering later |
| Hotels, restaurants, PGs (tourism city) | Larger baskets, predictable demand | **Hypothesis only.** Needs separate pricing and credit terms; it is the strongest lever on basket size |

## 4. Competition
| Competitor | Strength | Our angle |
|---|---|---|
| Swiggy Instamart (reported in Udaipur, undated [V, weak]) and other quick-commerce apps | Speed, selection, habit, discounts | Not on selection: honest weights, free 3-hour option, local freshness, Hindi-first |
| Neighbourhood vegetable vendors and shops | Cheapest, relationship, credit | Convenience and transparency, not lowest price |
| Supermarkets | Price, one-stop | Delivery and freshness |
| Mandi / weekly markets | Cheapest and freshest | Time saved |

I found no reliable public figure for Udaipur produce demand or competitor produce prices. **[?]** A same-morning price-basket comparison is the first piece of fieldwork.

## 5. Revenue model
- **Margin on produce** (buy price to shelf price) [A: 28%; unproven].
- **Delivery fees:** Instant ₹20, 1 hour ₹10, 3 hours ₹0. Not enough to cover riders (`UNIT_ECONOMICS.md`).
- Levers to evaluate: minimum order values, wider assortment (dairy, eggs, staples, fruit baskets), B2B supply to hotels/restaurants, family bundles, fees reflecting true cost on Instant.
- Not planned: platform/handling fees (your decision), subscriptions with auto-charge.

## 6. Honest assessment (summary)
- **The delivery model is much harder economically than the van model was.** At a ₹300 basket the contribution per order is ~₹3; break-even ~1,100 orders/day. With your sample price list the baskets are ₹150-250 and the model never breaks even. Full tables: `UNIT_ECONOMICS.md`.
- It becomes workable only with a combination: ₹380+ baskets, 35% buying margin, ≤4% wastage and rider batching (break-even ≈ 50 orders/day in that combined case).
- Therefore the product is built to **learn the real numbers cheaply**: configurable fees, minimums, radii and per-speed capacity; per-order cost data; a single hub.

## 7. Launch strategy (Udaipur only)
- **One hub**, central enough that Instant (3 km) covers dense neighbourhoods, 1-hour (7 km) most of the city, 3-hour (15 km) the whole urban area [A]. Get the real hub location before anything else.
- Start with the 3-hour speed + a small Instant radius, tune from data.
- Soft launch to a limited number of households (friends, societies you know), capped orders per speed, cash/UPI on delivery.
- **Hub selection criteria:** distance to the mandi at 5-6 AM and to dense residential clusters at 6 PM; rent; parking and loading space for riders; ability to keep produce cool.

## 8. Operations (summary; details in `OPERATIONS_PLAN.md`)
Daily buying → receiving/QC → publishing stock → order picking and packing → rider handover → delivery with code → cash/UPI reconciliation → closing and wastage. Staff: manager, 2+ packers, riders (own or partner), part-time procurement.

## 9. Risks
| # | Risk | Likelihood [E] | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Unit economics negative at realistic baskets | **High** | Fatal | Minimums, assortment, margin work; measure before hiring riders at scale |
| R2 | Instamart/others undercut on price and speed | High | High | Don't chase 10-minute; compete on honesty, Hindi-first, free 3-hour; consider B2B |
| R3 | High wastage (stock bought ahead of orders) | High | High | Daily buy-to-forecast, small SKU range at first, markdown/walk-up outlet, tight QC |
| R4 | Rider availability and cost; Instant promise missed | Medium | High | Capacity caps per speed; batching; backup riders; honest ETAs |
| R5 | Cash-on-delivery risk (no-shows, cash handling) | Medium | Medium | ₹600 cap, failed-delivery strikes, delivery code, daily cash reconciliation, online payment (M4) |
| R6 | Legal/registration gaps (FSSAI, GST, rider engagement) | Medium | High | Professional review **before the first real order** (§11) |
| R7 | Quality failures damage trust | Medium | High | QC checklist, photo logs, no-argument refunds on first claims |
| R8 | Location/geocoding costs and privacy | Medium | Medium | Free OSM geocoder only for dev; production provider decision; minimal data retention |
| R9 | Founder runs everything (key-person risk) | High | Medium | SOPs, admin panel, cross-trained staff |

## 10. Validation before big spending
| # | Experiment | Success threshold [A] |
|---|---|---|
| E1 | Price-basket benchmark vs vendor / supermarket / Instamart | Our shelf prices within ±10% of supermarket for staples, with a stated margin ≥ 26% at list |
| E2 | Basket size test (100 real orders, any channel) | Median basket ≥ ₹300 with a minimum order; ≥ ₹380 target |
| E3 | Rider cost test: quotes from 2-3 delivery partners and own-rider payroll | Blended cost ≤ ₹30 per delivery with batching |
| E4 | Wastage test (2 weeks of daily stock logs) | ≤ 6% of COGS |
| E5 | Speed mix test: share choosing Instant vs 1 hour vs 3 hours | Instant ≤ 25% of orders at current fees |
| E6 | Repeat test | ≥ 40% of first-time customers order again within 14 days |

## 11. Legal and compliance (NOT legal advice: needs a CA / lawyer / FSSAI consultant)
| Area | Finding | Status |
|---|---|---|
| FSSAI | Fruit and vegetable vendors are food business operators needing registration/licence. **Thresholds appear to have changed in 2026**: an FSSAI order dated 13 Mar 2026 is reported to set registration up to ₹1.5 cr turnover, state licence ₹1.5-50 cr, central above ₹50 cr; older sources say ₹12 lakh. FoSCoS tables list **e-commerce** under a central licence (₹7,500 fee) with no turnover limit. **[V, secondary, conflicting; primary PDFs could not be opened]** | **[?] Highest priority:** does selling online from our own site and delivering make us an "e-commerce FBO"? |
| GST | Fresh unbranded produce widely described as nil-rated; registration thresholds conflict across sources; delivery fees may be taxable. **[V, secondary]** | **[?]** CA to confirm treatment of the delivery fee and of any packed/branded items |
| Consumer protection (E-Commerce Rules 2020) | Sellers must disclose price/origin/expiry where relevant, appoint a grievance officer, acknowledge complaints (reported 48 h) and resolve within a month, no fake reviews. **[V, secondary]** | Build grievance flow; confirm timelines in the notified Rules |
| Legal metrology | Not found. Scales used for sale, pre-packed declarations. | **[?]** consultant |
| Privacy (DPDP) | Rules notified 13 Nov 2025; consent-manager provisions 13 Nov 2026; substantive duties from **13 May 2027**. **[V, secondary]** Location data and delivery addresses are personal data. | Consent, minimal retention, deletion process; confirm with counsel |
| Delivery workforce | Riders as employees vs gig contractors; motor-vehicle insurance, licences, any labour/social-security duties for platform workers | **[?]** lawyer/CA; affects cost |
| Payments | Gateway merchant eligibility; cash handling controls | **[?]** |
| Messaging | WhatsApp opt-in/templates; SMS typically needs DLT registration | **[?]** |
| Municipal | Trade licence, hub premises permissions, vehicle/parking rules | **[?]** city not yet researched in detail |
| Entity | Proprietorship / LLP / Pvt Ltd; bank account | **[?]** founder + CA |

**Build is allowed before registration; real sales are not** (DECISIONS D-023).

## 12. Conditions for expanding (second hub / new city)
Hub contribution ≥ 0 for 8 consecutive weeks; on-time (within promise) ≥ 90% per speed; refund+credit ≤ 3% of sales; wastage ≤ 5%; repeat ≥ 40%; SOPs written; a second supplier relationship; a hub manager who is not the founder; ≥ 150 waitlist sign-ups (location-clustered) in the new area.
