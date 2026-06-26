# BestOffers — Product Backlog

> Maintained by the Product Owner. Source of truth for what we build and in what order.
> Format: Epics → User Stories → Tasks. Each story has acceptance criteria (AC).

## Product one-liner
**Best Offers** — Kuwait-localized, Arabic-first AI shopping concierge. User states intent → AI clarifies →
searches local providers → ranked offer cards with deep links. No payments, inventory, or checkout. (See `Concept.txt`.)

## Locked decisions (PO, 2026-06-25)
- **MVP sectors:** **Electronics launches on live data; Food does NOT gate launch.** Food runs as a parallel partnership-led data workstream (direct provider onboarding → controlled beta), which also feeds the B2B data thesis. _(PO decision 2026-06-25, on owner's behalf, per Sprint 0 research: Food platforms are closed/ToS-risky day-1.)_
- **Data approach (UPDATED 2026-06-26):** **NO affiliations/partnerships exist.** The **AI does the heavy lifting — reads provider WEBSITES live at query time**, extracts offers, and ranks them. Source = public provider sites read by the AI (not feeds/DB). Recon (`team/research/website-recon-ai-readability.md`): X-cite + Blink readable now via plain fetch/JSON; Eureka, Best Al-Yousifi, Talabat need headless rendering; Jahez + Carriage hard-block bots (403 / Cloudflare). Caching + pre-warm required for "real-time but fast." ToS/legal flagged, owner directing.
- **LLM:** **Claude** (Anthropic) powers conversational search.
- **Mobile stack:** **React Native / Expo** (backend = architect's call).
- **Arabic:** Kuwaiti/Gulf colloquial input + MSA; research to confirm phrasing and scan cross-region approaches to localize the idea.
- **Price freshness:** **Real-time but fast** — architect designs the best live+cache strategy.
- **Monetization:** Build **discovery first**; keep **B2B demand/price-intelligence** capture in backlog — researchers + BA shape the winning feature set.
- **Timeline:** ASAP, **Agile sprints**, strict **Develop → Test → Deploy** per increment.

## Status legend
`📋 Backlog` · `🎯 Sprint` · `🔨 In Progress` · `🔍 In Review` · `✅ Done` · `🚫 Blocked`

---

## Sprint 0 — Discovery & Definition ✅ DONE
_Deliverables in `team/research/` and `team/analysis/`._

| ID | Story | Owner | Status |
|----|-------|-------|--------|
| S0-1 | Kuwait market + competitor scan | bo-researcher | ✅ |
| S0-2 | Provider data-feasibility matrix | bo-researcher | ✅ |
| S0-3 | Arabic/dialect + cross-region localization scan | bo-researcher | ✅ |
| S0-4 | MVP scope, personas, user stories + AC, KPIs | bo-business-analyst | ✅ |
| S0-5 | Winning-feature & monetization (B2B data) proposal | bo-business-analyst | ✅ |

## Sprint 1 — Design & Architecture Foundations ✅ DONE
_Deliverables in `team/design/` and `team/architecture/`._

| ID | Story | Owner | Status |
|----|-------|-------|--------|
| S1-1 | UX: IA + RTL user flows | bo-ux-lead | ✅ |
| S1-2 | UX: wireframes + design system | bo-ux-lead | ✅ |
| S1-3 | Architecture: system design + data/provider pipeline (ADR-001) | bo-tech-architect | ✅ |
| S1-4 | Architecture: Claude integration + logging pipeline (ADR-002) | bo-tech-architect | ✅ |

## Sprint 2 — Foundation + Walking Skeleton (Build)
_Goal: scaffold the project per ADRs and ship one end-to-end vertical slice — conversational
Electronics search on MOCK provider data — with tests. Respects the scraping legal gate (no scraping)._

| ID | Story | Owner | Status |
|----|-------|-------|--------|
| S2-1 | Monorepo scaffold (packages/shared, apps/api NestJS, apps/mobile Expo, apps/admin Next.js) | bo-dev-lead | ✅ |
| S2-2 | Data model migrations (8 tables, Postgres-compatible, money as fils) | bo-dev-lead | ✅ |
| S2-3 | Walking skeleton: intent → bounded clarifier → mock search → ranked RTL cards + mockable Claude | bo-dev-lead | ✅ |
| S2-4 | Tests — **22 green offline** (clarifier bound, ranker determinism, truthfulness invariant, no-PII gate) | bo-dev-lead | ✅ |

_Verified: `npm test` → 20 API + 2 mobile passing; API boots, live HTTP returns ranked cards; migrations create all tables._

## Sprint 2.5 — Demoable Build (make it runnable & seeable)
_Goal: a one-command-runnable app you can click through (intent→clarifier→ranked cards), seeded with
realistic Kuwait Electronics data, mock-Claude by default (no key needed). No scraping, no store publish._

| ID | Story | Owner | Status |
|----|-------|-------|--------|
| S2.5-1 | Seed realistic Kuwait Electronics dataset (SKUs, prices KWD, providers) | bo-dev-lead | ✅ |
| S2.5-2 | Wire Expo app end-to-end to API; run in web/dev mode; RTL/AR-EN core screens | bo-dev-lead | ✅ |
| S2.5-3 | One-command launch (`npm run demo`) + README; capture screenshots as proof | bo-dev-lead | ✅ |
| S2.5-4 | Optional: static/web demo build for a shareable link (if doable offline) | bo-dev-lead | ✅ |

_Verified (real run): `npm run demo` cold-starts in ~6s → migrate + seed (4 providers, 10 SKUs, 25
offers) + API :3000 (claude=mock) + Expo Web :8081. Full intent→clarifier(≤3)→ranked-cards flow works
over HTTP and the web bundle serves our AR/EN screen. `npm run demo:export` → `apps/mobile/dist/`
(offline static build). Proof in `team/demo/` (API transcript, served HTML, bundle string-check).
Pixel screenshot not capturable headlessly here (RN-web+Hermes blank under headless Chrome) — PO opens
the printed URL locally to view. 22 tests green._

## Sprint 2.6 — Live data, Slice A (real offers, no mock) — AI reads the sites
_Per ADR-003. Replace mock offers with LIVE reads of the two day-1-readable providers._

| ID | Story | Owner | Status |
|----|-------|-------|--------|
| S2.6-1 | `ProviderAdapter` interface + X-cite Tier-1 adapter (live HTML `/p`, parse price/SKU/stock/image) | bo-dev-lead | 🎯 |
| S2.6-2 | Blink Tier-1 adapter (Shopify `/products/{handle}.json`) | bo-dev-lead | 🎯 |
| S2.6-3 | Wire adapters into `resolveOffers` (replace mock for X-cite+Blink), Redis/TTL cache, timeout, allSettled partial results | bo-dev-lead | 🎯 |
| S2.6-4 | Test against LIVE sites; verify real KWD prices flow into ranked cards; demo shows real data | bo-dev-lead | 🎯 |

_Later: Slice B = Playwright render tier (Eureka, Best Al-Yousifi, Talabat) + Haiku extraction fallback + pre-warm. Slice C = blocked sites (Jahez/Carriage). T2/T3 behind `tos_reviewed` + counsel sign-off._

## Sprint 3 — Parallel build (PENDING owner ratification + legal gate)
| ID | Story | Owner | Status |
|----|-------|-------|--------|
| S3-1 | Auth: OTP/JWT/biometric + auth & clarifier-chat UI (W7), i18n/RTL | bo-dev-2 | 📋 |
| S3-2 | Provider-data layer: affiliate adapter + SKU-grouping + cache/TTL + offer_history (scraping behind legal gate) | bo-dev-3 | 🚫 gate |
| S3-3 | Admin web CRUD + KPI dashboard from anonymized events | bo-dev-4 | 📋 |
| S3-4 | Live Claude wiring (Opus structured outputs, prompt cache, fallback) + Redis sessions | bo-dev-lead | 📋 |
| S3-5 | QA verification pass (FE + BE) against AC | bo-qa-lead-frontend, bo-qa-backend | 📋 |

## Gates pending owner (legal/decision)
- 🚦 Scraping ToS/legal counsel sign-off (blocks live multi-provider scraping; Xcite affiliate is unblocked).
- ❓ Confirm Xcite affiliate feed carries SKU price vs links-only (architect spike).
- ❓ Privacy/consent copy for anonymized logging (legal).
- ❓ Native-Arabic QA pass on dialect glossary.

---

## Product Feature Backlog (owner-requested 2026-06-26)
_Prioritized for a future sprint by the PO. AC to be detailed by bo-business-analyst; stack impact by bo-tech-architect._

### EPIC-A: Accounts & User Profile
| ID | Story | Notes | Priority |
|----|-------|-------|----------|
| F-A1 | User can edit profile: **name, email, avatar** | Avatar upload → image storage (Supabase Storage); email change may need re-verify | Must |
| F-A2 | User can **enable/disable biometric login** | Toggle in profile; ties to device biometric (Face/Touch ID) after first OTP sign-in | Must |
| F-A3 | User can **enable/disable notifications** | Push (price-drop alerts, etc.); per-channel prefs | Should |

### EPIC-B: Backend Platform — Supabase
| ID | Story | Notes | Priority |
|----|-------|-------|----------|
| F-B1 | **Connect app to Supabase** (Auth, Postgres DB, Storage) | DECISION for architect: Supabase as the managed backend (auth + DB + avatar storage + realtime) vs current self-hosted NestJS+Postgres — may revise ADR-001. RLS for user data | Must |

### EPIC-C: Authentication — WhatsApp OTP
| ID | Story | Notes | Priority |
|----|-------|-------|----------|
| F-C1 | **OTP via WhatsApp** for login/verify | Via WhatsApp Business API (Meta) or provider (Twilio/360dialog); fallback to SMS. Replaces/augments mobile+OTP flow | Must |

### EPIC-D: Monetization — Subscription & Freemium Gate
| ID | Story | Notes | Priority |
|----|-------|-------|----------|
| F-D1 | **Stripe subscription — $1/month** | Stripe Billing; manage subscribe/cancel/renew; receipts; handle KWD vs USD display | Must |
| F-D2 | **Freemium gate: 5 free searches, then must subscribe** | Per-user search metering/counter; block search #6 → paywall → Stripe checkout; reset/quota rules TBD | Must |

> Architect decisions flagged: (1) Supabase vs current stack; (2) WhatsApp OTP provider; (3) Stripe + Kuwait payment/currency handling; (4) where search-count metering lives (ties to the anonymized events pipeline). BA to write full AC per story.

### ✅ Sprint 4 — Feature build STATUS (built 2026-06-26, mock-mode, runs offline)
| Feature | Status | Notes |
|---------|--------|-------|
| F-A1 Profile (name/email/avatar) | ✅ Built | Avatar via local-disk Storage mock; Supabase Storage config-ready |
| F-A2 Biometric toggle | ✅ Built | Backend flag + UI; real enclave prompt = device-only |
| F-A3 Notifications toggle | ✅ Built | UI + prefs; real push = device-only |
| F-B1 Supabase | ⚙️ Config-ready | Split-plane per ADR-004; runs on local DB in mock; needs project keys + RLS integration test |
| F-C1 WhatsApp OTP | ✅ Built (mock) | `MockOtpSender` (code 000000); Meta/Twilio config-ready |
| F-D1 Stripe $1/mo | ✅ Built (mock) | `MockBillingProvider`; Stripe impl config-ready; **IAP decision pending for store** |
| F-D2 Freemium gate (5 free) | ✅ Built | Server-side atomic counter, race-safe; 402 paywall; never-resets |

**Verified:** API 63/63 + mobile 18/18 tests green offline. Live funnel: mock-OTP sign-in → 5 free searches → 402 paywall at #6 → mock-subscribe → resume lands on results → unlimited. AC/design/QA docs in `team/analysis/`, `team/design/`, `team/qa/`.

**PO decision (on owner's behalf):** Stripe via swappable `BillingProvider` for MVP; swap to native IAP (StoreKit/Play/RevenueCat) for store release — interface makes it config-level, not a rebuild.

### 🔑 Owner must provide to go live (none block dev — all run mocked)
- **Supabase** project (URL + anon + service-role keys) — Pro ~$25/mo at launch
- **WhatsApp Business** (Meta Cloud API + approved auth template) or Twilio — start early (approval takes days); ~$0.01–0.04/OTP
- **Stripe** account + $1/mo USD recurring price + webhook secret (~2.9%+30¢/txn)
- Decisions: WhatsApp provider · freemium reset rule (lifetime-5 chosen) · KWD-display FX source · **App-store IAP vs Stripe**

### 🐞 Deferred defects (MED/LOW — for daylight)
- BE: D1-2 incomplete/incomplete_expired states + `invoice.payment_succeeded`; SMS-fallback test; avatar MIME/size test; **Supabase RLS integration test (mandatory CI gate before any live deploy)**
- FE: image cropper/action-sheet/validation; Subscription receipts list + cancel-confirm sheet + canceled-date; email pending→verified lifecycle (needs mailer); distinct OTP error states; RN render/RTL test coverage
- Visual mockup pass OWED (design skills weren't reachable); flaky e2e test FIXED (test-DB isolation)

### 📱 Simulator / render status (2026-06-26 night)
- ✅ **App RENDERS** — proven on booted iPhone 17 Pro sim (Safari/web) + headless. Screenshots in `team/qa/sim/` (home, login, settings, paywall, profile, subscription, clarifier, 6 ranked result cards with real KWD prices).
- ✅ Fixed SIM-HIGH-1 (blank render = duplicate React → `apps/mobile/metro.config.js` dedupe, load-bearing) + a 2nd web bug (bare-`fetch` illegal invocation → boundFetch).
- ⏳ **SIM-HIGH-2 (owner decision):** native on-device iOS build blocked — RN 0.74/Expo SDK 51 vs Xcode 26.2. Needs SDK 51→57 upgrade (multi-day, high-regression). DEFERRED to keep app stable; upgrade path documented in `team/memory/bo-tech-architect.md`/dev-lead memory. App runs on web/sim-Safari today.
- Tests: API 63/63, mobile 18/18, tsc clean.

### 🔑 Live-integration blockers (waiting on owner — credentials NOT yet provided)
- Supabase: `.env` has NO Supabase keys (anon key was not actually saved); no Supabase MCP connected. Need URL + anon + service-role.
- WhatsApp: "Prediction App" project not found on this machine — can't reuse its config/token. Need creds or path.
- Stripe: deferred; owner to be guided. Paste-ready commented slots added to `.env`.

---

## Epics (placeholder — to be defined)

### EPIC-1: Discovery & Market Validation
- As the team, we need to understand the market, users, and competitors so we build the right product.
- AC: validated personas, market sizing, competitor matrix, opportunity statement.

### EPIC-2: Product Definition
- Requirements, scope, MVP feature set, success metrics.

### EPIC-3: Design
- Information architecture, user flows, wireframes, UI system.

### EPIC-4: Architecture & Foundations
- Tech stack, system design, data model, non-functional requirements.

### EPIC-5: Build MVP
- Core features delivered as vertical, demoable increments.

### EPIC-6: Quality
- Test strategy, FE + BE test coverage, release readiness.

### EPIC-7: Go-to-Market
- Brand, content, launch campaign, social presence.

---

## Decisions log
_(PO records key product decisions here with date.)_

## Risks / open questions
_(Surfaced by agents during work; triaged by PO.)_
