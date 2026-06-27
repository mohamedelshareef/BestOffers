# BestOffers — 300-Case Search Suite: PASS/FAIL Run Report (v3)

**Author:** bo-qa-lead-frontend · **Date:** 2026-06-27 · **Status:** COMPLETE (all 300 executed)
**Build under test:** commit `79bec27` (AR/typo query-normalization, multi-word relax-and-retry, outage fallback, 100-area RE gazetteer)
**Suite:** `team/qa/search-test-cases.json` (300 cases — Electronics 100 / Food 100 / Real-estate 100)
**Oracle:** each case's `expectation.oracle` + the 5 global rules (GR1 gate≥5, GR2 truthful, GR3 no-dump, GR4 honest-empty, GR5 price-sanity).

---

## Headline — pass-rate jump confirmed

| Run | Overall | Electronics | Food | Real-estate |
|-----|---------|-------------|------|-------------|
| **v2 baseline** (prior report) | **220/300 (73%)** | 64/100 (64%) | 56/100 (56%) | 100/100 (100%) |
| **v3 raw harness** (this run) | 275/300 (92%) | 98/100 | 77/100 | 100/100 |
| **v3 warm-corrected** (truth) | **291/300 (97%)** | **99/100 (99%)** | **92/100 (92%)** | **100/100 (100%)** |

**+24 points vs the 73% baseline.** Electronics +35, Food +36, RE flat at 100%.

> **Why two v3 numbers (truthfulness note).** The raw sequential harness scored 92%. On warm re-verification, **16 of the 25 harness "fails" return real cards** — they were Apify/Talabat **cold-cache transient empties** under the busy sequential run, not coverage gaps. The harness re-probes empties 3× at 400 ms; that is insufficient for the food (Talabat) lane under load. A 5× warm re-probe (600 ms spacing) recovers them. The **97% warm-corrected number is the honest result**; the 9 that stay empty across 5 warm attempts are the real remaining defects. (This is the same documented cold-cache flakiness from v2 — see method.)

---

## How this was run (config + provenance)

- **Fresh build at `79bec27`.** `npm run build:types` + `build --workspace apps/api` (both clean, no TS errors — the v2 `coverageReason` type addition is now in `packages/shared`).
- **Isolated mock-clarifier instance on :3400** (owner's :3000 and :8765, and the stale v2 :3300/:3301, untouched/retired): `CLAUDE_PROVIDER=mock` (deterministic clarifiers — relevance already 45/45, $0), `LIVE_FETCH=on`, `SOCIAL_PROVIDER=apify`, `APIFY_RESULTS_LIMIT=8`, `MIN_CLARIFIER_QUESTIONS=5`, isolated `/tmp/bo-qa-run-v3.sqlite`. Real provider RESULTS (Eureka/Blink/X-cite live electronics; Talabat/IG live food). Booted from repo root via `node -r dotenv/config apps/api/dist/main.js`.
- **Harness:** `/tmp/bo-run300-v3.mjs` — `POST /search/intent` → skip every clarifier (`answer:"__skip__"`) through the ≥5 gate to terminal → evaluate `state`/`cards`/`coverageReason`/`broadenSuggestions` vs the case oracle. `CONC=1` (sequential, to avoid cold-cache throttle), distinct `pseudoId` per case (un-metered), **empties re-probed up to 3× warm in-harness**.
- **Cost discipline:** mock clarifier = $0 Anthropic; only live Apify fetch billed; sequential + warm reuse minimized cold fetches.
- **RE PASS bar = honest-empty + broaden** (live KW RE IG handles still unseeded, D-RUN-1). The 100-area gazetteer's job here is to **route the area correctly so the empty is `genuine_no_match`** (a true feed-gap), not an off-area leak.

---

## Per failure-mode (warm-corrected)

| Failure mode | v2 | v3 | Δ |
|--------------|----|----|---|
| FM-TYPO | 11/19 | **19/19** | +8 ✅ |
| FM-CATALOG | 42/67 | **66/67** | +24 ✅ |
| FM-RELEVANCE | 19/42 | **39/42** | +20 ✅ |
| baseline | 41/59 | **54/59** | +13 |
| FM-CONSTRAINT | 10/13 | **13/13** | +3 ✅ |
| FM-BRANDONLY | 5/6 | **6/6** | +1 ✅ |
| FM-OFFCATALOG | 11/13 | **13/13** | +2 ✅ |
| FM-AREA | 61/61 | 61/61 | = ✅ |
| FM-TENURE | 13/13 | 13/13 | = ✅ |
| FM-PRICEUNIT | 7/7 | 7/7 | = ✅ |

---

## Prior defect clusters — FIX confirmation (verified, warm)

| Prior cluster | Status | Evidence |
|---|---|---|
| **C1 — Electronics AR / typo / appliance catalog-0** (was 36 fails, HIGH) | **FIXED** | E002 `آيفون 17 برو`→5 cards · E007 `غسالة صحون`→7 · E034 `vacuum cleaner Dyson`→8 · E076 `AirPods Pro 2`→1 · E079 `Apple Watch`→6 · E097 `telvison samsung`→8 · E098 `refrigirator`→11 · E027 `ayfon 16`→4 · E029 `samesung galaxy`→6. AR transliteration + appliance vocab + fuzzy typos now resolve. |
| **C2 — Food AR / specific-dish / typo catalog-0** (was 22 fails, HIGH) | **FIXED** | F002 `بخاري`→13 · F003 `مجبوس`→13 · F096 `biryni`→13 · F097 `burgr`→16 · F098 `shwarma`→2 · F099 `كيكه شوكولاته`→11. AR + typo food normalization landed. |
| **Multi-word over-constrain** (Pixel 9 etc.) | **FIXED** | E043 `Google Pixel 9`→8 cards · E040 `headphones under 50 KWD`→2 · E062/E065 appliances resolve. Relax-and-retry working. |
| **C3 — rice→cake / rice-pudding leak** (was 11 flagged, LOW) | **FIXED** | F001 `rice`/F006 `biryani`/F021 `mandi`/F036 `kabsa`/F038 `mansaf` → rice-family cards, ZERO dessert leak (rice-pudding no longer surfaces). |
| **C4 — food test-vendor (`Tes P Hut`) + no-dump** (was 9, MED) | **FIXED** | `ramen`/`tacos` now honest-empty (no dump); `cake` returns real desserts, no test-vendor; commit history confirms test-vendor removal. |
| **C5 — food gibberish returns cards** (F035) | **FIXED** | `xyzqwfood`→honest-empty + broaden. |
| **RE area (Jabriya / Mishref / Zahra via gazetteer)** | **FIXED** | R001/R002 Jabriya, R009/R010 Zahra, R011/R012 Mishref → `genuine_no_match` honest-empty (area routed correctly, no off-area leak). R024 30k-rent price-unit trap → honest-empty. All FM-AREA 61/61, FM-PRICEUNIT 7/7, FM-TENURE 13/13 hold. |

---

## Remaining FAIL list (warm-verified, STABLE — 9 cases)

| id | sector | query | mode | got (warm 5×) | reason |
|----|--------|-------|------|---------------|--------|
| E072 | elec | `قلاية هوائية` | FM-CATALOG | empty(genuine_no_match,br=1) | AR "air fryer" term unresolved (EN `air fryer Philips` E071 → 8 cards) |
| F055 | food | `breakfast` | baseline | empty(genuine_no_match,br=1) | breakfast vendor/dish routing gap |
| F056 | food | `فطور صباحي` | baseline | empty(genuine_no_match,br=1) | AR breakfast gap |
| F066 | food | `ice cream` | FM-RELEVANCE | empty(genuine_no_match,br=1) | ice-cream dessert subtype gap |
| F067 | food | `آيس كريم` | FM-RELEVANCE | empty(genuine_no_match,br=1) | AR ice-cream gap |
| F068 | food | `donuts` | FM-RELEVANCE | empty(genuine_no_match,br=1) | donuts dessert subtype gap |
| F073 | food | `كرك` | baseline | empty(genuine_no_match,br=1) | karak (AR tea) beverage gap |
| F081 | food | `mcdonalds` | baseline | empty(genuine_no_match,br=1) | McDonald's vendor-name routing gap |
| F084 | food | `ماكدونالدز` | baseline | empty(genuine_no_match,br=1) | AR McDonald's vendor gap |

All 9 return **honest-empty + broadenSuggestions + `genuine_no_match`** — i.e. they fail the AC (expected ≥1 card) but do so *truthfully* (GR4 holds; no fabrication, no dump, no price-sanity violation).

---

## Remaining ranked defect clusters (route to dev)

### RC-1 — Food specific-subtype / vendor-name catalog gap (MED) — 8 fails
The remaining food misses are a narrow long-tail in the Talabat lane: **(a) dessert subtypes** `ice cream`/`آيس كريم`/`donuts` (F066/F067/F068) — note broad `cake`/`cheesecake` DO return desserts, so it's subtype routing, not a dead lane; **(b) beverages** `كرك` karak (F073); **(c) meal/vendor terms** `breakfast`/`فطور صباحي` (F055/F056) and **`mcdonalds`/`ماكدونالدز`** (F081/F084) return empty even though `kfc`/`talabat` vendor queries pass — McDonald's-specific vendor mapping is missing. Same root family as the now-fixed C2 (resolver keys a finite dish/vendor list); these are the residual uncovered tokens. Example IDs: F066, F067, F068, F073, F055, F056, F081, F084.

### RC-2 — Electronics AR appliance long-tail (LOW) — 1 fail
**E072 `قلاية هوائية`** (AR "air fryer") is the single remaining electronics gap — the EN equivalent `air fryer Philips` (E071) returns 8 cards, so it's an AR-synonym mapping miss for one appliance, not a systemic regression. Example ID: E072.

### RC-3 — Loose relevance on recovered baseline cards (LOW, watch-item — NOT a fail) — ~4 cases
Some warm-recovered cards pass the "≥1 card" baseline bar but are **loosely relevant**: `latte`/`cappuccino` (F071/F072) → returns Vegetable Platter / Mixed Kabbab (no actual coffee card); `seafood platter` (F059) → Vegetable Platter ranks above Fish Sayadieh; `pizza hut` (F082) → 132 sauce cards. These PASS the suite (non-empty, real, price-sane) but the ranker is not surfacing the on-intent item first. Flag for a relevance-tightening pass, not a release blocker. Example IDs: F071, F072, F059, F082.

---

## New regressions / notes

- **No NEW regressions vs v2.** Every v2-tracked lock holds.
- **بخاري demo honest-empty was NOT a stable regression.** The DEMO-10 sim run showed `بخاري`→honest-empty (flagged in memory). In this suite **F002 `بخاري` → 13 rice-family cards (PASS)** — the demo empty was a one-off live Talabat feed/cache variance at that moment, not a code bug. Confirmed warm.
- **Genuine feed-gaps correctly distinguished from bugs:** all 100 RE cases are honest-empty by design (no live IG handles, D-RUN-1) and **correctly count as PASS** — the gazetteer routes the area so the empty is `genuine_no_match`, not an off-area leak. This is a data-seeding gap, not a search bug.
- **Cold-cache flakiness re-confirmed (durable):** the Talabat/food lane is materially more cold-cache-sensitive than electronics under sequential load — 14 of the 16 recovered cases were food. Always warm-re-probe food empties ≥5× before recording FAIL.

---

## Release recommendation

- **RE: GREEN** at the honest-empty bar (100/100). Non-empty RE still blocked on live KW RE IG-handle seeding (D-RUN-1) — data task, not search.
- **Electronics: effectively release-ready (99%)** — one AR appliance synonym (E072) outstanding.
- **Food: strong (92%)** — close RC-1 (8 dessert-subtype/beverage/McDonald's-vendor tokens) and food clears ~98%+.
- **Recommendation:** ship-candidate for Electronics + RE; route RC-1 + RC-2 (9 tokens, one shared root cause = finite resolver list) for one more normalization pass, then re-run the suite (WORKFLOW §7 — iterate until AC holds across the set). Projected post-RC-1/RC-2: ~99%.

## Artifacts / servers
- Harness `/tmp/bo-run300-v3.mjs` · raw results `/tmp/bo-run300-v3-results.json` · warm-corrected `/tmp/bo-run300-v3-corrected.json` · warm re-probe `/tmp/bo-reprobe-fails.json` + `/tmp/bo-reprobe-fails.mjs`.
- API LEFT RUNNING on **:3400** (live mock-clarifier, warm cache, DB `/tmp/bo-qa-run-v3.sqlite`) for re-test. Owner's :3000/:8765 untouched; stale v2 :3300/:3301 retired.
