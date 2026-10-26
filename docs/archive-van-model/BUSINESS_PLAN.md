# Business Plan: Hyperlocal Fresh Produce (Pre-order + Neighbourhood Van)

> Status: DRAFT v0.1 for founder review · Date: 2026-10-23 · Working name: **"FreshVan" (placeholder only. Not checked for trademark/domain conflicts, do not publish.)**

## 0. How to read this document

Every claim is tagged:

| Tag | Meaning |
|---|---|
| **[V]** | Verified from a public source I actually opened/searched during this planning pass (source named). Many are *secondary* sources (news/blogs/law-firm notes) and must be re-checked against primary sources before any decision depends on them. |
| **[E]** | Estimate based on general knowledge/reasoning. Not measured. |
| **[A]** | Provisional assumption that exists only so the model can be calculated. Replace with measured data from the pilot. |
| **[?]** | Unknown / needs professional or official confirmation. |

No market size, competitor price, conversion rate or demand forecast in this plan is presented as fact unless tagged [V]. I deliberately did **not** include a TAM figure: I found no source I would trust, and a made-up TAM would not change any decision you need to make now.

---

## 1. Executive summary (the honest version)

**The idea:** customers pre-order fruit & vegetables online before a cutoff; we aggregate orders by neighbourhood, buy fresh against confirmed demand, pack, and a branded van visits scheduled stops where customers collect. Optional home delivery later.

**What is good about it:** pre-orders mean we buy against known demand (low spoilage vs. dark-store stocking), no rent for per-neighbourhood dark stores, and a scheduled "market comes to you" ritual that suits weekly produce buying.

**What the numbers say (see `UNIT_ECONOMICS.md`, all assumptions [A]):** with plausible-but-unmeasured inputs (AOV ₹400, 28% gross margin at list price, 4% discounts, 6% wastage, one route per van-day), **a single route loses money until roughly 100 orders per route-shift**. The route is the problem: a van + driver + helper costs about ₹4,350 per shift [A]; produce contribution per order is only about ₹40 [A]. The business becomes attractive only when several levers move together:

1. Higher basket size (baskets/bundles → ₹500+),
2. Better buying margin (direct farmer/FPO sourcing, ~32%+),
3. Low discounting (≤2–4%) and low wastage (≤4%),
4. Two route-shifts per van-day (e.g. morning + evening),
5. Dense stops (10–16 orders per stop, 5 stops/route).

With all five at "optimistic-but-not-crazy" values the model breaks even at roughly 30 orders per route-shift. **That is the single most important thing to validate**, and it can be validated *before building a full platform*.

**Recommendation (changes your requested sequence slightly):**

- **Phase 0, "concierge pilot" (4–6 weeks, ~no software):** run 2–3 real pilot stops/week using a simple order form + WhatsApp + UPI, a hired pickup/tempo, and manual packing. Goal: measure *real* orders-per-stop, AOV, margin, wastage, no-show rate, repeat rate. Cost: low five-figure ₹ [E].
- **Phase 1, Website MVP** only after Phase 0 hits agreed go/no-go thresholds (section 12). The planned app is a good investment *if* those numbers show up; it is a poor one if they do not.
- Keep home delivery out of the first release. It breaks route density (see section 5).

I will not push to build the full product before you decide on this sequencing (DECISIONS D-001).

---

## 2. Value proposition

> "Fresh produce, weighed honestly, at a fixed time, one stop from your home."

For households that buy vegetables/fruit weekly, we offer:

- **Freshness by design**: bought the same day against confirmed orders (not held in a warehouse for days).
- **Predictable schedule**: a published stop and arrival window; reminder before arrival.
- **Transparent pricing & weights**: per-kg price shown everywhere; no silent upcharge (see PRD business rules).
- **Competitive price**: aim to price near or below supermarkets, close to local vendor price (to be *measured*, not assumed, see section 4).
- **Convenience without a delivery fee**: collect from the van at a stop near you.

## 3. Customer pain points → solution

| Pain point (hypothesis [E]) | How we address it | How we test it |
|---|---|---|
| Local vendor quality/price vary day to day; no weight transparency | Fixed posted prices, packed weights shown, refund for short weight | Pilot NPS + "short-weight" complaints |
| Quick-commerce is convenient but costly (fees, small-cart surcharges, price markups [E]) | No delivery fee at stops; bundle pricing | Price-basket comparison done by us (section 4) |
| Visiting a mandi/market is time-consuming, esp. for working households | Pre-order, 2-minute collect | Time-to-collect measured at stops |
| Supermarket produce can be stale or pre-packed in large units | Same-day buy, configurable pack sizes | Repeat purchase rate |
| Uncertainty about delivery windows | Published windows + reminders | On-time arrival metric |

## 4. Market & competitor positioning

### 4.1 What I verified
- Quick-commerce scale (FY26 order counts per Eternal data as reported): Blinkit ≈ 916.6M orders, Zepto ≈ 640.2M, Swiggy Instamart ≈ 412.2M **[V, secondary: Business Today / Outlook Business, 2026]**. Q4 FY26: Blinkit adjusted EBITDA profit ≈ ₹37 cr; Zepto adjusted EBITDA loss ≈ ₹1,247.5 cr **[V, secondary]**. AOV figures reported by secondary sources conflict (e.g. Blinkit ~₹525 for Q4 FY26) → **[?]**, not used in the model.
- I found **no** reliable public figure for the fruit-and-vegetable share of quick-commerce orders. **[?]**

### 4.2 Positioning map (qualitative, [E])

| Competitor | Their strength | Their weakness vs. us | Our stance |
|---|---|---|---|
| Zepto / Blinkit / Instamart | 10–30 min delivery, huge selection, habit | Price/fees on low baskets, produce quality inconsistency (anecdotal), loss-making or thin-margin economics at scale | Don't compete on speed. Compete on freshness-by-schedule, weight transparency and price |
| Local street/cart vendors & neighbourhood shops | Cheapest, relationship, haggling, credit | No transparency, variable quality, no app/reorder | Offer reliability + convenience, not lower prices than a haggled cart |
| Supermarkets (DMart-type, Reliance, More, etc.) | Low prices, one-stop | Travel, produce freshness varies | Match on price for staples, win on convenience |
| Mandi/weekly markets | Cheapest, freshest | Time, crowd, hygiene | Same freshness without the trip |
| Existing farm-to-home subscription brands | Brand, organic positioning | Often premium-priced; some are subscription-heavy | Mainstream price, no subscription lock-in |

**To do in Phase 0 (not done yet):** build a *price-basket benchmark*: a standard 15-item basket priced the same morning at (a) a local vendor, (b) a supermarket, (c) Blinkit/Zepto/Instamart, (d) mandi wholesale. Only then set target price positioning. I did not fabricate prices.

### 4.3 Competitive advantages and weaknesses

| Advantages (real only if we execute) | Weaknesses |
|---|---|
| Demand known before purchase → lower wastage | Not instant. Scheduled model excludes impulse buyers |
| No per-neighbourhood fixed rent (one packing hub) | Van + staff cost is **fixed per route**, so density is everything |
| Weight/price transparency as brand | Customers must travel to a stop (friction) |
| Data on neighbourhood demand to expand intelligently | Small scale → weak purchasing power vs. quick-commerce |
| Low software cost (monolith) | Heavily dependent on 1–2 suppliers and a few key people at start |

---

## 5. Revenue model

**Core:** margin on produce sold (buy price → list price). [A: 22–32% at list price.]

**Evaluated additional streams (priority):**

| Stream | Priority | Notes |
|---|---|---|
| Family bundles / weekly baskets (higher AOV, planned buying) | **P0 for Phase 1** | Single biggest lever on route economics |
| Walk-up surplus sales at stops (sell leftover stock) | **P1** | Converts spoilage into margin; needs billing at the van + legal metrology compliance check |
| Small convenience fee on pay-at-van or on small baskets (e.g. min order ₹250 or small-order fee) | P1 | Test price sensitivity; the model shows a ₹25 fee on half of orders ≈ +₹625/route-shift |
| Paid home delivery in covered society gates | P1 (behind flag) | Only inside already-served societies; never a separate trip |
| Add-on categories: eggs, dairy, staples, herbs, cut vegetables | P2 | Cut/processed items have different FSSAI/shelf-life implications **[?]** |
| Society/corporate partnerships (sponsored stop, weekly office baskets) | P2 | Could provide guaranteed volume |
| Supplier/brand sampling & promotions at stops | P2 | Avoid until volume exists |

**Not recommended now:** subscriptions with auto-charge (see MARKETING_PLAN), membership fees before trust is built.

## 6. Target customer segments

| Segment | Why | Risk |
|---|---|---|
| **Primary:** Gated-society / apartment households with working adults, 25–50, weekly produce spend | Dense, reachable via RWA, parking at gate | Competing with quick-commerce habit |
| Secondary: Non-gated residential colonies with active WhatsApp groups | Large volume, price-sensitive | Parking/space, lower AOV |
| Tertiary: Hostels/PGs/offices (bulk pre-orders) | Predictable volume | Payment terms, credit risk |
| Later: Elderly/less mobile → home delivery add-on | Valuable for loyalty | Route cost |

## 7. Launch strategy (neighbourhood-first)

Scoring rubric (score each candidate 1–5 using *evidence*, not assumption; city is not yet chosen, see DECISIONS Q-1):

| Criterion | Evidence to collect |
|---|---|
| Residential density / households within 800 m of the stop | Society directories, RWA lists, map counts |
| Housing-society concentration | Count of 200+ unit societies within 1.5 km |
| Distance to supplier/mandi (travel time at 5 AM and 1 PM) | Drive-test |
| Competition at the gate | Count of vendors/stores/quick-commerce coverage; talk to residents |
| Parking & access for a van | Site visit, society permission |
| Purchasing power | Rent/price proxies, resident survey |
| Route feasibility | 5 stops within a 25–45 min loop |
| Expected orders per stop | Pre-launch registrations × historical conversion (from Phase 0) |

**Launch plan:** 1 hub, 1 route, 4–5 stops within ~5 km of each other, 3 days/week initially → 6 days/week once ≥ 30 orders/shift. Expand stops before adding vehicles. See `MARKETING_PLAN.md` for pre-launch demand validation.

## 8. Customer acquisition and retention (summary)

Detailed in `MARKETING_PLAN.md`. Core principle: **society/RWA partnerships + WhatsApp community + referral**, measured by *paid, fulfilled orders*, not clicks. Retention levers: reorder-in-two-taps, saved baskets, consented weekly reminders, honest refund policy, no auto-recurring charges without explicit authorization.

## 9. Operational requirements (summary)

Detailed in `OPERATIONS_PLAN.md`: packing hub (small, hygienic, with cold-handling for leafy produce), vehicle(s), scales (legal-metrology-verified where required **[?]**), crates, labels, UPI QR/POS, 1 procurement person, 1–2 packers, driver, handover helper, WhatsApp support, daily closing routine.

## 10. Risks and mitigations

| # | Risk | Likelihood [E] | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Route economics never close (density too low) | High | Fatal | Phase 0 pilot; fixed go/no-go thresholds; expand stops not vans |
| R2 | Customers won't walk to a van (convenience gap vs. Blinkit) | Medium | High | Stops at society gates; short dwell times; offer later home-delivery inside the society |
| R3 | Produce quality failure (one bad delivery destroys trust) | Medium | High | Inspection checklist, photo logs, no-questions refund for quality, supplier scorecards |
| R4 | Price wars/quick-commerce discounting | Medium | Medium | Don't match; differentiate on freshness/weight; basket bundles |
| R5 | Spoilage/over-buying | Medium | Medium | Buy against confirmed orders; small buffer; surplus walk-up sales; end-of-day workflow |
| R6 | Regulatory gap (FSSAI/GST/legal metrology/permits) | Medium | High | Professional review *before* first real order (section 13). Not a "we'll fix later" item |
| R7 | Payment/refund disputes, COD no-shows | Medium | Medium | Prepaid default for first orders; strike policy; capped pay-at-van |
| R8 | Founder/key-person dependence; single supplier | High | Medium | Document SOPs; 2+ suppliers per top-20 SKU |
| R9 | Vehicle breakdown/traffic/rain | High | Low–Medium | Contingency SOP; backup vehicle on call; delay notifications |
| R10 | Parking/municipal/traffic-police issues at stops | Medium | Medium | Written society permission; check local rules **[?]**; avoid road-side stops |
| R11 | Over-engineering software before demand is proven | High | Medium | Phase 0 concierge test; MVP monolith |
| R12 | Data privacy / consent mistakes in WhatsApp marketing | Low–Medium | Medium | Opt-in logging, DPDP-aligned design (section 13) |

## 11. Validation experiments (before heavy investment)

| # | Experiment | Success threshold (provisional [A]) | Cost |
|---|---|---|---|
| E1 | Landing page + pin-code/society interest form + WhatsApp opt-in | ≥ 300 verified sign-ups in 3 target societies in 3 weeks | Low |
| E2 | Price/preference survey (20 staple items, bundle options) | ≥ 100 responses, identify top 30 SKUs & bundle appetite | Low |
| E3 | **Paid pre-order test** of a fixed "Starter family basket" at a committed stop | ≥ 25 paid pre-orders at one stop | Very low |
| E4 | 3 pilot stops × 2 weeks (hired vehicle) | ≥ 15 orders/stop by week 2; AOV ≥ ₹400; no-show ≤ 5% | Low–medium |
| E5 | Repeat test: second-week reorder | ≥ 40% of week-1 buyers reorder in week 2 | None extra |
| E6 | Margin test: actual buy price vs list price over 2 weeks | Gross margin at list ≥ 26%; wastage ≤ 6% | None extra |
| E7 | Fee/bundle price test (A/B groups by stop) | Fee ≤ 5% demand loss | None extra |
| E8 | Time-at-stop test | ≤ 90 s average per customer; ≤ 12 min queue peak | None extra |

## 12. Conditions required before expanding

**Expand stops within the same area when, for 4 consecutive weeks at a route:**
- Average ≥ 12 orders per stop; AOV ≥ ₹450; repeat (week-over-week) ≥ 45%.
- On-time arrival ≥ 90%; refund+credit rate ≤ 3% of sales; wastage ≤ 5% of COGS.
- Route-shift contribution ≥ 0 (after route costs), trending positive.

**Add a second vehicle/route when:** the first route runs ≥ 6 days/week at ≥ 85% capacity and has a waitlist.

**Open another neighbourhood when:** the first has a positive route contribution for 8 weeks, SOPs are documented, a second supplier relationship is in place, and ≥ 150 verified waitlist registrations (or 3 society commitments) exist in the new area.

**Open a new city when:** ≥ 3 profitable neighbourhoods, a city manager can run daily operations without the founders, and software has no founder-only manual workarounds. The new-city launch repeats Phase 0.

## 13. Legal & compliance: status (NOT legal advice)

Requires a CA / lawyer / FSSAI consultant before first real order. What I found:

| Area | Finding | Status |
|---|---|---|
| FSSAI | Sources agree fruit/veg *vendors* are food business operators needing registration/licence and must display the number. **Thresholds appear to have changed in 2026**: an FSSAI order dated 13 Mar 2026 is reported to set registration up to ₹1.5 cr turnover, state licence ₹1.5–50 cr, central above ₹50 cr, whereas older sources still say ₹12 lakh. FoSCoS eligibility PDFs list **E-commerce** under a **central licence (₹7,500 fee) with no turnover limit**. **[V, secondary, conflicting; I could not open the primary PDFs because of a certificate error on fetch]** | **[?] Highest-priority compliance question: does an online-ordered, van-collected produce business count as an "e-commerce FBO"? Ask an FSSAI consultant / FSSAI helpdesk (1800-11-2100).** |
| GST | Fresh, unbranded fruits & vegetables are widely described as nil-rated (exempt); registration threshold sources conflict (₹20 lakh vs ₹40 lakh for goods; lower in special-category states); sources claim GST registration is mandatory for e-commerce sellers on third-party platforms (we run our own site). Exempt supplies cannot claim ITC on related purchases. **[V, secondary, partially conflicting]** | **[?] CA to confirm.** Also confirm tax treatment of delivery/convenience fees, cut/packed or branded items. |
| Consumer protection (E-Commerce Rules 2020) | Sellers on e-commerce must disclose price/origin/expiry where applicable, appoint a grievance officer, acknowledge complaints (reported 48 h) and resolve (reported 1 month); no fake reviews. **[V, secondary]** | Build grievance workflow and policy pages. Confirm exact timelines in notified Rules. |
| Legal Metrology | Search returned nothing usable on loose produce vs pre-packed declarations. Needed: what applies to pre-packed produce with declared weight, weighing instruments verification/stamping at the van. | **[?] Consultant.** |
| DPDP Act / Rules | Rules notified 13 Nov 2025; consent-manager provisions 13 Nov 2026; substantive consent/notice duties from **13 May 2027**. **[V, secondary law-firm summaries]** | Design consent capture and deletion now (cheap). Confirm with counsel before launch. |
| Payment gateway eligibility | Needs business PAN/bank account; category approval | **[?]** Apply only after approval to incur costs |
| Municipal/vehicle/parking permission, goods vehicle registration (commercial plates), trade licence | Not researched (city not chosen) | **[?]** |
| Messaging (WhatsApp/SMS) | WhatsApp requires opt-in, templates; SMS in India typically requires DLT registration (my background knowledge, not verified this session) | **[?]** |
| Business structure | Proprietorship vs LLP vs Pvt Ltd | **[?]** CA; see DECISIONS |

Distinguishing categories: *legal requirements* (FSSAI, GST, DPDP, E-Commerce Rules, municipal permits) vs *recommendations* (refund policy beyond legal minimum, NPS surveys, photo logs).

## 14. Open questions for the founder

See `DECISIONS.md` section 4. The top three: **city/neighbourhood**, **budget and runway**, **who runs daily operations**.
