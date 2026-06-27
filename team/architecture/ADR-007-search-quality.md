# ADR-007 — Search Quality: Systemic Diagnosis & Remediation

Status: PROPOSED (owner-escalated 2026-06-27)
Author: bo-tech-architect
Supersedes/extends: ADR-003 (live-fetch), ADR-005 (food), ADR-006 (Instagram)
Trigger: OWNER ESCALATION — AI search unreliable across categories. Live failures:
- ELECTRONICS: "Dish washing Machine" → **0 results**.
- REAL ESTATE: "Flat in Jabriya" → returned Al-Zahra/Al-Shuhada (wrong area) + 400,000 KWD "rent" (sale price as rent).
- FOOD: rice → cake (patched, but the pattern is brittle hand-tables).

Every claim below is tagged **VERIFIED** (read in the actual code) or **ASSUMED** (judgment).

---

## 1. Root cause per layer (evidence-based)

### 1.1 ELECTRONICS — the empty-results root cause is an in-code catalog, NOT discovery reach

**VERIFIED.** The electronics lane is gated entirely on a hand-written SKU catalog. Trace:

- `OffersService.resolveOffers` (electronics branch) → `resolveForSkus(intent, this.matchSkus(intent))`
  (`apps/api/src/offers/offers.service.ts:103`).
- `matchSkus` filters **`MOCK_SKUS`** by category/brand/model substring (`offers.service.ts:166-173`).
- `MOCK_SKUS` (`mock-offers.dataset.ts:31-176`) contains **16 SKUs, all phones/laptops**: iPhone 16/17, Galaxy S25, MacBook Air M4, Dell XPS 13. **No appliances, TVs, audio, gaming — nothing outside phones/laptops.**
- `resolveForSkus` short-circuits: `if (skus.length === 0) return []` (`offers.service.ts:131`).

So "Dish washing Machine" → `matchSkus` returns `[]` → `resolveForSkus` returns `[]` → `runSearch` sees `resolved.length === 0` → empty state (`search.service.ts:320`). **The live providers are never consulted for it.**

**The deeper structural bug:** even where SKUs exist, the live layer can only ever return offers that map back to a candidate SKU. `LiveOfferResolver.resolve(intent, skus)` is called WITH the candidate SKU list (`offers.service.ts:145`), and `LiveOfferResolver.toOffers` **drops any discovered product that doesn't match a candidate SKU** — `if (!sku) continue;` (`live-resolver.ts:120`). Discovery query text itself is derived from the candidate SKUs (`live-resolver.queryText`, `live-resolver.ts:154-159`).

**Net:** Blink (`/search/suggest.json`, `blink.adapter.ts:34-55`) and Eureka (Algolia index, `eureka.adapter.ts:51-76`) have **real catalog search** — but it is dead weight for any term not already in `MOCK_SKUS`, because (a) the lane never reaches them when `matchSkus` is empty, and (b) even when reached, `matchSku` discards non-catalog hits. X-cite is worse: it has **no search at all** — a 4-entry hand-typed `knownUrls` map of iPhone slugs (`xcite.adapter.ts:43-48`). The architect memory's own note "X-cite discovery route (sitemap vs `/search`) → confirm in Slice A spike" was never closed; it shipped as a hand-list.

**Verdict:** the "small hand-listed URL/SKU set" hypothesis in the escalation is **correct, and it's worse than just X-cite** — the whole electronics lane is catalog-bound. Real search exists in 2 of 3 adapters but is architecturally bypassed.

### 1.2 MATCHING / RELEVANCE — hand-maintained lexical+synonym tables that don't generalize

**VERIFIED.**

- **Food** (`food-relevance.ts`): a curated `SYNONYM_GROUPS` table (~16 groups, `:34-58`) + `STOP_WORDS` + `CONDIMENT_RE`. It works for the seeded domains (rice/biryani/burger/pizza…). **Breaks on:** any dish family not in the table (sushi, tacos, ramen, manakish, falafel, etc. — absent) → `expandFoodQuery` finds no group, `matchedGroup=false`, and for an unrecognized term it returns provider order capped at 24 (`:229-230`) i.e. **random restaurants, not the dish**. Cross-lingual coverage is only as good as the hand-typed AR list per group; a transliteration variant not listed (e.g. "machbous" spelling drift, dialectal forms) silently misses.
- **Real estate** (`realestate-relevance.ts`): `AREA_GROUPS` is **12 hand-listed areas** (VERIFIED via count). Kuwait has ~60+ residential areas. "Jabriya" IS in the table — but **Al-Zahra, Al-Shuhada, Bayan, Mishref, Rumaithiya, Sabah Al-Salem, Qadsiya, Adailiya…are NOT.** Consequence chain (`realestate-relevance.ts:184-216`):
  - When the query names a known area, the filter keeps only flats whose `detectOfferArea` resolves to that canonical area, else returns `[]`.
  - A flat whose caption area is **not in the 12 groups** → `detectOfferArea` returns `null` → it is dropped when an area is asked. So an unlisted-area flat can't *pass* the asked-area filter — meaning the **live "Al-Zahra returned for Jabriya" symptom is most consistent with the filter NOT having been applied to that run** (ASSUMED: live failure predates the area filter, which is dated today 2026-06-27) **OR** the query area itself ("Jabriya") matched while off-area flats leaked through a path that bypassed `filterFlatsByQuery`. The structural fragility is the same regardless: **a 12-area allow-list cannot adjudicate a 60-area city.** Any query in an unlisted area → `detectQueryAreas` empty → `return items` unfiltered (`:195`) → **every area surfaces** (exactly the reported symptom class).

**Verdict:** hand synonym/area tables are a per-bug patch treadmill. Each new failure ("bukhari", "mansaf", "Chilled with rice" — all visible as dated patches in the file headers) added a table row. This does not scale and is the structural cause of the cross-category brittleness.

### 1.3 REAL ESTATE specifics — tenure & price-unit

**VERIFIED — and largely already fixed in code, recently.** The tenure + rent-sanity guards exist and are wired:

- Extractor distinguishes rent/sale + `priceUnit` (month/total) and the RE tool prompt explicitly flags "100,000+ KWD is a SALE, not a monthly rent" (`anthropic-social-extractor.ts:119-150`).
- Ingest adapter (`social-ingest.adapter.ts:124-148`): resolves tenure (explicit → caption marker → price-magnitude inference), and **if a flat is treated as rent but the price is out-of-band (> 3,000 KWD/mo), it reclassifies to sale and drops the absurd number to "price on request"** (`:132-136`). Bands: `SANE_RENT_MIN/MAX = 50 / 3,000 KWD`, `SALE_PRICE_FLOOR = 10,000 KWD` (`realestate-relevance.ts:46-51`).
- Resolver applies `filterFlatsByQuery` (tenure + area) for the RE sector (`social-resolver.ts:59-66`).

**ASSUMED:** the "400,000 KWD rent" live failure predates these guards (the guard files are dated 2026-06-27, same day as this escalation). **Residual real gaps:** (a) there is **no `rent` vs `sale` clarifier dimension feeding `opts.tenure`** — tenure is inferred only from the raw query text/price, so a query like "Flat in Jabriya" with no tenure word is tenure-`null` and a sale flat can still appear next to rent flats; (b) price-unit sanity relies on the extractor reading the caption correctly — there is no second numeric cross-check against area-typical rent ranges.

### 1.4 QUERY UNDERSTANDING — Claude intent is thin and barely feeds discovery

**VERIFIED.** `clarify` (intent normalization) emits only `{category, brand, model, constraints}` (`anthropic-claude-client.ts:106-118, 165-168`). There is **no structured slot for RE (`area`, `tenure`, `rooms`) or food (`dish`, `cuisine`)** in the normalized intent. The RE/food lanes recover the query by stuffing the **raw text** into `intent.model` via `pinIntentToSector` (`search.service.ts:532-539`) and re-parsing it downstream with the hand tables. So Claude's understanding is **not** driving discovery or filtering for the two sectors that fail most — the deterministic hand-tables are, on raw text. For electronics, the normalized `model` feeds `matchSkus` against the mock catalog (so understanding is fine, but the catalog is the wall).

**Verdict:** intent normalization is correct but under-specified; its output is largely discarded for RE/food, and for electronics it only ever queries a 16-item catalog.

### Ranked root causes
1. **Electronics has no real catalog discovery** — lane is bound to a 16-item in-code mock; live search exists but is architecturally bypassed. (Cause of all electronics empties.) **HIGHEST IMPACT.**
2. **Relevance is hand-table lexical matching** — food synonyms (~16 groups) + RE areas (12) don't generalize; every miss is a new table row. (Cause of cross-category brittleness + RE wrong-area.)
3. **RE tenure is inferred, not asked** — no rent/sale clarifier; null-tenure queries mix sale & rent. (price-sanity already guarded; area coverage is the live hole.)
4. **Intent has no per-sector structured slots** — RE/food discovery runs on raw text + hand tables, not on Claude's understanding.

---

## 2. Recommended architecture (pragmatic, buildable)

Guiding principle (YAGNI + ADR-003 spine unchanged): **replace the catalog wall with real per-provider search; replace hand-tables with normalization-first + a thin embeddings assist; make RE tenure explicit.** No new infra beyond what ADR-001/004 already provision (Postgres + Redis; embeddings via the Anthropic-adjacent or pgvector path).

### 2.1 Electronics — catalog-free discovery (the big fix)
Decouple discovery from `MOCK_SKUS`. New flow for the electronics sector:

```
intent.model/brand  →  per-provider SEARCH (Blink suggest.json, Eureka Algolia, X-cite sitemap/search)
                     →  NormalizedOffer[] straight from each provider's OWN result set
                     →  SYNTHESIZE a Sku per discovered product (same move FoodOfferResolver/Social already use)
                     →  cross-provider SKU-grouping (pg_trgm Tier-3, ADR-001) to merge "same product"
                     →  rank + cards
```

- **Blink:** already has `discover()` via `suggest.json` — just call it with the query text directly (works today). **VERIFIED capability.**
- **Eureka:** already has Algolia search — call directly. **VERIFIED capability.**
- **X-cite:** replace the 4-entry `knownUrls` hand-list with **sitemap-based discovery** (`sitemap-pdps-*.xml`, already noted as the Slice-B plan in the adapter comment) or its on-site search endpoint. **ASSUMED feasible** — needs a 30-min spike to confirm the sitemap path parses to `/p` slugs (the adapter author already scoped it). Until confirmed, Blink+Eureka alone unblock the category.
- **Stop dropping non-catalog hits:** `LiveOfferResolver` must synthesize SKUs from discovered products (like `FoodOfferResolver.toResolved`/`social-resolver.toResolved` do) instead of requiring a pre-existing candidate SKU. `MOCK_SKUS` becomes a **test fixture only** (gated by `LIVE_FETCH=off`), not a discovery gate.

**Trade-off:** synthesized SKUs lose the curated cross-provider grouping the mock gave for free → use pg_trgm grouping (ADR-001 Tier-3, conservative threshold; below-threshold = leave ungrouped, show as separate cards). This is the SKU-grouping work already designed, now load-bearing. Cost: more Claude-free deterministic work; no token cost. Risk: grouping false-positives (wrong price compare) — mitigate with the conservative threshold already specified.

### 2.2 Matching — normalization-first, embeddings-assisted (retire hand-tables as the primary)
Two-stage, cheapest-first:

1. **Deterministic normalization** (keep, it's free and correct): the existing `normalizeFoodText`/`normalizeAreaText` (diacritic strip, alef/ya/ta-marbuta unify) stay as the first pass.
2. **Semantic match for the long tail** (NEW, replaces the synonym/area hand-tables as the *fallback authority*): precompute embeddings for a **canonical KW vocabulary** — (a) a dish-family lexicon, (b) the **full Kuwait area gazetteer (~60 areas, AR+EN)** — and match query/offer terms by cosine similarity above a threshold. Store vectors in **pgvector on the existing Supabase Postgres** (ADR-004) — no new infra.
   - This makes "sushi"/"Al-Zahra"/"Mishref" work without a code change, and AR↔EN/dialect variants resolve by proximity, not by a hand-typed alias row.
   - **Keep the hand-tables as a fast-path cache** for the top ~20 high-frequency terms (zero-latency exact hits); fall through to embeddings for the tail.

**Trade-off:** embeddings add a one-time precompute + a per-query vector lookup (~ms on pgvector with an index). Cost is tiny (a fixed gazetteer/lexicon embedded once; query terms are short). **ASSUMED**: pgvector available on Supabase Pro (it is, as an extension) — confirm enabled. Alternative if we want zero new dependency: ship a **complete static Kuwait area gazetteer** (~60 areas, AR+EN aliases) as the immediate RE fix and defer embeddings — this alone closes the reported RE area bug at near-zero risk. **Recommended sequencing: gazetteer NOW, embeddings as the durable generalization.**

### 2.3 RE tenure + price-sanity
- **Add a `tenure` (rent | sale) clarifier dimension** to the RE clarifier set (`clarifier-sets.ts`) so `opts.tenure` is explicit, not inferred. Feeds `filterFlatsByQuery({tenure})` which already exists.
- Keep the existing price-magnitude inference + rent-sanity band as defense-in-depth (already in `social-ingest.adapter.ts` — VERIFIED).
- **ASSUMED enhancement:** per-area rent reasonableness (a 2BR in area X typically Y–Z KWD) is a later slice; the absolute band (50–3,000) already kills the 400k-as-rent class.

### 2.4 Coverage / empty-state policy (truthful)
- An empty result must distinguish **"no provider covers this"** (e.g. electronics category we don't index) from **"providers searched, nothing matched"**. The empty-state already gives broaden controls (`search.service.ts:320-350`) — extend the `empty_empty` event payload with a `coverage_reason` so we can SEE which categories are systematically empty (today's silent failure).
- For electronics, define an explicit **covered-category list**; an out-of-coverage query returns a truthful "we don't compare {category} yet" instead of a generic empty.

---

## 3. Prioritized remediation plan (sliced for bo-dev-lead)

Highest-impact first. Each slice is independently shippable behind the unchanged `ProviderAdapter`/`resolveOffers` spine.

**SLICE Q1 — Electronics: real catalog discovery (replaces the mock-SKU wall). [HIGHEST]**
- Change the electronics lane to **discover via Blink `suggest.json` + Eureka Algolia directly from `intent.model`/raw text**, not from `matchSkus(MOCK_SKUS)`.
- `LiveOfferResolver`: synthesize a `Sku` per discovered product (mirror `FoodOfferResolver.toResolved`); stop requiring a pre-existing candidate SKU in `toOffers`/`matchSku`.
- Add cross-provider pg_trgm SKU-grouping (conservative threshold) to merge same-product cards; ungrouped = separate cards.
- `MOCK_SKUS` → test fixture only (`LIVE_FETCH=off`).
- **DoD:** "Dish washing Machine", "Samsung TV", "AirPods" return real Blink/Eureka offers (or a truthful "not covered" if neither provider stocks it) — not a blanket 0.
- Spec to add: an electronics query for a non-phone/laptop term returns ≥1 live offer when the provider search returns hits.

**SLICE Q2 — X-cite real discovery (sitemap/search). [HIGH, after Q1]**
- 30-min spike: confirm `sitemap-pdps-*.xml` → `/p` slugs, OR an on-site search endpoint. Replace the 4-entry `knownUrls`.
- **DoD:** X-cite contributes offers for arbitrary in-catalog queries; falls back gracefully (healthy-empty) when a slug is stale. If the spike fails, X-cite stays Blink+Eureka-backed and we flag it.

**SLICE Q3 — RE: full Kuwait area gazetteer + tenure clarifier. [HIGH]**
- Expand `AREA_GROUPS` from 12 to a **complete ~60-area KW gazetteer (AR+EN aliases)** — sourced from a real KW area list, reviewed by a native speaker (hand off the list build to bo-researcher/BA).
- Add a `tenure` (rent | sale) clarifier dimension to the RE set; wire `opts.tenure` into `filterFlatsByQuery`.
- **DoD:** "Flat in Jabriya" returns only Jabriya (or nearby-tagged) flats; an unlisted-but-real area (Al-Zahra, Mishref) resolves; a sale flat never appears under a rent query.
- Spec: assert area precision for ≥6 areas incl. ones NOT in the original 12; assert tenure filtering both directions.

**SLICE Q4 — Embeddings-assisted matching (durable generalization). [MEDIUM]**
- Enable pgvector on Supabase; embed the dish-family lexicon + area gazetteer once; query-time cosine match above threshold as the fallback authority behind the hand-tables.
- **DoD:** an unseen dish ("sushi", "ramen") and an unseen-but-real area route correctly with no code/table edit; latency within the ~6s query budget (vector lookup is sub-ms).
- **Trade-off flagged:** if the PO prefers zero new extension, Q3's gazetteer + a broader static synonym list defers this — but the hand-table treadmill returns. Recommend doing Q4.

**SLICE Q5 — Coverage telemetry + truthful empty-state. [LOW, cross-cutting]**
- Add `coverage_reason` to `empty_empty`; define electronics covered-category list; surface "we don't compare {category} yet" vs generic empty.
- **DoD:** dashboards can distinguish out-of-coverage from no-match; no silent category-wide zeroes.

### Cost / risk summary
- **Q1/Q2/Q3** = no new infra, no new token cost (deterministic provider search + a bigger static gazetteer). Risk: scraper fragility (already mitigated by health/kill-switch, ADR-003 §5) + pg_trgm grouping false-positives (conservative threshold).
- **Q4** = pgvector (free Supabase extension) + a one-time embed of a small fixed vocabulary (~cents) + sub-ms per-query lookup. Risk: threshold tuning.
- **Legal unchanged:** Blink/Eureka are the lowest-risk leads (ADR-003); X-cite sitemap is a read of a public sitemap. No new exposure beyond ADR-003's pending counsel review.

---

## Handoff
- **Done:** Systemic diagnosis (VERIFIED against the actual code). Ranked root causes: (1) electronics lane is bound to a 16-item in-code `MOCK_SKUS` catalog — real Blink/Eureka search exists but is architecturally bypassed; even reached, `LiveOfferResolver.toOffers` drops non-catalog hits (`offers.service.ts:103/131/166`, `live-resolver.ts:120`); X-cite has only a 4-entry hand-list (`xcite.adapter.ts:43`). (2) Relevance = hand-tables: food ~16 synonym groups, RE **12** hand-listed areas (VERIFIED) vs ~60 real KW areas → unseen dish/area = wrong or empty results. (3) RE tenure is inferred not asked (price-sanity + tenure-from-magnitude guards already shipped in `social-ingest.adapter.ts` — VERIFIED; the 400k-rent failure predates them). (4) Claude intent has no per-sector structured slots; RE/food run on raw text + hand-tables.
- **Recommended fix:** catalog-free electronics discovery (Blink/Eureka search direct + synthesized SKUs + pg_trgm grouping); full KW area gazetteer + rent/sale clarifier for RE; embeddings-assisted matching (pgvector) to retire hand-tables as the long-tail authority; coverage telemetry.
- **Build slices (ranked):** Q1 electronics real discovery [HIGHEST] → Q2 X-cite sitemap/search → Q3 RE gazetteer+tenure clarifier → Q4 embeddings matching → Q5 coverage/empty-state telemetry. Q1–Q3 = no new infra/token cost.
- **Next:** PO to route Q1+Q3 to bo-dev-lead now (highest impact, no infra); bo-researcher/BA to build the ~60-area KW gazetteer list (AR+EN, native-reviewed) for Q3; confirm pgvector enabled on Supabase for Q4. Owner to confirm: is electronics MVP scope still phones/laptops only, or full-catalog (Q1 assumes full-catalog discovery is wanted).
- **Owner:** bo-dev-lead (Q1/Q2/Q3 build); bo-researcher+BA (KW area gazetteer); bo-tech-architect (Q4 pgvector design, X-cite spike review).
- **Blockers/risks:** X-cite sitemap path UNVERIFIED (Q2 spike needed) — flag as ASSUMED until spiked. pg_trgm grouping false-positives = wrong price comparison (trust-critical) — conservative threshold mandatory. Live RE/food still depend on ADR-003/006 ToS counsel sign-off (unchanged). Need PO ruling on electronics MVP coverage scope.
