# BestOffers

Kuwait-localized, Arabic-first AI shopping concierge. User states intent → AI clarifies (≤3) →
searches local providers → ranked offer cards with deep links. **No payments, inventory, or checkout.**

Stack per **ADR-001** (`team/architecture/system-design.md`): Node/TS **NestJS** API · **Expo/React Native**
mobile · **Next.js** admin · PostgreSQL + Redis (prod). Claude (Anthropic) powers conversational search per **ADR-002**.

> **Sprint 2.5 status — Demoable Build:** one command (`npm run demo`) seeds a realistic Kuwait
> Electronics catalog, boots the API, and serves the Expo **web** app you can click through:
> intent → bounded clarifier chips → ranked offer cards (AR-first/RTL). Mock-Claude by default
> (offline, **no API key**); set `ANTHROPIC_API_KEY` + `CLAUDE_PROVIDER=anthropic` for live mode.
> **No scraping** (legal gate). 22 tests green offline.

## Quick demo (one command)
```bash
npm install            # uses legacy-peer-deps via .npmrc for the Expo matrix
npm run demo           # migrate + seed + API on :3000 + Expo Web (auto-picks a free port, usually :8081)
```
Then open the printed URL (e.g. **http://localhost:8081**) in a browser and search
**"iPhone 17 Pro Max"** → answer or **Skip** the clarifier chips → see ranked offer cards across
X-cite / Best Al-Yousifi / Eureka / Blink. Tap a card to hand off to the provider deep link.
The header **language toggle** flips AR↔EN. `Ctrl-C` stops everything.

Shareable static web build (no UI server; still calls the API on :3000 for data):
```bash
npm run demo:export    # → apps/mobile/dist/  (index.html + JS bundle)
```
Demo proof (API transcript, served HTML, bundle string-check): see `team/demo/`.

## Monorepo layout

```
bestoffers/
├── packages/
│   └── shared/        @bestoffers/shared — TS types & contracts (Offer, ResultCard, events, money-as-fils)
├── apps/
│   ├── api/           @bestoffers/api    — NestJS modular monolith (the tested core)
│   │   ├── src/ai/        Claude client interface + Mock (offline) + Anthropic (prod, dynamic-import)
│   │   ├── src/offers/    MOCK electronics dataset + resolveOffers (Slice 2 stub)
│   │   ├── src/search/    orchestrator: bounded clarifier · deterministic ranker · truthfulness guard
│   │   ├── src/events/    fire-and-forget anonymized logging (no-PII gate)
│   │   └── src/db/        Postgres-compatible migration (0001_init.sql) + SQLite local runner
│   ├── mobile/        @bestoffers/mobile — Expo Router; RTL result-card screen + API client (minimal)
│   └── admin/         @bestoffers/admin  — Next.js stub (Providers/Moderation/KPIs — G1–G3)
└── package.json       npm workspaces
```

## Prerequisites
- Node ≥ 20, npm ≥ 9. (Installs use `legacy-peer-deps` via `.npmrc` for the Expo peer matrix.)

## Install
```bash
npm install
```

## Run the tested slice (offline, no API key)
```bash
npm test            # builds shared types, runs the API suite (clarifier bound, ranker, truthfulness, e2e, no-PII)
```

## Run the API
```bash
npm run migrate                 # creates apps/api/dev.sqlite from the Postgres-compatible schema
npm run seed                    # loads the Kuwait-Electronics catalog (4 providers, 10 SKUs, 25 offers)
npm run dev:api                 # NestJS on :3000 (claude=mock by default)
# demo:
curl -s localhost:3000/health
curl -s -X POST localhost:3000/search/intent -H 'content-type: application/json' \
  -d '{"sector":"electronics","locale":"en","intentRaw":"iPhone 17 Pro Max 256GB black under 500 KWD"}'
```

To use the live Claude client: set `CLAUDE_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (see `.env.example`).
The Anthropic SDK is dynamically imported, so the offline test path never needs it.

## Mobile / admin
```bash
npm test --workspace @bestoffers/mobile        # offline search-client smoke test
npm run web --workspace @bestoffers/mobile     # Expo Web only (needs the API already running on :3000)
npm run export:web --workspace @bestoffers/mobile  # static web build → apps/mobile/dist/
npm run dev --workspace @bestoffers/admin      # Next.js admin on :3001
```
> The full intent→clarifier→results flow is wired in `apps/mobile/app/index.tsx`
> (W6/W7/W9 from the design system); prefer `npm run demo` to launch the whole stack at once.

## Slice / ownership map (4 devs, parallelizable per system-design §"Build slices")

| Slice | Owner | Scope | Status (S2) |
|---|---|---|---|
| **1 — Auth & session** | bo-dev-2 | OTP request/verify, JWT, biometric flag; owns `users`/`auth_otps`/`app_sessions`; privacy wall | schema ready; endpoints TODO |
| **2 — Provider-data layer** | bo-dev-3 | affiliate/scrape adapters, normalizer, SKU-grouping, cache/TTL, `offer_history`; owns `providers`/`skus`/`offers` | **mocked** via `OffersService.resolveOffers`; real adapters TODO (scraping behind legal gate) |
| **3 — Search orchestrator + AI** | bo-dev-lead | intent → bounded clarifier → resolveOffers → rank/why → cards; owns `search_sessions` | **DONE (mock Claude)**; live Claude calls TODO in `AnthropicClaudeClient` |
| **4 — Admin + analytics** | bo-dev-4 | Next.js CRUD (G1/G2), KPI dashboard (G3), event consumer → `events`; owns `events` | stub + `EventsService` emit/no-PII gate done; BullMQ→Postgres consumer + admin CRUD TODO |
| **Mobile (shared)** | bo-dev-2 + bo-dev-lead | Expo screens consuming the contracts; RTL/AR-EN cross-cutting | minimal results screen + client done; full auth/clarifier UI TODO |

**Contracts are the integration boundary** — devs build against the TS types in `@bestoffers/shared`
and the interfaces in `apps/api/src/ai` / `apps/api/src/offers`, independent of each other.

## Conventions
- **One language end-to-end** (TS). Strict mode on. Shared types in `@bestoffers/shared`; never duplicate a contract type.
- **Money = integer fils** (1 KWD = 1000 fils). Use `formatFils`/`kwdToFils`; never floats for money.
- **Privacy wall:** phone/PII lives only in `users`; only `pseudo_id` + bucketed values enter `events`.
- **Truthfulness:** price/provider/rank come from DATA; the LLM only authors the "why" text, and it must
  cite a real attribute (`verifyCitation`) or fall back to a data-only why.
- **Clarifier ≤3 enforced in CODE** (`MAX_CLARIFIER_QUESTIONS`), not just the prompt.
- Tests: `*.spec.ts` colocated; jest + ts-jest; must pass offline.
- **Do not scrape** until legal sign-off (scraping providers stay behind `providers.tos_reviewed = true`).
