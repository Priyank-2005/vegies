# Milestone 4 plan: integrations (costs, approvals, order of work)

> Status: v1 approved by the founder 2026-10-25 (all five recommendations); step 1 built ·  Nothing here has been bought, registered or signed up for. Figures are labelled **[V]** verified on the provider's own page, **[S]** from secondary sources (blogs, resellers), **[A]** my assumption, **[?]** not checked. Prices change: every [S] and [?] figure must be re-checked on the provider's page before you commit money.

## 1. What M4 has to do

The app already works end to end with cash or UPI paid to the rider. M4 adds the parts that need outside services:

| Need | Why | Already in the code |
|---|---|---|
| A real place to run (hosting, database, domain, HTTPS) | Customers, riders and webhooks need a public address | Docker-free Next.js app; migrations; health check |
| Real OTP and order messages | Customers must receive the sign-in code and updates | `OtpProvider` interface; every order change already writes an outbox event |
| Production address search | The free OpenStreetMap service is refused in production | `Geocoder` interface; one adapter to add |
| Online payment and refunds (optional for launch) | Prepaid orders, orders above the cash cap, refunds | `payment`, `refund`, `gateway_event` tables; cancel queues a refund; short-weight refunds queue for prepaid |
| A background worker | Send messages, expire unpaid orders, late-order alerts | `expirePendingOrders` exists; outbox table exists |

## 2. Integration by integration

### 2.1 Hosting, database, domain (needed before anything real)
- **What:** an always-on app process (the worker needs it), managed Postgres with point-in-time backups, a domain with HTTPS.
- **Options and costs:**
  - Container on a small VPS plus managed Postgres. A VPS in a German data centre was reported at about €8 a month after Hetzner's April 2026 price rise **[S]**. Managed Postgres with backups: Neon bills by use, about $0.106 per compute-hour and $0.35 per GB-month, and a tiny always-idle database can cost a few dollars a month, while an always-on one costs far more **[S]**. My earlier all-in estimate stands: app ₹1,500-6,000 + database ₹1,500-5,000 per month **[A]**.
  - Vercel Pro is $20 a month plus usage **[S]**, but it is built for short-lived functions, so the worker and scheduled jobs need extra services. Not my first choice.
  - Domain about ₹100 a month **[A]**; the founder must own the account.
- **Not checked [?]:** whether an Indian region is available at these prices, and how much slower a European server feels in Udaipur. This needs a 30-minute price and region check before you choose (open decision D-004).
- **Needs from you:** a decision, a payment card, a domain name. I cannot create accounts or pay.

### 2.2 Customer messages: OTP and order updates
- **WhatsApp Business Platform** (Meta). Per delivered message in India: utility ₹0.115 and authentication ₹0.115 **[S]** (Meta's rate as reported by several sites; one reseller lists ₹0.145 which probably includes its margin); marketing ₹0.8631 **[S]** (we send none). Replies within the service window are free **[S]**. Add 18% GST and any reseller platform fee **[S]**. No SMS registration (DLT) is needed.
- **SMS:** needs TRAI "DLT" registration: a one-time fee of about ₹5,900 + GST on one operator portal (sources say ₹5,000-10,000) **[S]**, business PAN and an address proof such as a GST certificate, incorporation certificate or Shop Act licence **[S]**, then approved sender names and message templates (3-7 working days **[S]**). Per SMS about ₹0.15-0.18 **[S]**; one user reported nearer ₹1 **[S]**.
- **Per order** (confirmed, out for delivery, delivered, plus one for delays or cancellations) ≈ 4 WhatsApp utility messages ≈ ₹0.46 + GST ≈ **₹0.55-0.70 per order**, and ₹0.14 for each sign-in code **[A from S]**. The economics file assumed ₹1; this is lower.
- **Needs from you:** a phone number dedicated to the business WhatsApp account (it cannot also be used in the normal WhatsApp app), a Meta business account, and probably business verification, which may need registration documents **[?]**; a provider choice (direct Meta or a reseller); a prepaid balance.
- **My recommendation:** WhatsApp first (cheaper, no DLT). Add SMS later as a fallback once registration exists.

### 2.3 Production address search (decision D-040)
- **Ola Maps** (Indian): all prices in rupees **[V]**. First 100,000 calls per month per API free. After that: address suggestions ₹0.056, address-to-location and location-to-address ₹0.099 per call **[V]**. At pilot volume (hundreds of lookups a day) this costs ₹0.
- **Google Maps:** priced in dollars, with a monthly free allowance per product (reported as 10,000 for suggestions and 10,000 for geocoding; after that about $2.83 and $5 per 1,000 calls) **[S]**. Also free at pilot volume, but a foreign-currency bill and a stricter licence.
- **Not checked [?]:** how good each one is for Udaipur lanes and societies. **Test before choosing:** I run 30 real Udaipur addresses (you give me a list) through both and compare. The code switch is one setting.
- **Needs from you:** a free account and API key (I will ask before anything is created) and the address list.

### 2.4 Online payment and refunds (optional at launch)
- **Razorpay** (the one I researched): 2% platform fee + 18% GST on most Indian payments including UPI and cards, 3% + GST for premium methods, no set-up or yearly fee **[S, Razorpay's own blog]**. **₹5.90 on a ₹250 order** (2% = ₹5 + ₹0.90 GST). Custom rates only above ₹5 lakh a month **[S]**. Other providers not compared **[?]**.
- **Opening the account (KYC):** PAN, address proof, a bank account in the same name as the PAN; a sole proprietorship needs two business proofs; GST is not a universal requirement; a website with policy pages helps; a food business may need its FSSAI licence **[S, unconfirmed]**. So going live is blocked by the legal registration (D-023). **Test mode needs none of this**, so I can build and test the whole flow first.
- **My honest recommendation:** **do not make online payment a launch requirement.** Cash and UPI paid to the rider already work, cost nothing in fees (UPI on bank accounts has zero government-set merchant fee **[S]**), and a ₹250 online order loses ₹5.90 of a margin that is about ₹3 an order (UNIT_ECONOMICS). Build it, test it, keep it switched off, and turn it on for (a) orders above the cash cap, (b) first orders from new customers if fraud shows up, and (c) customers who prefer it.
- **Needs from you:** a free test-mode account at the provider (I will ask before creating), later the KYC documents and a bank account.

### 2.5 Background worker
No outside cost; it runs next to the app. Sends outbox messages with retries, expires unpaid orders, flags late orders to the dispatch board, reconciles payments. Decides the hosting shape (needs an always-on process).

### 2.6 Email, photos, monitoring (small, can wait)
- Email for staff alerts or receipts: not needed for the pilot; the first provider will be a free tier **[?]**.
- Product photos need storage and an upload screen once you have photos (≈ ₹200-800 a month **[A]**). The illustrations stay until then.
- Error tracking and uptime alerts belong to M5 (hardening).

## 3. What needs your approval, and what does not

| I can do now, free, with no accounts | I will ask you before |
|---|---|
| Message sending framework, templates (English and Hindi), consent rules, retries, a fake provider for tests | Creating any account (Razorpay, Meta/WhatsApp, an SMS reseller, Ola or Google Maps, hosting, domain) |
| Payment flow against the provider's test mode simulated locally: create payment, verify signed webhooks, ignore duplicates, refunds, reconciliation, admin refund screen | Paying anything: hosting, a prepaid message balance, DLT fee, domain |
| Address search adapters written and tested with recorded responses | Uploading your documents (PAN, address proof, bank details), or entering them anywhere |
| The background worker and late-order alerts | Choosing the provider when two are close in price |
| Deployment scripts and a runbook | Anything that sends a real message to a real person |

Rule kept from before: no real customer order until the registrations in D-023 are settled by a professional.

## 4. Order of work

| Step | Work | Effort [A] | Needs you? | Done when |
|---|---|---|---|---|
| 0 | **Founder tasks that take calendar time** (start now): decide the registration path (D-023), pick the hosting shape, give me 30 real addresses, choose a WhatsApp number | your time | Yes | Registration started; decisions logged |
| 1 | Worker and message framework with a fake channel; templates; consent; retries; late-order alerts on the board | 3-4 days | No | **DONE 2026-10-25.** Order events produce messages in a test log, duplicates impossible, tests pass (241) |
| 2 | Address search adapter (Ola first) and the 30-address comparison | 2 days | A free key | **Prepared 2026-10-25:** adapters for Ola and Google behind the existing interface, comparison script, 10 tests. **Address file built from public web sources (35 rows, 18 with a reference pin)**; free-service baseline run: it found 5 of 35 and gave a generic "Udaipur" for most pin lookups. **Waiting for:** free keys. Ola adapter format unverified until a real key is tried |
| 3 | Payment flow in test mode: checkout, signed webhooks, duplicates and late webhooks, refunds, reconciliation, refund screen | 1-1.5 weeks | A test-mode account | Forged, duplicated and out-of-order webhook tests pass; short-weight refund on a prepaid order reaches "sent" |
| 4 | Staging deployment: hosting, database with backups, domain, HTTPS, secrets, deploy and rollback runbook | 2-3 days | Hosting purchase | Staging reachable; a restore drill done once |
| 5 | Real WhatsApp (and later SMS) provider adapters, templates submitted for approval | 3-4 days of work, plus waiting for approvals | Account, number, documents | Test messages arrive on your own phone |
| 6 | Live smoke tests with small amounts: a ₹10 payment and refund, real message, real address search | 1 day | Live keys, your phone | Everything works once with real money, then keys locked down |
| 7 | Keep online payment switched off until you decide (section 2.4) | – | Your call | A setting, not a rebuild |

Calendar reality: steps 5 and 6 are gated by registration, number and approvals, which take days to weeks, not by programming. That is why step 0 comes first.

## 5. Running cost once live (rough, all [A] unless marked)

- **Fixed per month:** hosting and database ₹3,000-11,000; domain ₹100; messaging has no fixed fee unless a reseller charges one. Roughly **₹3,000-11,000**, below the ₹5,000-17,000 in ARCHITECTURE.md because that included monitoring and storage that can wait.
- **Per order:** messages ₹0.55-0.70; address search ₹0; payment 2.36% of the basket **only on online orders**.
- At ₹250 baskets: ₹0.7 per cash/UPI order, ₹6.6 per online order. Per day at 100 orders with 20% online: 80 × ₹0.7 + 20 × ₹6.6 ≈ **₹190**, around ₹5,700 a month, **on top of** the fixed costs. This is a significant share of a margin the model already shows as very thin.

## 6. Decisions I need from you

1. **Payment:** build online payment in test mode but keep it off at launch? (recommended: yes)
2. **Messages:** WhatsApp first, SMS later? (recommended: yes)
3. **Address search:** test Ola Maps against Google with your 30 addresses? (recommended: yes)
4. **Hosting:** may I do the 30-minute price and region check and bring you two options, with the monthly cost for each? (recommended: yes)
5. **Registration:** have you started with a CA or the FSSAI basic registration? Steps 5-6 cannot finish without it.
