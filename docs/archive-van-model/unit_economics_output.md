## A. Per-order economics (Rs)

| Line | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| List basket value (AOV) | 300.0 | 400.0 | 500.0 |
| Net sales after discount | 282.0 | 384.0 | 490.0 |
| Refunds / credits | -8.5 | -7.7 | -4.9 |
| Revenue collected | 273.5 | 376.3 | 485.1 |
| COGS | -234.0 | -288.0 | -340.0 |
| Spoilage / wastage | -18.7 | -17.3 | -13.6 |
| Payment gateway fees | -3.2 | -6.2 | -9.2 |
| Packaging | -10.0 | -9.0 | -8.0 |
| Packing labor | -12.0 | -10.0 | -8.0 |
| Messaging | -1.0 | -0.8 | -0.6 |
| Support / misc | -4.0 | -3.0 | -2.0 |
| **Contribution before route costs** | -9.4 | 42.0 | 103.7 |
| Contribution as % of AOV | -3.1% | 10.5% | 20.7% |

## B. Route-shift economics (Rs)

| Line | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| Orders per route-shift | 25 | 50 | 80 |
| Orders per stop | 5 | 10 | 16 |
| Route cost per shift (van+driver+fuel+helper+parking) | 4,350 | 4,350 | 2,900 |
| Route cost per order | 174 | 87 | 36 |
| Contribution per route-shift before route cost | -235 | 2,101 | 8,299 |
| **Route-shift profit / (loss)** | -4,585 | -2,249 | 5,399 |
| **Break-even orders per route-shift** | inf | 104 | 28 |

## C. Monthly P&L at 1 and 2 route-shifts/day (Rs, 26 operating days)

| Line | Conservative x1 | Conservative x2 | Base x1 | Base x2 | Optimistic x1 | Optimistic x2 |
|---|---:|---:|---:|---:|---:|---:|
| Orders/day | 25 | 50 | 50 | 100 | 80 | 160 |
| GMV (list) | 195,000 | 390,000 | 520,000 | 1,040,000 | 1,040,000 | 2,080,000 |
| Revenue collected | 177,801 | 355,602 | 489,216 | 978,432 | 1,009,008 | 2,018,016 |
| Contribution before route | -6,115 | -12,230 | 54,630 | 109,260 | 215,782 | 431,564 |
| Route costs | 113,100 | 226,200 | 113,100 | 226,200 | 75,400 | 150,800 |
| Fixed costs | 68,000 | 68,000 | 68,000 | 68,000 | 68,000 | 68,000 |
| **Operating profit / (loss)** | -187,215 | -306,430 | -126,470 | -184,940 | 72,382 | 212,764 |

Total monthly fixed costs: Rs 68,000

## D. Fixed-cost break-even (single route-shift per day)

| Scenario | Orders/day to cover route + fixed costs |
|---|---:|
| Conservative | inf |
| Base | 166 |
| Optimistic | 53 |

## E. Customer payback (contribution before route cost vs CAC)

| Scenario | CAC | Lifetime orders (6 mo) | Lifetime contribution before route | Net of CAC |
|---|---:|---:|---:|---:|
| Conservative | 200 | 4 | -38 | -238 |
| Base | 150 | 8 | 336 | 186 |
| Optimistic | 100 | 12 | 1,245 | 1,145 |

## F. Sensitivity (Base scenario, route-shift profit/(loss), Rs)

**F1. Orders per route-shift x AOV**

| Orders \ AOV | 300 | 350 | 400 | 450 | 500 | 600 |
|---|---:|---:|---:|---:|---:|---:|
| 25 | -3,705 | -3,502 | -3,299 | -3,097 | -2,894 | -2,489 |
| 35 | -3,446 | -3,163 | -2,879 | -2,596 | -2,312 | -1,745 |
| 50 | -3,059 | -2,654 | -2,249 | -1,844 | -1,439 | -628 |
| 65 | -2,672 | -2,145 | -1,618 | -1,092 | -565 | 488 |
| 80 | -2,285 | -1,636 | -988 | -340 | 308 | 1,605 |
| 100 | -1,768 | -958 | -148 | 663 | 1,473 | 3,093 |

**F2. One-at-a-time shocks (50 orders/route-shift)**

| Shock | Route-shift profit/(loss) | Change vs base |
|---|---:|---:|
| Base | -2,249 | 0 |
| Fuel +30% | -2,459 | -210 |
| Fuel +60% | -2,669 | -420 |
| Spoilage 12% of COGS (vs 6%) | -3,113 | -864 |
| Spoilage 3% of COGS | -1,817 | 432 |
| Discounts 10% of list (vs 4%) | -3,405 | -1,157 |
| Discounts 0% | -1,478 | 771 |
| List margin 24% (vs 28%) | -3,097 | -848 |
| List margin 34% (direct sourcing) | -977 | 1,272 |
| Refunds 5% (vs 2%) | -2,815 | -566 |
| 2 shifts per van-day | -799 | 1,450 |
| Rs 25 collection fee on 50% of orders (illustrative) | -1,624 | 625 |

The fee row ignores any demand loss from charging it.

**F3. Combined lever case: AOV 500, margin 32%, discount 2%, spoilage 4%, 2 shifts/van-day**

| Orders per route-shift | Profit/(loss) |
|---|---:|
| 25 | -503 |
| 35 | 455 |
| 45 | 1,414 |
| 60 | 2,852 |
| 80 | 4,769 |

Break-even orders per route-shift in the combined case: 30

## G. 12-month ramp projections (illustrative, all inputs [A])

**G1. Base scenario, as-is** (orders/shift 15->50 over 9 months, 1 route-shift(s)/day)

| Month | Orders/shift | Orders/day | GMV (list) Rs | Operating profit Rs | Cumulative Rs |
|---:|---:|---:|---:|---:|---:|
| 1 | 15 | 15 | 156,000 | -164,711 | -164,711 |
| 2 | 19 | 19 | 201,500 | -159,931 | -324,642 |
| 3 | 24 | 24 | 247,000 | -155,151 | -479,792 |
| 4 | 28 | 28 | 292,500 | -150,371 | -630,163 |
| 5 | 32 | 32 | 338,000 | -145,590 | -775,753 |
| 6 | 37 | 37 | 383,500 | -140,810 | -916,564 |
| 7 | 41 | 41 | 429,000 | -136,030 | -1,052,594 |
| 8 | 46 | 46 | 474,500 | -131,250 | -1,183,844 |
| 9 | 50 | 50 | 520,000 | -126,470 | -1,310,314 |
| 10 | 50 | 50 | 520,000 | -126,470 | -1,436,783 |
| 11 | 50 | 50 | 520,000 | -126,470 | -1,563,253 |
| 12 | 50 | 50 | 520,000 | -126,470 | -1,689,723 |

Peak cumulative operating cash need (before capex & working capital): Rs 1,689,723

**G2. Combined-lever case** (orders/shift 15->45 over 9 months, 2 route-shift(s)/day)

| Month | Orders/shift | Orders/day | GMV (list) Rs | Operating profit Rs | Cumulative Rs |
|---:|---:|---:|---:|---:|---:|
| 1 | 15 | 30 | 390,000 | -144,024 | -144,024 |
| 2 | 19 | 38 | 487,500 | -125,330 | -269,353 |
| 3 | 22 | 45 | 585,000 | -106,635 | -375,989 |
| 4 | 26 | 52 | 682,500 | -87,941 | -463,930 |
| 5 | 30 | 60 | 780,000 | -69,247 | -533,177 |
| 6 | 34 | 68 | 877,500 | -50,553 | -583,731 |
| 7 | 38 | 75 | 975,000 | -31,859 | -615,590 |
| 8 | 41 | 82 | 1,072,500 | -13,165 | -628,755 |
| 9 | 45 | 90 | 1,170,000 | 5,529 | -623,226 |
| 10 | 45 | 90 | 1,170,000 | 5,529 | -617,697 |
| 11 | 45 | 90 | 1,170,000 | 5,529 | -612,168 |
| 12 | 45 | 90 | 1,170,000 | 5,529 | -606,639 |

Peak cumulative operating cash need (before capex & working capital): Rs 628,755

**G3. Optimistic scenario** (orders/shift 15->80 over 9 months, 2 route-shift(s)/day)

| Month | Orders/shift | Orders/day | GMV (list) Rs | Operating profit Rs | Cumulative Rs |
|---:|---:|---:|---:|---:|---:|
| 1 | 15 | 30 | 390,000 | -137,882 | -137,882 |
| 2 | 23 | 46 | 601,250 | -94,051 | -231,933 |
| 3 | 31 | 62 | 812,500 | -50,220 | -282,153 |
| 4 | 39 | 79 | 1,023,750 | -6,390 | -288,543 |
| 5 | 48 | 95 | 1,235,000 | 37,441 | -251,102 |
| 6 | 56 | 111 | 1,446,250 | 81,272 | -169,830 |
| 7 | 64 | 128 | 1,657,500 | 125,102 | -44,728 |
| 8 | 72 | 144 | 1,868,750 | 168,933 | 124,206 |
| 9 | 80 | 160 | 2,080,000 | 212,764 | 336,969 |
| 10 | 80 | 160 | 2,080,000 | 212,764 | 549,733 |
| 11 | 80 | 160 | 2,080,000 | 212,764 | 762,497 |
| 12 | 80 | 160 | 2,080,000 | 212,764 | 975,261 |

Peak cumulative operating cash need (before capex & working capital): Rs 288,543
