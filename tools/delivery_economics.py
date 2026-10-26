"""Unit-economics model for the hub-delivery business (Instant Rs20 / 1-hour Rs10 / 3-hour free).

Every number below is a PLACEHOLDER ASSUMPTION [A], not a market fact. Edit and re-run:
    python tools/delivery_economics.py > tools/delivery_economics_output.md
Rupees; floats are fine here (planning model only, NOT the production money path).
"""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Option:
    name: str
    fee: float          # delivery fee charged to the customer, Rs
    rider_cost: float   # rider cost per delivered order, Rs (depends on trip batching)
    mix: float          # share of orders choosing this option


@dataclass(frozen=True)
class Model:
    aov: float = 300.0          # basket value at list price, Rs
    list_margin: float = 0.28   # gross margin at list price
    discount: float = 0.03      # share of list value given away
    refund: float = 0.02        # refunds as share of net sales
    wastage: float = 0.08       # of COGS: stock is bought ahead of orders (no pre-order any more)
    packing: float = 10.0       # picker/packer cost per order
    packaging: float = 9.0      # bag, ties, label
    messaging: float = 1.0
    support: float = 3.0
    online_share: float = 0.5
    gateway_fee: float = 0.0236  # unverified
    fixed_monthly: float = 95_000.0  # hub rent 25k + 2 packers 30k + manager 25k + tools 8k + misc 7k [A]
    days: int = 30
    options: tuple = (
        Option("Instant", 20.0, 45.0, 0.20),
        Option("1 hour", 10.0, 32.0, 0.35),
        Option("3 hours", 0.0, 22.0, 0.45),
    )


def per_order(m: Model, o: Option) -> dict:
    net = m.aov * (1 - m.discount)
    refunds = net * m.refund
    cogs = m.aov * (1 - m.list_margin)
    waste = cogs * m.wastage
    revenue = net - refunds + o.fee
    fee = revenue * m.online_share * m.gateway_fee
    var = cogs + waste + fee + m.packing + m.packaging + m.messaging + m.support + o.rider_cost
    return dict(revenue=revenue, cogs=cogs, waste=waste, fee=fee, rider=o.rider_cost, var=var, contrib=revenue - var)


def blended(m: Model) -> float:
    return sum(o.mix * per_order(m, o)["contrib"] for o in m.options)


def breakeven_orders_per_day(m: Model) -> float:
    c = blended(m)
    return float("inf") if c <= 0 else m.fixed_monthly / m.days / c


def row(label, values):
    print(f"| {label} | " + " | ".join(values) + " |")


def main():
    base = Model()
    print("## A. Per-order economics at the base assumptions (AOV Rs 300, 28% margin)\n")
    print("| Line | Instant (Rs 20) | 1 hour (Rs 10) | 3 hours (free) |")
    print("|---|---:|---:|---:|")
    rows = [("Revenue collected incl. delivery fee", "revenue"), ("COGS", "cogs"), ("Wastage", "waste"), ("Gateway fee", "fee"), ("Rider cost", "rider"), ("**Contribution per order**", "contrib")]
    for label, k in rows:
        sign = "" if k in ("revenue", "contrib") else "-"
        row(label, [f"{sign}{per_order(base, o)[k]:,.1f}" for o in base.options])
    print(f"\nPacking {base.packing:.0f} + packaging {base.packaging:.0f} + messaging {base.messaging:.0f} + support {base.support:.0f} are also deducted (Rs {base.packing + base.packaging + base.messaging + base.support:.0f} per order).")
    print(f"Option mix assumed: {', '.join(f'{o.name} {o.mix:.0%}' for o in base.options)}. Blended contribution: Rs {blended(base):,.1f} per order.\n")

    print("## B. Blended contribution per order and break-even by basket size and margin\n")
    margins = [0.22, 0.28, 0.35, 0.40]
    aovs = [150, 200, 300, 400, 600, 800]
    print("**Blended contribution per order (Rs)**\n")
    print("| AOV \\ list margin | " + " | ".join(f"{m:.0%}" for m in margins) + " |")
    print("|---|" + "---:|" * len(margins))
    for a in aovs:
        row(f"Rs {a}", [f"{blended(replace(base, aov=a, list_margin=m)):,.0f}" for m in margins])
    print("\n**Orders per day to cover fixed costs (Rs " + f"{base.fixed_monthly:,.0f} / month)**\n")
    print("| AOV \\ list margin | " + " | ".join(f"{m:.0%}" for m in margins) + " |")
    print("|---|" + "---:|" * len(margins))
    for a in aovs:
        vals = []
        for m in margins:
            be = breakeven_orders_per_day(replace(base, aov=a, list_margin=m))
            vals.append("never" if be == float("inf") else f"{be:,.0f}")
        row(f"Rs {a}", vals)

    print("\n## C. Which option makes or loses money (AOV Rs 300, margin 28%)\n")
    print("| Option | Fee | Rider cost | Contribution per order |")
    print("|---|---:|---:|---:|")
    for o in base.options:
        print(f"| {o.name} | Rs {o.fee:.0f} | Rs {o.rider_cost:.0f} | Rs {per_order(base, o)['contrib']:,.1f} |")

    print("\n## D. Levers (blended contribution per order, AOV Rs 300, margin 28%)\n")
    print("| Change | Contribution per order (Rs) | Break-even orders/day |")
    print("|---|---:|---:|")
    levers = [
        ("Base", base),
        ("Minimum order Rs 199 (AOV rises to Rs 380)", replace(base, aov=380)),
        ("Wastage 4% instead of 8% (tight stock control)", replace(base, wastage=0.04)),
        ("Buying margin 35% (direct sourcing)", replace(base, list_margin=0.35)),
        ("Riders batch more (cost 36 / 26 / 16)", replace(base, options=(Option("Instant", 20, 36, .2), Option("1 hour", 10, 26, .35), Option("3 hours", 0, 16, .45)))),
        ("Everyone picks 3 hours (45% -> 100%)", replace(base, options=(Option("Instant", 20, 45, 0), Option("1 hour", 10, 32, 0), Option("3 hours", 0, 22, 1.0)))),
        ("Instant fee Rs 20 -> Rs 40, 1 hour Rs 10 -> Rs 20", replace(base, options=(Option("Instant", 40, 45, .2), Option("1 hour", 20, 32, .35), Option("3 hours", 0, 22, .45)))),
        ("Combined: AOV 380, margin 35%, wastage 4%, batching", replace(base, aov=380, list_margin=0.35, wastage=0.04, options=(Option("Instant", 20, 36, .2), Option("1 hour", 10, 26, .35), Option("3 hours", 0, 16, .45)))),
    ]
    for label, m in levers:
        be = breakeven_orders_per_day(m)
        print(f"| {label} | {blended(m):,.0f} | {'never' if be == float('inf') else f'{be:,.0f}'} |")


if __name__ == "__main__":
    main()
