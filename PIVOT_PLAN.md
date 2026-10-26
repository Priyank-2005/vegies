# Pivot plan: from van collection to hub delivery (Hari Haat, Udaipur)

> Status: v1 · 2026-10-24 · The original van/pre-order documents are archived in `docs/archive-van-model/` and are no longer current. The current documents (`BUSINESS_PLAN.md`, `PRD.md`, `OPERATIONS_PLAN.md`, `ARCHITECTURE.md`, `UNIT_ECONOMICS.md`, `MARKETING_PLAN.md`, `ROADMAP.md`, `DECISIONS.md`) are rewritten for the new model.

## 1. What you asked for
1. **No van.** Orders are delivered to the customer's address.
2. **Three delivery speeds:** Instant (₹20), 1 hour (₹10), 3 hours (free). No platform charges on any of them.
3. **Udaipur, Rajasthan only** for now.
4. **Detect the customer's location automatically** instead of typing a pincode.
5. **New name.**

## 2. The new model in one paragraph
Customers open the site, allow location access, and see whether we deliver to them and which speeds are available right now. They fill a cart from the hub's stock, choose Instant / 1 hour / 3 hours, confirm the address, verify their phone and place the order. The hub packs it, a rider takes it, the customer gives a 4-digit handover code, the rider collects cash/UPI if needed. There is no pre-order cut-off, no stops, no routes, no time slots.

## 3. Assumptions I made (change any of them; all are settings, not code)
| # | Assumption | Why |
|---|---|---|
| A1 | **Instant means a promise of 25 minutes**, 1 hour = 60 min, 3 hours = 180 min. Shown as "within X min" and as a clock time. | You did not define "instant"; 10-minute delivery needs dark-store density we do not have in one city hub. |
| A2 | **One hub** (dark store/packing point) in Udaipur. Delivery radii: Instant 3 km, 1 hour 7 km, 3 hours 15 km from the hub. The demo hub is a placeholder at the city centre. | Radius is the cheapest honest way to say "Udaipur only" and to protect the Instant promise. You must give the real hub address. |
| A3 | Hub opens 07:00-22:00, last order 20 minutes before closing. | Typical produce hours; editable. |
| A4 | Own riders (a staff role). Third-party rider partners can be added later. | Keeps cost control and proof of delivery in our system. |
| A5 | No platform/handling fee anywhere; only the delivery fee. Fees: Instant ₹20, 1 hour ₹10, 3 hours ₹0. | Your instruction. |
| A6 | **No minimum order by default** (your instruction), but each speed has its own configurable minimum. **I strongly recommend setting one**, see §4. | Economics. |
| A7 | Capacity per speed = maximum orders in progress at once (Instant 6, 1 hour 20, 3 hours 60). When full, that speed shows "Busy" and the others stay available. | Protects the Instant promise; replaces slot capacity. |
| A8 | Pay on delivery (cash/UPI to the rider), capped at ₹600 per order, until online payment exists (Milestone 4). | Same rule as before. |
| A9 | Stock is held at the hub and published daily. Nothing is bought "against orders" any more. | On-demand delivery cannot wait for a pre-order cut-off. |

## 4. Critical assessment (read this)
I ran the economics again for the new model (`tools/delivery_economics.py`, full tables in `UNIT_ECONOMICS.md`). All inputs are assumptions, but the conclusion is robust:

- At a **₹300 basket and 28% margin**, each order earns about **₹3** after the rider, packing, packaging, wastage and payment fees. Break-even needs roughly **1,100 orders per day**.
- With your **sample price list**, baskets are about **₹150-250**. There the model **never breaks even**, whatever the volume, because rider and packing cost per order do not shrink with the basket.
- The delivery fees (₹20, ₹10, ₹0) do not cover a rider (about ₹22-45 per delivery in my assumptions, from loosely sourced reports of ₹25-40 per quick-commerce order). Instant loses most per order.
- Wastage is higher than in the pre-order model because stock is bought ahead of demand.
- Reality check on competition: Swiggy Instamart is reported to have launched in Udaipur (an undated report; verify). Competing on speed against an incumbent with scale is the hardest version of this business.

**What would make it work** (combine several; each is a setting or a business choice): minimum order values (₹299-₹399 would lift the basket to ₹400+), a wider assortment with higher-value items (fruit, dairy, eggs, staples, dry fruit), buying margin of 35%+ through direct sourcing, wastage at 4% or less, batching 3-hour orders per rider trip, and charging a fee on Instant that reflects its cost. In the model, the combination of ₹380 basket, 35% margin, 4% wastage and batching reaches break-even at about 50 orders per day.

**My recommendation:** build as asked (everything below is configurable), but before spending on riders or marketing, test with real numbers: real shelf prices vs. Blinkit/Instamart/local vendors, your real mandi buying prices, and a real rider quote.

## 5. What changes in the product
| Area | Before (van) | Now (delivery) |
|---|---|---|
| Where | Pincode, collection stops | **Browser location (GPS)** → distance to hub; fallback: address search |
| When | Slots with cut-off | **Speed choice** (Instant / 1 hour / 3 hours), hub opening hours |
| Capacity | Slot + stop + van load | **Active orders per speed** at the hub |
| Fee | Free collection | **₹20 / ₹10 / ₹0** per speed (configurable) |
| Hand-over | QR pickup code at the van | **4-digit delivery code** shown to the customer, entered by the rider |
| Cancel | Free until slot cut-off | Free **until packing starts** |
| Staff | Driver at stops | **Rider**; dispatcher/ops assigns |
| Order states | ... PROCUREMENT_LOCKED, LOADED, AT_STOP, COLLECTED, NO_SHOW | CONFIRMED → PACKING → PACKED → OUT_FOR_DELIVERY → DELIVERED / DELIVERY_FAILED |
| Stock | Bought against confirmed orders | Held at the hub, published daily |

## 6. Location detection: how it works and what it costs
- The browser's built-in Geolocation API gives latitude/longitude **after the customer taps "Use my current location" and allows it** (browsers require this permission; it also requires HTTPS in production, localhost is exempt). We never read location silently.
- The server decides serviceability from the coordinates (distance to the hub); no external service is needed for that, and it costs nothing.
- To turn coordinates into a readable address and to support "search my address" when permission is denied, we use a **geocoder behind an interface**. The development build uses the free public OpenStreetMap Nominatim service; its published policy allows about 1 request per second, requires an identifying User-Agent, and expects caching (secondhand summary, verify the official policy). **It is not suitable for production volume**: before launch choose a paid provider (Google, Ola Maps, MapMyIndia or a self-hosted Nominatim). That is an open decision (D-040).
- Privacy: coordinates are personal data. We store the delivery coordinates with the order, show them only to staff who need them, do not log them, and say so in the policy.
- If the customer denies permission or GPS is inaccurate, they can search or type their address, and always edit the address text before ordering.

## 6b. Name
**Hari Haat (हरी हाट)**: "green market". My web searches found no existing business with this name, but that is not a trademark search. Rejected after search: Tokri (existing Pune grocery company and others), Fatafat (existing Jugnoo service), Jhatpat (too close to "Jhutpat", a Delhi delivery startup). The name lives in one file (`app/src/lib/brand.ts`) so changing it later is a one-line edit.

## 7. Work breakdown (what I am doing now)
1. **Schema re-baseline** (pre-launch, no real data): hub, delivery options, delivery address on orders, delivery records; remove stops/routes/slots. Migration history is squashed.
2. **Services:** serviceability by location, delivery options with availability, order creation with fee, hub-load capacity, cancel/expire, rider dispatch and proof of delivery (code check + cash/UPI record), geocoder interface.
3. **Tests:** replace the slot/van tests; add tests for range, hours, capacity under concurrency, fees, handover code, dispatch.
4. **API + storefront:** location detect, speed selector, address form, new tracking page, new copy and policy.
5. **Rename** everywhere; **docs rewritten**; economics model replaced.
6. **Not in this change:** admin screens (Milestone 3: dispatch board, rider app, catalogue/stock/hub settings), online payment, real OTP/WhatsApp delivery, a map view, saved addresses, scheduling for later, third-party rider integration, real product photos.
