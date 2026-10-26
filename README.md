# Hari Haat (हरी हाट)

Fresh vegetable and fruit delivery for **Udaipur, Rajasthan**: order on a phone, get it in about 25 minutes (Rs 20), within an hour (Rs 10) or within three hours (free). One local hub, cash or UPI to the rider, English with Hindi product names.

**Where it stands:** the customer shop and the operations panel (dispatch, packing, riders, stock, prices, reports, staff) are built and tested; the message worker runs with a fake channel. Nothing is hosted, no paid service is connected, and no real order has been taken. Read [`FEATURES_AND_PROGRESS.md`](FEATURES_AND_PROGRESS.md) first.

## The documents

| Read this | To learn |
|---|---|
| [`FEATURES_AND_PROGRESS.md`](FEATURES_AND_PROGRESS.md) | Everything we are building and how much is done |
| [`ROADMAP.md`](ROADMAP.md) | The milestones and what comes next |
| [`M4_PLAN.md`](M4_PLAN.md) | Milestone 4 (payments, messages, address search, hosting): costs, approvals, order of work |
| [`DECISIONS.md`](DECISIONS.md) | Every decision made, why, and what is still open |
| [`PRD.md`](PRD.md) | Product requirements with status per requirement |
| [`BUSINESS_PLAN.md`](BUSINESS_PLAN.md), [`UNIT_ECONOMICS.md`](UNIT_ECONOMICS.md), [`tools/`](tools) | The business case and the numbers behind it (honest: the margin is thin) |
| [`OPERATIONS_PLAN.md`](OPERATIONS_PLAN.md), [`MARKETING_PLAN.md`](MARKETING_PLAN.md) | How the day runs; how customers are found |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the software is put together |
| [`PIVOT_PLAN.md`](PIVOT_PLAN.md), [`BRAND_NAMES.md`](BRAND_NAMES.md), [`docs/archive-van-model/`](docs/archive-van-model) | The earlier van-collection idea (archived) and the name |

## The code

All code is in [`app/`](app) (Next.js, TypeScript, PostgreSQL). Setup, commands and demo logins are in [`app/README.md`](app/README.md). In short:

```bash
cd app
npm install
cp .env.example .env     # then fill in the values
npm run db:start && npm run db:migrate && npm run db:seed:demo && npm run db:seed:orders
npm run dev              # the shop, and the admin panel at /admin
npm run worker           # in a second terminal: messages and background jobs
npm test                 # 251 tests against a real database
```

Secrets live only in `app/.env`, which is never committed.
