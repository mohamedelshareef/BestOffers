# ADR-003 — Live AI-Fetch Pipeline (read provider sites at query time)

> Owner: bo-tech-architect · Status: accepted (owner-directed model change) · 2026-06-26
> Supersedes the **affiliate-feed assumption in ADR-001/S1-3** (Pipeline section). The data spine — `ProviderAdapter` → `normalize` → SKU-group → `offers`/`offer_history`, `resolveOffers(...) → Offer[]`, TTL cache, kill-switch, `providers.tos_reviewed` — is **unchanged and reused**. Only the *source* of offers changes: there are **NO affiliate feeds/partnerships**; the AI reads public provider websites live and extracts + ranks offers.
> Inputs: `team/research/website-recon-ai-readability.md` (recon verdicts), `system-design.md` (schema + `resolveOffers` contract), ADR-002 (Claude shape). Principle: simplest design meeting AC (YAGNI); cost + latency explicit.

---

## Context

Recon verdicts (electronics-first MVP):
- **GREEN (plain HTTP, ship first):** X-cite product pages `…/p` (full server HTML: price/SKU/stock/img); Blink `…/products/{handle}.json` (Shopify structured JSON).
- **AMBER (need headless render / XHR sniff):** Eureka (AngularJS SPA), Best Al-Yousifi (JS shell), Talabat (renders, prices via API).
- **RED (bot-walled):** Jahez (403), Carriage (Cloudflare 526) — need full browser + residential egress; **later/optional**.

The product goal is "real-time but fast." Per-query live render of multiple sites is multi-second and bot-exposed. The architecture must **exploit cheap structured paths first**, **isolate the expensive render tier**, and **degrade gracefully** so a query always returns something.

**Truthfulness is trust-critical (AC D3.3):** every price/spec on a card must come from the fetched page. Claude orders and explains; it must never invent a price, spec, or stock state.

---

## Decision

A **three-tier fetch pipeline behind one `ProviderAdapter` interface**, with a **server-side fetch-then-feed** AI extraction model, a **discovery/price split**, and a **short-TTL cache + pre-warm** layer. The GREEN adapters (X-cite, Blink) ship end-to-end first and replace the mock for those two providers. Tiers 2 and 3 plug in behind the same interface with zero changes to the search orchestrator.

```
                resolveOffers(skuCandidates, providerSet)   ← unchanged contract (S1-3)
                              │
                     ┌────────┴─────────┐  per-provider, in PARALLEL, per-site timeout
                     ▼                  ▼
              ┌─────────────┐    ┌─────────────┐
              │ CACHE hit?  │──► │ serve warm   │  (TTL fresh → no fetch; labeled source:"cache")
              └──────┬──────┘    └─────────────┘
                 miss│
                     ▼
         ┌──────────────────────────────────────────┐
         │            ProviderAdapter.fetch()         │
         │  ┌──────────┬───────────────┬───────────┐  │
         │  │ TIER 1   │ TIER 2        │ TIER 3    │  │
         │  │ HTTP     │ Headless      │ Browser + │  │
         │  │ (X-cite  │ render        │ residential│ │
         │  │  /p,     │ (Playwright   │ egress    │  │
         │  │  Blink   │  pool)        │ (Jahez,   │  │
         │  │  .json)  │ Eureka/Best/  │  Carriage)│  │
         │  │          │ Talabat       │ LATER     │  │
         │  └────┬─────┴──────┬────────┴─────┬─────┘  │
         └───────┼────────────┼──────────────┼────────┘
                 ▼            ▼              ▼
            raw page / json  rendered DOM   rendered DOM
                 └────────────┴──────────────┘
                              ▼
                  ProviderAdapter.extract()  ──► NormalizedOffer[]
                  (deterministic-first; Claude only for hard pages)
                              ▼
              SKU-group ─► upsert offers + append offer_history ─► CACHE (TTL)
                              ▼
                          Offer[]  ──►  [Opus rank+why]  (ADR-002, unchanged)
```

---

## 1. Fetch tiers + the `ProviderAdapter` interface

Each provider is a **pluggable adapter**. The orchestrator never knows the tier — it calls `fetchOffers`. Adapter declares its tier so the runtime routes it to the right fetcher (HTTP client vs Playwright pool vs egress-proxied browser).

```ts
type FetchTier = "http" | "render" | "render_residential";

interface ProviderAdapter {
  providerId: string;            // FK → providers.id
  sector: "electronics" | "food";
  tier: FetchTier;               // routing hint for the fetch runtime
  enabled: boolean;              // mirrors providers.enabled + kill-switch

  // DISCOVERY: cheap. Map an intent/SKU candidate → concrete product URLs.
  discover(query: DiscoveryQuery): Promise<ProductRef[]>;   // sitemap / search / .json / known-URL

  // FETCH: tier-appropriate retrieval of ONE product page/payload.
  fetch(ref: ProductRef, ctx: FetchCtx): Promise<RawPage>;  // RawPage = {html|json, url, fetched_at}

  // EXTRACT: RawPage → structured offer(s). Deterministic-first (see §2).
  extract(raw: RawPage): Promise<NormalizedOffer[]>;

  health(): AdapterHealth;       // last_ok_at, consecutive_failures, extract_confidence
}

type ProductRef       = { url: string; handle?: string; provider_sku_ref?: string };
type NormalizedOffer  = { provider_sku_ref: string; title: string; price_fils: number;
                          attrs: Record<string,string>; deeplink: string; in_stock: boolean;
                          image_url?: string; source: "http"|"render"|"residential";
                          fetched_at: string };
```

`resolveOffers(skuCandidates, providerSet) → Offer[]{price_fils, provider, deeplink, source, fetched_at}` (S1-3 contract) is the **only** thing the search orchestrator calls. Internally it = cache-check → `discover` → `fetch` → `extract` → SKU-group, fanned out per provider.

**Tier responsibilities / trade-offs**

| Tier | Sites (MVP) | Mechanism | Latency (cold) | Cost/risk |
|---|---|---|---|---|
| 1 `http` | **X-cite `/p`, Blink `.json`** | Node fetch (undici), no browser | ~0.2–0.8 s | Cheapest; lowest bot-risk; public pages |
| 2 `render` | Eureka, Best, Talabat | Playwright Chromium pool (BullMQ workers, isolated from request path) | ~2–6 s | Heavy CPU/RAM; bot-exposed; XHR-sniff shortcut where possible |
| 3 `render_residential` | **Jahez, Carriage — LATER/OPTIONAL** | Tier-2 browser + residential egress proxy | ~4–10 s, fragile | Slow, costly, hardest ToS posture; behind a flag, not in MVP |

YAGNI: **Tier 1 ships first and alone proves the live model.** Tier 2 is a second slice. Tier 3 is explicitly deferred and may never be built if value/risk doesn't justify it.

---

## 2. AI extraction — how Claude turns a page into structured offers

**Decision: HYBRID, deterministic-first.**
- **Tier 1 GREEN sites → deterministic parser in the adapter, NO Claude.** X-cite `/p` price/SKU/stock sit at stable, server-rendered selectors; Blink ships clean JSON. We parse these with code (cheerio / `JSON.parse`). Zero token cost, deterministic, fastest, fully truthful by construction.
- **Tier 2/hard pages → Claude extraction as a fallback**, only when a deterministic selector parse fails or confidence is low (e.g., a site shape we haven't templated). This keeps tokens off the hot path for the common case.

**Server-side fetch-then-feed, NOT Claude tool-use/web-fetch.** *Recommended.* We fetch the page on our infrastructure (Tier 1/2 runtime) and feed **pre-trimmed** content to Claude only when needed. Rejecting Claude-native web fetch because: (a) we need our own egress control, headers, render tier, retries, and per-site timeouts; (b) caching + pre-warm require us to own the fetched bytes; (c) deterministic parsing handles the common case with no model in the loop; (d) cost/latency predictability. Claude is an **extraction fallback**, not the fetcher.

**Truthfulness rule (hard, enforced):**
- Price, SKU, stock, specs come **only** from the fetched page. When Claude extracts, it is constrained by **structured outputs** to emit fields copied from the supplied page text, and instructed: *"Return only values present verbatim in the page; if a field is absent, return null — never infer or estimate."*
- Code validates extracted `price_fils` against a price-shaped token actually present in the trimmed input (a regex/anchor check); a value Claude returns that is **not found in the source slice is dropped** (defense-in-depth). This is a QA-assertable invariant.
- Ranking/"why" (ADR-002) continues to consume only these validated `Offer` fields — model explains, never invents.

**Keep token cost sane — never feed raw HTML:**
1. **Pre-trim/select before Claude.** Strip `<script>/<style>/nav/footer`, collapse whitespace, and pass only the **product container region** (selected by a coarse heuristic: the DOM subtree containing the price/`itemprop`/`og:` tags). Target < ~4 KB per page to Claude.
2. **Prefer structured signals first:** JSON-LD (`<script type="application/ld+json">` Product), Open Graph, microdata, Shopify JSON. If present, parse directly — often no Claude at all.
3. **Use Haiku 4.5 for extraction** (cheap, deterministic field-copy task); reserve Opus for rank/"why" only.
4. **Cache the extraction**, not just the fetch — re-extract only on cache miss.

```
RawPage ──► [strip scripts/nav/footer + select product region]
                │
        JSON-LD / OG / Shopify JSON present?
          │ yes                         │ no
          ▼                             ▼
   deterministic parse        [Haiku extract from trimmed slice, structured out]
          │                             │   "copy verbatim; null if absent"
          └──────────────┬──────────────┘
                         ▼
        validate price token ∈ source slice  (drop if not)
                         ▼
                  NormalizedOffer[]
```

---

## 3. Discovery vs price split (cheap find, reserve render for price)

Two distinct operations with different cost profiles:

| Step | Goal | Cheap path | Fallback |
|---|---|---|---|
| **Discover** | intent/SKU → product URLs | **sitemap.xml**, Shopify `/collections/{x}/products.json`, X-cite `/search` (or sitemap), known-URL cache table | render the search page (Tier 2) only if no cheap discovery exists |
| **Price/extract** | URL → live price/stock | Tier 1 HTTP on product page | Tier 2 render |

Key win from recon: **discovery is often cheaper than price.** X-cite `/search` is JS-shelled (would need render) but X-cite product `/p` is plain HTML — so we **discover URLs via sitemap/known-URL cache** (no render) and **fetch price via cheap HTTP `/p`**. Blink discovers *and* prices via `.json`. We **never spend a render on discovery if a sitemap/JSON route exists**, and we persist discovered `ProductRef`s (a `provider_url_cache` keyed by SKU candidate) so repeat queries skip discovery entirely.

---

## 4. "Real-time but fast" — latency budget, cache, pre-warm, partial results

**Per-query live fetch + short-TTL cache + pre-warm of popular SKUs + parallel fetch + graceful partial results.**

**Cache TTL (Redis + `offers.ttl_expires_at`, S1-3 schema):**
- Electronics price: **TTL ~15 min** (electronics prices move slowly; cache hit = no fetch, serve labeled `source:"cache"`).
- Discovered URLs (`provider_url_cache`): **TTL ~24 h** (URLs stable; price is what's volatile).
- Food promos (when added): **TTL ~5 min** (more volatile).
- Tunable via config; values are starting points, validated against the freshness/latency KPI.

**Pre-warm:** a background BullMQ scheduler refreshes the **top-N popular SKUs** (from `events` demand signal) on a rolling basis so query-time work is a **cache hit / refresh, not a cold fetch**. Pre-warm is the main lever that makes Tier-2 sites feel fast.

**Parallel + per-site timeout + partial results:**
- Fan out per provider **in parallel**; each provider has a **hard per-site timeout** (Tier 1: **~1.5 s**; Tier 2: **~5 s**).
- **Overall query budget ~6 s.** On timeout for a provider: **serve that provider's last cached offer labeled stale**, or **omit it** and proceed.
- **Graceful partial results:** rank and return whatever came back before the budget; never block the whole query on the slowest site (recon mitigation; AC D1.4 / cross-cutting #4). The result card carries `source` + `fetched_at` for honesty.

```
query ─► Promise.allSettled([
            provider_A(timeout 1.5s, http),
            provider_B(timeout 1.5s, http),
            provider_C(timeout 5s, render) ])
        ─► collect fulfilled within ~6s budget
        ─► timed-out/failed → labeled cache OR omit
        ─► rank what returned ─► cards (each tagged source+fetched_at)
```

---

## 5. Resilience & anti-bot

- **Retries:** Tier 1 = 1 retry w/ jittered backoff on 5xx/timeout; Tier 2 = 1 re-render. No aggressive hammering (politeness + ToS posture).
- **Headers / UA:** realistic, stable User-Agent + `Accept-Language: en,ar`; honor a small per-site rate limit + Redis scrape-lock (no concurrent duplicate fetch of the same URL).
- **Failure isolation per provider:** one adapter failing/throwing **never** fails the query — `allSettled` + per-provider try/catch. Others still return.
- **Kill-switch per adapter:** `providers.enabled` + a runtime flag the admin can flip instantly (reuses S1-3 kill-switch). Disabled adapter is skipped, query degrades to remaining providers.
- **Graceful degradation on site redesign:** when `extract()` confidence drops or yields 0 offers across N consecutive fetches, the adapter **self-reports unhealthy** (`AdapterHealth.consecutive_failures`), increments a metric, and is **auto-muted** (soft kill-switch) so it stops polluting results — **other adapters keep returning.** A redesign degrades one source, not the app.
- **Monitoring:** per-adapter dashboards — `fetch_success_rate`, `extract_confidence`, `p95_latency`, `cache_hit_ratio`, `consecutive_failures`, `claude_extract_calls`. Alert when an adapter crosses thresholds → human re-templates the parser.
- **Anti-bot reality (recon):** Tier 1 sites show no bot wall today; Tier 3 (Jahez 403 / Carriage 526) are *intentionally* walled — handled only in the deferred residential tier, behind a flag, and the cheapest design choice is **not to fight walls in MVP.**

---

## 6. Build slices + interface contracts (for bo-dev-lead / dev-3)

**Slice A (FIRST, buildable now) — X-cite + Blink live adapters, end-to-end.**
- Implement `ProviderAdapter` for **X-cite** (Tier 1, deterministic `/p` parser; discover via sitemap/known-URL) and **Blink** (Tier 1, `/products/{handle}.json` + `/collections/{x}/products.json` discovery).
- Wire them into the **existing `resolveOffers`** so these two providers return **live data, replacing the mock** for X-cite + Blink. Other providers stay mocked.
- Add `provider_url_cache` + Redis offer cache (TTL 15 min) + per-site timeout (1.5 s) + `allSettled` partial results.
- **No Claude on this slice** — deterministic parse only. Truthfulness via source-token validation.
- **DoD:** a real query returns live X-cite + Blink prices, cache hit on repeat, one adapter can be killed without breaking the query, prices match the live page (QA assert).

**Slice B — Tier 2 render adapters (Eureka, Best Al-Yousifi, Talabat).**
- Playwright pool on BullMQ (already in stack), `tier:"render"`. Prefer XHR/JSON-endpoint sniff over full render where found (recon §2). Add Haiku extraction fallback (§2) with structured outputs + source validation. Pre-warm scheduler for popular SKUs.
- **DoD:** AMBER sites return live offers within the 5 s/render budget; Claude extraction only fires on parser miss; token spend tracked.

**Slice C — Tier 3 residential (Jahez, Carriage). DEFERRED / OPTIONAL.**
- Behind a feature flag + explicit PO + legal go. Browser + residential egress. Build only if value justifies cost/fragility/ToS.

**Contracts to freeze for the team:**
- `ProviderAdapter` interface (§1) — the pluggable boundary; new sites = new adapter, no orchestrator change.
- `resolveOffers(skuCandidates, providerSet) → Offer[]{price_fils, provider, deeplink, source, fetched_at}` — **unchanged from S1-3**; Slice A just fills it with live data for 2 providers.
- `NormalizedOffer` (§1) — adapter output → `normalize`/SKU-group input (unchanged spine).
- Search orchestrator (Dev C, ADR-002) is **untouched** — it already consumes `Offer[]`.

---

## Consequences

- (+) GREEN sites ship live in one slice with **no AI cost** and lowest latency/risk; proves the owner's model fast.
- (+) Tiering + the adapter interface contain cost/risk: render and residential are isolated, optional, and don't touch the request path or the orchestrator.
- (+) Truthfulness enforced structurally (deterministic parse + source-token validation); ranking spine (ADR-002) unchanged.
- (+) Graceful partial results + per-adapter kill-switch/health → a site redesign or block degrades one source, never the app.
- (−) Tier 2/3 are latency- and cost-heavy and bot-fragile; mitigated by cache + pre-warm + XHR-sniff + deferring Tier 3.
- (−) Adapter maintenance burden (site redesigns) — budgeted via health auto-mute + monitoring + re-template playbook.
- (−) Live per-query fetch raises a **ToS/IP posture** beyond the old affiliate model (see flags).

## Legal / ToS flags (owner is directing — NOT blocking)
- Live per-query reading of public pages + republishing competitor price/image likely runs against marketplace/retailer ToS (esp. Talabat/Jahez/Carriage). The 403/526 walls are **intentional non-consent signals**. Per-query republishing may raise IP / database-right / trademark questions. **Route to counsel.** Owner has directed proceeding.
- **Lower-risk first:** X-cite `/p` (public) and Blink Shopify `.json` (publicly served) are the lowest-risk sources → they lead. Tier 2/3 stay behind `providers.tos_reviewed` + kill-switch. The affiliate-feed/`tos_reviewed`/kill-switch machinery from S1-3 is retained as the legal control surface.

---

## Handoff

**To bo-dev-lead / dev-3 (first buildable slice):**
- **Done:** ADR-003 — 3-tier live-fetch pipeline behind one `ProviderAdapter` interface; hybrid deterministic-first extraction (server-side fetch-then-feed, Claude/Haiku only as fallback with source-token validation); discovery/price split; short-TTL cache + pre-warm + parallel/partial-results latency design; per-adapter resilience/kill-switch/health; build slices A→B→C with frozen contracts.
- **Next (Slice A):** Build **X-cite (`/p`) + Blink (`.json`) Tier-1 adapters end-to-end and replace the mock for those two providers in `resolveOffers`.** Add `provider_url_cache`, Redis offer cache (TTL 15 min), per-site timeout 1.5 s, `allSettled` partial results. No Claude in Slice A. Then Slice B (Playwright render tier).
- **Owner:** bo-dev-lead (build), bo-tech-architect (interface authority), bo-qa-backend (truthfulness + partial-results + kill-switch asserts).
- **Blockers/risks:** X-cite discovery route (sitemap vs render `/search`) to confirm in Slice A spike; selector stability monitoring.

**To PO (decisions / risks):**
- **Decisions:** affiliate model dropped; AI reads sites live. GREEN (X-cite, Blink) ship first with **zero AI/token cost**. Render tier (Eureka/Best/Talabat) is slice 2. Jahez/Carriage **deferred** (bot-walled, costly).
- **Headless infra:** Tier 2 needs a Playwright worker pool (CPU/RAM cost) — within stack but raises infra spend above the old < ~$150/mo target as render volume grows; pre-warm + cache contain it. Tier 3 (residential egress) is a further paid dependency — recommend NOT building in MVP.
- **Latency budget:** ~6 s/query overall; Tier 1 ~1.5 s, Tier 2 ~5 s; partial results guarantee a response. "Real-time but fast" depends on cache + pre-warm — confirm this is acceptable.
- **Legal (action needed):** route the live-fetch / republish-competitor-data ToS+IP question to counsel. Not blocking GREEN sites per your direction, but Tier 2/3 should clear `tos_reviewed` before public release.
