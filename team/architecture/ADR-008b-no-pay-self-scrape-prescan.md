# ADR-008b — No-Pay Self-Scrape Pre-Scan (revises ADR-008 under the owner cost directive)

Status: PROPOSED (revises ADR-008; owner cost directive 2026-06-27)
Author: bo-tech-architect
Date: 2026-06-27
Revises: ADR-008 (cron pre-scan into DB). Extends: ADR-003 (live fetch), ADR-005 (Talabat), ADR-006 (IG/Apify), ADR-007 (search quality).
Scope guard: still a **parallel, flag-gated, SHADOW** pipeline. `SEARCH_SOURCE=live` stays the default; nothing here touches the live `/search` path until shadow-validated and the PO flips the flag.

Every claim tagged **VERIFIED** (read in code / prior verified ADR) or **ASSUMED** (judgment / arithmetic on verified rates).

---

## 0. The owner directive (what changed)

> **We should NOT pay third parties for the search mechanism. The only paid dependency allowed is Apify (Instagram) — and we want even that minimised. Everything else (X-cite/Blink/Eureka, Talabat, RE portals) we already self-fetch for FREE. Revise Plan B to our own SCHEDULED SELF-SCRAPING → DB → search-reads-from-DB.**

ADR-008 accepted Apify at ~$20–30/mo as "cheap, a non-issue." This revision **rejects that default**: Apify is the only paid line, and the directive is to drive search cost to **$0 wherever physically possible** and treat IG as a deliberate, minimised tradeoff — not a baseline expense.

**Bottom line up front:** electronics, Talabat food, and RE portals are **$0 marginal** self-scrape lanes — confirmed in code. Instagram is the **only** lane that cannot be made truly free: self-scraping IG without paying is **technically possible but operationally fragile and needs residential proxies (which cost money)**, so "free IG" is a myth at any real scale. The honest recommendation is **drop IG from the always-on scan, lean on the free sources (RE→portals, food→Talabat), and keep IG as a low-frequency best-effort lane** — paid only if the PO wants the IG-only long tail, and then via the cheapest of {one cheap account self-scrape + budget proxies} vs {minimal delta-Apify}.

---

## 1. Free lanes — CONFIRMED $0 marginal (self-scrape into DB)

**VERIFIED in code 2026-06-27:** X-cite/Blink/Talabat all retrieve via our own `httpGet` (`apps/api/src/offers/adapters/http-fetch.ts` — global `fetch`/undici on **our** box, realistic UA + Accept-Language, AbortController timeout, 1 retry). No third party sits in the path. Eureka uses our render/Algolia path. The social lane is the only one that delegates acquisition to an external provider (`social/social-provider.ts` comment: *"We NEVER fetch Instagram ourselves"*). **VERIFIED.**

So the "free" claim is real, not aspirational: these lanes already run on our infra at $0 marginal. Pre-scanning them changes *when* we fetch (scheduled vs per-query), not *who* fetches or *what it costs*.

| Free lane | Acquisition (VERIFIED) | Marginal $ | Claude? | Notes |
|---|---|---|---|---|
| **Electronics** | X-cite `/p` HTML, Blink `/products/{h}.json`+`suggest.json`, Eureka Algolia — our `httpGet`/render | **$0** | No (deterministic T1) | Friendliest, build first |
| **Food — Talabat** | `/nextMenuApi/v2/branches/{vendorId}/menu` JSON (200, no auth, ADR-005 spike) — our `httpGet` | **$0** | No | slug→vendorId cached 24h |
| **RE — portals** (q84sale, Boshamlan) | SEO-public HTML/JSON — our `httpGet` | **$0** | No (deterministic parse) | adapters partly TBD (flag) |

**Confirmed:** all three are scheduled self-scrape at **$0 marginal**, reusing the existing `ProviderAdapter` unchanged. The only cost is our own server/Redis/Postgres, which we already pay for (ADR-001/004) — flat regardless of these scans.

### Scheduler for the free lanes (BullMQ on the existing Redis)
- **BullMQ repeatable jobs on the Redis we already run** (ADR-001 cache/locks). No new infra, gives retries + concurrency caps + backoff + dashboard. Chosen over node-cron (no retry/observability, dies with process) and pg_cron/hosted (second control plane, can't share the worker pool). **VERIFIED** Redis is in-stack; **ASSUMED** BullMQ is the best fit (judgment, consistent with ADR-008).
- **Cadence (recommended):**
  - Electronics — **every 30 min** (price TTL ~15 min, ADR-003; cheap T1 GETs).
  - Talabat / food — **every 30 min** (promos move; deterministic JSON).
  - RE / portals — **every 60 min** (listings change slower).
- Each job = a per-sector scan worker iterating the curated source set, calling existing `discover()/fetch()/extract()`, writing `cached_offers` + appending `offer_history`. Global concurrency cap + per-provider scrape-lock (reuse ADR-003). Polite: backoff, off-peak skew, realistic UA.
- **At ~100 sources/lane × a handful of runs/day, this is seconds of HTTP and kilobytes of storage per day. $0 marginal. ASSUMED** (arithmetic on VERIFIED per-fetch latency).

**Verdict (free lanes): GO at $0. These are the backbone of the no-pay search mechanism.**

---

## 2. The Instagram problem — the crux (honest assessment)

IG is net-new supply (KW home-kitchens / IG-only food + agents posting flats) that Talabat and the portals **cannot** reach. The seed is **74 accounts (60 food / 13 RE)**; only **~28 carry a machine-readable price** (24 caption / 4 image), **45 are DM-only** (card = "price on request"). **VERIFIED** (ADR-008 §0, counted). So IG's *unique* value is mostly the **food IG-only long tail** and a thin RE slice — RE coverage is already better served by free portals (13 IG accounts vs ~60 real KW areas of portal data).

### 2a. Can we self-scrape IG for FREE? — honest answer: **No, not durably.**

What self-scraping IG actually requires (a Playwright headless browser on our box with a logged-in session), and the real anti-bot reality:

- **IG direct fetch is RED — VERIFIED (ADR-006 §1):** the public profile/post endpoints are login-walled (header-only HTML, `?__a=1`/GraphQL gated). You **must** be authenticated to read post lists. So "free self-scrape" means **running real IG accounts in an automated browser** — which is exactly what Meta's anti-automation is built to detect and kill. **VERIFIED** the wall; **ASSUMED** the operational consequences below (industry-standard, not code-verified — flagged honestly).

- **What it actually takes (ASSUMED, honest):**
  1. **Logged-in session(s):** one or more real IG accounts, warmed up, with stored cookies/session in the scraper. Automating a logged-in account to scrape at scale is a **direct ToS violation** and the #1 ban trigger.
  2. **Anti-bot reality:** IG rate-limits aggressively, fingerprints the browser, throws checkpoint/"suspicious activity" challenges, and **bans accounts** that scrape — often within hours/days of automated patterned access. Datacenter IPs (our PaaS egress) are flagged fast. **This is not a "build once" — it's a continuous arms race** (IG changes GraphQL params, adds challenges; the scraper breaks repeatedly). This is precisely the **per-bug treadmill ADR-007 warns against**, applied to infrastructure.
  3. **Residential proxies are effectively mandatory** to avoid instant datacenter-IP blocks — and **residential proxies cost money** (typically **$3–15/GB**, or ~$50–300+/mo for a small pool from Bright Data / Smartproxy / Oxylabs). **ASSUMED** market rates (not spiked). So **"self-scrape IG free" is false the moment you need proxies to survive** — and you do. Even one account behind a residential proxy is a **monthly bill, plus account-burn replacement cost, plus engineering maintenance**.
  4. **Account burn:** banned accounts must be replaced (phone-verified, warmed). This is ongoing manual ops, not automatable cheaply, and legally/ethically the worst posture in the project.

- **Verdict:** **Self-scraping IG is NOT free.** Its *real* cost is **proxies ($50–300+/mo) + account churn + recurring engineering to fix breakage**, with **high ban risk and the heaviest ToS exposure**. It is almost certainly **more expensive and far more fragile than minimal delta-Apify (~$20–30/mo)**, while carrying *more* legal risk (we'd be the operating party of the violating automation, not merely directing a vendor). **Do not pretend it is free.**

### 2b. Cheaper / zero-cost alternatives (the honest menu)

| Option | Real $/mo | Coverage | Fragility | Legal |
|---|---|---|---|---|
| **A. Drop IG from the always-on scan; lean on FREE sources** (RE → portals only; food → Talabat + IG dropped or best-effort) | **$0** | Loses the **food IG-only long tail**; RE barely affected (portals cover it) | None | Cleanest |
| **B. Self-scrape IG (Playwright + 1 cheap account + residential proxies)** | **~$50–300+** (proxies) + account churn + eng time | Full curated set, but flaky | **HIGH** — bans, breakage, arms race | **Worst** (we operate the violating automation) |
| **C. Minimal delta-Apify, low frequency, food-only, capped** | **~$10–30** (delta + cap; can floor lower by trimming accounts/cadence) | Food IG-only long tail covered | LOW (vendor absorbs anti-bot) | Heavy but vendor-shielded (ADR-006) |
| **D. Opt-in partner OAuth (IG Graph API for accounts that authorize us)** | **$0** (official API) | Only consenting accounts — small at MVP, grows | LOW | **Cleanest long-term** (ADR-006 P3) |

**Key honest findings:**
- **B is the trap the directive must avoid:** "self-scrape = free" is the intuition, but proxies + account burn + maintenance make it *both* the most expensive-in-total-cost *and* the most fragile/illegal path. **ASSUMED** but high-confidence (standard IG-scraping reality).
- **A is genuinely $0** and loses little for RE (portals win) — it only sacrifices the **food IG-only long tail**, which the search can degrade gracefully on (live best-effort, or simply not covered, clearly).
- **C** is the smallest real spend if the PO values the food IG long tail: with delta pulls + a tight account list + low cadence, it can sit at **~$10–30/mo**, far below the proxy bill of B and far below ADR-006's naïve ~$300–750.
- **D** is the only path that is both $0 and clean — but it doesn't cover "track any account," only those who opt in. Build it as the long-term answer; it won't carry MVP coverage alone.

### 2c. RECOMMENDATION (lowest-cost viable path to keep IG coverage)

**Tiered, by how much IG coverage the PO actually wants:**

1. **Default (recommended for no-pay MVP): Option A — drop IG from the scheduled scan.** RE runs on free portals (negligible loss); food runs on free Talabat. The **food IG-only long tail** is handled as **best-effort live** (existing social lane stays live-per-query behind cache, NOT in the scan) or is simply out-of-scope-and-labelled. **$0. Cleanest legally.** This fully satisfies the no-pay directive.
2. **If the PO wants the food IG long tail in the DB: Option C — minimal delta-Apify, food-only, capped (~$10–30/mo).** This is **cheaper and far less fragile than self-scraping (B)**, despite "self-scrape" sounding free. Hard constraints: delta pulls only (`onlyPostsNewerThan`), food accounts only, low cadence (2–3×/day), monthly result cap + kill-switch.
3. **Always, in parallel: Option D — build opt-in partner OAuth (Graph API).** $0, clean, grows coverage over time. The real long-term answer.
4. **Do NOT choose B (self-scrape IG).** It is not free (proxies $50–300+/mo + account churn + perpetual breakage) and carries the worst legal posture. If anyone proposes it as "the free option," that is mistaken — flag it.

> **The cheapest *viable* path to keep IG coverage is C (minimal delta-Apify), not B (self-scrape).** The cheapest path *overall* is A (drop IG), which is also fully no-pay and recommended as the default unless the food IG long tail is judged essential.

---

## 3. Design (scheduled self-scrape → DB → flag-gated read)

Unchanged in spirit from ADR-008; revised so IG is **off by default** and the free lanes carry the DB.

```
   BullMQ repeatable jobs (existing Redis)
        │
        ├─ ElectronicsScanWorker → X-cite/Blink/Eureka   (our httpGet, $0)  [ON]
        ├─ FoodScanWorker        → Talabat JSON           (our httpGet, $0)  [ON]
        ├─ RealEstateScanWorker  → portals q84sale/Boshamlan (our httpGet,$0)[ON]
        └─ IgScanWorker          → social lane            (Apify, $)   [OFF by default]
        │        all reuse existing ProviderAdapter.discover()/fetch()/extract()  (UNCHANGED)
        ▼
   NORMALIZE → CATEGORIZE → DEDUP (content_hash)
        ▼
   cached_offers (NEW)  +  offer_history (reuse)  +  tracked_accounts (reuse, +last_pull_at)
        ▼
   SEARCH_SOURCE = live (default) | db | hybrid   ← single seam at resolveOffers() (search.service.ts:314)
        ▼
   /search/answer (UNCHANGED)
```

- **Scan workers reuse `ProviderAdapter` as-is** — the only difference from live is the caller (scheduled writer to a durable store vs request handler to short-TTL cache). No adapter changes.
- **`cached_offers`** (new) — same shape as ADR-008 §2b: `sector, provider_id, source_tier, sku_id|dish_key|listing_key, title, price_fils NULL, old_price_fils NULL, currency, area|tenure|rooms (RE slots), deeplink, permalink NULL, posted_at NULL, category, subcategory, content_hash, scanned_at, ttl_expires_at, is_stale; UNIQUE(provider_id, content_hash)`. Money = integer **fils** (ADR-001). Truthfulness guards unchanged (price null unless literal token; permalink/posted_at verbatim).
- **Reuse `offer_history`** (append-only price asset) and **`tracked_accounts`** (+`last_pull_at` for IG deltas).
- **`SEARCH_SOURCE` flag** (default **live**): `db` → `DbOfferReader` (same signature as live resolver); `hybrid` → read DB, fall back to live on a category miss (covers ADR-007 long tail). **Shadow until validated.**
- **Staleness/TTL:** `ttl_expires_at = scanned_at + sectorTTL` (electronics 60 min, food 30 min, IG 12 h — IG posts static). Past TTL → row served **labelled stale** (truthfulness), refreshed next scan. Monitor alerts if a lane's newest `scanned_at` > 2× cadence (worker down).
- **Dedup:** `content_hash = hash(provider_id + normalized_title + price_fils + permalink|deeplink)`; re-scans upsert. Cross-provider grouping reuses SKU-group / dish-key / area-key (moves grouping off the hot path — a win).
- **IG worker, IF enabled (Option C):** `onlyPostsNewerThan = account.last_pull_at`, update `last_pull_at` on success, monthly result cap + per-account/global kill-switch. **`SOCIAL_PROVIDER=mock` default** (dev needs no key/spend).

`.env` additions: `SEARCH_SOURCE=live`, `SCAN_ELECTRONICS_CRON`, `SCAN_FOOD_CRON`, `SCAN_RE_CRON`, `SCAN_IG_ENABLED=false` (default off), `SCAN_IG_DELTA_PER_DAY`, plus existing `SOCIAL_PROVIDER=mock`, `SOCIAL_MONTHLY_RESULT_CAP`.

---

## 4. Cost table — monthly $ under the no-pay directive

| Lane | Acquisition | **Monthly $ (no-pay path)** | $0 achievable? | Tradeoff if $0 |
|---|---|---|---|---|
| **Electronics** | Self-scrape (our `httpGet`) | **$0** | ✅ Yes | None |
| **Food — Talabat** | Self-scrape (our `httpGet`) | **$0** | ✅ Yes | None |
| **RE — portals** | Self-scrape (our `httpGet`) | **$0** | ✅ Yes | None (portal adapters TBD) |
| **Claude extraction (elec/food/RE)** | Deterministic, no Claude | **$0** | ✅ Yes | None |
| **IG — Option A (drop from scan)** | — | **$0** | ✅ Yes | Lose food IG-only long tail (best-effort live or out-of-scope) |
| **IG — Option B (self-scrape)** | Playwright + account + **residential proxies** | **~$50–300+** + account churn + eng | ❌ **No** | "Free" is false; fragile + worst legal |
| **IG — Option C (minimal delta-Apify, food-only, capped)** | Apify | **~$10–30** | ❌ No | Cheapest *viable* IG coverage |
| **IG — Option D (opt-in Graph API)** | Official API | **$0** | ✅ Yes | Only consenting accounts (small at MVP) |
| **Infra (Redis/BullMQ/Postgres)** | Already paid (ADR-001/004) | **$0 marginal** | ✅ Yes | None |

**Where $0 is achievable:** electronics, Talabat food, RE portals, Claude (deterministic), opt-in IG (D), and infra — i.e. **the entire search mechanism except the arbitrary-IG long tail.**

**Where IG forces a tradeoff:** to cover the **arbitrary (non-consenting) IG-only food long tail in the DB**, you either accept ~$10–30/mo (Option C, cheapest viable) or accept the fragility+cost of self-scraping (Option B, *not* free). The only $0 IG path (D) covers just opt-in accounts.

---

## 5. Trade-offs (DB self-scrape vs live) — unchanged from ADR-008 §3

DB pre-scan wins on **latency + stability + grouping-off-hot-path** for a bounded top-N; loses on **freshness** (stale between scans) and **long-tail coverage** (only what was scanned). End state = **`SEARCH_SOURCE=hybrid`** (DB for top-N hits, live for the ADR-007 long tail), **not** DB-only. Pure DB-only re-creates the catalog-wall failure mode — rejected as an end state.

---

## 6. Buildable SHADOW slices (for bo-dev-lead)

**Invariant:** `SEARCH_SOURCE` defaults `live`; IG scan defaults OFF (`SCAN_IG_ENABLED=false`). No change to search/intent/clarifier/ranking. Flag flips only after S5 + PO sign-off.

- **S0 — Scheduler infra.** BullMQ + `scheduler` module on existing Redis; one no-op repeatable job proving fire + retry + dashboard. `.env` flags. *No live impact.*
- **S1 — `cached_offers` store + `offer_history` reuse + categorize/dedup helpers.** Migration + repo with upsert-on-`content_hash`. Unit-tested. *No live impact.*
- **S2 — ElectronicsScanWorker (FIRST, $0).** Reuse X-cite/Blink/Eureka; scan top-~100 handles; write `cached_offers` + `offer_history`; TTL/staleness. Proves the whole pattern at $0. *No live impact.*
- **S3 — FoodScanWorker (Talabat) + RealEstateScanWorker (portals), both $0.** Reuse Talabat JSON + portal adapters; categorize; dedup. (Portal RE adapters partly TBD — dependency flag.) *No live impact.*
- **S4 — IG lane DECISION GATE (default OFF).** Do **not** build IG scan until the PO picks an option:
  - If **A (drop):** skip — no IG scan worker; food IG long tail stays best-effort live or out-of-scope. **$0.**
  - If **C (minimal delta-Apify):** build IgScanWorker reusing `social-ingest.adapter` + `apify-social-provider` + `tracked-accounts.store`; `SOCIAL_PROVIDER=mock` default; pass `onlyPostsNewerThan=last_pull_at`; enforce monthly cap + kill-switch; **prove delta math against the cap before any real-key run.** Food accounts only, low cadence.
  - **Never B (self-scrape)** without explicit PO sign-off on proxy budget + legal — and even then, prefer C.
- **S5 — `DbOfferReader` + flag binding + shadow diff.** Reader with live signature; bind on `SEARCH_SOURCE`. Run a query set through `db` and `live`, diff coverage/freshness/latency incl. ADR-007 long-tail cases (off-catalog SKU, unseen area, unseen dish). Report to PO. Flag stays `live` until approved.
- **S6 (later) — `SEARCH_SOURCE=hybrid`** read-DB-then-live-fallback. After S5 shows where DB beats live.

**Order rationale:** S0–S3 deliver the **entire $0 self-scrape backbone** before any IG spend is even considered. S4 is a gate, not a default build. S5 makes the live-vs-DB comparison; the flag never flips silently.

---

## 7. Cost / risk flags for the PO

- **No-pay search is achievable for the backbone:** electronics + Talabat + RE portals + Claude + infra = **$0 marginal.** **(GREEN.)**
- **IG cannot be made truly free at scale.** Self-scraping IG needs **residential proxies ($50–300+/mo) + account churn + perpetual maintenance** and carries the **worst ToS posture** — it is *not* the free option despite the intuition. **(HIGH-flag; correct the "self-scrape = free" assumption.)**
- **Cheapest viable IG coverage = minimal delta-Apify (~$10–30/mo)**, not self-scrape. Only spend it if the PO judges the **food IG-only long tail** essential. Otherwise **Option A ($0)** is the recommended default. **(Decision for PO.)**
- **Opt-in Graph API (D)** is the only $0 *and* clean IG path — build it in parallel as the long-term answer; it won't carry MVP coverage alone.
- **Self-scraping is heavier ToS than live-on-demand or vendor-mediated** (we'd operate the violating automation, and pre-scan grows our standing footprint). Mark for counsel; gate `tos_reviewed=false`, internal-only. **(HIGH legal flag for B; MED for the rest, unchanged.)**
- **Staleness** is the inherent trade for DB speed — label on cards, never hide. **(MED.)**
- **No new infra** beyond BullMQ-on-existing-Redis + one table. Infra cost flat. **(GREEN.)**

---

## Handoff
- **Done:** ADR-008b written (`team/architecture/ADR-008b-no-pay-self-scrape-prescan.md`), revising ADR-008 under the owner no-pay directive. Verified in code that X-cite/Blink/Talabat self-fetch via our own `httpGet` ($0), and that the social lane is the only one delegating acquisition to a paid provider. Honest IG self-scrape assessment included (proxies + bans + maintenance). Memory updated.
- **No-pay verdict per lane:** **Electronics $0 ✅ · Talabat food $0 ✅ · RE portals $0 ✅ · Claude extraction $0 ✅ · Infra $0 marginal ✅.** Only **Instagram** resists $0.
- **IG recommendation (cheapest viable):** **Default = Option A: drop IG from the scheduled scan ($0)** — RE is covered by free portals, food by free Talabat; the food IG-only long tail degrades to best-effort live or out-of-scope-and-labelled. **If the PO wants the food IG long tail in the DB, use Option C: minimal delta-Apify, food-only, capped (~$10–30/mo)** — this is CHEAPER and far LESS fragile than self-scraping (Option B), which needs residential proxies ($50–300+/mo) + account churn + perpetual maintenance and is the worst legal posture, so **self-scrape IG is NOT the free option and is not recommended.** Build **Option D (opt-in Graph API, $0, clean)** in parallel as the long-term path.
- **Shadow build slices (Dev Lead):** S0 BullMQ scheduler → S1 `cached_offers`+history+dedup → S2 ElectronicsScanWorker ($0, first) → S3 Food/RE scan workers ($0) → **S4 IG = DECISION GATE (default OFF; build only if PO picks Option C, delta+cap+mock-default; never Option B without proxy-budget+legal sign-off)** → S5 `DbOfferReader`+`SEARCH_SOURCE` flag+shadow diff vs live (incl. ADR-007 long-tail) → S6 (later) `hybrid`. Flag defaults `live`; flips only after S5 + PO sign-off.
- **Owner:** PO to (1) confirm the $0 self-scrape backbone proceeds to shadow build, (2) choose the IG option (A drop=$0 default / C minimal-Apify ~$10–30 / D opt-in $0 long-term), (3) note self-scrape-IG is NOT free and is not recommended, (4) acknowledge ToS posture for self-scrape/pre-scan (counsel). bo-dev-lead owns S0–S6 once approved.
- **Blockers/risks:** "self-scrape IG = free" is a false assumption — proxies cost money (HIGH, corrected here) · Meta ToS heaviest if we self-scrape (HIGH, gated) · portal RE adapters not all built (flag, S3 dep) · staleness vs live (MED, label) · IG long-tail coverage only $0 via opt-in (D), which is small at MVP.
