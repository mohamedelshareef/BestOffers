# BestOffers — 300-Case Search Suite: PASS/FAIL Run Report

**Author:** bo-qa-lead-frontend · **Date:** 2026-06-27 · **Status:** COMPLETE (all 300 executed)
**Suite:** `team/qa/search-test-cases.json` (300 cases — Electronics 100 / Food 100 / Real-estate 100)
**Oracle:** each case's `expectation.oracle` + the 5 global rules (GR1 gate≥5, GR2 truthful, GR3 no-dump, GR4 honest-empty, GR5 price-sanity).

## How this was run (config + provenance)

- **Fresh build first.** The repo had uncommitted WIP (electronics/food/RE hardening) in `offers.service.ts`, `search.service.ts`, `electronics-resolver.ts`, `food-relevance.ts` that **did not compile** — `search.service.ts:351` returns `coverageReason` on `SearchResponse`, a field absent from the shared type. The running :3000 API was therefore STALE (old code). I added the missing optional `coverageReason?` field to `packages/shared/src/domain.ts` so the API builds, rebuilt clean, and ran the **fresh** dist. (Surfaced to PO below — the dev's branch was un-buildable.)
- **Isolated mock-clarifier instance on :3300** — `CLAUDE_PROVIDER=mock` (deterministic clarifiers; relevance already 45/45), `LIVE_FETCH=on`, `SOCIAL_PROVIDER=apify`, `APIFY_RESULTS_LIMIT=8`, isolated `/tmp/bo-qa-run.sqlite`. Real provider RESULTS (Eureka/Blink/X-cite live electronics; Talabat/IG live food).
- **Harness:** `POST /search/intent` → skip every clarifier (`answer:"__skip__"`) through the ≥5 gate to terminal → evaluate `state`/`cards`/`coverageReason`/`broadenSuggestions` against the case oracle. Distinct `pseudoId` per case (un-metered).
- **Determinism caveat (IMPORTANT, VERIFIED):** live Apify is **cold-cache flaky under concurrency** — a 4-way batch produced ~10 false-empties that resolve to real cards once cached. I re-ran **sequentially with a warmed cache** and **re-probed every food/electronics empty 2–3×** to separate true coverage gaps from cache artifacts. **All 80 fails below are STABLE (reproduce warm) — zero are cache artifacts.** The numbers here are the warm/deterministic run.
- RE live IG handles are still unseeded (D-RUN-1), so the RE PASS bar = **honest-empty + broadenSuggestions** (ADR-007/F-SR1 AC-14), per locked memory.

## Overall result

**220 / 300 PASS (73%)** — warm/deterministic live run.

| Sector | Pass | Rate |
|--------|------|------|
| Electronics | 64/100 | 64% |
| Food | 56/100 | 56% |
| Real-estate | 100/100 | **100%** |

### Per failure-mode

| Failure mode | Pass | Fails |
|--------------|------|-------|
| FM-AREA | 61/61 | 0 |
| FM-TENURE | 13/13 | 0 |
| FM-PRICEUNIT | 7/7 | 0 |
| FM-CONSTRAINT | 10/13 | 3 |
| FM-BRANDONLY | 5/6 | 1 |
| FM-OFFCATALOG | 11/13 | 2 |
| FM-TYPO | 11/19 | 8 |
| baseline | 41/59 | 18 |
| FM-RELEVANCE | 19/42 | 23 |
| FM-CATALOG | 42/67 | 25 |

### Wins (verified)
- **RE sector is GREEN (100/100).** Every area-leak trap (35 KW areas, listed + unlisted), every tenure trap, and every price-unit absurd-rent trap (R024 300k, R080 500k, R081 200k) resolves correctly to **honest-empty + broaden + `coverageReason=genuine_no_match`**. No off-area leak, no >3,000-KWD "rent" card, no sale-as-rent. ADR-007 RE regression locks all hold.
- **ADR-007 electronics dishwasher headline FIXED:** E006 `Dish washing Machine` → 7 real cards (Ariston/Samsung/Bosch, real KWD prices). E008 washer, EN appliances, EN flagships all pass.
- **ADR-007 rice→cake regression FIXED:** `rice`/`biryani`/`mandi`/`kabsa`/`mansaf` return rice-family cards with **ZERO cake/cheesecake/tiramisu**. (See C3 caveat — the only dessert-adjacent leak is "Rice Pudding", a literal-rice item, not the catastrophic cake bug.)
- **Clarifier gate GR1 held on 300/300** — every case presented 5 questions before dispatch.
- **GR5 price-sanity held everywhere** — zero nonsensical prices across all sectors.

## Prioritized defect clusters (route these to dev)

> Ranked by size + severity. C1 + C2 are the same root cause across two sectors and account for **58 of 80 fails**.

### C1 — Electronics catalog-0: AR-routing + appliance + typo (HIGH) — 36 fails
Live electronics resolver returns **empty (`genuine_no_match`)** for Arabic-routed, appliance, and misspelled queries that have real provider stock. EN canonical model queries pass; **22 of 36 are Arabic**, 5 are typos.
- AR not resolving: E002 `آيفون 17 برو`, E007 `غسالة صحون`, E009 `غسالة ملابس`, E011 `تلفزيون 65 بوصة`, E015 `مكيف سبليت`, E016 `سماعات ايربودز`, E019 `بلايستيشن 5`, E020 `ايباد اير`, E022 `ميكروويف`, E025 `سامسونج`(brand), E030 `لابتوب ابل`, E033 `ساعة ذكية`, E047 `موبايل ايفون`, E049 `آيفون رخيص`, E055 `لابتوب جيمنج`, E058 `تابلت`, E060 `شاشة سامسونج 75`, E063 `ثلاجة ال جي`, E074 `مكنسة كهربائية`, E077 `سماعة بلوتوث`, E080 `ساعة ابل`, E039 `أرخص آيفون`.
- EN appliance/accessory empty (real stock exists): E014 AC, E034 vacuum, E040 headphones<50, E043 Pixel 9, E059 LG OLED TV, E062 Samsung fridge, E065 LG washer, E076 AirPods Pro 2, E079 Apple Watch.
- Typos unnormalized: E027 `ayfon 16`, E029 `samesung galaxy`, E096 `labtop dell`, E097 `telvison samsung`, E098 `refrigirator`.
- **Root cause:** the live electronics query/normalization layer covers EN flagship phone/laptop terms but not AR transliteration, appliance vocabulary, or fuzzy typos. SLICE-Q1 catalog-free discovery is partially landed (dishwasher works) but does not generalize to AR/appliance/typo.

### C2 — Food catalog-0: AR + specific-dish + typo (HIGH) — 22 fails
Same shape as C1, in the Talabat/IG lane. Stable-empty warm (verified 2× each). EN canonical terms (`rice`, `cake`, `burger`, `kfc`, `mcdonalds`, `mandi`, `kabsa`, `mansaf`, `pizza pepperoni`, `latte`) resolve; these do not:
- AR: F030 `قهوة مختصة`, F056 `فطور صباحي`, F064 `تشيز كيك`, F067 `آيس كريم`, F069 `كنافة نابلسية`, F073 `كرك`, F076 `سلطة`, F084 `ماكدونالدز`, F091 `دجاج مقلي`, F099 `كيكه شوكولاته`.
- EN specific dish/vendor: F055 breakfast, F063 cheesecake, F065 tiramisu, F066 ice cream, F068 donuts, F072 cappuccino, F075 healthy salad, F082 pizza hut, F090 fried chicken bucket.
- Typos: F096 `biryni`, F097 `burgr`, F098 `shwarma`.
- **Root cause:** Talabat resolution keys on a narrow EN dish/vendor list; AR + specific desserts + typos miss. Note `cheesecake`/`tiramisu`/`donuts` empty individually yet appear *inside* a broad `cake`/`chocolate cake` result — the dish→vendor routing is too coarse.

### C3 — Food relevance: rice-pudding leak into savory-rice queries (LOW) — 11 cases flagged
`rice`/`biryani`/`mandi`/`kabsa`/`mansaf`/`white rice with chicken` each surface **one** dessert-class card: **"Rice Pudding … Vanilla"** (`@Chicken Tikka`). This is the ONLY dessert in those result sets — **the headline rice→cake regression is FIXED** (no cake/cheesecake). Severity LOW: it is a literal-"rice" item, arguably correct, but it's a sweet pudding in a savory-rice list. IDs: F001, F002, F003, F006, F021, F036, F037, F038, F039, F042, F044.
- **Root cause:** `food-relevance.ts` rice bucket includes "rice pudding" because the token "rice" matches; needs a dessert-subtype exclusion.

### C4 — Food no-dump (GR3): beverage/test-vendor cards front-rank dessert & long-tail queries (MED) — 9 fails
`cake`/`chocolate cake` return real desserts but the **top 4 cards are "7 Up / Mirinda / Water — Tes P Hut"** (beverages + a test vendor) ranking ABOVE the desserts. Long-tail dishes (`ramen`, `tacos`) return a 24-card list dominated by the same `Tes P Hut` test-vendor noise instead of honest-empty. IDs: F026 ramen, F027 tacos, F031 وجبات دايت, F033 كنافة, F034 زبدية, F050 calzone, F057 pancakes, F058 eggs benedict, F081 mcdonalds.
- **Root cause:** (1) a **`Tes P Hut` TEST VENDOR is live in the Talabat dataset** and leaks into prod results — must be excluded; (2) beverage cards aren't down-ranked under dessert/dish intent; (3) long-tail uncovered dishes dump unrelated cards instead of honest-empty (GR3/GR4).

### C5 — Off-catalog: gibberish returns cards (MED) — 1 fail
F035 `xyzqwfood` (gibberish) returns cards instead of honest-empty — fabrication/dump risk on nonsense input (GR4). (Electronics gibberish E036/E099 correctly empty; food path does not guard.)

### C6 — Food baseline category-miss (LOW) — 1 fail
F060 `سمك مشوي` (grilled fish) returns 40 cards but no seafood/fish card surfaces — AR seafood routing miss (overlaps C2).

## Full FAIL list (`id | query | expected mode | got | reason`)

| id | query | fm | got | reason |
|----|-------|----|-----|--------|
| E002 | `آيفون 17 برو` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR iPhone unresolved |
| E007 | `غسالة صحون` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR dishwasher unresolved |
| E009 | `غسالة ملابس` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR washer unresolved |
| E011 | `تلفزيون 65 بوصة` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR TV unresolved |
| E014 | `air conditioner split unit` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN AC empty |
| E015 | `مكيف سبليت` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR AC unresolved |
| E016 | `سماعات ايربودز` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR AirPods unresolved |
| E019 | `بلايستيشن 5` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR PS5 unresolved |
| E020 | `ايباد اير` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR iPad unresolved |
| E022 | `ميكروويف` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR microwave unresolved |
| E025 | `سامسونج` | FM-BRANDONLY | empty(genuine_no_match,br=1) | catalog-0: AR brand-only Samsung |
| E027 | `ayfon 16` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| E029 | `samesung galaxy` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| E030 | `لابتوب ابل` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR MacBook unresolved |
| E033 | `ساعة ذكية` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR smartwatch unresolved |
| E034 | `vacuum cleaner Dyson` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN vacuum empty |
| E039 | `أرخص آيفون` | FM-CONSTRAINT | empty(genuine_no_match,br=1) | catalog-0: AR cheapest-iPhone empty |
| E040 | `headphones under 50 KWD` | FM-CONSTRAINT | empty(genuine_no_match,br=2) | catalog-0: EN headphones empty |
| E043 | `Google Pixel 9` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN Pixel empty |
| E047 | `موبايل ايفون` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR iPhone unresolved |
| E049 | `آيفون رخيص` | FM-CONSTRAINT | empty(genuine_no_match,br=1) | catalog-0: AR cheap iPhone empty |
| E055 | `لابتوب جيمنج` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR gaming laptop unresolved |
| E058 | `تابلت` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR tablet unresolved |
| E059 | `LG OLED 65 TV` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN LG TV empty |
| E060 | `شاشة سامسونج 75 بوصة` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR Samsung TV unresolved |
| E062 | `Samsung side by side fridge` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN fridge empty |
| E063 | `ثلاجة ال جي` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR LG fridge unresolved |
| E065 | `front load washing machine LG` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN washer empty |
| E074 | `مكنسة كهربائية` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR vacuum unresolved |
| E076 | `AirPods Pro 2` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN AirPods empty |
| E077 | `سماعة بلوتوث` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR BT audio unresolved |
| E079 | `Apple Watch Series 10` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: EN watch empty |
| E080 | `ساعة ابل` | FM-CATALOG | empty(genuine_no_match,br=1) | catalog-0: AR Apple Watch unresolved |
| E096 | `labtop dell` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| E097 | `telvison samsung` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| E098 | `refrigirator` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| F001 | `rice` | FM-RELEVANCE | 14 cards | rice-pudding dessert leaks (1) — see C3 (NOT the cake bug) |
| F002 | `بخاري` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F003 | `مجبوس` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F006 | `biryani` | baseline | 14 cards | rice-pudding leak (1) — C3 |
| F021 | `mandi` | baseline | 14 cards | rice-pudding leak (1) — C3 |
| F026 | `ramen` | FM-RELEVANCE | 24 cards | C4: test-vendor (Tes P Hut) dump, not honest-empty |
| F027 | `tacos` | FM-RELEVANCE | 24 cards | C4: test-vendor dump |
| F030 | `قهوة مختصة` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR specialty coffee empty |
| F031 | `وجبات دايت` | baseline | 24 cards | C4: test-vendor/noise dump |
| F033 | `كنافة` | FM-RELEVANCE | 24 cards | C4: dessert query → beverage/test-vendor front-rank |
| F034 | `زبدية` | FM-OFFCATALOG | 24 cards | C4: ambiguous → test-vendor dump, not honest-empty |
| F035 | `xyzqwfood` | FM-OFFCATALOG | cards returned | C5: gibberish returns cards (want honest-empty) |
| F036 | `kabsa` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F037 | `كبسة` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F038 | `mansaf` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F039 | `منسف` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F042 | `white rice with chicken` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F044 | `biryani lamb large` | FM-RELEVANCE | 14 cards | rice-pudding leak (1) — C3 |
| F050 | `calzone` | FM-RELEVANCE | 24 cards | C4: test-vendor dump, not Italian/honest-empty |
| F055 | `breakfast` | baseline | empty(genuine_no_match,br=1) | catalog-0: breakfast empty |
| F056 | `فطور صباحي` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR breakfast empty |
| F057 | `pancakes` | FM-RELEVANCE | 24 cards | C4: test-vendor dump |
| F058 | `eggs benedict` | FM-RELEVANCE | 24 cards | C4: test-vendor dump |
| F060 | `سمك مشوي` | baseline | 40 cards | C6: AR grilled-fish → no seafood card surfaces |
| F063 | `cheesecake` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: cheesecake empty (yet inside `cake`) |
| F064 | `تشيز كيك` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: AR cheesecake empty |
| F065 | `tiramisu` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: tiramisu empty |
| F066 | `ice cream` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: ice cream empty |
| F067 | `آيس كريم` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: AR ice cream empty |
| F068 | `donuts` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: donuts empty |
| F069 | `كنافة نابلسية` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: AR kunafa empty |
| F072 | `cappuccino` | baseline | empty(genuine_no_match,br=1) | catalog-0: cappuccino empty |
| F073 | `كرك` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR karak empty |
| F075 | `healthy salad` | baseline | empty(genuine_no_match,br=1) | catalog-0: salad empty |
| F076 | `سلطة` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR salad empty |
| F081 | `mcdonalds` | baseline | 24 cards | C4: real McD cards but test-vendor cards mixed/front |
| F082 | `pizza hut` | baseline | empty(genuine_no_match,br=1) | catalog-0: Pizza Hut vendor empty |
| F084 | `ماكدونالدز` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR McDonald's empty |
| F090 | `fried chicken bucket` | baseline | empty(genuine_no_match,br=1) | catalog-0: fried chicken empty |
| F091 | `دجاج مقلي` | baseline | empty(genuine_no_match,br=1) | catalog-0: AR fried chicken empty |
| F096 | `biryni` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| F097 | `burgr` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| F098 | `shwarma` | FM-TYPO | empty(genuine_no_match,br=1) | typo not normalized |
| F099 | `كيكه شوكولاته` | FM-RELEVANCE | empty(genuine_no_match,br=1) | catalog-0: AR choc-cake spelling empty |

## Release recommendation

**NOT release-ready for Electronics or Food.** RE is solid (honest-empty bar; non-empty still blocked on IG handle seeding, D-RUN-1). The two dominant, fixable clusters are **AR/typo/appliance normalization** (C1+C2, 58 fails — one shared root cause across both sectors: the resolver keys on EN canonical terms only) and **food test-vendor leak + no-dump** (C4, including a live `Tes P Hut` TEST vendor in prod data). Fix C1/C2 normalization and remove the test vendor → projected pass jumps from 73% to ~90%+. Re-run this suite after the fix (WORKFLOW §7 — iterate until AC holds across the case set).

## Servers left running (for re-test)
- :3300 live mock-clarifier API (warm cache) · :3301 deterministic mock-data API · DBs `/tmp/bo-qa-run.sqlite`, `/tmp/bo-qa-mock.sqlite`. Harness: `/tmp/bo-run300.mjs`; results JSON `/tmp/bo-run300-warm.json`.

## Build blocker surfaced to PO
The dev branch did **not compile** (`coverageReason` returned but absent from `SearchResponse`). I added the optional field to `packages/shared/src/domain.ts` to unblock the build/run. Dev should ratify this type addition (it matches the `CoverageReason` union in `offers.service.ts`).
