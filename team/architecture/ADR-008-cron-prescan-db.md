# ADR-008 — Cron Pre-Scan into a Categorized DB (Plan B): Feasibility, Design, Shadow Build

Status: PROPOSED (owner Plan B — feasibility + plan, NOT a live-search change)
Author: bo-tech-architect
Date: 2026-06-27
Extends / contrasts: ADR-003 (live AI-fetch), ADR-005 (food), ADR-006 (Instagram/Apify), ADR-007 (search quality)
Scope guard: This ADR designs a **parallel, flag-gated pipeline** (`SEARCH_SOURCE=db|live`, default **live**). It does **not** touch the live search path. Nothing here ships into `/search` until validated in shadow and the PO flips the flag.

Every claim is tagged **VERIFIED** (read in code / cited from a prior verified ADR) or **ASSUMED** (judgment / arithmetic on verified rates).

---

## 0. The owner's Plan B, restated

A **scheduled cron** runs several times/day, **scans all sources** — ~100 Electronics products/providers, ~100 Food sources (Talabat + tracked IG), ~100 Real-estate sources — **extracts + categorizes + saves into the DB**, and then **search reads from the DB** instead of fetching live per query.

This inverts the current model. Today (ADR-003) acquisition happens **on the query path** behind a short-TTL cache. Plan B moves acquisition **off the query path** into a scheduled writer + a DB store that search reads.

---

## 1. Feasibility per sector (honest, with numbers)

### What already exists (VERIFIED, read in code 2026-06-27)
- **Adapters are already built** for all three lanes behind one `ProviderAdapter` iface: Tier-1 HTTP (X-cite, Blink), Talabat JSON (`tier:'http'`), and the **social lane** (`apps/api/src/offers/adapters/social/*` — `social-ingest.adapter.ts`, `apify-social-provider.ts`, `tracked-accounts.store.ts`, `social-resolver.ts`). **VERIFIED.**
- The social lane today fetches **live-per-query** behind an in-process/Redis `OfferCache` keyed `providerId:queryText`, TTL `SOCIAL_TTL_MS` (~6h). `SocialOfferResolver.resolveOne` calls `adapter.discover()` on cache miss. **VERIFIED** (`social-resolver.ts:83-97`). → Plan B's job is to *pre-populate a durable store* so that miss never hits Apify on the query path.
- Search reads offers via `this.offers.resolveOffers(intentNormalized)` (`search.service.ts:314`). **VERIFIED.** This is the single seam where a `db|live` toggle belongs.
- **No BullMQ/cron is wired yet.** Only `events.service.ts` references a queue concept; there is **no scheduler dependency in `apps/api/package.json`**. **VERIFIED.** Plan B needs a real scheduler added (see §2).
- Curated seed = **74 accounts** (60 food + 13 real-estate; 1 ambiguous), in `team/research/ig-accounts-seed.json`. **VERIFIED** (counted). Price mode: **24 caption-price (`yes`), 45 DM-only, 4 image-baked.** **VERIFIED.** → only ~28/74 accounts ever carry a machine-readable price; **45 are DM-only** (card degrades to "price on request").

### 1a. Electronics — **CHEAP, FEASIBLE, LOW RISK** ✅
- Sources are HTTP/JSON: X-cite `/p`, Blink `/products/{handle}.json` + `suggest.json`, Eureka Algolia. **VERIFIED** (ADR-003, ADR-007). No Apify, no Claude on the hot path; T1 = deterministic parse.
- A scheduled scan of the **top ~100 SKUs/handles per provider** is just N HTTP GETs. At ~0.2–0.8s each, 3 providers × ~100 = ~300 requests/run → **seconds of work, ~0 marginal $.** **ASSUMED** (arithmetic on VERIFIED per-fetch latency).
- **Storage:** an offer row ≈ a few hundred bytes; current + history for ~300 SKUs × several runs/day = **kilobytes/day**. Trivial on Supabase Postgres. **ASSUMED.**
- **Refresh cadence realistic: every 15–60 min** (electronics price TTL is ~15 min in ADR-003). Cheap enough to be the most frequent lane. **ASSUMED.**
- **Risk:** provider scan load + ToS/anti-bot. ~100 polite GETs/run with backoff + scrape-lock + realistic UA is low load, but **Plan B raises request volume vs live** (live only fetches what users ask for; cron fetches the whole top-100 regardless). Net for electronics: **still low risk**, T1 sources are the friendliest. **ASSUMED.** ToS sign-off already pending (ADR-003) — unchanged.
- **Verdict: GREEN. Build the electronics scan lane first; it's the cheapest and de-risks the whole pattern.**

### 1b. Food — Talabat **CHEAP/GREEN**; IG = the cost & legal story
- **Talabat:** the menu API (`/nextMenuApi/v2/branches/{vendorId}/menu` → 200, 130 priced items, no auth) is deterministic JSON. **VERIFIED** (ADR-005 live spike). Scanning ~100 restaurants = ~100–200 JSON GETs/run (slug→vendorId cached 24h). **Cheap, no Claude.** Cadence every 30–60 min realistic. ToS/anti-bot risk = same as live (internal endpoint, behind `tos_reviewed`+kill-switch). **GREEN.**
- **Instagram (Apify):** this is **THE big cost & risk line** — see §1d for the full Apify math. IG inventory is net-new (Talabat can't reach it) and is the reason Plan B is attractive, but it's also where cron multiplies spend.

### 1c. Real-estate — **CHEAP for portals; IG same as food**
- Portal listings (the gazetteer/area work in ADR-007) are SEO-public HTML/JSON — scannable cheaply, no Apify. **ASSUMED** (consistent with ADR-007 "catalog-free discovery"; portal adapters not yet all built — flag).
- RE IG = **13 accounts** in the seed (not 100). **VERIFIED.** So the RE "~100 sources" is mostly **portals + agents**, not 100 IG accounts → cheaper than the food IG line.
- **Verdict: GREEN for portals; IG-RE folds into the Apify line below.**

### 1d. **THE BIG ONE — Apify credit cost for scanning ~100 IG accounts several times/day**

Verified Apify rates (ADR-006, live-checked 2026-06-26):
- **Free trial:** one-time credit only — **NOT a recurring free tier.** Apify's recurring free plan is ~$5/mo platform credit, **nowhere near** this workload. **VERIFIED** (ADR-006) / **ASSUMED** (free-tier inadequacy is arithmetic).
- **Starter $30/mo** → **$2.30 / 1,000 results** (~16.9k results/mo included-ish).
- **Scale** → **$1.90 / 1k**. **Business** → **$1.50 / 1k**. **PAYG base $2.70 / 1k.**

**The cost driver is: accounts × posts-pulled-per-run × runs-per-day × 30.**

The decisive lever (already in ADR-006) is **`onlyPostsNewerThan` delta pulls** + `last_pull_at`: after a one-time backfill, each run pulls only *new* posts since the last run. **Cron cadence does NOT linearly multiply cost** *if* deltas are used — pulling the same account 6×/day still only returns each new post once across the day. **VERIFIED** capability (ADR-006) / **ASSUMED** that Apify bills per returned result not per run (true for `instagram-scraper` pay-per-result).

Scenarios (food 60 + RE 13 ≈ **73 IG accounts**, ~3 new posts/account/day — ADR-006's "smart" assumption):

| Approach | Results/month | Apify $/mo | Note |
|---|---|---|---|
| **NAÏVE full re-pull, 6×/day** (pull last 30 posts every run, no delta) | 73 × 30 × 6 × 30 ≈ **394k** | **~$590–750/mo** | ❌ cadence linearly multiplies — **do not do this** |
| **NAÏVE full re-pull, 3×/day** | 73 × 30 × 3 × 30 ≈ **197k** | **~$300–450/mo** | ❌ still wasteful |
| **SMART delta, any cadence** (backfill once, then `onlyPostsNewerThan=last_pull_at`) | 73×30 backfill + 73×3×30 deltas ≈ **8.8k/mo** | **~$20–30/mo** (fits Starter $30) | ✅ **the only sane path** |

> **VERDICT (Apify):** cron pre-scan of ~73 IG accounts is **cheap (~$20–30/mo) ONLY with delta pulls**, and **expensive (~$300–750/mo) if cron does naïve full re-pulls.** The danger of Plan B is precisely that "scan everything several times/day" *invites* the naïve pattern. **Hard requirement: the IG scan worker MUST be delta-based; cadence then becomes ~free.** Apify is the single line item that can blow the <$150/mo infra budget if mis-built — flag to PO. **ASSUMED** (arithmetic on VERIFIED rates).

### 1e. Claude (Haiku) extraction at batch scale
- Electronics + Talabat = **zero Claude** (deterministic). **VERIFIED** (ADR-003/005).
- IG extraction = Haiku on a **trimmed caption slice**, vision **only when caption lacks a price**. With delta pulls (~8.8k posts/mo), ADR-006 puts this at **~$8–15/mo.** **VERIFIED** estimate (ADR-006). Batch scale doesn't change per-post cost; total tracks delta volume, which deltas keep small. **Cheap.**
- **Image-vision exposure is small:** only 4/74 accounts are image-baked-price, ~24 caption-price. Most (45) are DM-only → no price to extract → cheapest of all. **VERIFIED.**

### 1f. Freshness vs the live model
- **Live (ADR-003):** data is as fresh as the moment the user searches (minus short cache). Price changes are seen on next query.
- **DB pre-scan:** data is as fresh as the **last scan**. A price that changes between scans is **stale until the next run.** Electronics @ 15–60 min is fine; **food promos and IG flash-deals can go stale** between runs. Mitigation = `last_scanned_at` + TTL + staleness label on the card. **ASSUMED.** This is Plan B's core trade-off: **speed/stability bought with freshness.**

### Feasibility summary

| Lane | Feasible? | Cost | Cadence (realistic) | Risk |
|---|---|---|---|---|
| Electronics (T1 HTTP/JSON) | ✅ YES | ~$0 marginal | 15–60 min | LOW (build first) |
| Food — Talabat JSON | ✅ YES | ~$0 marginal | 30–60 min | LOW–MED (ToS pending) |
| Real-estate — portals | ✅ YES (adapters TBD) | ~$0 marginal | hourly | LOW–MED |
| **IG (food+RE, Apify)** | ✅ YES **only with deltas** | **$20–30/mo smart / $300–750 naïve** | deltas decouple cadence | **MED–HIGH (cost trap + Meta ToS, highest legal flag)** |
| Claude extraction | ✅ YES | ~$8–15/mo | tracks delta volume | LOW |

**Cheap:** electronics, Talabat, portals, Claude extraction.
**Expensive *if mis-built*:** Apify IG (naïve re-pull). **Cheap if delta-built.**
**Risky:** Meta ToS for IG (unchanged from ADR-006, still the top legal flag) + increased scan request volume vs live (we now fetch the whole top-100 whether or not anyone asked) + staleness.

---

## 2. Design (shadow / parallel pipeline)

```
                        ┌──────────────────────────────────────────────┐
   SCHEDULER (BullMQ     │  per-sector SCAN WORKERS (reuse ProviderAdapter)│
   repeatable jobs)      │                                              │
   ─────────────         │  ElectronicsScanWorker → X-cite/Blink/Eureka  │
   every 15–60m  ───────▶│  FoodScanWorker        → Talabat + IG(social) │
   (per lane)            │  RealEstateScanWorker  → portals + IG(social) │
                        └───────────────┬──────────────────────────────┘
                                         │ discover() → fetch() → extract()  (UNCHANGED adapter contract)
                                         ▼
                          NORMALIZE → CATEGORIZE → DEDUP
                                         ▼
                        ┌──────────────────────────────────────────────┐
                        │  cached_offers (NEW durable store)            │
                        │  + offer_history (append-only, reuse)         │
                        │  + tracked_accounts (reuse, +last_pull_at)    │
                        └───────────────┬──────────────────────────────┘
                                         │  read path, FLAG-GATED
                                         ▼
                 SEARCH_SOURCE=db ? DbOfferReader : LiveOfferResolver   ← single seam at resolveOffers()
                                         ▼
                                  /search/answer (UNCHANGED)
```

### 2a. Scan workers (per sector) — reuse, don't reinvent
- Each worker iterates the curated source set and calls the **existing** `adapter.discover()/fetch()/extract()`. **No adapter changes.** The only difference vs live: the caller is a **scheduled job writing to a durable store**, not a request handler writing to a short-TTL cache.
- IG worker uses `tracked-accounts.store.ts` + `apify-social-provider.ts` **as-is**, but passes `onlyPostsNewerThan = account.last_pull_at` and updates `last_pull_at` on success. **This is the cost-critical change** (§1d).
- Workers run on the existing Playwright/queue worker process (separate from the API request path) — same isolation principle as ADR-003.

### 2b. Store: `cached_offers` (new) + reuse history & accounts
Reuse the ADR-003 offer shape; add scan/staleness columns. **ASSUMED schema (slice-able):**
```
cached_offers (
  id, sector, provider_id, source_tier,           -- http|render|social
  sku_id NULL, dish_key NULL, listing_key NULL,    -- categorization keys (reuse SKU/dish/area grouping)
  title, price_fils NULL, old_price_fils NULL, currency,
  area NULL, tenure NULL, rooms NULL,              -- RE slots (ADR-007)
  deeplink, permalink NULL, posted_at NULL,        -- IG verbatim (non-hallucinatable, ADR-006)
  category, subcategory,                            -- categorization output
  content_hash,                                     -- dedup key
  scanned_at, ttl_expires_at, is_stale,            -- staleness
  UNIQUE (provider_id, content_hash)
)
offer_history  -- REUSE append-only price asset (ADR-001); each scan appends a price point
tracked_accounts  -- REUSE; ADD last_pull_at (delta driver) + last_result_count
```
- **Money stays integer fils** (ADR-001). **Truthfulness guards unchanged** (ADR-006): `price_fils` null unless a literal token is in source; `permalink`/`posted_at` copied verbatim from the Apify row; non-offers dropped.
- Single managed Postgres = Supabase `public` (ADR-004), service-role conn. No new DB infra.

### 2c. Scheduler — **BullMQ repeatable jobs** (recommendation)
- **Choose BullMQ repeatable jobs** over node-cron or a hosted scheduler:
  - VERIFIED: Redis is already in the stack (ADR-001 cache/locks). BullMQ rides it → no new infra, gives retries, concurrency caps, per-job backoff, and a dashboard. **Recommended.**
  - node-cron: in-process, no retry/observability, dies with the process → rejected (too fragile for paid Apify calls).
  - Hosted scheduler (Supabase `pg_cron`, GitHub Actions, Render cron): viable fallback, but adds a second control plane and can't easily share the Playwright worker pool → defer.
- **Per-lane cadence (recommended):** electronics 30 min · Talabat/food 30 min · portals/RE 60 min · **IG delta pull 4–6×/day** (cadence is cost-neutral with deltas; pick by freshness need, not by budget). Global concurrency cap + per-provider scrape-lock (reuse ADR-003).

### 2d. Categorization
- Deterministic-first (ADR-003 philosophy): sector is known from the worker; category/subcategory from the adapter's structured fields (Talabat menu section, Shopify product type, IG `category` from `tracked_accounts`). Claude/Haiku categorization **only** for ambiguous IG captions — same call that already extracts the offer, no extra spend. **ASSUMED.**

### 2e. Dedup
- `content_hash = hash(provider_id + normalized_title + price_fils + permalink|deeplink)`. `UNIQUE (provider_id, content_hash)` → re-scans upsert, don't duplicate. Cross-provider same-product grouping reuses **SKU-group / dish-key / area-key** (ADR-001/005/007) — same matching logic, just applied at scan time instead of query time (a **win**: grouping cost moves off the hot path).

### 2f. Staleness / TTL
- `ttl_expires_at = scanned_at + sectorTTL` (electronics 60 min, food 30 min, IG 12h — IG posts are static so longer is fine, ADR-006). A read past TTL returns the row **labelled stale** (don't hide it; truthfulness) and the next scan refreshes it. A monitor alerts if any lane's newest `scanned_at` is older than 2× its cadence (scan worker down).

### 2g. Read path (toggle) — the one seam
- New `DbOfferReader.resolveOffers(intentNormalized)` with the **same signature** as the live `LiveOfferResolver`/`resolveOffers` (`search.service.ts:314`). It queries `cached_offers` by sector + categorization keys + ranks (ranking stays deterministic, Claude only explains — unchanged).
- Bind by flag: `SEARCH_SOURCE=db` → `DbOfferReader`; `SEARCH_SOURCE=live` (**default**) → existing path. **Search/intent/clarifier/ranking code is untouched.**
- Optional later: `SEARCH_SOURCE=hybrid` (read DB, fall back to live on a category miss) — defer (YAGNI) until shadow proves DB coverage.

---

## 3. Trade-offs: DB-backed vs Live (ADR-003) vs Hybrid pre-warm

| Dimension | **Live (ADR-003, current)** | **DB pre-scan (Plan B)** | **Hybrid pre-warm (ADR-003 already names this)** |
|---|---|---|---|
| Query latency | Med (fetch + 6s budget, partial results) | **Fast** (DB read, no network) ✅ | Fast for hot SKUs, live for cold |
| Freshness | **Best** (live at query time) ✅ | Stale between scans ❌ | Hot=fresh-ish, cold=live |
| Stability vs site breakage | A redesign breaks results **at query time** for users | Breakage seen by **scan worker**, last-good rows still served ✅ | In between |
| Apify cost | Pay only for what users pull (cache-gated) | **Pay to scan top-100 whether asked or not** — only safe with deltas ⚠️ | Pre-warm only hot/top-N → less |
| Scan/ToS surface | Fetch only what's asked → lowest volume | **Highest request volume** (scan everything) ⚠️ | Medium |
| Coverage of long tail | Whatever discovery finds at query time | Only what was scanned → **misses off-catalog/unseen** unless scan set is broad ❌ | Live covers the tail |
| Build complexity | Already built | New scheduler + store + reader (this ADR) | Smallest add to current |

**When DB-backed WINS:** high query volume on a **stable, bounded top-N** (popular electronics SKUs, top Talabat restaurants, the curated IG set) — speed + stability + grouping-off-hot-path, and it **decouples user traffic from Apify spend** (a real plus for IG: a viral query can't trigger paid live calls).

**When DB-backed LOSES:** the **long tail** (ADR-007's whole point — off-catalog dish/unseen-area/unseen-SKU). If it wasn't scanned, the DB has nothing. It also loses on **freshness** for fast-moving prices and **raises ToS surface** (scanning the whole catalog vs only what users ask).

### Recommendation
**Adopt a HYBRID, built in this order:**
1. **Keep LIVE as the default and the long-tail engine** (ADR-003 + ADR-007 fixes are doing the real coverage work). Do **not** replace it.
2. **Build the pre-scan DB lane in SHADOW** for the **bounded, high-value top-N**: top electronics SKUs, top Talabat restaurants, the curated IG accounts (where DB-backed genuinely wins on speed + decouples Apify spend).
3. **Converge on `SEARCH_SOURCE=hybrid`** later: read DB for a hit, fall back to live for a miss. This captures Plan B's speed/stability **without** sacrificing the long tail or freshness on cold queries.
4. **IG pre-scan MUST be delta-based** (§1d) — the one non-negotiable, or the cost story collapses.

Pure `SEARCH_SOURCE=db` (DB-only, no live fallback) is **not recommended** as an end state — it would re-introduce the catalog-wall failure mode ADR-007 just diagnosed. It's only a shadow/validation milestone.

---

## 4. Buildable plan — SHADOW mode (sliced for bo-dev-lead)

**Invariant:** `SEARCH_SOURCE` defaults to `live`. Every slice below is developed and validated **without** the live `/search` path reading from the DB. The flag flips only after S5 validation + PO sign-off. No change to search/intent/clarifier/ranking code.

- **S0 — Scheduler infra (foundation).** Add BullMQ + a `scheduler` module; one no-op repeatable job proving the cron fires + retries + has a dashboard. Add `.env`: `SEARCH_SOURCE=live` (default), `SCAN_ELECTRONICS_CRON`, `SCAN_FOOD_CRON`, `SCAN_RE_CRON`, `SCAN_IG_DELTA_PER_DAY`. *No live impact.*
- **S1 — `cached_offers` store + `offer_history` reuse + categorization/dedup helpers.** Migration + repository with upsert-on-`content_hash`. Unit-tested with fixtures. *No live impact.*
- **S2 — ElectronicsScanWorker (cheapest, build first).** Reuse X-cite/Blink/Eureka adapters; scan top-~100 handles; write `cached_offers` + append `offer_history`; staleness/TTL. Proves the whole pattern at ~$0. *No live impact.*
- **S3 — FoodScanWorker (Talabat) + RealEstateScanWorker (portals).** Reuse Talabat JSON + portal adapters; categorize; dedup. *No live impact.*
- **S4 — IG delta scan (cost-critical).** Reuse `social-ingest.adapter` + `apify-social-provider` + `tracked-accounts.store`; add `last_pull_at` and pass `onlyPostsNewerThan`. **`SOCIAL_PROVIDER=mock` default** so dev needs no key/spend. Enforce **monthly Apify result cap + per-account/global kill-switch** (reuse ADR-006). Validate delta math against the cap **before** any real-key run. *No live impact.*
- **S5 — `DbOfferReader` + flag binding + shadow validation.** Implement reader with the live signature; bind on `SEARCH_SOURCE`. **Validate in shadow:** run a query set through both `db` and `live`, diff coverage/freshness/latency (especially the ADR-007 long-tail cases: off-catalog SKU, unseen area, unseen dish). Report the diff to the PO. **Flag stays `live` until the PO approves.**
- **S6 (later, post-validation) — `SEARCH_SOURCE=hybrid`** read-DB-then-live-fallback. Only after S5 shows where DB beats live and where it must defer to live.

**Order rationale:** S0–S2 prove the pattern at ~$0 risk before any Apify spend (S4). S5 is where the comparison is made; the flag never flips silently.

---

## 5. Cost / risk flags for the PO
- **Apify is the budget risk.** Delta-built ≈ **$20–30/mo**; naïve cron re-pull ≈ **$300–750/mo** and breaks the <$150/mo infra budget. S4 must prove deltas + cap before a real run. **(HIGH-flag.)**
- **Meta ToS (IG)** — unchanged top legal flag (ADR-006). Pre-scanning the whole curated set *increases* our standing data footprint vs live-on-demand → counsel should be aware the posture is slightly heavier. Gated `tos_reviewed=false`, internal-only.
- **Increased scan request volume** vs live (we fetch the top-100 whether asked or not) → keep polite (backoff, scrape-lock, off-peak), watch provider anti-bot. **(MED-flag.)**
- **Staleness** is the inherent trade for speed — must be labelled on cards, never hidden. **(MED-flag.)**
- **No new infra** beyond BullMQ-on-existing-Redis and one new table → infra cost ~flat (the variable is Apify, controlled above). **(GREEN.)**

---

## Handoff
- **Done:** ADR-008 written (`team/architecture/ADR-008-cron-prescan-db.md`) — feasibility (per-sector, with verified numbers), shadow design (scan workers reusing existing adapters, `cached_offers` store, BullMQ repeatable scheduler, categorization/dedup/TTL, flag-gated `DbOfferReader`), trade-offs vs live/hybrid + recommendation, and a 7-slice shadow build. Memory updated. Verified against code (no BullMQ yet; social lane exists & is live-per-query; `resolveOffers` is the read seam; 74 curated accounts, 24 caption-price/45 DM/4 image) and against ADR-006 Apify rates.
- **Feasibility verdict:** **GO — feasible and cheap for electronics/Talabat/portals/Claude (~$0 marginal). The ONLY cost trap is Apify IG: ~$20–30/mo if delta-built, ~$300–750/mo if naïve cron re-pulls.** Conditional GO: **build IG scan delta-based only.** Pure DB-only as an end state = NO (re-creates the ADR-007 catalog-wall on the long tail).
- **Recommended cadence:** electronics 30 min · Talabat/food 30 min · RE/portals 60 min · **IG = delta pulls 4–6×/day (cost-neutral with deltas; choose by freshness, not budget).** End-state read mode = **`SEARCH_SOURCE=hybrid`** (DB for top-N hits, live for the long tail), not DB-only.
- **Shadow build slices (Dev Lead, kept OUT of live search — flag defaults `live`):** S0 BullMQ scheduler → S1 `cached_offers`+history+dedup → S2 ElectronicsScanWorker (first, ~$0) → S3 Food/RE scan workers → S4 IG **delta** scan (mock default, monthly cap+kill-switch, prove delta math before real key) → S5 `DbOfferReader`+`SEARCH_SOURCE` flag+shadow diff vs live (incl. ADR-007 long-tail cases) → S6 (later) `hybrid` fallback. Flag flips ONLY after S5 + PO sign-off.
- **Owner:** PO to (1) confirm we proceed to shadow build, (2) note Apify delta-discipline as a hard build constraint, (3) acknowledge IG ToS posture is slightly heavier under pre-scan (counsel). bo-dev-lead owns S0–S6 once approved.
- **Blockers/risks:** Apify naïve-repull cost trap (HIGH, mitigated by delta requirement + cap) · Meta ToS/IP (HIGH, gated, unchanged) · increased scan/anti-bot surface (MED) · staleness vs live (MED, label don't hide) · portal RE adapters not all built yet (flag, S3 dependency).
