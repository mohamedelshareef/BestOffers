# System Design — BestOffers Electronics MVP (S1-3)

> Owner: bo-tech-architect · Status: draft for Dev Lead/QA · 2026-06-25
> Source: `Concept.txt`, `team/backlog.md` (locked), `team/analysis/*`, `team/research/*`.
> Companion: `ai-and-data-pipeline.md` (S1-4) covers Claude + logging in depth.
> Principle: simplest design that meets current AC (YAGNI). Trade-offs + cost explicit. Slice-able across 4 devs.

## Locked inputs (do not re-decide)
- Mobile = **React Native / Expo**. LLM = **Claude (Anthropic)**.
- MVP = **Electronics on live data**; Food = later partnership workstream (design stub only).
- Pricing = **"real-time but fast"** (live fetch + short-TTL cache).
- Non-goals: **no payments / cart / checkout / inventory**; no sponsored ranking at MVP.
- **Day-one anonymized logging** required (B2B demand + price-intelligence moat).

---

## ADR-001 — Backend stack

**Context.** Small team (4 devs), Arabic-first RN/Expo client, Claude in the loop, provider data via hybrid affiliate-feed + scraping, day-one analytics/price-history capture, light admin web, ASAP timeline. We need fast delivery, low ops burden, one language across BE/admin to keep the team fungible, and a data store that serves both live serving and append-only price history.

**Decision.**
- **API + AI orchestration:** **Node.js + TypeScript (NestJS)** as a single modular-monolith API. One language shared with the RN client and admin web → devs move between layers; Anthropic TS SDK is first-class. NestJS gives module boundaries (clean slices) without microservice ops overhead.
- **Primary DB:** **PostgreSQL** (managed — Supabase or RDS). Relational core (users, providers, SKUs, offers) + `JSONB` for raw provider payloads + good full-text/`pg_trgm` search for SKU matching. One engine covers OLTP and price-history append.
- **Cache / hot layer:** **Redis** — short-TTL offer cache (the "fast" in "real-time but fast"), clarifier session state, rate-limit buckets, scrape-politeness locks.
- **Scraper workers:** separate **Node worker process** (BullMQ on Redis) running Playwright for resilient scraping; isolated from the request path so a slow/blocked site never stalls the API.
- **Analytics sink:** events land on an async queue → Postgres `events` table (MVP). Heavy B2B aggregation deferred to a warehouse later (see NFRs).
- **Admin web:** **Next.js (React + TS)** — same ecosystem, fast CRUD for provider/source management, moderation, KPI dashboard.
- **Hosting:** managed Postgres + Redis; API + workers on a container PaaS (Railway/Render/Fly) or a small ECS. No Kubernetes at MVP (YAGNI).

**Alternatives considered.**
- *Python/FastAPI BE* — great LLM ecosystem, but splits the team's language (RN/admin are TS) and adds context-switch cost. Claude TS SDK is strong; Python edge not worth the split. **Rejected.**
- *Serverless-everything (Lambda)* — cold starts hurt the latency promise; long-running Playwright scrapes fit poorly. **Rejected** for core; fine for cron triggers.
- *Microservices day-1* — premature for 4 devs; modular monolith first, extract the scraper/AI service only if load demands. **Rejected (YAGNI).**
- *Mongo* — we need relational integrity (SKU↔offer↔provider) and append-only price history with time queries; Postgres `JSONB` covers the document needs anyway. **Rejected.**

**Consequences.**
- (+) One language end-to-end; low ops; clean module-to-slice mapping; scraper isolation protects latency.
- (+) Postgres serves serving **and** price history → fewer moving parts; the B2B data asset accrues with zero extra infra at MVP.
- (−) Node CPU-bound work (none significant here) would need workers — already have them.
- (−) Modular monolith requires discipline on module boundaries (enforced via the interface contracts below).
- **Cost (MVP, rough):** managed PG ~$25–50/mo, Redis ~$10–20/mo, API+workers container ~$20–40/mo, admin host ~$0–20/mo. Claude usage is the variable cost (see S1-4). Total infra well under ~$150/mo at MVP traffic.

---

## High-level system diagram (text)

```
                    ┌──────────────────────────────────────────────┐
                    │            MOBILE  (React Native / Expo)        │
                    │  Auth · Sector picker · Conversational search   │
                    │  Result cards · Deep-link hand-off · AR/RTL     │
                    └───────────────┬──────────────────────────────┘
                                    │ HTTPS / JSON (JWT)
                                    ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                 API  (Node/TS · NestJS modular monolith)        │
        │                                                                 │
        │  auth │ search-orchestrator │ providers │ offers │ logging      │
        └───┬─────────┬──────────────┬───────────────┬───────────┬───────┘
            │         │              │               │           │
            ▼         ▼              ▼               ▼           ▼
      ┌────────┐ ┌─────────┐  ┌────────────┐  ┌──────────┐ ┌──────────────┐
      │  OTP   │ │  Claude  │  │ Provider-  │  │  Redis   │ │  Event queue │
      │ /SMS   │ │ AI svc   │  │ data layer │  │ (cache + │ │  → events DB │
      │ gateway│ │(clarify/ │  │            │  │ sessions)│ │ (anonymized) │
      └────────┘ │ rank)    │  └─────┬──────┘  └──────────┘ └──────────────┘
                 └──────────┘        │
                                     ▼
                 ┌───────────────────────────────────────┐
                 │  Affiliate-feed adapters (Xcite …)      │
                 │  Scraper workers (Playwright + BullMQ)  │  ← politeness, kill-switch
                 │  Normalizer → common SKU/offer schema   │
                 └───────────────────┬───────────────────┘
                                     ▼
                 ┌───────────────────────────────────────┐
                 │   PostgreSQL                            │
                 │   users · sessions · providers · skus   │
                 │   offers (current) · offer_history      │
                 │   events (anonymized)                   │
                 └───────────────────────────────────────┘
                                     ▲
        ┌────────────────────────────┴──────────────┐
        │   ADMIN WEB  (Next.js)                      │
        │   provider/source mgmt · moderation · KPIs  │
        └────────────────────────────────────────────┘
```

**Component responsibilities**
- **Mobile (Expo):** UI only; no business logic for ranking/normalization. Talks to API.
- **API:** auth, request orchestration, calls AI service + provider-data layer, assembles result cards, emits events. Owns "why this offer" assembly from AI output + offer data.
- **AI service (logical module, not a separate deploy at MVP):** wraps Claude — clarifier loop, ranking/explanation. Detailed in S1-4.
- **Provider-data layer:** affiliate adapters + scraper workers + normalizer + cache. The only place that knows provider-specific shapes.
- **DB / cache / event sink:** as in ADR-001.
- **Admin web:** internal CRUD + dashboards; same API or a guarded admin module.

---

## Data model

> Postgres. Pseudonymous everywhere analytics touches. KWD money stored as integer **fils** (1 KWD = 1000 fils) to avoid float drift.

### Identity & session
```
users
  id (uuid, pk)
  phone_e164 (unique)          -- +965… ; PII, lives only here, never in events
  pseudo_id (uuid, unique)     -- stable analytics id; the ONLY id that enters events
  locale_pref (ar|en)
  biometric_opt_in (bool)
  created_at, last_login_at

auth_otps                       -- short-lived, hashed
  id, user_id?, phone_e164, code_hash, expires_at, attempts, consumed_at

app_sessions                    -- auth/session (distinct from a search session)
  id (uuid), user_id (fk), refresh_token_hash, expires_at, created_at, revoked_at
```

### Providers & catalog (Electronics)
```
providers
  id (uuid, pk)
  name, slug
  sector (electronics|food)        -- food rows dormant at MVP
  access_channel (affiliate|scrape) -- hybrid: see pipeline
  base_url, deeplink_template
  enabled (bool)                    -- admin G1 toggle gates user search
  affiliate_meta (jsonb)            -- network, tracking params, commission
  last_sync_at, health_status       -- admin G1 source health
  robots_ok (bool), tos_reviewed (bool)  -- legal gate (see S1-4)

skus                                 -- the canonical product (SKU-grouping target)
  id (uuid, pk)
  category (e.g. smartphone, laptop, tv)
  canonical_name                     -- "Apple iPhone 17 Pro Max 256GB Black"
  brand, model, attributes (jsonb)   -- {storage:256GB, color:black, screen:6.9"}
  gtin / mpn (nullable)              -- strongest grouping key when present
  search_text (tsvector, generated)  -- pg_trgm / FTS over name+brand+model+attrs

offers                               -- a provider's current price for a sku
  id (uuid, pk)
  sku_id (fk)                        -- the grouping link (PriceScout-style)
  provider_id (fk)
  provider_sku_ref                   -- provider's own id/url for deep link
  price_fils (int)                   -- KWD as integer fils
  currency (default KWD)
  in_stock (bool, nullable)
  deeplink_url
  raw_payload (jsonb)                -- as-fetched, for re-normalization/debug
  fetched_at, ttl_expires_at         -- drives "real-time but fast" cache
  source (live|cache)                -- provenance for the freshness label

offer_history                        -- append-only; the B2B price-intelligence asset
  id, sku_id, provider_id, price_fils, in_stock, observed_at
  -- written on every fresh fetch; never updated. Powers price-over-time + deal-confidence.
```

### Search / intent (ephemeral, per search)
```
search_sessions                      -- one conversational search (NOT auth session)
  id (uuid, pk)
  pseudo_id                          -- analytics link (no user PII)
  sector, locale, started_at
  intent_raw (text)                  -- user's words; treated as non-PII content
  intent_normalized (jsonb)          -- {category, brand?, model?, constraints{budget,storage,color}}
  clarifier_state (jsonb)            -- dimensions asked/answered, loop guard set
  status (clarifying|searching|results|handed_off|empty)
  -- TTL'd in Redis live; only the anonymized rollup persists as events.
```

### Logs (anonymized — full schema & rules in S1-4)
```
events
  id (uuid), ts
  pseudo_id, search_session_id
  type (intent_submitted | clarifier_answered | search_executed |
        offer_returned | empty_result | card_tapped | result_refined |
        session_outcome | alert_triggered)
  payload (jsonb)                    -- per BA schema; NO PII, bucketed values only
```

**SKU-grouping (the core comparison primitive).** Matching providers' messy titles to one canonical `sku` is what makes "compare the same product" possible.
- **Tier 1:** exact `gtin`/`mpn` match when a feed supplies it → deterministic.
- **Tier 2:** brand+model+key-attributes match (storage/color) via normalized attributes.
- **Tier 3:** fuzzy `pg_trgm`/FTS over `search_text` with a confidence threshold; below threshold → leave ungrouped (never force a wrong group — a wrong group is a wrong price comparison).
- Claude assists Tier-2/3 normalization (title → structured attributes) at ingest, **not** in the live request path. Human-confirmable via admin.

---

## Provider-data pipeline — Electronics (hybrid, real-time-but-fast)

> Research (S0-2): Electronics is day-1 feasible. **Xcite has affiliate programs (preferred channel)**; Eureka / Best Al-Yousifi / Blink via public-catalog scraping. PriceScout proves multi-retailer scrape + SKU-grouping works in KW.

### Channels (per provider, hybrid)
1. **Affiliate feed adapter (preferred where it carries price/SKU):** Xcite via affiliate network. ToS-blessed + seeds referral revenue. **Risk flagged in S0-2:** confirm the feed carries SKU-level price, not links-only; if links-only, fall back to scrape for price while keeping the affiliate deep link for hand-off + attribution.
2. **Resilient scraper (the rest):** Playwright workers, per-provider adapter modules, run on BullMQ. Politeness (rate-limit, backoff, respect robots where ToS allows), per-source **kill-switch** (admin can disable instantly), health reporting to `providers.health_status`. **Gated on legal/ToS sign-off — see S1-4.**

### Normalization
Raw payload → `normalize(providerAdapter)` → `{provider_sku_ref, title, price_fils, attrs, deeplink, in_stock}` → SKU-grouping (tiers above) → upsert `offers`, append `offer_history`.

### "Real-time but fast" — live fetch + short-TTL cache
The promise is *current price, fast response*, not *re-scrape every keystroke*.

```
search request (sku candidates resolved)
        │
        ▼
  for each enabled provider with a matching sku:
     ┌─ offers row fresh?  (ttl_expires_at > now)
     │       └─ YES → serve from cache  (source=cache)         ← the "fast" path
     │       └─ NO  → live fetch (affiliate adapter / scrape),
     │                normalize, upsert offers + append offer_history,
     │                serve fresh (source=live)
     └─ live fetch bounded by a hard per-provider timeout (e.g. ~1.5s);
        on timeout/error → serve last-known cache with a "as of <time>" label
        (AC D1.4: partial results still render).
```
- **TTL policy:** short (electronics price-volatility is low-to-moderate) — start ~10–15 min, tune per provider from `offer_history` volatility. Hot SKUs (frequently searched) get **background refresh** (a worker pre-warms cache before TTL expiry) so popular queries are always the fast path.
- **Async logging never blocks** (S1-4): `search_executed` records `freshness source (live|cache)` and `latency_ms` for the time-to-result KPI.
- **Determinism (AC D2.2):** ranking is deterministic for the same `(query, data snapshot)` — cache snapshot makes results stable within a TTL window.

### Trade-offs
- (+) Fast median (cache) + fresh on demand (live); price history accrues free.
- (−) Scraper maintenance burden (site redesigns) — budget monitoring + per-provider health + kill-switch (S0-2 risk).
- (−) Stale-but-labeled prices on provider timeout — acceptable per AC; the freshness label keeps trust.

---

## Food pipeline — sequenced design stub (NOT in MVP build)
- Food providers (Talabat/Deliveroo/Jahez) are **closed**: no public consumer price API; scraping is fragile + ToS-prohibited (S0-2). **Not on the Electronics data path.**
- **Designed-for, built-later:** the schema is already sector-aware (`providers.sector`, `skus.category`, dish-shaped `attributes`). Food slots in via a **partnership ingest adapter** (restaurant/POS pushes menu+price+promo directly) reusing the same `normalize → SKU-group → offers/offer_history` spine. Intent vocabulary shifts spec→dish (handled in S1-4 prompt config, sector-scoped). Location context becomes a `search_sessions` field. **No core schema change required** — this is the YAGNI payoff of the canonical model.

---

## Non-functional requirements

**Scalability**
- Stateless API behind a load balancer; horizontal scale by replica. Redis offloads read-hot offers. Scraper workers scale independently of API. Postgres read-replica only when needed (not MVP). `offer_history` is append-only → partition by month later if it grows; not at MVP.

**Security**
- Phone/OTP auth; OTP hashed + TTL'd + attempt-locked (AC A1). Short-lived JWT access + rotating refresh (`app_sessions`, hashed). HTTPS only; secrets in a manager (not the repo — note the stray `GEMINI_API_KEY` in `.env.example` is unused; **the LLM is Claude — remove/replace that key to avoid confusion**). Admin web behind separate auth + role. Rate-limit auth + search endpoints (Redis buckets). Provider raw payloads sanitized before render (no injected markup in cards).

**Privacy**
- **Hard wall: PII (phone) lives only in `users`. Only `pseudo_id` crosses into `events`.** No free-text PII in analytics — intent is stored as bucketed/normalized categories for B2B (S1-4). B2B outputs aggregated + anonymized only (never individual-identifiable). Consent/privacy copy pending legal **[R?]** (S0-5).

**Cost**
- Infra < ~$150/mo at MVP (ADR-001). Dominant variable cost = Claude tokens → controlled via Haiku-for-cheap-tasks + prompt caching + bounded clarifier loop (S1-4). Scraper egress modest. Design keeps a single DB engine to avoid multi-store licensing/ops.

**Performance**
- Time-to-result KPI: cache path is the common case; live path bounded per-provider timeout with parallel fan-out. Target low median, tracked p90 (BA KPI). AI clarifier/rank latency budgeted in S1-4.

**Reliability / graceful degradation (cross-cutting AC)**
- Provider error → partial results + label, never a dead-end (AC D1.4, cross-cutting #4). Logging async → never blocks/slows user flow (cross-cutting #3). Per-source kill-switch for fast incident response.

---

## Build slices for Dev Lead (parallelizable across 4 devs)

Interfaces are the contracts; devs build against them independently.

- **Slice 1 — Auth & session (Dev A).** OTP request/verify, JWT issue/refresh, biometric opt-in flag, sign-out. Owns `users`, `auth_otps`, `app_sessions`. **Contract:** `POST /auth/otp/request`, `POST /auth/otp/verify` → `{access, refresh, pseudo_id, locale_pref}`, `POST /auth/refresh`, `POST /auth/logout`.
- **Slice 2 — Provider-data layer (Dev B).** Affiliate adapter (Xcite) + scraper workers + normalizer + SKU-grouping + cache/TTL + `offer_history`. Owns `providers`, `skus`, `offers`, `offer_history`. **Contract (internal):** `resolveOffers(skuCandidates, providerSet) → Offer[] {price_fils, provider, deeplink, source, fetched_at}`; `normalize(adapter,raw) → NormalizedOffer`. Exposes `getEnabledProviders(sector)`.
- **Slice 3 — Search orchestrator + AI service (Dev C).** Wires intent → Claude clarifier loop → SKU resolution → `resolveOffers` → rank/"why" → result cards. Owns `search_sessions`. **Contract:** `POST /search/intent` → clarifier or results; `POST /search/answer` → next step; response = `{state, questions?[], cards?[]}`. Card = `{sku, provider, price_fils, why, deeplink, image, source}`. (Claude internals = S1-4.)
- **Slice 4 — Admin web + analytics/logging (Dev D).** Next.js CRUD for providers/sources (G1), moderation (G2), KPI dashboard (G3) + the event ingestion pipeline (async queue → `events`) + emit helpers used by all slices. Owns `events`. **Contract:** `logEvent(type, payload)` (fire-and-forget) consumed by Slices 1–3; admin REST for provider CRUD + dashboard queries.
- **Mobile (shared, Dev A+C or a 5th hand):** Expo screens consume the above contracts. AR/RTL + bilingual is cross-cutting on every screen (UX owns flows S1-1/1-2).

**Parallelization note:** Slices 1, 2, 4 have no dependency on each other and start immediately. Slice 3 depends on the **contracts** of 2 (offer interface) and the AI design (S1-4) — both are defined here, so Dev C builds against stubs/mocks of `resolveOffers` while Dev B fills it in.

---

## Risks
- **Legal/ToS sign-off required before any scraping ships** (S0-2 + S1-4) — hard gate; affiliate (Xcite) is the ToS-safe path and can lead.
- **Xcite affiliate feed may be links-only** (no SKU price) — fallback to scrape-for-price designed in; confirm in a spike.
- **Scraper fragility** — site redesigns break adapters; mitigated by per-provider isolation, health status, kill-switch, monitoring budget.
- **SKU-grouping false positives** = wrong price comparison (trust-critical) — confidence threshold + leave-ungrouped + admin review.
- **Stray `GEMINI_API_KEY`** in `.env.example` contradicts the locked Claude decision — clean it up.

## Handoff
- **Done:** ADR-001 (Node/TS NestJS + Postgres + Redis + Playwright workers + Next.js admin); system diagram; full data model with KWD-in-fils, pseudo_id privacy wall, SKU-grouping tiers, append-only `offer_history`; hybrid affiliate+scrape pipeline with live-fetch + short-TTL cache ("real-time but fast"); Food design stub (no core schema change); NFRs; 4-dev build slices with interface contracts.
- **Next:** Dev Lead to sequence slices (1/2/4 parallel, 3 against mocks). QA to treat AC in `mvp-scope-and-stories.md` as oracle; freshness label + partial-results + no-PII-in-events are testable invariants. PO/legal to clear scraping ToS before Slice 2 scraping path ships. Spike: confirm Xcite feed price coverage.
- **Owner:** bo-tech-architect (design), bo-dev-lead (build), bo-qa-backend (verification), PO/legal (ToS).
- **Blockers/risks:** scraping legal gate; Xcite feed completeness; scraper maintenance; SKU-grouping accuracy. See S1-4 for AI + logging risks.
