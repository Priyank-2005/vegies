"""Editable unit-economics model for the hyperlocal produce van business.

Every number in SCENARIOS / FIXED is a PLACEHOLDER ASSUMPTION, not a market fact.
Edit the values, then run:  python tools/unit_economics.py > unit_economics_output.md
Money is in whole rupees (floats are acceptable here: this is a planning model,
NOT the production money path, which must use integer paise).
"""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Scenario:
    name: str
    aov: float             # list-price basket value per order, Rs
    list_margin: float     # gross margin at list price (1 - cost/list)
    discount: float        # promo/discount as share of list value
    refund: float          # refunds+credits as share of net sales
    spoilage: float        # unsold/damaged stock as share of COGS
    prepaid_share: float   # share of orders paid online
    gateway_fee: float     # effective fee on prepaid (2% + 18% GST = 2.36%, unverified)
    packaging: float       # Rs per order
    packing_labor: float   # Rs per order (variable pack labor)
    messaging: float       # Rs per order (WhatsApp/SMS/email)
    support_misc: float    # Rs per order
    orders_per_route: int  # orders served on one route-shift
    stops_per_route: int
    van_day: float         # van hire/EMI-equivalent, Rs per van-day
    fuel_shift: float      # Rs per route-shift
    driver_day: float      # Rs per van-day
    handover_shift: float  # handover/billing helper, Rs per route-shift
    parking_shift: float   # Rs per route-shift
    shifts_per_van_day: int
    cac: float             # marketing spend per new customer, Rs
    lifetime_orders: float  # orders per acquired customer over 6 months


SCENARIOS = [
    Scenario("Conservative", 300, .22, .06, .03, .08, .50, .0236, 10, 12, 1.0, 4,
             25, 5, 2000, 700, 900, 600, 150, 1, 200, 4),
    Scenario("Base", 400, .28, .04, .02, .06, .70, .0236, 9, 10, 0.8, 3,
             50, 5, 2000, 700, 900, 600, 150, 1, 150, 8),
    Scenario("Optimistic", 500, .32, .02, .01, .04, .80, .0236, 8, 8, 0.6, 2,
             80, 5, 2000, 700, 900, 600, 150, 2, 100, 12),
]

# monthly fixed costs, Rs (same for all scenarios; edit freely)
FIXED = {
    "Packing hub / small godown rent": 20000,
    "Ops & procurement lead (salary)": 25000,
    "Software, hosting, tools": 6000,
    "Accounting & compliance": 6000,
    "Phone, internet, misc": 3000,
    "Always-on marketing/content": 8000,
}
OPERATING_DAYS = 26  # per month


def unit(s):
    net = s.aov * (1 - s.discount)
    refunds = net * s.refund
    collected = net - refunds
    cogs = s.aov * (1 - s.list_margin)
    spoil = cogs * s.spoilage
    fee = collected * s.prepaid_share * s.gateway_fee
    var = cogs + spoil + fee + s.packaging + s.packing_labor + s.messaging + s.support_misc
    return dict(net=net, refunds=refunds, collected=collected, cogs=cogs, spoil=spoil,
                fee=fee, var=var, contrib=collected - var)


def route_cost(s):
    return (s.van_day / s.shifts_per_van_day + s.driver_day / s.shifts_per_van_day
            + s.fuel_shift + s.handover_shift + s.parking_shift)


def route_day_profit(s):
    return s.orders_per_route * unit(s)["contrib"] - route_cost(s)


def breakeven_orders_per_route(s):
    c = unit(s)["contrib"]
    return float("inf") if c <= 0 else route_cost(s) / c


def monthly(s, routes_per_day):
    u = unit(s)
    orders_day = s.orders_per_route * routes_per_day
    contrib = orders_day * u["contrib"] * OPERATING_DAYS
    rcost = route_cost(s) * routes_per_day * OPERATING_DAYS
    fixed = sum(FIXED.values())
    gmv = orders_day * s.aov * OPERATING_DAYS
    return dict(orders_day=orders_day, gmv=gmv,
                collected=orders_day * u["collected"] * OPERATING_DAYS,
                contrib=contrib, route_cost=rcost, fixed=fixed, profit=contrib - rcost - fixed)


def fmt(x):
    return f"{x:,.0f}"


def header(first):
    print(f"| {first} | " + " | ".join(s.name for s in SCENARIOS) + " |")
    print("|---|" + "---:|" * len(SCENARIOS))


def main():
    print("## A. Per-order economics (Rs)\n")
    header("Line")
    rows = [("List basket value (AOV)", lambda s, u: s.aov),
            ("Net sales after discount", lambda s, u: u["net"]),
            ("Refunds / credits", lambda s, u: -u["refunds"]),
            ("Revenue collected", lambda s, u: u["collected"]),
            ("COGS", lambda s, u: -u["cogs"]),
            ("Spoilage / wastage", lambda s, u: -u["spoil"]),
            ("Payment gateway fees", lambda s, u: -u["fee"]),
            ("Packaging", lambda s, u: -s.packaging),
            ("Packing labor", lambda s, u: -s.packing_labor),
            ("Messaging", lambda s, u: -s.messaging),
            ("Support / misc", lambda s, u: -s.support_misc),
            ("**Contribution before route costs**", lambda s, u: u["contrib"])]
    for label, f in rows:
        print(f"| {label} | " + " | ".join(f"{f(s, unit(s)):,.1f}" for s in SCENARIOS) + " |")
    print("| Contribution as % of AOV | "
          + " | ".join(f"{unit(s)['contrib'] / s.aov * 100:.1f}%" for s in SCENARIOS) + " |")

    print("\n## B. Route-shift economics (Rs)\n")
    header("Line")
    print("| Orders per route-shift | " + " | ".join(str(s.orders_per_route) for s in SCENARIOS) + " |")
    print("| Orders per stop | " + " | ".join(f"{s.orders_per_route / s.stops_per_route:.0f}" for s in SCENARIOS) + " |")
    print("| Route cost per shift (van+driver+fuel+helper+parking) | "
          + " | ".join(fmt(route_cost(s)) for s in SCENARIOS) + " |")
    print("| Route cost per order | "
          + " | ".join(f"{route_cost(s) / s.orders_per_route:.0f}" for s in SCENARIOS) + " |")
    print("| Contribution per route-shift before route cost | "
          + " | ".join(fmt(s.orders_per_route * unit(s)['contrib']) for s in SCENARIOS) + " |")
    print("| **Route-shift profit / (loss)** | "
          + " | ".join(fmt(route_day_profit(s)) for s in SCENARIOS) + " |")
    print("| **Break-even orders per route-shift** | "
          + " | ".join(f"{breakeven_orders_per_route(s):.0f}" for s in SCENARIOS) + " |")

    print(f"\n## C. Monthly P&L at 1 and 2 route-shifts/day (Rs, {OPERATING_DAYS} operating days)\n")
    print("| Line | " + " | ".join(f"{s.name} x{r}" for s in SCENARIOS for r in (1, 2)) + " |")
    print("|---|" + "---:|" * 6)
    ms = [monthly(s, r) for s in SCENARIOS for r in (1, 2)]
    for label, k in [("Orders/day", "orders_day"), ("GMV (list)", "gmv"),
                     ("Revenue collected", "collected"),
                     ("Contribution before route", "contrib"), ("Route costs", "route_cost"),
                     ("Fixed costs", "fixed"), ("**Operating profit / (loss)**", "profit")]:
        print(f"| {label} | " + " | ".join(fmt(m[k]) for m in ms) + " |")

    fixed = sum(FIXED.values())
    print(f"\nTotal monthly fixed costs: Rs {fmt(fixed)}\n")
    print("## D. Fixed-cost break-even (single route-shift per day)\n")
    print("| Scenario | Orders/day to cover route + fixed costs |\n|---|---:|")
    for s in SCENARIOS:
        c = unit(s)["contrib"]
        need = (route_cost(s) * OPERATING_DAYS + fixed) / (c * OPERATING_DAYS) if c > 0 else float("inf")
        print(f"| {s.name} | {need:.0f} |")

    print("\n## E. Customer payback (contribution before route cost vs CAC)\n")
    print("| Scenario | CAC | Lifetime orders (6 mo) | Lifetime contribution before route | Net of CAC |")
    print("|---|---:|---:|---:|---:|")
    for s in SCENARIOS:
        lt = unit(s)["contrib"] * s.lifetime_orders
        print(f"| {s.name} | {s.cac:.0f} | {s.lifetime_orders:.0f} | {lt:,.0f} | {lt - s.cac:,.0f} |")

    base = SCENARIOS[1]
    print("\n## F. Sensitivity (Base scenario, route-shift profit/(loss), Rs)\n")
    print("**F1. Orders per route-shift x AOV**\n")
    aovs = [300, 350, 400, 450, 500, 600]
    ords = [25, 35, 50, 65, 80, 100]
    print("| Orders \\ AOV | " + " | ".join(str(a) for a in aovs) + " |")
    print("|---|" + "---:|" * len(aovs))
    for o in ords:
        print(f"| {o} | " + " | ".join(
            fmt(route_day_profit(replace(base, aov=a, orders_per_route=o))) for a in aovs) + " |")

    print("\n**F2. One-at-a-time shocks (50 orders/route-shift)**\n")
    print("| Shock | Route-shift profit/(loss) | Change vs base |\n|---|---:|---:|")
    b = route_day_profit(base)
    shocks = [("Base", base),
              ("Fuel +30%", replace(base, fuel_shift=base.fuel_shift * 1.3)),
              ("Fuel +60%", replace(base, fuel_shift=base.fuel_shift * 1.6)),
              ("Spoilage 12% of COGS (vs 6%)", replace(base, spoilage=.12)),
              ("Spoilage 3% of COGS", replace(base, spoilage=.03)),
              ("Discounts 10% of list (vs 4%)", replace(base, discount=.10)),
              ("Discounts 0%", replace(base, discount=0)),
              ("List margin 24% (vs 28%)", replace(base, list_margin=.24)),
              ("List margin 34% (direct sourcing)", replace(base, list_margin=.34)),
              ("Refunds 5% (vs 2%)", replace(base, refund=.05)),
              ("2 shifts per van-day", replace(base, shifts_per_van_day=2)),
              ("Rs 25 collection fee on 50% of orders (illustrative)", None)]
    for label, s in shocks:
        p = b + base.orders_per_route * 0.5 * 25 if s is None else route_day_profit(s)
        print(f"| {label} | {fmt(p)} | {fmt(p - b)} |")
    print("\nThe fee row ignores any demand loss from charging it.")

    print("\n**F3. Combined lever case: AOV 500, margin 32%, discount 2%, spoilage 4%, 2 shifts/van-day**\n")
    lev = replace(base, aov=500, list_margin=.32, discount=.02, spoilage=.04, shifts_per_van_day=2)
    print("| Orders per route-shift | Profit/(loss) |\n|---|---:|")
    for o in (25, 35, 45, 60, 80):
        print(f"| {o} | {fmt(route_day_profit(replace(lev, orders_per_route=o)))} |")
    print(f"\nBreak-even orders per route-shift in the combined case: {breakeven_orders_per_route(lev):.0f}")


def ramp(s, start_orders, end_orders, ramp_months=9, months=12, shifts_per_day=1):
    """Cumulative operating result over `months`, orders per shift ramping linearly."""
    cum, low, rows = 0.0, 0.0, []
    for m in range(1, months + 1):
        frac = min(1.0, (m - 1) / max(1, ramp_months - 1))
        ops = start_orders + (end_orders - start_orders) * frac
        orders_day = ops * shifts_per_day
        contrib = orders_day * unit(s)["contrib"] * OPERATING_DAYS
        rcost = route_cost(s) * shifts_per_day * OPERATING_DAYS
        profit = contrib - rcost - sum(FIXED.values())
        cum += profit
        low = min(low, cum)
        rows.append((m, ops, orders_day, orders_day * s.aov * OPERATING_DAYS, profit, cum))
    return rows, low


def print_ramp(title, s, start, end, shifts):
    rows, low = ramp(s, start, end, shifts_per_day=shifts)
    print(f"\n**{title}** (orders/shift {start}->{end} over 9 months, {shifts} route-shift(s)/day)\n")
    print("| Month | Orders/shift | Orders/day | GMV (list) Rs | Operating profit Rs | Cumulative Rs |")
    print("|---:|---:|---:|---:|---:|---:|")
    for m, ops, od, gmv, p, c in rows:
        print(f"| {m} | {ops:.0f} | {od:.0f} | {fmt(gmv)} | {fmt(p)} | {fmt(c)} |")
    print(f"\nPeak cumulative operating cash need (before capex & working capital): Rs {fmt(-low)}")


def projections():
    print("\n## G. 12-month ramp projections (illustrative, all inputs [A])")
    base = SCENARIOS[1]
    print_ramp("G1. Base scenario, as-is", base, 15, 50, 1)
    lev = replace(base, aov=500, list_margin=.32, discount=.02, spoilage=.04, shifts_per_van_day=2)
    print_ramp("G2. Combined-lever case", lev, 15, 45, 2)
    print_ramp("G3. Optimistic scenario", SCENARIOS[2], 15, 80, 2)


if __name__ == "__main__":
    main()
    projections()
