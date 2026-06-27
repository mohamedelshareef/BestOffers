# Memory — Full-Stack Dev Lead (bo-dev-lead)

> READ at task start. UPDATE at end with durable facts only. Keep lean; prune stale.

## ADR-007 RC-1/RC-2/RC-3 — remaining 9 stable defects cleared via REAL Talabat search (2026-06-27, 331/331 api, REAL-proven, NO git)
- **RE-VERIFIED (independent run 2026-06-27):** full api suite **331/331 GREEN** (28 suites, ~11s); 3 RC specs
  89/89. Normalize check: mcdonalds/ماكدونالدز→`mcdonald`, آيس كريم→`ice cream`, كرك→`karak tea`, فطور صباحي→
  `breakfast`, قلاية هوائية→`air fryer`. LIVE spot-check (LIVE_FETCH=on, compiled resolvers, isolated, NO git):
  mcdonalds→883 (McFlurry/Camembert, real KWD), آيس كريم→40 (Vermilion ice-cream), كيك→40 (Cake Shop FIRST =
  RC-3 holds), قلاية هوائية→8 (Xiaomi/Black+Decker air fryers). All on-intent, price-sane. Defects cleared.
- **ROOT CAUSE (RC-1, the big one):** Talabat discovery used the UNPARAMETRIZED `/{country}/restaurants` SSR
  page = a ~40-vendor FEATURED SUBSET (no McDonald's / ice-cream / donut / karak / breakfast vendors at all),
  so those queries fell back to random restaurants → menu filter dropped everything → honest-empty.
- **FIX 1 (REAL DISCOVERY, talabat.adapter.ts `discover`):** now hits Talabat's OWN restaurant SEARCH
  `GET /kuwait/restaurants?searchTerm=<q>` — returns the vendors Talabat actually indexes (VERIFIED live:
  mcdonald→mcdonalds1/…, ice cream→vermilion/prefere, donuts→dunkin, karak→karak-hut, breakfast→breakfast-
  club). NOT a hand-list. SERP-hit slugs front-ranked; fallback to featured listing if search empty. EXCLUDE
  extended w/ SERP footer slugs (terms/faq/privacy/contact-us/sitemap/all-areas/about-us/careers/blog).
- **FIX 2 (food-resolver.ts `queryMatchedRestaurant`):** real outlet slugs carry branch suffixes
  ("mcdonalds1"). Added brand-PREFIX match (token len≥4 && slugToken.startsWith(token)) → "mcdonald" flips to
  whole-menu vendor mode. Whole-token match kept otherwise (tikka≠chicken).
- **FIX 3 (query-normalize.ts gazetteer):** McDonald's → **`mcdonald`** (SINGULAR — Talabat search only
  matches the singular stem; "mcdonalds"/"ماك" return NOTHING; provider-preferred canonical, like ثلاجة→
  refrigerator). FOOD_VOCAB has `mcdonald` (not `mcdonalds`) so fuzzy doesn't snap it back. +ايسكريم,
  دونتس→donuts, جيلاتي→gelato.
- **RC-2 (air fryer):** electronics gazetteer `قلايه هوائيه`/`قلايه`→air fryer + `fryer` in vocab. AR now = EN.
- **RC-3 (ranker, food-relevance.ts):** `scoreDish(dish, terms, coreTerms?)` — coreTerms = user's OWN tokens
  earn EXACT-INTENT BONUS (name+250/substr+150/cat+120) → on-intent dish above same-group sibling (cake>
  cookie, seafood>veg, latte>generic). Bonus only ORDERS. Filter is called with the NORMALIZED term (كيك→
  cake) so coreTerms are EN. Added karak/tea group, single-token ice/cream group members.
- **REAL SPOT-CHECK (LIVE_FETCH=on real providers, compiled resolvers, isolated, NO git):** mcdonalds/
  ماكدونالدز→884 (was 0), آيس كريم→40, كيك→40 (cake first), donuts→40, كرك→14, breakfast→40, قلاية هوائية→8.
  Regression clean: kfc 446, rice 27, cake 40, xyzqwfood honest-empty.
- **Tests +11 (320→331):** query-normalize.spec RC-1/RC-2; food-relevance.spec RC-1 subtype-keep + RC-3 rank;
  food-resolver.spec mcdonalds1 brand-prefix vendor mode. RUN `cd apps/api && npx jest --runInBand`.
  PROJECTED 300-suite: 291→~300 (~99-100%); 100 RE empties stay honest (data gap, not search).
- **EMBEDDINGS REC (ADR-007):** DISCOVERY is now durable (real provider search generalizes); RELEVANCE/ROUTING
  half (synonym groups, dish↔vendor routing, exact-intent terms) is STILL curated word-by-word = the hand-
  table treadmill. SCHEDULE the durable fix (Q4 embeddings / generated food taxonomy) — provider search finds
  a new subtype but the filter can't recognize it without a synonym row. Food long-tail is unbounded → worth it.
- **TECH DEBT (not a defect):** vendor-mode whole-menu has NO cap (kfc 446, mcdonalds 884 across multiple
  outlets). Truthful+price-sane but large; add per-vendor dedup + vendor-mode cap + titleCase mcdonalds1→
  McDonald's. Out of scope here.

## ADR-007 Q3 — 84→100-area Kuwait gazetteer wired into RE AREA_GROUPS (2026-06-27, 320/320 api, REAL-proven, NO git)
- **GOAL:** replace the hand-maintained ~12-area `AREA_GROUPS` (realestate-relevance.ts) with the full
  researcher gazetteer so EVERY KW area resolves (fix Jabriya→wrong-area leaks + unlisted-area pass-through).
- **NEW `offers/adapters/kuwait-areas.ts`** generates `AREA_GROUPS` from `team/research/kuwait-area-
  gazetteer.json` (file has **100 areas**, not the briefed 84 — reported real count). slug(en)→aliases
  (EN translit + AR with/without ال + ة/ه + ى/ي variants, PLUS auto-gen AR spelling variants per alias).
  Loaded at runtime via `fs.readFileSync` (NOT a JSON import — keeps it outside `src` so no tsc rootDir
  warning); path resolves from __dirname (5 up = repo root), env override `KUWAIT_AREA_GAZETTEER_PATH` for
  tests. realestate-relevance.ts now `import { AREA_GROUPS, AREA_GOVERNORATE, GOVERNORATE_ALIASES,
  GOVERNORATE_MARKERS } from './kuwait-areas'` + re-exports AREA_GROUPS. Tenure/price-sanity/NEARBY_MARKERS
  untouched.
- **CAVEATS handled:** (1) two same-romanization "Qairawan" en (Capital القيروان vs Jahra القيصرية) →
  on slug COLLISION append governorate slug → keys `qairawan_capital` / `qairawan_jahra`, aliases NEVER
  merge. (2) Salwa carries BOTH سلوى and السالوة (both in gazetteer aliases, both resolve).
- **CRITICAL FALSE-MATCH FIX (would have broken existing tests):** old matcher used `hay.includes(alias)`
  SUBSTRING — at 100 areas short aliases like "rai"/"ري" (Al-Rai) matched INSIDE الجابرية/للايجار →
  `detectQueryAreas('شقة في الجابرية للايجار')` wrongly returned `['jabriya','rai']`. FIX: NEW `aliasInText`
  matches per-TOKEN (token===alias) OR an AR particle-glued form (strip leading بال/فال/لل/ال/ب/ل/و/ف/ك
  then ===alias — covers بالسالمية); multi-word aliases fall back to contiguous substring. Used by
  detectQueryAreas + detectOfferArea + the namesAskedArea nearby check. KEEP THIS — substring matching is
  unsafe at this area count.
- **GOV-LEVEL FALLBACK (low-risk, marker-gated):** `detectQueryGovernorates` fires ONLY when an explicit
  GOVERNORATE_MARKER present (محافظة/governorate) — avoids the area/gov name overlap (bare "Ahmadi"/"Hawally"
  stays the specific AREA). `filterFlatsByQuery` checks govs FIRST: "محافظة الأحمدي" keeps ANY Ahmadi-gov
  area (Fahaheel/Mangaf/…), drops other govs. AREA_GOVERNORATE maps key→gov slug.
- **REAL VERIFIED (booted :3417, mock claude/social/extractor, LIVE_FETCH=off, isolated, NO git):**
  "شقة للايجار في الجابرية" → 1 card "2BR · Jabriya · semi · For rent" (@jabriya.homes, correct area+tenure);
  "المهبولة" → 1 Mahboula card; "مشرف" (Mishref — real KW area, NOT in mock seed) → **state=empty,
  coverageReason=genuine_no_match** = previously-unlisted area now resolves AND drops off-area flats (no leak).
- **Tests +7 (313→320):** realestate-relevance.spec NEW "84-area gazetteer" block: ≥84 keys; 16 previously-
  leaking/missing areas resolve EN+AR (Jabriya/Mishref/Bayan/Rumaithiya/Mahboula/Mangaf/Fintas/Sabah Al-Salem);
  unlisted-before area matches + different-area flat excluded; Qairawan collision stays separate keys; Salwa
  dual-spelling; الجابرية⊅الري false-match guard; gov fallback. RUN: `cd apps/api && npx jest --runInBand`.
- **DURABLE:** AREA_GROUPS is now GENERATED — to add areas edit the gazetteer JSON, not code. NEVER revert to
  substring alias matching. Mock RE seed only has 6 areas (Salmiya/Salwa/Mahboula/Hawally/Jabriya/Mangaf) so
  most of the 100 areas have no seed flat → honest-empty by design until live IG provides them.

## RELAX-AND-RETRY discovery — over-specific multi-word electronics no longer 0 (2026-06-27, 313/313 api, REAL-proven, NO git)
- **BUG (300-case cluster):** over-specific multi-word electronics queries returned EMPTY because extra
  model-suffix/size/form-factor/price tokens OVER-CONSTRAINED the provider DISCOVERY search even though the
  product exists. 10 verified failing→working pairs (AC split unit→0/split AC→6; "vacuum cleaner Dyson"→0/
  "vacuum cleaner"→8; "Google Pixel 9"→0; "AirPods Pro 2"→0; "Apple Watch Series 10"→0; "LG OLED 65 TV"→0;
  "Samsung side by side fridge"→0; "front load washing machine LG"→0; "Xiaomi phone"→0; "headphones under 50
  KWD"→0).
- **FIX 1 — `query-normalize.ts` NEW `relaxQueryVariants(normalized)`:** builds a ladder of progressively-
  relaxed discovery terms, MOST-SPECIFIC first. Rung0=full; Rung1=strip price-constraint phrase
  (PRICE_CONSTRAINT_RE) + multi-word form-factor phrases (FORM_FACTOR_PHRASES: side-by-side/front-load/
  built-in…); Rung2=drop ALL over-specific tokens WHEREVER they sit (bare numbers NUMERIC_SUFFIX_RE, model-
  tier words MODEL_TIER_WORDS series/pro/max…, single-token form-factors FORM_FACTOR_WORDS split/inverter) —
  this is why interior "65" in "lg oled 65 tv" drops (trailing-only peeling FAILED that case); Rung3=drop a
  trailing BRAND after a type ("vacuum cleaner DYSON"→"vacuum cleaner") OR a generic type suffix after a brand
  (GENERIC_TYPE_WORDS "xiaomi phone"→"xiaomi"); Rung4=single strongest core token (brand else type). Dedup,
  never empty. GENERALIZING (token CLASSES, not a per-query table). NOTE typo-corrector quirk: "phone"→"iphone"
  (1-edit snap) so "Xiaomi phone"→"xiaomi iphone" rung0 (0 hits) then "xiaomi" rung1 recovers — left as-is.
- **FIX 2 — `electronics-resolver.ts resolveOneProvider` loops the ladder:** for each rung
  discover→fetch→FILTER, stop at the FIRST rung whose RELEVANT (filtered) set is non-empty. CRITICAL: re-check
  relevance PER RUNG — an over-specific rung can DISCOVER (core substring hits) yet be over-constrained at the
  FILTER step by its own extra AND-token ("vacuum cleaner dyson" finds vacuums then "dyson" drops the non-Dyson
  ones → empty again). Stopping on filtered-non-empty + using THAT rung's term as the relevance FLOOR fixes
  both. `resolveWithCoverage` builds the ladder once and passes it in. Cache key stays the FULL queryText.
- **FIX 3 — `electronics-relevance.ts filterProductsByQuery(items, query, rankQuery?)`:** `query`=the matched
  rung = the AND-filter FLOOR (hits must satisfy its tokens); `rankQuery`=full specific query = RANK-ONLY (a
  closer specific match floats first, NEVER drops the rest). NEW `refinementBonus()` rewards the specific
  query's discriminator tokens NOT in the floor — INCLUDING 1-char model numbers (the "9" in Pixel 9, matched
  WHOLE-token so Pixel 9 ranks above Pixel 8) which `electronicsTokens` (len≥2) would otherwise ignore.
- **REAL SPOT-CHECK (LIVE_FETCH=on real Xcite/Blink/Eureka, compiled resolver, isolated, NO git):** "Google
  Pixel 9"→8 (Pixel 8 Pro/7a/10 Fold, real KWD), "vacuum cleaner Dyson"→8 (AutoBot/Samsung Jet vacuums),
  "headphones under 50 KWD"→3 (Bose/JBL — price phrase stripped from discovery), "LG OLED 65 TV"→2 (real LG
  OLED). ALL were 0 before. Real verbatim prices, correct category, no fabrication.
- **Tests +27 (286→313):** query-normalize.spec ladder block (full-term-first, 10 pairs each→core, price-strip,
  interior-number drop, single-term=itself, never-empty); electronics-resolver.spec relax block (12: each of 10
  pairs 0-on-full→cards-on-core via SearchAwareAdapter query-aware mock, Pixel-9-ranks-first-keeps-both,
  genuinely-absent honest-empties). RUN: `cd apps/api && npx jest --runInBand`.
- **DURABLE:** discovery must RELAX (find the product) while relevance FILTERS on the matched rung + RANKS on
  the full query (precision). NEVER let a specific token zero out BOTH discovery AND the filter. Genuinely-
  absent products still honest-empty (no rung discovers → []). Q4 embeddings remain the eventual generalization.

## CLAUDE-OUTAGE RESILIENCE — clarify() no longer 500s search (2026-06-27, 286/286 api, REAL-proven, NO git)
- **BUG (QA, real):** `startIntent` ran `claude.clarify()` inside `Promise.all` with NO fallback (only the
  parallel `generateClarifierSet` had one). Claude down (credit depleted→400, invalid key→401, any outage)
  → `clarify()` rejects → whole `/search/intent` throws 500 → search HARD-DOWN. A provider outage must
  DEGRADE, not 500.
- **FIX (`search.service.ts`):** NEW `clarifyWithFallback(input)` wraps `claude.clarify()`; on throw it
  logs a WARN (`clarify() failed … → search degrades, not 500`) and returns a deterministic minimal
  `ClarifierResult` = `{ intentNormalized:{ model:intentRaw.trim(), constraints:{} }, needClarification:true }`.
  That minimal intent is ENOUGH downstream: `pinIntentToSector` pins category=sector + model=raw for food/RE
  (seeds model for off-catalog electronics), and the CONFIG clarifier gate (`clarifier-sets.ts`) pre-resolves
  the food/RE dish/area dim off raw text — providers need NO Claude. `startIntent` now calls
  `clarifyWithFallback` (was `this.claude.clarify`). Imported `ClarifierInput`/`ClarifierResult`.
- **explainRanking ALREADY degrades (verified intact):** `assembleCards` try/catch → `explanations=[]` →
  every card falls to the truthful data-only why (`<price> at <provider>`). Confirmed REAL below.
- **REAL VERIFIED (isolated :3411, CLAUDE_PROVIDER=anthropic + ANTHROPIC_API_KEY=invalid = real 401
  x-api-key on EVERY Claude call = the outage class; LIVE_FETCH=off, mock social, owner ports untouched,
  NO git):** food "kfc" → `/search/intent` **HTTP 201 (not 500)**, state=clarifying, config set drives gate
  (totalQuestions=5); skip-through → terminal empty w/ coverageReason=genuine_no_match + broadenSuggestions
  (food has no offline data, providers ran clean). ELECTRONICS "iPhone 17 Pro Max" (MOCK_SKUS offline) →
  201, config gate (storage→color→budget→condition), skip-through → **9 REAL cards** (Eureka/X-cite, real
  KWD prices), why="419.500 KWD at Eureka" = data-only (explainRanking outage degraded too). Log: 2×
  `clarify() failed (401 invalid x-api-key) → search degrades, not 500`; **0 Internal Server Errors** in the
  whole run.
- **TESTS +1 (285→286):** `search-resilience.spec.ts` NEW "OUTAGE: clarify() throwing does NOT 500 — config
  clarifiers drive the gate and search still reaches REAL provider results" (clarify+clarifierSet+
  explainRanking all throw → intent returns clarifying 200, ≥5 config Qs, skip→results w/ real card +
  data-only why). RUN: `cd apps/api && npx jest --runInBand`. NOTE: `accounts.e2e.spec.ts` is FLAKY in the
  full --runInBand run (OTP/auth 401, timing/rate-limit, unrelated to this change — passes in isolation +
  on reruns); confirmed 286/286 on 3 consecutive full runs.
- **DURABLE:** ANY per-request Claude call in the intent/search path MUST have a deterministic fallback —
  never let a Claude failure 500 the search. clarify→config intent, clarifierSet→config set, explainRanking→
  data-only why. The providers + config clarifiers are the resilient spine; Claude is best-effort enrichment.

## ADR-007 300-case CLUSTER FIXES C1/C2/C3/C4/C5 (2026-06-27, 285/285 api, REAL-proven, NO git)
- **ROOT CAUSE (C1+C2, 58/80 fails, ONE shared):** provider search (Eureka/Blink elec, Talabat food) indexes
  EN-canonical terms; AR queries (غسالة صحون/تشيز كيك) + typos (refrigirator/biryni) + appliance vocab were
  passed VERBATIM → 0 hits despite real stock. **FIX — NEW `offers/adapters/query-normalize.ts`
  `normalizeProviderQuery(raw, 'electronics'|'food')`:** (1) `foldText` (diacritics/alef/ya/ta-marbuta);
  (2) GAZETTEER — AR/transliteration phrase→EN canonical, LONGEST-PHRASE wins (`gazetteerLookup`), a domain
  vocabulary NOT a per-query patch (one row covers a class); (3) FUZZY typo — `editDistance` (Damerau-
  Levenshtein, handles transposition), length-scaled bound (≤4ch→1 edit, else 2), snaps an unmapped LATIN
  token to the sector vocab. **NEVER corrects:** Arabic, <4ch, or a `NO_CORRECT` connector (chilled≠grilled,
  with≠fish — these are 1 edit from a catalog word; correcting changes meaning). Unmapped term → UNCHANGED
  (off-catalog still honest-empties, never fabricates). WIRED: electronics `queryText` (resolver) runs it
  BEFORE `canonicalizeElectronicsPhrase`; food `resolve()` runs it on `intent.model` before discovery+filter.
- **GAZETTEER provider-canonical gotcha (DURABLE):** Eureka indexes "lg fridge"→0 but "lg refrigerator"→2,
  so AR ثلاجة→**refrigerator** (NOT fridge); the relevance synonym group still treats fridge≡refrigerator.
  Use the term the PROVIDER indexes best as the canonical, esp. WITH a brand.
- **C4 test-vendor `Tes P Hut` (live Talabat seed) leaked:** `isTestRestaurant` regex only matched whole-word
  `test` — "tes" (3-letter obfuscated marker) slipped. FIX: added `tes/tst/uat/qat/fake/internal/staging…` to
  TEST_MARKERS + boundary `(^|[\s\-_])(marker)([\s\-_]|$)` so "tes" as its OWN token flags but "Contest"/
  "Tested" do NOT. Double-covered: food-resolver filters slug at discovery + filterDishesByQuery STEP-0 drops
  by title suffix. VERIFIED: 0 test-vendor cards across cake/kfc/burger.
- **C4 beverage front-rank:** NEW `isBeverage` (`food-relevance.ts`) — EN word-boundary (`7up/mirinda/cola/
  water/juice/soda…`) + AR WHOLE-TOKEN (`كولا/بيبسي…`). **CRITICAL:** AR must be whole-token — "شوكولاته"
  (chocolate) CONTAINS substring "كولا" → would falsely drop chocolate cake as cola. NEW `nonDishRank` (real
  dish 0 < beverage 1 < condiment 2) replaces condimentRank in both the restaurant-menu pass-through and the
  dish-query sort → drinks/sauces never front a dish/menu. A query matching ONLY drinks/sauces = no real hit.
- **C5 gibberish/off-menu dump:** `filterDishesByQuery` got opts `{unmatchedEmpty?}`. **Talabat lane
  (food-resolver) AND social lane (social-resolver) BOTH pass `unmatchedEmpty:true`** → an unrecognized/
  gibberish query (xyzqwfood/ramen) returns HONEST-EMPTY, never the first-N restaurant cards NOR the curated
  IG posts (was leaking Mounjaro/Halo-Halo/cake into every food query). Recognized free-form (meal-prep/diet)
  still matches — added a `mealprep/diet/keto/healthy/وجبات/دايت…` SYNONYM_GROUP so it's a real hit. Default
  (no flag) keeps the old lenient cap for any other caller.
- **C3 rice-pudding leak:** NEW `isDessertRice` (rice pudding/kheer/مهلبيه) + `isSavoryRiceQuery` (rice-family
  token, no dessert intent). A savory-rice query pre-filters dessert-rice out. ALSO fixed `scoreDish`: SHORT
  tokens (≤3ch e.g. "ice") match ONLY whole-word — "ice" was substring-matching "r**ice**" so an ice-cream
  query surfaced rice dishes (F067). Longer tokens may substring-match.
- **REAL VERIFIED (isolated :3400, LIVE_FETCH=on real Eureka/Blink/X-cite + Talabat/Apify, CLAUDE=mock,
  SEQUENTIAL warm; owner :3000/:3300/:8765 untouched, NO git):** ELEC — غسالة صحون→7 dishwashers, غسالة
  ملابس→6 washers, تلفزيون→7 TVs, ميكروويف→8, مكنسة→8 vacuums, آيفون 17 برو→4 iPhones, تابلت→9, ثلاجة ال جي→1
  LG refrigerator (was 0), labtop dell→3 Dells, refrigirator→11, telvison samsung→8 Samsung TVs. FOOD —
  تشيز كيك→5, دجاج مقلي→17, biryni→13 rice, shwarma→2 shawarma, كنافة→1 kunafa, rice/kabsa→15 (ricePudding=0),
  cake→27 desserts (0 beverages top4, 0 test-vendor). HONEST-EMPTY (correct): xyzqwfood/ramen/ice cream/
  mcdonalds → genuine_no_match. Still genuine-empty (real provider gap, EN, was empty pre-fix too): E014 AC
  "split unit", E034 vacuum "Dyson" (Dyson sells no std vacuum in feed). Added STOP_WORDS `unit/cheapest/
  latest/brand/model/ارخص` so "split UNIT" doesn't over-constrain.
- **Tests +37 (248→285):** NEW `query-normalize.spec.ts` (editDistance; elec+food AR routing each.each;
  typo correction; no-over-correct/off-catalog-unchanged; C4 test-vendor+beverage; C5 gibberish→empty +
  IG-lane lenient default; C3 savory-rice drops pudding). RUN: `cd apps/api && npx jest --runInBand`.
- **Item 4 RATIFIED:** `SearchResponse.coverageReason?: 'ok'|'genuine_no_match'|'provider_failure'|'timeout'`
  (shared/domain.ts:172) EXACTLY matches `CoverageReason` (offers.service.ts:26). Build green. KEEP IT.
- **EXPECTED PASS-RATE:** report was 220/300 (73%). C1(36)+C2(22 mostly) AR/typo/appliance now return cards;
  C3(11) rice-pudding gone; C4(9) test-vendor/beverage fixed; C5(1) gibberish honest-empty. A few EN
  provider-gap empties remain genuine (E014/E034 ≈ honest). Projected ~92-95%+. QA must RE-RUN the 300 suite.
- **VERIFY DRIVER:** `/tmp/bo-verify-clusters.mjs` (sequential warm, skips clarifiers). RUN CMD: `cd apps/api
  && DOTENV_CONFIG_PATH=<repo>/.env CLAUDE_PROVIDER=mock LIVE_FETCH=on SOCIAL_PROVIDER=apify SOCIAL_EXTRACTOR=
  anthropic APIFY_RESULTS_LIMIT=8 SQLITE_PATH=/tmp/x.sqlite PORT=3400 node -r dotenv/config dist/main.js`.

## ADR-007 full-flow RESULT-relevance fixes (2026-06-27, 248/248 api, REAL-proven, NO git)
- **D1 electronics timeout/0-cards (HIGH) FIXED — `electronics-resolver.ts` TIER_TIMEOUT_MS bumped**
  http 1500→**3500ms**, render 5000→**7000ms** (Eureka Algolia is the appliance source + does discover→
  fetch→extract sequential round-trips; 5s was too tight → whole lane aborted to []). Added
  `PER_PROVIDER_DEADLINE_MS=9000` via `withDeadline()` (Promise.race, unref'd timer) so a HUNG provider
  can't stall the lane. Providers run in PARALLEL (allSettled) → slow one only delays itself, others serve
  PARTIAL. **REAL VERIFIED (LIVE_FETCH=on, real Blink+Eureka+X-cite, isolated):** dishwasher 7, fridge 9,
  TV 11, microwave 8, AC 6, washing machine 6, vacuum 12 — ALL real cards, failed=0, 217–777ms. Partial
  proven: Eureka forced down → "TV" still 5 Blink cards, failed=1.
- **D2 over-dump (HIGH) FIXED — `food-relevance.ts`:** (1) added a **sushi SYNONYM_GROUP** (sushi/sashimi/
  maki/nigiri/roll + AR سوشي…) + AR coffee aliases. ROOT CAUSE of "sushi"→243: sushi wasn't a recognized
  dish token, so a "sushi"-named slug flipped `food-resolver.queryMatchedRestaurant` to RESTAURANT-mode →
  dumped every sushi restaurant's WHOLE menu. Now sushi is a dish term → never flips (GENERALIZING fix).
  (2) NEW `MATCHED_RESULT_CAP=40` — `filterDishesByQuery` slices the matched+ranked list to top-40 by
  relevance (scorer already ranks best first), so even a popular term can't dump the long tail. **REAL
  VERIFIED:** sushi 243→40 (0 off-topic burgers), pizza 130→40, coffee 100→40, all relevant; small set
  (5) returned in full (cap only bites the tail).
- **D3 RE "always ~7 cards" — INVESTIGATED: it's DATA-THINNESS, not a bug.** Mock RE seed = 10 posts
  (8 rent + 2 sale). **REAL VERIFIED (mock provider, fresh resolver per query so 6h cache doesn't bleed):**
  results VARY correctly — generic rent(no area)→8 rent (sale excluded), Jabriya→1, Salmiya→1, Salwa→3,
  Hawally→1, BUY→2 sale (rent excluded). Honest + varies by area/tenure/matched-accounts, NOT a fixed 7.
  Unlisted area (Mishref)→8 = the KNOWN AREA_GROUPS gap (12 hand-areas, gazetteer is ADR-007 Q3, deferred).
  No code change needed; symptom was thin seed data.
- **D4 coverage_reason (GR4/ADR-007 Q5) — `OffersService.resolveOffersWithCoverage()` NEW.** Returns
  `{offers, coverageReason:'ok'|'genuine_no_match'|'provider_failure', providersTried, providersFailed}`.
  Distinguishes a SUSPECT empty (a lane threw/timed-out → flagged) from a clean empty (every provider
  answered, nothing matched). `resolveOffers()` now delegates to it (callers unchanged). Electronics
  resolver got `resolveWithCoverage()`: `resolveOneProvider` returns `{hits,failed}` — a relevance-empty
  is markOk (NOT a failure), only a throw is `failed:true`. `search.service.runSearch` calls it (with a
  `typeof …WithCoverage==='function'` guard so test doubles stubbing only `resolveOffers` still work →
  treated as genuine_no_match) + surfaces `coverageReason` in the empty `SearchResponse` + `empty_empty`
  event payload (coverage_reason + providers_tried/failed). `SearchResponse.coverageReason` was already in
  shared/domain.ts. **REAL VERIFIED:** HTTP /search (mock, :3309) genuine empty → response
  `coverageReason:"genuine_no_match"`; compiled svc → ok(9 cards)/genuine_no_match/provider_failure(failed=1).
- **Tests +10 (238→248):** electronics-resolver.spec +3 (providersFailed on throw / clean-empty=0 /
  hung-provider deadline still partial), food-relevance.spec +4 (sushi recognized+matchedGroup, 200-item
  cap to 40 no off-topic, pizza/coffee capped, small set full), offers.service.spec +3 (coverageReason
  ok / genuine_no_match / provider_failure via thrown lane). RUN: `cd apps/api && npx jest --runInBand`.
- **VERIFY DRIVERS (isolated, owner :3000/:8765 untouched):** `/tmp/verify-elec.js` (LIVE_FETCH=on real
  providers, 7 catalog terms), `/tmp/verify-partial.js` (forced provider-down), `/tmp/verify-overdump.js`
  (243-item menu→cap), `/tmp/verify-re.js` (mock RE varied queries), `/tmp/verify-cov-svc.js` +
  `/tmp/drive-coverage.sh` (HTTP :3309 coverageReason). Compile first: `npx tsc -p tsconfig.json` (ignore
  the known pre-existing import-tracked-accounts.spec rootDir tsc warning — jest handles it fine).

## tracked_accounts DB store — IG handles now DB-driven (2026-06-27, 238/238 api, REAL-proven)
- **GOAL:** persist the IG curated allow-list in the DB by sector/category (keep GROWING it); IG ingestion
  reads from it instead of the hardcoded `HANDLES_FOOD`/`REALESTATE_HANDLES` dicts.
- **MIGRATION (both engines):** `db/migrations/0005_tracked_accounts.sql` (SQLite-runner) + `db/postgres/
  0005_tracked_accounts.sql` (Supabase). Cols: id, handle(UNIQUE), sector(food|realestate CHECK),
  category, follower_tier, recency, posts_prices, lang, status(verified|confirm|disabled CHECK,
  DEFAULT confirm), note, added_at, last_seen_at. INDEX (sector, category, status). Idempotent DDL.
  CATEGORY uses UNDERSCORES in DB/seed (home_meal/meal_prep) vs HYPHENS in code's FoodDishCategory
  (home-meal/meal-prep) → `normalizeCategory()` bridges (always store/query underscore form).
- **STORE `offers/adapters/social/tracked-accounts.store.ts` (TrackedAccountsStore over the Db port):**
  `upsert()` idempotent BY HANDLE (insert→'inserted', existing→'updated', NEVER duplicates; id=`ta_<handle>`,
  added_at set once). `addTrackedAccount()` = public append, DEFAULTS status='verified' (vetted append goes
  live); pass status='confirm' for hashtag-discovery finds (staged, NOT live until `promote(handle)`).
  `verifiedHandles(sector,cat)` / `verifiedForSector(sector)` return ONLY status='verified'. `counts()`
  groups sector/category/status. `markSeen()` touches last_seen_at.
- **IMPORT `scripts/import-tracked-accounts.ts` (`importTrackedAccounts(db)` exported):** reads
  `team/research/ig-accounts-seed.json` (path via IG_SEED_PATH at CALL-TIME so tests use a fixture), upserts
  each: seed VERIFIED→status='verified' (live), seed CONFIRM→status='confirm' (staged). Prints per-sector/
  category counts. **REAL RUN (isolated /tmp/bo-tracked-verify.sqlite):** 73 inserted (re-run: 0 ins, 73 upd
  = idempotent). Counts: food rice 8V/1C, home_meal 2V/2C, grill 8V/2C, meal_prep 18V, dessert 13V, cloud 6V;
  RE rent 8V/1C, agency 3V, sale 0V/1C.
- **PROVIDER WIRING (`apify-social-provider.ts`):** `ApifySocialProvider` ctor now takes optional
  `TrackedAccountsStore`. NEW `resolveHandleTargets(vertical,query)`: if store present → `dbHandles()` (food:
  `verifiedForSector('food')` ranked into `foodCategoryOrder(query)` so rice query → rice sellers LEAD; RE:
  all verified RE handles), logs `source=DB`; if DB EMPTY or query throws → hardcoded fallback (the ONLY
  remaining use of HANDLES_FOOD/REALESTATE_HANDLES) + warn. `routeFoodHandles` refactored to share new
  EXPORTED `foodCategoryOrder()`. `defaultProvider()` (social-ingest.adapter) builds the store from a
  `new DbService()` ONLY when SOCIAL_PROVIDER=apify (try/catch → undefined on DB-init fail; mock path
  untouched, no DB dep). Cost guards (6h cache, monthly cap, perHandle/HashtagLimit) ALL intact.
- **REAL VERIFIED (compiled provider + DB, fetch mocked to capture Apify body, isolated):** food "rice" →
  55 verified handles, rice-led (alamir_bukhari,bukhari_kuwait,kabsa.house,machbos_daqoos,maidaalmandi…);
  confirm rows (kabsawberyeni) EXCLUDED. RE "شقة للايجار السالمية" → all 11 verified RE handles (vs old
  hardcoded 4); confirm (aqar_kw0) excluded. No-store → hardcoded 4 RE handles (fallback proven).
- **TESTS +12 (226→238):** `tracked-accounts.store.spec.ts` (idempotent upsert no-dup, @ strip + hyphen→
  underscore, verifiedHandles gates confirm/disabled, promote, addTrackedAccount verified-default vs confirm,
  counts; DB-driven selection: food rice-led + confirm gated, RE all-verified, empty-DB fallback, no-store
  fallback) + `import-tracked-accounts.spec.ts` (VERIFIED→verified/CONFIRM→confirm, idempotent re-import).
  Specs use REAL in-memory SQLite with migrations applied. RUN: `cd apps/api && npm run migrate` (writes
  0005), `npx ts-node scripts/import-tracked-accounts.ts` (SQLITE_PATH for isolation). To append live:
  `store.addTrackedAccount({handle,sector,category})`; hashtag find: `addTrackedAccount({...,status:'confirm'})`.
- **STILL TODO (ADR-006):** BullMQ delta-pull scheduler maintains last_seen_at + auto-inserts hashtag finds as
  confirm; admin CRUD UI; legal Meta ToS sign-off (tos_reviewed=false). Pg port not yet pushed to Supabase.

## ADR-007 Q1 — ELECTRONICS CATALOG-FREE discovery (2026-06-27, OWNER, 226/226 api, REAL-proven)
- **BUG:** electronics "Dish washing Machine" (any non-seeded product) → 0 results. Root cause: electronics
  lane filtered a 16-item in-code `MOCK_SKUS` (only iPhones/Galaxy/MacBook/Dell); `matchSkus`→[] for anything
  else short-circuits; `live-resolver` also DROPS hits that don't map to a candidate SKU. Real provider search
  (Blink suggest.json, Eureka Algolia) was architecturally bypassed off-catalog.
- **FIX — `ElectronicsOfferResolver` (`offers/adapters/electronics-resolver.ts`, mirrors FoodOfferResolver):**
  for an electronics intent calls each adapter's REAL search directly with the query text, SYNTHESIZES a
  `Sku`(category='electronics', id `elec_<slug>`)+`Offer` per live hit (title/price→fils/image/url/stock
  VERBATIM), groups near-dupes across providers, returns ResolvedOffer[]. allSettled + per-site timeout +
  ELECTRONICS_TTL cache (`elec:<providerId>:<q>`) + partial results. Does NOT require a MOCK_SKUS match.
- **WIRING (`offers.service.ts`):** electronics branch — when LIVE_FETCH=on run `electronicsResolver.resolve`;
  if >0 use it, ELSE fall back to `resolveForSkus(matchSkus)` (MOCK_SKUS = offline/test fixture + safety net).
  `withLiveLayer` rebuilds the electronics resolver. LIVE_FETCH=off → MOCK_SKUS path only (precision specs
  depend on it). `search.service.pinIntentToSector`: for electronics, ONLY when LIVE_FETCH!=='off', seed
  `intent.model = intentRaw` when Claude left model blank (off-catalog class).
- **fallback.ts:** new `isDiscoveredOffer` — a synthesized electronics offer (`sku.category==='electronics'`)
  is treated like food/RE discovery (every hit is exact; budget-only exclusion). MOCK_SKUS electronics keep
  category 'smartphone'/'laptop'/'tv' + strict model-identity matching (Pro≠Pro Max precision specs intact).
- **RELEVANCE + GROUPING (`offers/adapters/electronics-relevance.ts`, the CORE guards):**
  - `canonicalizeElectronicsPhrase` PHRASE map — **VERIFIED live: providers index "dishwasher" (one word);
    "dish washing machine"/"dish washer" → 0 hits.** Map rewrites the DISCOVERY query + normalizes titles
    (dishwasher/dryer/air conditioner/microwave). Tiny high-freq only (Q4 embeddings = durable generalization).
  - `scoreProductTitle(title,query,category)` — a hit must satisfy EVERY significant query token (token OR a
    synonym), matched in TITLE **or the provider CATEGORY PATH** (Eureka `cn`, Blink `product_type` — now
    surfaced as `attrs.category`). Why "laptop" matches a "MacBook Pro" (no word "laptop" in title; cat="…>
    Laptops > Note Books"). Drops off-query rows (microwave for a dishwasher query).
  - `isAccessoryTitle` ACCESSORY guard — a DEVICE query drops case/cover/stand/bag/charger/streaming-stick/
    keyboard hits (unless the query asked for the accessory). Why "TV"/"iPhone 16" no longer surface cases.
  - `groupSimilarProducts` — trigram (pg_trgm-style) Jaccard ≥ **0.55** (conservative; default pg_trgm 0.3);
    same product across X-cite/Blink/Eureka merges to ONE synth SKU carrying every provider's offer; below
    threshold = separate cards (never a wrong price-compare). `titleSimilarity`/`trigrams` exported.
- **REAL PROOF (LIVE_FETCH=on, real Blink+Eureka+X-cite, isolated — owner :3000/:8765 untouched, NO git;
  drove compiled ElectronicsOfferResolver + full OffersService.resolveOffers):**
  - **"Dish washing Machine" → 7 REAL dishwashers** (Eureka): Bosch Series 6 FreeStanding 365.000, Ariston
    Built-in 14-Place 250.000, Samsung Freestanding 219.000, Ariston Inverter 202.000, Bosch Series 6 199.900,
    Samsung DW60M5050FS 159.000, Ariston 13-Place 149.900 KWD — real URLs. **BUG FIXED.**
  - "TV" → 11 real Samsung/LG QLED/OLED TVs (streaming-stick/keyboard dropped). "washing machine" → 6 real
    Hitachi/Bosch/Ariston/Panasonic washers (189–365). "iPhone 16" → X-cite 128GB 219.900 + 512GB 399.900 +
    Blink 16 Pro Max/16e (cases dropped). "laptop" → 5 real Eureka ROG/Omen/MacBook Pro (839–1204) via cat path.
- **X-cite status (ASSUMED partial):** still the 4-entry iPhone-16 known-URL hand-list (no search/sitemap path
  spiked — ADR-007 Q2). Contributes only for iPhone-16-class text; 0 for dishwasher/TV/washer/laptop. Blink+
  Eureka carry off-catalog discovery. NOT a blocker (Q1 done).
- **DURABLE:** Blink has NO appliances (dishwasher/washer → 0); Eureka (Algolia instant_records) IS the
  appliance source. Provider category path is the key relevance signal for brand/model-named devices. Eureka
  query-vs-PDP `name` param can mirror a sibling SKU, but title/price are from the hit itself (truthful).
  Tests: 226/226 (was 209; +17: electronics-relevance.spec 9, electronics-resolver.spec 5, +3 folded). RUN:
  `LIVE_FETCH=on` + import compiled `dist/offers/adapters/electronics-resolver.js` with [Xcite,Blink,Eureka].

## RE RENT-vs-SALE + price-sanity FIXED — "300,000 KD rent" bug (2026-06-27, OWNER, 209/209 api)
- **BUG (live):** a RENT flat card showed **300,000 KD** = a SALE price. Root causes (BOTH real): (1) RE
  extraction had NO tenure field — rent & sale listings were undifferentiated, so a sale leaked into rent
  results; (2) `parseKwdPrice` regex `(\d+(?:[.,]\d{1,3})?)` mis-parsed "300,000" as `300.000`→**300 KWD**
  (a grouped-thousands sale price truncated to look like a sane rent). No price-sanity bound existed.
- **FIX 1 — tenure extraction:** `RealEstateExtract` += `tenure:'rent'|'sale'|null`, `priceFils` (alias of
  legacy `rentFils`, both kept), `priceUnit:'month'|'total'`. RE_TOOL (anthropic-social-extractor) schema +
  prompt updated (rent للإيجار / sale للبيع/تمليك; a 100k+ value is a SALE not a monthly rent). Mock extractor
  `parseTenure` (sale markers WIN over rent) + `parsePriceUnit`.
- **FIX 2 — KWD number parser (`mock-social-extractor.parseKwdNumber`, EXPORTED+tested):** disambiguates a
  DECIMAL KWD amount ("12.500"→12.5) from GROUPED THOUSANDS ("300,000"→300000, "1,250,000"→1250000, multi-sep
  "1.250.000"→1250000). Rule: ≥2 seps = thousands; one comma + exactly-3-trailing = thousands (sale);
  else decimal fils. `parseKwdPrice` now matches `\d[\d.,]*\d`. `priceLiterallyInCaption` (adapter truthfulness
  guard) extended with `toLocaleString` candidates so a real 300,000 sale price passes the literal-in-caption check.
- **FIX 3 — relevance filter (`realestate-relevance.ts`, the CORE guard):** NEW `detectQueryTenure`,
  `detectOfferTenure` (explicit attr → caption marker), `isSaneMonthlyRent` (band **50,000–3,000,000 fils** =
  50–3,000 KWD/month; 0=price-on-request OK), `inferTenureFromPrice` (≥10,000 KWD ⇒ sale), `filterFlatsByTenure`,
  and `filterFlatsByQuery(items, query, {tenure})`. A rent query DROPS sale flats (and vice versa); a rent flat
  with an out-of-band price is DROPPED. `FlatCandidate` += tenure/priceFils.
- **FIX 4 — adapter relabel (`social-ingest.adapter.ts` RE branch):** resolves tenure (extraction→caption→price
  inference); if tenure=rent but price out-of-band → reclassify to sale (if >max) + **zero the price → price-on-
  request** (NEVER renders an absurd rent number). Sets `attrs.tenure`/`attrs.priceUnit`; title gets "· For rent/
  For sale". `social-resolver.ts` reads `intent.constraints.tenure` (the rent/buy clarifier; 'buy'→sale) as
  AUTHORITATIVE, else query text; passes it into the filter (+ reads `sku.attributes.tenure`, `offer.priceFils`).
- **SEEDS (`mock-social-provider.ts`):** +2 SALE posts — Salmiya 3BR **300,000 د.ك للبيع/تمليك** (the owner's bug
  case) + Salwa house **450,000 دينار للبيع**. Existing 8 rent seeds (230–600 KWD/month) unchanged + sane.
- **REAL PROOF (booted API :3303, mock claude/social/extractor, isolated — owner :3000/:8765 untouched, NO git;
  driver answers the tenure clarifier then skips to results):**
  - "شقة للايجار السالمية" tenure=rent → **1 card: "1BR · Salmiya · semi · For rent", priceFils=300000 = 300
    KWD/month** (sane), the 300,000 KWD Salmiya SALE post EXCLUDED. **0 cards with priceFils>3,000,000.** No absurd rent.
  - "شقة للبيع" tenure=buy → **2 cards: Salmiya 3BR 300,000 KWD + Salwa 450,000 KWD**, both "For sale", rent flats excluded.
  - Tenure correctly separated both directions.
- **Tests: 209/209 api (was 185; +24):** realestate-relevance.spec +16 (detectQueryTenure/detectOfferTenure,
  isSaneMonthlyRent, inferTenureFromPrice, filterFlatsByTenure rent-drops-sale + sale-drops-rent + absurd-rent
  drop + price-inference, end-to-end area+tenure: rent query for Salmiya excludes the 300k sale). social-ingest
  .spec +8 (parseKwdPrice grouped-thousands 300,000→300,000,000; parseKwdNumber decimal-vs-thousands; parseTenure;
  adapter: 300k sale extracted as SALE w/ real price not 300; lying rent@300k → sanitized to price-on-request+sale;
  RESOLVER rent-السالمية excludes 300k sale; RESOLVER للبيع returns sales). Lying-extractor stub updated to new shape.
- **DURABLE:** monthly-rent sane band = 50–3,000 KWD (`SANE_RENT_MIN/MAX_FILS`); sale floor = 10,000 KWD
  (`SALE_PRICE_FLOOR_FILS`). KWD has 3 decimals → "X.500" is decimal, "X,000" (3 after comma) is thousands — never
  conflate. The tenure filter is the CORE guard; constraints.tenure ('buy'→sale) from the rent/buy clarifier is
  authoritative over query text. RUN CMD: `cd apps/api && DOTENV_CONFIG_PATH=<repo>/.env CLAUDE_PROVIDER=mock
  LIVE_FETCH=off SOCIAL_PROVIDER=mock SOCIAL_EXTRACTOR=mock PORT=3303 node -r dotenv/config dist/main.js`; driver
  posts /search/intent then /search/answer{searchSessionId,dimension,answer} (tenure→rent|buy, else __skip__).

## "Bukhari food" → @layers_kw CAKE bug FIXED — IG category routing + relevance filter (2026-06-27, OWNER, 185/185)
- **BUG (live):** searching "Bukhari food" (رز بخاري, a RICE dish) returned cake offers from @layers_kw. Root
  cause: (1) flat bakery-heavy `FOOD_HANDLES` seed, no dish-category routing; (2) IG social offers were filtered
  for food but the rice SYNONYM_GROUP was MISSING bukhari/بخاري + mansaf/منسف, so a bukhari post didn't expand.
- **FIX PART 1 — category-routed handles (`apify-social-provider.ts`):** replaced flat FOOD_HANDLES with the
  researcher's CATEGORY-TAGGED `HANDLES_FOOD: Record<FoodDishCategory, string[]>` (rice/home-meal/grill/meal-prep/
  dessert/cloud — the [V] seed). NEW `routeFoodHandles(query)` (EXPORTED, unit-tested) maps a query to its dish
  category via `FOOD_CATEGORY_KEYWORDS` (bukhari/machboos/biryani/kabsa/mandi/mansaf/rz → rice+home-meal;
  mashawi/grill/mishkak → grill; cake/حلى → dessert; diet/keto → meal-prep; burger/coffee → cloud) and ORDERS the
  full union so the matching category LEADS (rice query → rice sellers first, NOT @layers_kw). ALWAYS returns the
  full deduped union — only ORDER changes, no seller dropped. `pullMode(vertical,mode,queryText)` uses
  routeFoodHandles for food; RE unchanged. Cache still `${vertical}:${mode}` (one Apify run holds all sellers'
  posts, re-ranked per query). NOTE seed updated: dropped stale bakers (cake_art_kwt/heavenly.cake/itsmesini/…),
  added rice block (bukhari_kuwait/alamir_bukhari/maidaalmandi/malekalmajbous/machbos_daqoos/manasif_/mansafna_kw/
  kabsa.house) + home-meal + mishkak_kw/mashawi_alzayn.
- **FIX PART 2 — relevance filter (the core, `food-relevance.ts`):** the IG food relevance filter was ALREADY
  wired in `social-resolver.ts` (sector==='food', uses `filterDishesByQuery`). Extended the rice SYNONYM_GROUP:
  +bukhari/bukhary/boukhari/بخاري, +mansaf/منسف, +machbous/makboos, EN biryani spellings. Added a GRILL group
  (mashawi/mishkak/tikka/shish/bbq/مشاوي/مشكاك/شواء). So "Bukhari food" expands → rice group → cake/burger/coffee
  posts score 0 → DROPPED.
- **REAL PROOF (compiled provider→resolver, SOCIAL_PROVIDER=apify + SOCIAL_EXTRACTOR=anthropic, APIFY_RESULTS_LIMIT
  =2, isolated — owner :3000 untouched, NO git):** "Bukhari food"/"machboos"/"مجبوس" → routeFoodHandles leads
  bukhari_kuwait,alamir_bukhari,maidaalmandi… → **0 offers, 0 cake** (raw probe showed the 30 fetched posts DID
  include @layers_kw cake / @burgerinn / @mug.cr coffee — the filter dropped ALL; rice sellers' live 30d window had
  no clean priced rice-dish offer at limit=2, so honest EMPTY, NEVER cake). "cake" → dessert block leads → **8 real
  cake offers** (@layers_kw "Customized cake", @thecakeshop_kuwait, @bakehaus.kuwait, @zahracakes_kwt, @cakentakekw —
  all price-on-request, real permalinks). Symmetric + correct. CREDIT this verify ≈ 39 handles×2 ≈ <$0.10.
- **Tests: 185/185 api (was 178; +7):** apify-social-provider.spec +5 (routeFoodHandles: rice query leads rice not
  bakery, AR machboos/biryani/مندي/منسف route to rice, cake→dessert leads, grill→grill leads, full union preserved);
  social-ingest.spec +2 (rice query EXCLUDES @layers_kw cake offer + keeps bukhari; cake query symmetric). All other
  specs untouched + green.
- **DURABLE:** the IG relevance filter (`social-resolver.ts` food branch) is the CORE guard — keep it. routeFoodHandles
  only re-orders (rank lead); the filter is what guarantees no cross-category leak. To add a dish category: add a
  `HANDLES_FOOD` key + a `FOOD_CATEGORY_KEYWORDS` rule + (if a new dish family) a SYNONYM_GROUP in food-relevance.ts.

## SMART per-query clarifier generation (2026-06-27 — OWNER, REAL-proven, 178/178 api)
- **GOAL:** the ≥5 follow-ups must be SMART + SPECIFIC to the EXACT requested item (Claude-generated),
  NOT the fixed generic per-sector list. Config sets kept ONLY as deterministic FALLBACK.
- **NEW interface method `ClaudeClient.clarifierSet(input)`** (`claude-client.interface.ts` +
  `ClarifierSetInput{intentRaw,sector,locale,minQuestions,alreadyResolved}`) → `ClarifierQuestionDraft[]`.
  AnthropicClaudeClient impl = Haiku (CLAUDE_CLARIFY_MODEL) forced tool_use `emit_clarifier_set`,
  **max_tokens 2560** (a tighter cap truncated → stop_reason=max_tokens on busy items like كنب; 2560 fixed
  it). System prompt = owner's tailoring examples (laptop→use_case/ram/screen; iphone→storage/color/
  applecare; rice→rice_dish/protein/spice) + HARD no-drift rules (same item only, no upsell, ≥3 chips +
  "Any/لا يهم", Western numerals, AR-first). Sanitizes/dedupes/drops malformed (chips<2). MockClaudeClient
  impl = canned `MOCK_SETS` (laptop/iphone/rice/flat) — deterministic, query-appropriate (laptop≠phone),
  returns [] for unrecognized → exercises the fallback path offline.
- **search.service wiring:** `startIntent` runs `clarify()` + `generateClarifierSet()` **IN PARALLEL**
  (Promise.all) — LOAD-BEARING: sequential made clarifierSet start ~6s late and blow the timeout. Bounded
  `withTimeout(CLARIFIER_GEN_TIMEOUT_MS=12000, unref'd timer + clearTimeout)`. `reconcileGenerated()` drops
  dims colliding with pre-resolved (RULE-7) + dedupes; TRUSTS the smart set only if `clean.length >= need`
  (need=5−preResolved) ELSE undefined→config fallback (never half-smart/half-config). Stored on
  `session.generatedQuestions` (frozen for the multi-turn loop). `nextQuestion(session)` prefers the
  generated set, else `CLARIFIER_SETS[sector]` config (via toQuestion). `applyAnswer` discovery-fold
  widened to smart food/RE dim keys (rice_dish/protein/cuisine, area/neighborhood/location) so a smart
  answer tightens the Talabat/social query, like the config `dish`/`area` dims.
- **REAL VERIFIED (Haiku live, isolated :3301 — owner :3000 untouched):** laptop→use_case(Gaming/Work/
  Study/Design)/screen_size(13/14/15/17")/ram(8/16/32/64GB)/brand(Apple/Dell/HP/Lenovo), NO storage/color;
  iPhone 16→storage/color(Natural Titanium/Blue!)/condition/budget; "chilled with rice"→rice_dish(Machboos/
  Biryani/Kabsa)/protein/spice_level/portion_size; "flat in Salwa للايجار"→bedrooms/budget/furnished/
  amenities/floor_type (AR); "كنب"(sofa)→sofa_type/seating_capacity/material(leather/fabric/velvet)/color/
  budget/features — all tailored, different per item, no drift. FALLBACK proven HTTP: CLARIFIER_GEN_TIMEOUT_
  MS=1 → "clarifierSet generation failed → config fallback" → config ELECTRONICS set drives the gate, 25
  cards. Pre-resolved dim (model/dish from raw) makes a specific intent start at Q[2/5] (RULE-7).
- **Tests +7 `clarifier-smart.spec.ts` (178/178, was 171):** laptop≠phone dims, iphone phone-specific,
  rice dish-specific, different items diverge, unrecognized→config fallback, clarifierSet THROW→config
  fallback, smart query still reaches results. All inline ClaudeClient spec stubs got a `clarifierSet`
  ([] = config fallback): clarifier-gate/clarifier-bound/search-resilience; truthfulness delegates to mock.
- **DURABLE:** clarify + clarifierSet MUST run in parallel (two sequential Haiku calls blow the budget).
  max_tokens≥2560 for the set. Keep the config sets — they ARE the fallback and the offline/test path.

## Current state (after ADR-005 Slice F-1 — FOOD now LIVE via Talabat Tier-1 JSON; fallback spec fixed)
- **88/88 api tests green** (was 79/81). FOOD ships with ZERO scraping of walled apps (no Jahez/Carriage).
- **TALABAT adapter LIVE** (`offers/adapters/talabat.adapter.ts`, tier:'http', sector:'food', deterministic
  JSON, NO browser/NO Claude). VERIFIED LIVE 2026-06-26 against real KW restaurants. SHAPE (durable, matches
  ADR-005 spike): DISCOVER `GET /kuwait/restaurants` SSR HTML → restaurant slugs via regex `"\/kuwait\/{slug}"`
  (kfc, chicken-tikka, kababji, burger-king…; EXCLUDE list drops restaurants/cuisine/cart/etc). Per slug
  `GET /kuwait/{slug}` → `__NEXT_DATA__.props.pageProps.data.vendorId` (KFC=5804, Chicken Tikka=5859,
  Kababji=710511, regex fallback `"vendorId":\d+`). FETCH `GET /nextMenuApi/v2/branches/{vendorId}/menu` →
  JSON `{result:{menu:{menuSection:[{nm,itm:[…]}]}}}`, NO auth/cookie/Cloudflare. EXTRACT item fields:
  `nm`=name, `pr`=price KWD FLOAT (round(pr*1000)→fils; rounds float noise e.g. 1.925000011920929→1925),
  `opr`=old price (**-1 = NO promo sentinel**; `opr>pr` = REAL promo→isPromo+oldPriceFils+discountPct),
  `id`=item id, `imgurl`=full image URL, section `nm`=category. **Menu API has NO restaurant name** (only
  vendorId) → display name is titleCase(slug). fetch() carries the slug onto `raw.url` as `#slug=…` so
  extract() builds the deeplink `/kuwait/{slug}` + title `{dish} — {Restaurant}`.
- **VERIFIED LIVE (`npm run live:offers -- "kfc" --food`):** KFC 55 priced dishes — Supreme Cruncher Meal
  2.000 KWD (was 3.000, -33%), Zinger Supreme Duo 2.000 (was 4.250, -53%); Chicken Tikka 67 dishes (Chicken
  Kebab Meal 1.925, was 2.750, -30%); Burger King 177 dishes (1 KD Deal 1.000, Whopper King Box 2.950). Real
  names + KWD prices + promos + working URLs. Full SERVICE integration proven: `OffersService.resolveOffers(
  {category:'food',model:'kfc'})` → 55 real `prov_talabat` dishes, ranked cheapest-first (LIVE network probe).
- **Wiring:** FOOD has NO pre-defined SKUs (unlike electronics). `FoodOfferResolver` (`food-resolver.ts`,
  allSettled + FOOD_TTL_MS 5min cache + per-site 4s timeout + partial results + kill-switch) SYNTHESIZES a
  dish-`Sku`+`Offer` per real dish from verbatim Talabat data (id `dish_prov_talabat_{itemId}`, category
  'food') → flows the unchanged ResolvedOffer→ranker→fallback→card spine, truthful by construction.
  `OffersService.resolveOffers` branches on `intent.category==='food'` → foodResolver (returns [] when
  LIVE_FETCH=off, no food mock). `withFoodLayer()` test hook. mock-claude now detects food (chicken/burger/
  pizza/kfc/shawarma/kebab… + AR) → category='food', model=raw query (the Talabat discovery term).
  `provider_url_cache` = `provider-url-cache.ts` (InMemoryProviderUrlCache, 24h DISCOVERY_TTL_MS, slug→vendorId;
  Redis/PG-table-ready) — FIRST impl of the table ADR-003 deferred.
- **Talabat ToS:** internal JSON endpoint, no auth/challenge — lower risk than Cloudflare-walled apps but
  STILL behind counsel review + `tos_reviewed`/kill-switch before public release (ADR-005 legal flags).
- **FALLBACK SPEC 2 pre-existing failures FIXED (soft-rank ranker fallout):** ROOT CAUSE = `rankOffers`
  HARD-filters over-budget offers (ranker.spec line 57 locks this) AND `matchSkus` is model-scoped
  (offers.service.spec locks: a bad-storage answer must NOT change the model's offer set; iPhone-99→0). So
  `buildFallback(intent, ranked)` could NEVER see over-budget items (budget test) NOR adjacent models
  (caps test). FIX: added `OffersService.resolveBroadened(intent)` (same category/brand, MODEL filter dropped)
  + `rankOffers(intent, offers, {applyBudgetFilter:false})` soft mode + `buildFallback(intent, ranked,
  broadenedRanked?)` — exact/closest from model-scoped `ranked`, alternative/within_budget/related from the
  broadened+unfiltered pool (still 100% REAL fetched offers, de-duped). search.service resolves the broadened
  pool LAZILY only when exactCount<RELEVANCE_FLOOR_N. offers.service.spec + ranker.spec UNTOUCHED + green.
- **Talabat tests:** adapters.spec +4 (extract KWD→fils/section/restaurant/image, promo opr>pr vs -1 sentinel,
  truthfulness drop on missing/zero price, empty/malformed menu); food-resolver.spec +3 (synth dish-SKU,
  cache hit source=cache, kill-switch + failing-adapter partial []); fallback.spec now 11/11.
- **NEXT food:** Slice F-2 `PartnershipIngestAdapter` (tier:'ingest') + partner_menus/partners + admin upload
  (Lane 2, Jahez/Carriage legal coverage). Cross-restaurant dish-grouping (pg_trgm) deferred (intra-Talabat
  each dish = 1 offer today). Deliveroo render / Jahez residential = F-3/F-4, NOT on beta path.



## v2 re-skin + category-first + Western-numerals (mobile, 2026-06-26 — DONE, additive)
- **Tests after:** 88/88 api · 22/22 mobile (was 18; +4 `src/format.spec.ts`). mobile `tsc` clean.
  Web export builds (610 modules / 953kB, was 437/897kB — fonts+gradient+new routes bundled).
- **Theme (`src/theme.ts`):** v2 token VALUES from `tokens.css` `:root` (sand `#FBF8F3` canvas, teal
  `#0B6B5B`, deal-gold `#C8881C`, border `#E6DFD4`, card radius 16, chip/pill 999, sheet 24). Token
  NAMES unchanged → all screens pick up the look free. Added `gradient` export (brand `['#0E8C74',
  '#075345']`, accent `['#E0A93B','#C8881C']`) for `expo-linear-gradient`, and `font` map keyed to the
  REAL loaded family names (`Rubik_700Bold`, `IBMPlexSansArabic_500Medium`, …).
- **Fonts:** `expo-font` `useFonts` in `app/_layout.tsx` loads Rubik (400/700/800) + IBM Plex Sans
  Arabic (400/500/600) from `@expo-google-fonts/rubik` + `/ibm-plex-sans-arabic`. NOT gated — renders
  with system fallback if still loading/offline. Import the SPECIFIC weight constants (e.g.
  `Rubik_700Bold`) — the package's `index.js` re-exports a `./useFonts` module that breaks bare node
  resolve but works in Metro. Deps pinned in `apps/mobile/package.json` (`expo-font ~12.0.10`,
  `expo-linear-gradient ~13.0.2`, both google-fonts `^0.4.2`). Installed via `npx expo install`.
- **Category-first flow:** `app/categories.tsx` = NEW authed root / post-login landing (B1). 4 tiles:
  Electronics+Food ACTIVE → `router.push('/search?cat=<id>')`; Furniture+Cars disabled "قريباً/Soon"
  (dashed recessed). `cat` id maps 1:1 to `Sector` ('electronics'|'food') → forwarded straight to
  `search.startIntent({sector:cat})`. `app/index.tsx` is now a SPLASH/REDIRECT (authed → `/categories`;
  `?q=` demo affordance → `/search?cat=electronics&q=…` preserved for QA). `app/search.tsx` = relocated
  intent/clarifier/results, reads `cat`, header BACK chevron → `/categories` (router.replace), category
  as eyebrow. **PO decision: switching `cat` mid-search RESETS the funnel** (useEffect on `cat` clears
  intent+results). OTP `verify()` now `router.replace('/categories')` (was `/`). Paywall pushes
  `/paywall?cat=<cat>` and resumes to `/search?cat=<cat>&resume=1` (carries cat through the gate so the
  blocked intent re-runs on the right category screen). router.d.ts union += `/categories` + `/search`.
- **v2 components:** `VerdictRibbon.tsx` (SIGNATURE — gold accent-gradient + ✓ + "أوفر بـ X د.ك من
  المتوسط"; savings = avg−cheapest of REAL cards, dropped when ≤0, never invented) wraps rank #1 ONLY
  in search.tsx. `GradientButton.tsx` (brand-gradient CTA, used on paywall). ResultCard → v2 (radius 16,
  Rubik name, price in deal-gold via NumText). QuotaPill → full pill, 1-left = gold-soft warn,
  0-left = solid-brand gate. ClarifierQuestion → full-PILL chips, theme tokens (was local v1 hex).
  Paywall → bottom-sheet (scrim+grabber+gold crown+gradient CTA), sand canvas.
- **Western numerals (LOCKED):** `src/format.ts` = `toLatinDigits` (٠-٩ U+0660 + ۰-۹ U+06F0 → 0-9) +
  `formatCount` (`Intl.NumberFormat(`${locale}-u-nu-latn`)` + normalize guard). `src/components/NumText.tsx`
  = the RN `.num` span (writingDirection:'ltr' + digit-normalize) — wrap every numeric run (price, quota,
  ranks, OTP, counts). Server `formatFils` already emits Latin (JS toString). OtpInput already strips
  non-ASCII digits (`\D`). Profile phone placeholder `…٦٧`→`…67` (D7; phone is PII, not on /me).

## v2 BLANK-RENDER FIX (2026-06-26 — app RENDERS, screenshot-proven)
- **ROOT CAUSE (real, from CDP console, not a guess):** `Error: Attempted to navigate before mounting
  the Root Layout component...`. The NEW category-first `app/index.tsx` calls `router.replace('/categories')`
  in a `useEffect` on FIRST render. On the web/static export this effect can fire BEFORE the root `<Stack>`
  navigator has committed → the navigation THROWS → React unwinds → `#root` left with 0 children → BLANK
  white screen (same blank CLASS as SIM-HIGH-1, different cause: a pre-mount nav, not dup-React/illegal-fetch).
  expo-linear-gradient / expo-font / VerdictRibbon / new components were INNOCENT (red herrings in the brief).
- **FIX (minimal, root-cause):** gate the redirect on `useRootNavigationState()?.key` being defined (the
  navigator is mounted only once that key exists). `app/index.tsx`: import `useRootNavigationState`, add
  `if (!rootNavState?.key) return;` guard, dep `[rootNavState?.key]`. ~4 lines. expo-router 3.5.24 has the hook.
  Other `router.replace('/categories')` sites (otp.tsx verify, search.tsx back, paywall) are USER-ACTION
  handlers = post-mount = SAFE; only index.tsx redirects on mount. Do NOT delete this guard.
- **PROOF:** post-fix CDP console = CLEAN (no exceptions), `#root` childCount 1, body text = the AR category
  screen. Rebuilt export (`entry-4406733215101d35c95a45de8c7737e5.js`). RENDER screenshot on REAL booted
  iPhone 17 Pro sim: `team/qa/sim/v2-categories-fixed.png` (Electronics+Food active tiles, Furniture/Cars
  "قريباً·Soon" dashed, sand v2 look, Western numerals). Drove 1 step deeper: `team/qa/sim/v2-search-step.png`
  (cat→search, clarifier Q1 full-pill chips 256/128/512 جيجابايت, teal ابحث CTA — funnel runs live vs API).
- **Tests stayed green:** 88/88 api · 22/22 mobile · mobile tsc clean.
- **TAKEAWAY (durable):** any on-MOUNT `router.replace/push` in an expo-router screen on the web export MUST
  guard on `useRootNavigationState()?.key`. Building ≠ rendering — always CDP-console + sim-screenshot prove.
- **RUN CMD (PO reload):** SPA `node /tmp/spa-server.mjs <repo>/apps/mobile/dist 8765` (SPA fallback→index.html);
  API on :3000 already up. Sim: `xcrun simctl openurl booted http://localhost:8765/`.

## ADR-006 Phase-1 SOCIAL (Instagram) lane — MOCK-FIRST, RENDER-PROVEN (2026-06-26, additive)
- **Tests: 102/102 api (was 88; +14 `offers/adapters/social/social-ingest.spec.ts`) · 22/22 mobile · tsc clean.**
- **GOAL:** FREE mock demo of IG "social offers" for FOOD (IG restaurants) + REAL ESTATE (flats), no paid
  API/key/live IG. REAL Claude does the extraction (ANTHROPIC_API_KEY in repo-root `.env`). All 4 AC
  RENDER-proven on the real iPhone 17 Pro sim + CDP full-page (shots in `team/qa/sim/social-*.png`).
- **`Sector` += `'realestate'`** (shared/domain.ts). `ProviderAdapter.tier` += `'social'`; `.sector` +=
  `'realestate'`. NO change to search/intent/ranking spine shape (ADR-006 §2 — orchestrator still only
  calls resolveOffers).
- **NEW dir `apps/api/src/offers/adapters/social/`:**
  - `social-provider.ts` — `SocialProvider` sub-iface (acquisition) + `RawPost` {id,ownerHandle,caption,
    imageUrl,permalink,timestamp,vertical}. `mock-social-provider.ts` = `MockSocialProvider` (DEFAULT,
    SOCIAL_PROVIDER=mock): **14 seeded posts** (8 RE flats Salwa/Salmiya/Mahboula/Hawally/Jabriya/Mangaf
    — mix literal-rent + "السعر بالخاص/DM"; 6 food meal-prep/grill/breakfast/coffee + 2 DM desserts).
    Each post real permalink `instagram.com/p/<code>/`, handle, placeholder img, AR/EN caption, posted_at
    ≤30d (anchored NOW=2026-06-26). Light EN→AR area-alias pre-rank so "salwa" floats Salwa posts.
    `apify-social-provider.ts` = `ApifySocialProvider` (SOCIAL_PROVIDER=apify, CONFIG-READY STUB, throws
    until APIFY_TOKEN+allow-list — NOT the demo path).
  - `social-extractor.ts` — `SocialExtractor` iface + Food/RealEstate extract shapes (ADR-006 §2a).
    `anthropic-social-extractor.ts` = REAL Claude (forced tool_use `emit_food_offer`/`emit_realestate_
    offer`, SDK dynamic-import, model SOCIAL_EXTRACT_MODEL||CLAUDE_MODEL||opus-4-8). `mock-social-
    extractor.ts` = deterministic regex stand-in (offline/tests; `parseKwdPrice` 420د.ك/12.500/230دينار→
    fils, null on DM). Selected: SOCIAL_EXTRACTOR=anthropic (default WITH key) | mock.
  - `social-ingest.adapter.ts` = `SocialIngestAdapter` (tier:'social', ONE per vertical: providerId
    `prov_social_food`/`prov_social_realestate`). discover()→provider.fetchPosts(30d)→1 ProductRef/post
    (RawPost as payload); fetch()→re-serve post (NO IG round-trip — we never fetch IG); extract()→Claude
    →NormalizedOffer. **TRUTHFULNESS (code, not prompt):** `priceLiterallyInCaption(fils,caption)` regex
    requires the KWD/dinar number ADJACENT to a currency marker → else priceFils=0 + attrs.priceOnRequest
    ='true' (card shows "price on request — see post"; NEVER invents). permalink+postedAt VERBATIM into
    attrs+deeplink+fetchedAt. Title = item / `rooms·area·furnished` (handle shown separately as provider).
  - `social-resolver.ts` = `SocialOfferResolver` (mirrors FoodOfferResolver): synth `Sku`+`Offer` per
    post, providerName=`@handle`, deeplink=permalink, 6h cache (`SOCIAL_TTL_MS` in offer-cache.ts).
- **OffersService wiring:** `socialAdapters=[Social('food'),Social('realestate')]` (MOCK-FIRST → runs
  offline, NOT gated by LIVE_FETCH). resolveOffers: `realestate`→social only; `food`→Talabat(LIVE-gated)
  MERGED with social via Promise.all. `withSocialLayer()` test hook. resolveBroadened treats realestate
  like food (no model-adjacency).
- **search.service `pinIntentToSector()`** (NEW, LOAD-BEARING): for food/realestate the SECTOR (user's
  category tile) is AUTHORITATIVE — pins intent.category=sector + model=intentRaw, because real-Claude's
  free-form category ("apartment_rent") would miss the resolver branch. Called at top of runSearch.
- **fallback.ts `DISCOVERY_SECTORS={food,realestate}`:** isExactMatch short-circuits TRUE for these (each
  discovered dish/flat IS an exact result; the electronics model-substring/adjacent-model/related-category
  fallback machinery does NOT apply). Only a stated budget excludes (and never a price-on-request offer).
  WITHOUT this, food+RE rendered 0 cards (fallback.classify returned null for all synth offers).
- **ranker.ts:** RE area spec-match (offer whose attrs.area is in the query text gets SPEC_MATCH_WEIGHT →
  Salwa floats first); price-on-request (priceFils=0 + priceOnRequest) gets PRICE_ON_REQUEST_PENALTY so it
  ranks BELOW real-priced offers (its price is unknown, not zero), never "cheapest".
- **assembleCards:** priceLabel for price-on-request → localized "السعر بالخاص — شوف البوست" / "Price on
  request — see post" (NOT formatFils(0)).
- **mock-claude:** detects realestate intent (شقة/للايجار/flat/apartment/rent/bedroom…) → category=
  'realestate', model=raw; food regex widened (+meal prep/dessert/cake/coffee/حلى/كيك/قهوة/وجبات). NEW:
  for sector food|realestate (or that category) mock-claude returns needClarification=FALSE (skips the
  electronics storage/color clarifiers — discovery sectors go straight to results, bounded + deterministic).
- **MOBILE:** `categories.tsx` 3rd ACTIVE tile "عقارات (شقق)/Real Estate" 🏢 (Cars now the only Soon tile).
  `search.tsx` + `paywall.tsx`: cat map += realestate; CAT_EYEBROW/CAT_PLACEHOLDER += realestate.
  `ResultCard.tsx`: when deeplink matches instagram.com → teal **"شوف على إنستقرام / View on Instagram"**
  📷 CTA pill (whole card already opens the permalink). i18n += catRealEstate, viewOnInstagram, catNote/sub
  updated. Western numerals + RTL reused.
- **RENDER PROOF (real iPhone 17 Pro sim + CDP):** `social-categories.png` (3 active tiles incl. RE),
  `social-realestate-results.png`/`-full.png` (8 RE flats: 6 priced KWD + 2 "السعر بالخاص — شوف البوست",
  Salwa-first, VerdictRibbon, IG CTA — REAL Claude extraction), `social-food-results.png`/`-full.png`
  (7 IG food offers: burger/breakfast/coffee/grill/meal-prep priced + 2 DM desserts price-on-request).
- **VERIFY RUN CMD (isolated ports — did NOT touch PO :3000/:8765):** API `cd apps/api && DOTENV_CONFIG_
  PATH=<repo>/.env CLAUDE_PROVIDER=mock LIVE_FETCH=off BILLING_PROVIDER=mock SOCIAL_PROVIDER=mock
  SOCIAL_EXTRACTOR=anthropic PORT=3101 node -r dotenv/config dist/main.js` (CLAUDE_PROVIDER=mock = bounded
  clarifier so `?q` lands on results; SOCIAL_EXTRACTOR=anthropic = REAL Claude reads captions). Web: edit
  app.json extra.apiBaseUrl→:3101, `npx expo export --platform web --output-dir /tmp/bo-dist-3101`,
  RESTORE app.json, **then sed-patch the export's baked `localhost:3000`→`:3101`** (expo bakes the
  apiBaseUrl into the manifest at export; a post-export edit is needed). Serve `node /tmp/spa-server.mjs
  /tmp/bo-dist-3101 8767`; `xcrun simctl openurl booted http://localhost:8767/search?cat=realestate&q=…`.
  GOTCHA: real-Claude clarifier (CLAUDE_PROVIDER=anthropic) loops/varies budget questions + can parse
  "٥٠٠ دينار" as fils-vs-KWD non-deterministically → use mock clarifier for the screenshot; real-Claude
  EXTRACTION (anthropic) is the verified core. RN-web Pressables don't reliably take scripted CDP clicks.
## APIFY HANDLE SEEDING (DIRECT sellers) + HASHTAG DISCOVERY (2026-06-27 — 162/162 api, REAL-proven)
- **Tests: 162/162 api (was 156; apify-social-provider.spec 6→13).** `apify-social-provider.ts` reworked.
- **HANDLES.food = 39 [V] DIRECT-seller handles** (food-instagram-accounts.md "Seed list"): 16 meal-prep
  (basickuwait, scale.kuwait, chefpaulkitchen, portionkw, themealboxkw, …caloriecontrol) FIRST, then 16
  home-bakers (layers_kw, bakehaus.kuwait, cakentakekw, js_bakery…), 2 grills (mashawi.kw, mashawikw), 5
  cloud/IG-led (kuwaitkitchensgroup, burgerinn.kw, bbtkw, mug.cr, collective_kw). **REMOVED the old
  aggregator handles** (offer_food_kw, kuwait_eateries) per the DIRECT-seller rule; CONFIRM-only excluded.
- **HANDLES.realestate = 4 [V] direct flat-listers** (real-estate-instagram-accounts.md "Seed list"):
  majestic_kuwait, amadell_for_rent, q8_rent (furnished operators), reokuwait. Portals (q84sale/boshamlan/
  bayut/opensooq) deliberately NOT here — they're the separate portal layer.
- **HASHTAG DISCOVERY (opt-in, `SOCIAL_HASHTAG_DISCOVERY=on`, default off):** captures the home-kitchen/
  من-المالك long tail that can't be hand-listed. `DISCOVERY_HASHTAGS={food:[foodkuwait,مطبخ_منزلي_الكويت],
  realestate:[kuwaitrealestate,شقق_للايجار_الكويت]}`. **REAL FINDING (live probe 2026-06-27, durable):** the
  post-scraper's `searchType:hashtag` + `resultsType:posts` returns only tag ENTITIES (`/explore/tags/` row,
  no caption) on the free tier — USELESS for posts. The DEDICATED actor **`apify/instagram-hashtag-scraper`**
  (`APIFY_IG_HASHTAG_ACTOR`, `~` in run path) with body `{hashtags:[…],resultsLimit,onlyPostsNewerThan:"30
  days"}` DOES expand tags into real recent POSTS (caption+permalink+owner). ONE run takes the whole hashtags
  array (1 call, 1 cap charge). Very-niche AR tags (مطبخ_منزلي_الكويت) often return `error:no_items` (IG has
  few/none indexed — matches researcher §3) → mapRow drops them; busy tags (foodkuwait) return real posts. So
  each vertical LEADS with a busy tag + keeps the niche AR tag (free when empty).
- **Pipeline (apify-social-provider.ts):** `fetchPosts` = handle-mode (always) + hashtag-mode (gated) →
  `dedupeByPermalink([...handle,...hashtag])` (EXPORTED, unit-tested) → rankByQuery. Cache keyed
  `${vertical}:${mode}` (handle/hashtag cache independently, 6h SOCIAL_TTL_MS). Cost guards INTACT + shared:
  ONE monthly call cap (SOCIAL_MONTHLY_RESULT_CAP=50) covers BOTH modes; perHandleLimit (APIFY_RESULTS_LIMIT,
  ≤30); perHashtagLimit (APIFY_HASHTAG_RESULTS_LIMIT, ≤15, default 5). `runActor(actor,body,vertical)` now
  takes the actor id so handle vs hashtag use different actors.
- **REAL E2E PROOF (credit-bounded: APIFY_RESULTS_LIMIT=1, APIFY_HASHTAG_RESULTS_LIMIT=3):** drove the
  COMPILED provider, SOCIAL_PROVIDER=apify + SOCIAL_HASHTAG_DISCOVERY=on, food "meal prep box" → **24 posts
  (21 from seeded handles + 3 long-tail hashtag-only)**, deduped. Seeded: @tuningkw, @mug.cr, @bakingstudio
  kuwait, @chefpaulkitchen, @cakentakekw, @bakehaus.kuwait — real permalinks (p/DZ1ybhBlsKK/, p/DaCtDBKimw_/).
  Long-tail (NOT in hand list): @duaij_alkandari, @alkashkhaa.bh. Then REAL Claude (haiku) extraction on those
  real posts: @alkashkhaa.bh caption "بـ 1.500 دينار" → `{isOffer:true,priceFils:1500}` (REAL price from a
  hashtag-discovered post); @bakehaus.kuwait/@mug.cr no literal price → `priceFils:null` (price-on-request).
  Truthfulness holds. **CREDIT IMPACT this verify: ~39×1 + ~2-tags×3 ≈ 45 results ≈ $0.10 of free credit.**
- **Tests added (mock the Apify HTTP, NO real calls in suite):** handle-seeding (food targets [V] direct
  sellers, EXCLUDES aggregators; RE seeded, EXCLUDES portals); hashtag-input mapping (off by default; on →
  ONE instagram-hashtag-scraper run with {hashtags}, long-tail owner flows through); dedup (permalink repeat
  across handle+hashtag → 1); monthly-cap across both modes (cap=1 → only first run executes); dedupeByPermalink.
- **APIFY CREDIT NOTE (owner):** free-tier token. Handle run = ~39 handles × perHandleLimit posts; hashtag run
  = 1 call for all tags × perHashtagLimit each. Behind 6h cache (user traffic never triggers) + monthly cap.
  Hashtag discovery is OFF by default — flip SOCIAL_HASHTAG_DISCOVERY=on only when you accept the extra pulls.
  hashtag-scraper actor must exist on the account (apify/instagram-hashtag-scraper, free to use, pay-per-result).

## REAL APIFY IG + v2 HIGH-defect fixes (2026-06-26 — 120/120 api · 22/22 mobile, REAL-proven)
- **GOAL 1 — REAL Apify Instagram lane LIVE.** `apify-social-provider.ts` `fetchPosts` IMPLEMENTED (was
  stub). VERIFIED REAL call shape (free-tier APIFY_TOKEN in repo .env, SOCIAL_PROVIDER=apify): `POST
  https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN`
  body `{directUrls:["https://www.instagram.com/<handle>/"],resultsType:"posts",resultsLimit:N,
  onlyPostsNewerThan:"30 days"}` → HTTP 201 (~20-40s, synchronous) JSON ARRAY of rows
  `{id,shortCode,caption,hashtags,url,timestamp,displayUrl,ownerUsername}` (url=permalink, timestamp=ISO).
  `mapRow(row,vertical)` (EXPORTED, unit-tested) → RawPost; **skips `{error:'not_found'}`/error rows +
  caption-less + permalink-less rows.** Actor id `apify/instagram-scraper`→`apify~instagram-scraper`
  (`/`→`~` in run path). [HANDLES SUPERSEDED 2026-06-27 — see top section: FOOD=39 [V] direct sellers
  (aggregators removed), RE=4 [V] direct listers, + opt-in hashtag discovery.]
  COST GUARDS: in-process TTL cache per vertical (SOCIAL_TTL_MS 6h — user traffic NEVER triggers a run) +
  monthly call cap (SOCIAL_MONTHLY_RESULT_CAP, default 50; month rollover resets; cap-hit serves stale
  cache or []) + perHandleLimit (APIFY_RESULTS_LIMIT, default 10, hard-max 30). Mock stays default for
  offline/tests. **REAL E2E PROVEN:** SOCIAL_PROVIDER=apify + SOCIAL_EXTRACTOR=anthropic, food "offer" →
  real IG posts (offer_food_kw/mug.cr/kuwait_eateries) → REAL Claude extract → cards w/ REAL permalinks
  (e.g. `instagram.com/p/DZ2S4cCMAQd/`, `/DZxvz_OCGwA/`). Captions w/o literal KWD → "السعر بالخاص — شوف
  البوست" (truthfulness guard, correct). Full app (Talabat LIVE + Apify merged): 273 cards, 3 IG-tagged.
- **D-V2-1 FIXED (HIGH) — root cause was NOT the Talabat adapter.** FoodOfferResolver returns 55/289/67
  real dishes fine (unit-proven). The real cause: with CLAUDE_PROVIDER=anthropic, `assembleCards` →
  `this.claude.explainRanking()` was awaited with NO try/catch; the real Claude hit `stop_reason=
  max_tokens` on 55+ food offers and THREW → entire `/search` 500'd → QA saw "0 cards". FIX (search.
  service.ts assembleCards): wrap explainRanking in try/catch → `explanations=[]` on failure; every card
  already has a data-only "why" fallback (verifyCitation path) so it degrades, never blocks. The "why" is
  the ONLY model-authored field; price/provider/deeplink are DATA. **DO NOT remove this guard.** Mock
  Claude never reproduced this (it skips food clarifiers + returns explanations) — only real Claude did.
- **D-V2-1 #2 FIXED — real Claude asked electronics clarifiers (storage/color/budget) for "kfc".**
  Mock-claude returns needClarification=false for food/realestate; real Claude does NOT honor that. FIX
  (search.service.ts `advance`): `isDiscoverySector = sector===food||realestate` → `canAskMore=false` →
  discovery sectors go STRAIGHT to results (deterministic across both providers). clarifierCount=0 now.
- **D-V2-2 verified (HIGH) — empty state already returns `broadenSuggestions` (search.service.ts:186,
  always ≥1 via the category-pivot fallback in fallback.ts:233).** QA saw none only because the run 500'd
  before reaching the empty branch (the explainRanking throw above) — the D-V2-1 fix makes it reachable.
  Confirmed live: electronics impossible-model → state=empty + broadenSuggestions=[{model,category,
  "Browse the whole category"}]; food genuine-empty path same.
- **TESTS +10:** `apify-social-provider.spec.ts` (mapRow real row / not_found skip / shortCode-derived
  permalink / caption-less skip / token-missing throws / no-handle vertical []) + `search-resilience.spec
  .ts` (explainRanking-throws→still results+data-only why; food discovery→clarifierCount 0; empty→≥1
  broaden). SearchService unit-constructed w/ flaky-Claude stub + real SessionStore/EventsService.
- **GOTCHA (durable):** run api specs from `apps/api` (its own jest+ts-jest config); root `npx jest` uses
  babel parser on .ts → SyntaxError. Apify run-sync call takes 20-40s (synchronous actor) — fine for a
  scheduled delta-pull behind the 6h cache, NOT for per-request live (cache decouples it, by design).
- **STILL TODO (ADR-006 go-live):** persist social_offers table + tracked_accounts admin CRUD + BullMQ
  delta-pull scheduler (cache is in-process now); seed RE handles; LEGAL Meta ToS/IP/PII sign-off (gate
  tos_reviewed=false internal-only). Apify token is free-tier — watch the monthly cap.

- **MOCK→REAL go-live (ADR-006) [SUPERSEDED above for food]:** RE lane + tracked_accounts table + BullMQ
  scheduler + legal sign-off still pending; food Apify lane now REAL + proven.

## History (terse — durable facts preserved; full narrative pruned 2026-06-26)
- **Sprint 2.5:** monorepo (ADR-001/002). `npm run demo` = migrate→seed→API:3000→Expo Web; `demo:export`→
  `apps/mobile/dist/`. W6→W7→W9 intent→clarifier→cards in `app/index.tsx`.
- **Sprint 2.6 Slice A (X-cite+Blink LIVE):** Tier-1 adapters, deterministic, no browser/Claude.
  `ProviderAdapter` iface FROZEN (discover→fetch→extract). `resolveOffers` ASYNC. `LiveOfferResolver`
  (allSettled, 1.5s/site timeout, 15min cache, partial results), `priceTokenInSource` truthfulness drop.
  `LIVE_FETCH=off`=offline (jest.setup forces off). X-cite product `/{slug}/p`=`__NEXT_DATA__`
  {name,sku,price:{value}}; discovery=hand-verified sku→slug map (4 iPhone-16 slugs). Blink=Shopify:
  `/search/suggest.json` + `/products/{handle}.json` (variants[].price KWD string). Proof: `live:offers`.
- **ADR-003 Slice B (Eureka LIVE, Tier-2 Algolia XHR sniff, NOT full render):** in `LIVE_PROVIDER_IDS`.
  DURABLE creds (Eureka home hidden inputs): appId `#cky`=5GPHMAA239, search key `#srcapk`=
  3d7dbc330852592da244c87ae924a221, index instant_records (AR instant_records_ar). Query=POST
  `https://5GPHMAA239-dsn.algolia.net/1/indexes/instant_records/query` + 2 algolia headers +{query,hitsPerPage}.
  Hit fields: itmn=title,bn=brand,cn=category,ipic=image,clprc/clprcv=current KWD,lprc=was,avaqt=stock,
  objectID=id. PDP=`/products/details/{objectID}?name=…`. discover()=1 POST, hit→ProductRef.payload,
  fetch() re-serves payload (no 2nd trip). `render-fetch.ts renderHtml()` (Playwright pool, lazy import,
  throws RENDER_UNAVAILABLE if dep/binary absent) INSTALLED but off hot path (`npx playwright install
  chromium` to enable). Per-tier TIER_TIMEOUT_MS {http:1500,render:5000,render_residential:8000}.
- **iPhone-16 no-results BUG FIXED:** removed storage/color HARD filter from `matchSkus` (match on
  category/brand/model identity only; storage/color/budget = SOFT RANK in `rankOffers`). Empty state ONLY
  when model has 0 SKUs. Added optional `ResultCard.matchesPreferences?` (display tag, never filters).
- **LIVE-NONMOCK:** `AnthropicClaudeClient` clarify+explainRanking IMPLEMENTED (forced tool_use, structured
  JSON; model claude-opus-4-8, env CLAUDE_MODEL). DI bug fix RULE: a Nest provider ctor param needs an
  injectable type/token/@Inject/@Optional — a bare defaulted param crashes DI (key now read via getter from
  process.env). Mockable via CLAUDE_CLIENT token (MockClaudeClient default offline). Billing still mock.
  RESTART CMD: `lsof -ti :3000|xargs kill -9`; `npm run build:types && npm run build --workspace=apps/api`;
  from apps/api: `DOTENV_CONFIG_PATH=<repo>/.env LIVE_FETCH=on BILLING_PROVIDER=mock PORT=3000 node -r
  dotenv/config dist/main.js`. (GOTCHA: stale ts-node-dev squats :3000 with a mock /health — free port first.)
- **Supabase provisioned (schema LIVE):** project ruzthjvtlnmdkdamnuxa, Tokyo txn-pooler :6543. DDL in
  `apps/api/src/db/postgres/` (0001 catalog, 0002 accounts/billing keyed to auth.users uuid +
  on_auth_user_created trigger, 0003 RLS). Runner `npm run db:supabase:push` (idempotent, REPO-ROOT .env).
  avatars bucket live (private, per-uid RLS). JWKS uses **ES256** (P-256) asymmetric keys (NOT HS256).

## SUPABASE RUNTIME CUTOVER — DONE + REAL-PROVEN (2026-06-26, additive, default stays SQLite)
- **Tests: 102/102 api green on SQLite default · mobile untouched (22).** App boots keyless in default mode
  (`db:sqlite,auth:local,storage:local`) AND boots clean with `DB_DRIVER=pg AUTH_MODE=supabase STORAGE_PROVIDER=supabase`.
- **Async DB port** `apps/api/src/db/db.port.ts` (`Db`: get/all/run/tx + `rewritePlaceholders` ?→$n). Drivers:
  `sqlite-db.ts` (SqliteDb wraps better-sqlite3 sync→resolved Promise; `.handle` still exposed for specs;
  RETURNING via .get) and `pg-db.ts` (PgDb, **pg dynamic-imported**, `ssl:{rejectUnauthorized:false}`,
  pool max 8). `db.service.ts` is now a DRIVER-SELECTING FACADE implementing `Db` (DB_DRIVER=pg|sqlite,
  default sqlite); lazily opens the pg.Pool on first query (ctor stays sync so `new DbService()` in specs +
  Nest DI unchanged); `.db` (sync handle) ONLY valid in sqlite mode.
- **PgDb TYPE NORMALIZATION (read side, back to SQLite-shaped expectations the services encode):**
  boolean→0/1, Date→ISO string, jsonb(object)→JSON string, int8/count→number, purely-numeric short string→
  number. **WRITE side gotcha (PROVEN):** Postgres ACCEPTS integer PARAM 1/0 for a boolean column (pg binds
  it ok) — but a SQL LITERAL `=1` FAILS ("type integer"). Only literal that works cross-dialect is `=true`.
  So changed profile.service `email_verified=1` literal → param `?,[…,1,…]`. better-sqlite3 takes number 1 fine.
  Do NOT pass JS booleans as better-sqlite3 params (it throws) — pass 0/1 ints everywhere.
- **TXN-POOLER (:6543) has NO session state:** PgDb.tx() checks out ONE pooled client for the whole
  BEGIN…COMMIT (any SET LOCAL/GUC must live inside one tx). No named/server-side prepared stmts.
- **Refactor (mechanical, all 5 services → `await this.dbs.get/all/run/tx(sql, params[])`):** auth.service
  (issueSessionForPhone/refresh/issueRefresh now async; tx() for first-signin 4-insert), profile.service
  (getProfile/updateProfile/applyEmailChange/verifyEmail async), quota.service, billing.service,
  mock+stripe billing providers. Controllers updated to await/return Promise (auth.refresh, accounts.* ).
  **Specs:** quota/billing already awaited (untouched); profile.spec + auth.spec edited to `await`/`rejects`
  (count unchanged at 102; specs still seed/inspect via sync `dbs.db.prepare` in sqlite mode).
- **AUTH JWKS** (`auth/supabase-jwks.ts`, ZERO deps, Node crypto + fetch): AUTH_MODE=supabase verifies real
  Supabase access tokens via `<URL>/auth/v1/.well-known/jwks.json` (cached 10min by kid). Supports RS256/
  **ES256**(ieee-p1363→DER via dsaEncoding)/EdDSA; REJECTS HS256/keyless (forged) tokens. JwtService gained
  async `verifyAccessAsync()` (dispatches by AUTH_MODE; default=local HS256, unchanged sync `verifyAccess`).
  **AuthGuard is now ASYNC** (`canActivate→Promise<boolean>`), injects DbService; Supabase token has NO
  pseudo_id claim → guard resolves sub→profiles.pseudo_id (1 query). PROVEN: real ES256 token ACCEPTED
  (sub matches), forged HS256 REJECTED, signature-tampered REJECTED.
- **STORAGE** `accounts/storage.interface.ts` `SupabaseStorage` (STORAGE_PROVIDER=supabase, REST not SDK,
  service-role): put→`avatars/{uid}/avatar.<ext>` x-upsert, url→signed 1h, remove→DELETE. `selectStorage()`
  selector wired in accounts.module (default LocalDiskStorage).
- **REAL PROOF (live project, self-cleaning harnesses, NOT just builds):**
  - `apps/api/scripts/verify-supabase-runtime.mjs` — admin-creates auth.users (trigger→profiles+quota), then
    through the COMPILED dist services in pg mode: ProfileService.updateProfile wrote "محمد الشريف"+jsonb+bool
    biometric → independent service-role read confirms persisted; QuotaService freemium 5-allow/6th-PAYWALL →
    `search_quota.used_count=5` in Supabase; 25 concurrent at cap → 0 allowed (race-safe on PG); SupabaseStorage
    PNG upload → signed-URL fetch 200 + storage.objects row present.
  - `apps/api/scripts/verify-supabase-jwks.mjs` — mints a REAL ES256 token (password sign-in) → accept/reject proof.
  - `apps/api/scripts/http-authed-check.mjs` — booted REAL Nest app on :3201 (DB_DRIVER=pg AUTH_MODE=supabase),
    `GET /me`→200 (profile from Supabase, pseudoId guard-resolved), `GET /me/quota`→200, no/garbage token→401.
- **RUN CMD (Supabase mode):** `cd apps/api && DOTENV_CONFIG_PATH=<repo>/.env DB_DRIVER=pg AUTH_MODE=supabase
  STORAGE_PROVIDER=supabase BILLING_PROVIDER=mock PORT=3000 node -r dotenv/config dist/main.js` (build first:
  `npm run build:types && npm run build --workspace=apps/api`). `/health.providers.db/auth/storage` reflect mode.
- **NOT cut over (intentional, mock/local still):** Stripe billing still mock (StripeBillingProvider
  config-ready). main.ts rawBody for real Stripe webhook still TODO. SUPABASE_JWKS_URL/JWT_ISSUER not in
  .env → derived from SUPABASE_URL.

## WHATSAPP OTP — Football-replicated, LIVE in BOTH modes (2026-06-26, additive)
- **Tests: 110/110 api (was 102; +8 `auth/providers/twilio-otp-sender.spec.ts`).** Mock default stays green.
- **FOOTBALL'S ACTUAL METHOD (verified `/Football/src/contexts/AuthContext.tsx`):** NO direct Twilio code.
  It delegates to SUPABASE AUTH phone-OTP: `supabase.auth.signInWithOtp({phone, options:{channel:'whatsapp'}})`
  to SEND, `supabase.auth.verifyOtp({phone, token, type:'sms'})` to VERIFY. Supabase Auth is wired (dashboard
  → Auth → SMS provider) to TWILIO via TWILIO_ACCOUNT_SID/AUTH_TOKEN/TWILIO_PHONE_NUMBER and delivers over
  Twilio's WhatsApp channel. Football's `docs/TODO.md`: "Code already calls signInWithOtp({phone}) — this is
  config only." So the underlying transport = Twilio WhatsApp channel (whatsapp: From/To on Messages.json).
- **REPLICATION (BestOffers runs its OWN OTP flow):** `auth/providers/twilio-otp-sender.ts` reproduces that
  transport: POST `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`, Basic auth, form body
  `From=whatsapp:{number} To=whatsapp:{e164} Body={code …}`. SMS fallback = plain From/To same endpoint.
  Uses Football's env name `TWILIO_PHONE_NUMBER` (overrides TWILIO_WHATSAPP_FROM/TWILIO_SMS_FROM optional).
  Selected by OTP_PROVIDER=twilio (covers 360dialog). Spec mocks fetch → asserts endpoint+payload shape.
- **BOTH MODES:** SQLite mock-default unchanged (verify 000000). For Supabase pg mode, NEW pg migration
  `db/postgres/0004_custom_otp_plane.sql` creates `public.auth_users`+`auth_otps`+`auth_sessions` (0002 PG
  port had OMITTED them, assuming Supabase-Auth-owned identity) and RE-POINTS profiles/subscriptions/
  search_quota/notification_tokens FKs from `auth.users` → `public.auth_users` so issueSessionForPhone's
  inserts succeed under the custom JWT plane. (AUTH_MODE=supabase path = unaffected; it never calls
  issueSessionForPhone — that's a separate proven path.) Applied via `npm run db:supabase:push` (auto-picks
  the new .sql). PROVEN LIVE: DB_DRIVER=pg request→verify(000000) against Supabase persisted real auth_users
  +profile+quota(0)+sub(none), FK-linked, then cleaned up.
- **SANDBOX SENDER WIRED + VERIFIED (2026-06-26, 121/121 api; +1 spec):** owner set `OTP_PROVIDER=twilio`,
  `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (sandbox), `TWILIO_SMS_FROM=+12602543269`. `/health`→`otp:twilio`
  (booted real Nest :3112 w/ repo .env). **BUG FOUND+FIXED (real):** `.env` From already carries the `whatsapp:`
  prefix, but `send()` prepended it again → `whatsapp:whatsapp:+1415…` (Twilio rejects). FIX: `bareNumber()`
  strips a leading `whatsapp:`/`sms:` before re-prefixing → exactly one prefix. Spec contract (bare-number env)
  UNCHANGED + green; added regression test for the already-prefixed sandbox value. DRY-RUN against real .env
  (fetch intercepted, NO send): WA `From=whatsapp:+14155238886 To=whatsapp:<dest>` AR body, SMS fallback
  `From=+12602543269 To=<dest>` plain — both POST `Messages.json` w/ real SID AC416b…, Basic auth.
- **ONE-SHOT LIVE-SEND PATH:** `apps/api/scripts/send-sandbox-otp.mjs` (thin CLI over compiled TwilioOtpSender).
  GUARDED: refuses w/o a valid E.164 dest (exit 2 — proven), checks OTP_PROVIDER=twilio + health. RUN (only with
  an opted-in number): `cd apps/api && DOTENV_CONFIG_PATH=<repo>/.env node -r dotenv/config
  scripts/send-sandbox-otp.mjs +9655XXXXXXX [code] [ar|en]`. NOT run yet (no number supplied). GOTCHA: pass
  DOTENV_CONFIG_PATH explicitly — `-r dotenv/config` from apps/api otherwise looks for apps/api/.env (none).
- **OWNER OPT-IN STEPS (sandbox delivery):** Twilio Console → Messaging → Try it out → Send a WhatsApp message;
  from the DESTINATION phone send `join <two-words>` to +1 415 523 8886. Opt-in lasts 24h (re-join if lapsed).
  Sandbox = freeform body, NO approved template needed (templates only for production WA Business sender).
- **LIVE-SEND BLOCKER (real, from Twilio API w/ the .env creds):** Account is TRIAL ("HighMarks"). Football's
  number +12602543269 has SMS+Voice ONLY — **NOT WhatsApp-enabled**. Only WA sender on the account is
  whatsapp:+14155238886 (= Twilio SANDBOX, status OFFLINE). So OTP_PROVIDER=twilio + whatsapp channel will
  401/fail until: (a) recipient opts into the Twilio WhatsApp Sandbox (msg the join code to +14155238886) and
  set TWILIO_WHATSAPP_FROM=+14155238886; OR (b) a real WhatsApp Business sender is approved. SMS works today
  (the +12602543269 number is SMS-capable, trial → only verified destination numbers).
- **RENDER-FIX (app RENDERS):** root cause = duplicate React in web bundle → null hook dispatcher. FIX =
  `apps/mobile/metro.config.js` (LOAD-BEARING, do NOT delete) pins react/react-dom/jsx-runtime to mobile copy.
  2nd bug: `src/api/config.ts` passed bare global `fetch` → `Illegal invocation`; fixed with boundFetch.
  Pixel proof in `team/qa/sim/`. `app/index.tsx ?q=<intent>` auto-runs search (demo affordance). SPA-fallback
  server needed to serve `expo export --platform web` single-page export. EXPO UPGRADE (SDK51→57, React19,
  New-Arch) DEFERRED — high regression risk; web-stable now, native upgrade is a separate owner task.
- **QA-fix pass (HIGH defects):** D1-1 isPremium=active/trialing OR (canceled AND period_end>now), shared
  `isPremiumStatus` in billing-provider.interface (Mock+Stripe); webhook COALESCE keeps period_end on cancel.
  D1 FE post-subscribe resume replays the EXACT 402'd request (`src/search/resume.ts`). D2 FE biometric/notif
  explainer sheets before toggle (`src/settings/explainerGate.ts`). OTP body field=`phoneE164`, dev code 000000.
  TEST-ISOLATION: all e2e use `makeTestDb()` (fresh temp sqlite via SQLITE_PATH before module compile).
- **Phase 2a backend (mock-first, ADR-004):** auth/accounts/billing/quota/db. 3 externals behind FROZEN
  interfaces+mock impls: OtpSender (Mock/WhatsApp/Twilio), BillingProvider (Mock/Stripe), Storage (LocalDisk/
  Supabase). Identity LOCAL HS256 (JwtService; swap-in = verifyAccess→JWKS). Freemium = ADR-004 Decision 5:
  atomic single `UPDATE search_quota SET used_count+1 WHERE used_count<5 RETURNING` (race-safe); premium
  bypass first; enforced in runSearch at value-delivery (after clarifiers); 402 {error:PAYWALL,used,limit};
  only authed searches metered. GATE TIMING: clarifying does NOT decrement; answer/skip to terminal to meter.
- **Phase 2b mobile (mock-first):** expo-router screens login/otp/profile/edit/settings/paywall/subscription;
  N8 QuotaPill + paywall interception + resume. Infra: theme/i18n/locale/secureStorage/session/accountsClient/
  config. `typedRoutes` DISABLED (router.d.ts hand-maintained — add route to the union when adding a screen).

## FOOD "Chilled with rice" → 274 unrelated sauces BUG (2026-06-27 — OWNER, REAL-proven, 171/171 api)
- **ROOT CAUSE #1 (the dump):** `FoodOfferResolver.queryMatchedRestaurant` used a LOOSE substring slug
  match over ALL discovered slugs. The resolver over-fetches 6 restaurants for a dish query, so when ANY
  dish token coincidentally appeared in SOME slug ("rice" in `rice-house`, "chicken" in `chicken-tikka`),
  the WHOLE query flipped to restaurant-mode → `restaurantQuery=true` → `filterDishesByQuery` returned the
  ENTIRE unfiltered menu (sauces + everything). "Chilled with rice" → "rice" hit a slug → 274 items dumped.
  **FIX (`food-resolver.ts`):** a slug match now only counts as RESTAURANT query if the matching token is
  (a) NOT a recognized food/dish term (`isRecognizedFoodToken`) AND (b) a WHOLE-token slug match (not loose
  substring). So "kfc"/"burger king"(via "king") = restaurant; "rice"/"chicken"/"Chilled with rice" = dish.
- **ROOT CAUSE #2 (test/seed + condiments leaking):** "Test Burger King" + condiment-only sections showed.
  **FIX (`food-relevance.ts`):** `isTestRestaurant()` (TEST_MARKERS test/demo/qa/sample/تجريبي… whole-word,
  "Contest" safe) — dropped at discovery in resolver AND inside `filterDishesByQuery` (both modes).
  `isCondiment()` (sauce/mayo/dip/صوص/اضافه…) — condiments rank BELOW real dishes; a dish-term query matching
  ONLY condiments = no real hit (empty if recognized term, capped free-form otherwise).
- **ROOT CAUSE #3 (multi-word free-form bypass):** `STOP_WORDS` (with/and/chilled/spicy/مع/و…) + `foodTokens()`
  so a phrase tokenizes to its food signal ("Chilled with rice"→"rice" recognized). Free-form no-food-signal
  queries CAPPED at `FREEFORM_RESULT_CAP=24` — NEVER dump hundreds.
- **REAL PROOF (booted API :3000 LIVE_FETCH=on CLAUDE=anthropic, full HTTP /search/intent→answer):**
  "Chilled with rice" → **15 cards, ALL real rice/biryani** (Tikka Rice 0.750, White/Saffron Rice 1.100,
  Chicken Biryani 3.950, Rice Bowls) — **0 sauces, 0 Test-vendor**. "rice"/"برياني" → same set. "chicken" →
  14 real chicken dishes. Direct resolver probe vs real Talabat identical. The 274-dump is GONE.
  **Tests: 171/171 api (was 162; +9).** NOTE: real Claude now asks a food "people" clarifier (clarifier-sets
  .ts, added since prior memory) — skip through to reach results.
- **DURABLE:** never decide restaurant-vs-dish by loose slug substring — a dish token in an unrelated candidate
  slug poisons it. Gate on non-food WHOLE-token match. Strip test vendors at source + demote condiments.

## FOOD SEARCH accuracy + speed fix (2026-06-26 — "rice returns random food" BUG, REAL-proven)
- **Tests: 131/131 api (was 120; +8 `food-relevance.spec.ts`, +3 `food-resolver.spec.ts`).**
- **ROOT CAUSE (accuracy):** a DISH query ("rice") matched NO Talabat restaurant slug → `TalabatAdapter.
  discover` fell back to the first N restaurants → `FoodOfferResolver` returned their WHOLE menus
  unfiltered (ranker only sorts by price, never by query relevance). REAL proof: "rice" fetched **564
  dishes** (6 restaurants incl. burger-king/hardees/kfc) and dumped all of them.
- **FIX — `offers/adapters/food-relevance.ts` (NEW, deterministic, shared):** `normalizeFoodText`
  (lowercase + strip harakat/tatweel + أإآٱ→ا + ى→ي + ة→ه), `expandFoodQuery` (query tokens → AR+EN
  SYNONYM_GROUPS; rice⇄biryani/مجبوس/برياني/رز/أرز/مندي/كبسه…; +burger/pizza/chicken/shawarma/kebab/fish/
  pasta/coffee/dessert/breakfast/shrimp/fries groups), `scoreDish` (name hit 100 / category(menu-section)
  50 / desc 15; whole-word > substring; strips "— Restaurant" suffix so a restaurant *named* Rice doesn't
  pass a burger), `filterDishesByQuery(items,query,restaurantQuery)`. GRACEFUL FALLBACK (load-bearing): on
  0 matches → `matchedGroup? [] : items` — a RECOGNIZED dish term that finds nothing returns empty (term
  constrains), an UNRECOGNIZED free-form query keeps provider order (don't nuke "meal prep grill").
- **Wiring:** `food-resolver.ts` now over-fetches (discover limit 3→6), computes `queryMatchedRestaurant`
  (slug contains a query token ⇒ whole menu, e.g. "kfc"; else dish term ⇒ filter), and applies
  `filterDishesByQuery` to the merged menus before synth-SKU. `social-resolver.ts` applies the SAME filter
  for sector==='food' only (RE keeps its area-match in ranker; `matchedGroup` fallback protects free-form
  IG food queries — fixed the 2 social-ingest tests it first broke).
- **ACCURACY PROOF (REAL Talabat, LIVE_FETCH=on):** "rice" 564→**14-15 dishes**, ALL real rice/biryani
  (Tikka Rice 0.750, White/Saffron Rice 1.100, Tawook Rice, Rice Bowls, Chicken Biryani 3.950) — ZERO
  burgers/fries. "برياني" (AR) → same 15 incl. Chicken Biryani. End-to-end through booted API w/ REAL
  Claude: 15 cards state=results, cheapest-first, Talabat KWD prices + deeplinks.
- **ROOT CAUSE (speed):** `explainRanking` ran on ALL 15-280 dishes on OPUS, sequentially. FIX (2 knobs):
  (1) `anthropic-claude-client.ts` explain uses `explainModel` = `CLAUDE_EXPLAIN_MODEL ?? claude-haiku-4-5`
  (clarify stays on main model claude-opus-4-8; "why" is low-stakes, price/rank are CODE). (2) `search.
  service.ts` `EXPLAIN_TOP_N` (env, default 8) caps explained cards via `ranked.slice(0,N)`; ranks beyond
  N fall through to the existing truthful data-only "why". **SPEED PROOF (warm cache, REAL API, same
  query):** BEFORE (Opus+explain-all) **19.4s** → AFTER (Haiku+top8) **9.5-9.8s** ≈ **51% faster** on the
  Claude path. Remaining ~4s = live Talabat fetch of 6 menus (cached 5min, FOOD_TTL_MS) — decoupled.
- **RUN CMD (real food search):** `cd apps/api && DOTENV_CONFIG_PATH=<repo>/.env CLAUDE_PROVIDER=anthropic
  LIVE_FETCH=on BILLING_PROVIDER=mock SOCIAL_PROVIDER=mock SOCIAL_EXTRACTOR=mock PORT=3210 node -r
  dotenv/config dist/main.js` then POST /search/intent {intentRaw:"rice",sector:"food",locale:"ar"}.
  GOTCHA: Talabat /restaurants SSR is SLOW (~30s cold) — discovery timeout must be ≥15s for a cold cold-cache
  manual probe (the resolver's FOOD_TIER_TIMEOUT http=4s is per-MENU-fetch, fine once slugs are cached).
- **NEXT (food speed, deferred):** parallelize clarify+offer-resolve (clarify is skipped for food so minor);
  pre-warm Talabat menu cache via scheduler; semantic-boost the relevance filter (currently lexical+synonym
  only — enough for the demo). Synonym groups are a hand table — extend as cuisines grow.

## PRECISION pass — tight, query-scoped matching across ALL categories (2026-06-26, REAL-proven)
- **Tests: 148/148 api (was 131; +12 `realestate-relevance.spec.ts`, +5 `electronics-precision.spec.ts`).** tsc clean.
- **GOAL (owner):** return ONLY what was asked, drop loosely-related; precision > breadth; never invent.
- **REAL ESTATE — NEW strict area filter `offers/adapters/realestate-relevance.ts`** (mirrors food-relevance):
  `AREA_GROUPS` (canon→AR+EN aliases: salmiya/السالمية, salwa/السالوة, mahboula, hawally, jabriya, mangaf,
  +fintas/fahaheel/jahra/farwaniya/sharq/bneid), `normalizeAreaText`, `detectQueryAreas` (substring so
  AR-glued "بالسالمية" matches), `detectOfferArea`, `filterFlatsByQuery`. Query names an area → keep ONLY
  that area (exact-area first) + "nearby/قريب"-tagged flats; DROP unrelated areas; asked-area-empty → []
  (honest empty, NOT random). No area named → keep provider order (don't nuke free-form). Wired in
  `social-resolver.ts` for sector==='realestate' (uses `intent.model`+category raw text; reads
  `sku.attributes.area`). RE flats come ONLY from social mock lane (offline). **REAL PROOF (booted API
  :3215, mock claude/social):** "شقة في السالمية"→1 (Salmiya only), "بالجابرية"→1, "flat in Salwa"→3 (all
  3 Salwa, no others), "الفنطاس"→state=empty (0, no random), "شقة مفروشة للايجار" (no area)→all 8 kept.
- **ELECTRONICS — exact-model precision in `fallback.ts`.** `isExactMatch` no longer uses `model.includes`
  (substring) — NEW `modelIsExactlyAsked(skuModel, askedModel)`: SKU model must START with all asked
  tokens AND any extra token must be a storage/color qualifier, NOT a model word (`pro/max/plus/ultra/
  mini/se/air/fe/lite/note`) or a bare generation number. So "iPhone 16" is NOT exact for "iPhone 16 Pro
  Max"/"iPhone 16 Plus"; Pro Max becomes an `alternative` (isAdjacent), never mislabeled exact. matchSkus
  still substring-gathers candidates (no-results bug fix preserved) — only CLASSIFICATION tightened.
  **REAL PROOF:** booted :3215 (offline) "iPhone 17 Pro"→11 cards: only true 17 Pro tagged `exact`, every
  17 Pro Max `alternative`. booted :3216 (LIVE_FETCH=on) "iPhone 16"→4 cards ALL real iPhone 16 (128 Blk/
  Ultra/White, 512 Blk) from X-cite live, ZERO Pro Max / ZERO 17, fallbackServed=false (4≥N).
- **FOOD — already applied to BOTH lanes (confirmed):** `filterDishesByQuery` in `food-resolver.ts`
  (Talabat) AND `social-resolver.ts` (IG food, sector==='food'). REAL PROOF (booted :3216 LIVE): "rice"→
  15 cards, ALL rice/biryani (Tikka/White/Saffron Rice, Rice Bowls, Chicken/Lamb Biryani 0.750–5.850 KWD)
  + 1 IG meal-prep box whose caption literally has "رز" (legit synonym hit) — ZERO burgers/fries.
- **PROMPTS tightened (precision, no behavior change to mock path):** clarify system (`anthropic-claude-
  client.ts`) — questions MUST narrow the SAME requested item, never drift to a different model/accessory/
  inapplicable attribute, preserve exact model, skip low-value padding. explainRanking system — "why" MUST
  cite the actual asked attribute, no unrelated praise/marketing/emoji; fewer true words > padding.
  social extraction system (`anthropic-social-extractor.ts`) — extract ONLY literally-present fields,
  unstated→null, no inference; isOffer=false for memes/non-offers (droppable). Truthfulness guards (code)
  unchanged: `priceLiterallyInCaption`, `priceTokenInSource`, `verifyCitation`.
- **TEST DRIVERS (durable):** electronics clarifier must be SKIPPED to terminal (mock-claude asks storage)
  — POST /search/answer {dimension, answer:'__skip__'} loop (`/tmp/elec-driver.mjs`). Food/RE skip
  clarifiers (discovery sectors). iPhone 16 has NO offline mock offers (live-only) → assert electronics
  precision offline on iPhone 17 Pro vs 17 Pro Max (both have MOCK_OFFERS); iPhone 16 needs LIVE_FETCH=on.
- **RUN CMD:** `cd apps/api && DOTENV_CONFIG_PATH=<repo>/.env CLAUDE_PROVIDER=mock LIVE_FETCH=on|off
  BILLING_PROVIDER=mock SOCIAL_PROVIDER=mock SOCIAL_EXTRACTOR=mock PORT=32xx node -r dotenv/config
  dist/main.js` (build first). RE/electronics-offline use off; food/iPhone16 use on. Did NOT touch PO :3000.

## ≥5 CLARIFIER GATE — per-sector, config-driven, server-authoritative (2026-06-26, REAL-proven)
- **Tests: 156/156 api (was 148; +8) · 22/22 mobile · tsc clean (both).** OWNER DIRECTIVE (PO-ratified):
  irrespective of sector ask AT LEAST 5 clarifiers BEFORE search. **SUPERSEDES** the old ≤3 cap
  (`MAX_CLARIFIER_QUESTIONS=3`) AND the "food/realestate = no-clarifier discovery" rule (D-V2-1 #2).
- **CONFIG MODULE `apps/api/src/search/clarifier-sets.ts` (NEW, the source of truth):** `CLARIFIER_SETS:
  Record<Sector, ClarifierDimension[]>` from BA spec §1–4. Each sector lists dims BROAD→NARROW; first 5
  = mandatory floor, rest = optional Q6–Q8 used only to top up to 5 when intent pre-resolves some.
  Electronics={model,storage,color,budget,condition,+brand,mustHave}; Food={dish,people,budget,delivery,
  dietary,+spice,sides}; RealEstate={tenure,area,bedrooms,budget,furnished,+amenities,tenant}. Each dim
  carries `preResolved(ctx)` predicate (RULE-7: counts toward 5, never re-asked). `MIN_CLARIFIER_QUESTIONS
  =5`. **Adding a sector = add a key with ≥5 dims (§4 template), NO loop code change.** `toQuestion()`
  strips the predicate before sending to client.
- **search.service.ts rewrite (the gate is CODE, not the model):** `advance(session)` is now config-driven
  — presents the NEXT unresolved dim until `presentedCount>=5`, then `runSearch`. `presentedCount` = Set
  union of pre-resolved + askedDimensions. `nextDimension` skips pre-resolved + already-asked.
  `markPreResolved()` (called in startIntent) stamps pre-resolved dims into answers as `__prefilled__`.
  Claude `clarify` is now called ONCE (startIntent) ONLY for intent normalization — the per-ANSWER Claude
  round-trip is GONE (faster + deterministic). `MAX_CLARIFIER_QUESTIONS` kept as alias = MIN (5) for the
  old import in specs. **applyAnswer**: discovery answers (food `dish`, RE `area`) FOLD into `intent.model`
  (the term `filterDishesByQuery`/`filterFlatsByQuery` drive off) so a chip answer TIGHTENS results
  (RULE-3/5); all answers also stay in constraints. budget chip → budgetFils (hard filter).
- **SearchResponse += `totalQuestions`** (shared/domain.ts) = the "of N" denominator (Math.max(5,
  preResolvedCount)). `clarifierCount` now = PRESENTED count (the "N"). Set on clarifying + results + empty.
- **RULE-8 (clarifier ≠ free search) preserved:** quota.tryConsume is in runSearch (after the floor); every
  clarifier turn returns from advance BEFORE runSearch → 0 quota burn. Proven: ≥5 turns → tryConsume called
  EXACTLY once. RULE-10 (fast model): `CLAUDE_CLARIFY_MODEL ?? claude-haiku-4-5` for the clarify call
  (anthropic-claude-client.ts; was Opus). explainModel already Haiku.
- **TESTS:** NEW `clarifier-gate.spec.ts` (≥5 no-dispatch per sector via resolveOffers spy; skip-all-still-
  searches per sector; RULE-8 tryConsume-once). REWROTE `clarifier-bound.spec.ts` (≥5 per sector + RULE-7
  fully-specified→only `condition` asked, shows 5 of 5). Updated `search-resilience.spec.ts` (food now asks
  ≥5; the old "food→0 clarifiers" test INVERTED to "food asks ≥5"). `truthfulness.spec.ts` + resilience use
  NEW `clarifier-test-util.ts skipToTerminal(svc,res,pseudo)` helper to drive past the gate.
- **REAL PROOF (booted API :3290, CLAUDE_PROVIDER=mock LIVE_FETCH=on):** all 3 sectors present EXACTLY 5
  before search: electronics "iPhone 16" (model pre-resolved → storage/color/budget/condition asked) → 4
  real iPhone cards; food "rice" (dish pre-resolved → people/budget/delivery/dietary) → 13 real rice/biryani
  dishes; RE "شقة في السالمية" (area pre-resolved → tenure/bedrooms/budget/furnished) → Salmiya flat.
  ANSWER-TIGHTENS proven: RE budget chip 250→0 cards, 400→1 card (300KWD Salmiya flat passes). SKIP-ALL
  still searches (never dead-ends). Driver `/tmp/clarifier-flow-driver.mjs`.
- **FRONTEND (render-proven, real iPhone 17 Pro sim):** `ClarifierQuestion.tsx` += "N of 5 / ٣ من ٥"
  progress PILL (brand-teal, Western digits) + segmented dot bar (filled = presented). i18n += `progressOf`
  (من/of), `narrowingTitle`. search.tsx passes `total={response.totalQuestions ?? 5}`. Shots:
  `team/qa/sim/clarifier-elec-ar.png` (Q "2 من 5", storage chips), `clarifier-elec-q5.png` (full intent →
  "5 من 5", dot bar FULL, only `condition` asked = RULE-7 proof), `clarifier-food-q2.png` (food "لكم شخص؟").
  **BIDI GOTCHA (durable):** "N من total" — "من" is strong-RTL; in an RTL row it lays out with N on the
  trailing edge → reads correctly R-to-L. `direction:'ltr'` on the pill + LTR-isolate (U+2066/2069) did NOT
  override RN-web's RTL row cascade; a single `<Text>` run in the locale's natural direction renders right.
- **RUN CMD (this verify, isolated — did NOT touch PO :3000):** API `cd apps/api && DOTENV_CONFIG_PATH=
  <repo>/.env CLAUDE_PROVIDER=mock LIVE_FETCH=on BILLING_PROVIDER=mock SOCIAL_PROVIDER=mock
  SOCIAL_EXTRACTOR=mock PORT=3290 node -r dotenv/config dist/main.js`. Web export app.json extra.apiBaseUrl
  →:3290, `npx expo export --platform web -o /tmp/bo-dist-3290`, RESTORE app.json, sed-patch baked
  localhost:3000→3290 in `_expo/static/js/web/*.js`, serve `node /tmp/spa-server.mjs /tmp/bo-dist-3290 8790`,
  `xcrun simctl openurl booted http://localhost:8790/search?cat=<sector>&q=<intent>`.
- **DEFERRED:** real-Claude (CLAUDE_PROVIDER=anthropic) intent normalization for new dims (condition/people/
  delivery/dietary/tenure/bedrooms/furnished) not yet pre-resolved from free-text — mock-claude only extracts
  model/storage/color/budget/area-via-raw, so those new dims are always ASKED (correct, just not pre-filled
  from a rich free-text). The §4 `preResolved` predicates are wired; extend mock+real Claude extraction to
  populate constraints.{condition,people,…} to pre-resolve more. ranker does not yet hard-rank by the new
  food/RE dims (dietary/furnished/bedrooms) beyond budget+area+dish — currently they sit in constraints +
  the dish/area fold; deeper relevance use is a follow-up. KPI instrumentation (clarifier completion rate,
  phase duration, skip rate) per §6 not added.

## Env / tooling gotchas (durable)
- **Node 25 is installed locally** (>node 20). better-sqlite3 prebuilt works; migrate+seed OK.
- **Expo Web needs `react-native-web` + `react-dom`** (now in mobile deps). `expo export --platform web`
  works fully OFFLINE → dist/. `expo start --web` default port 8081 may be taken → demo auto-picks free.
- **HOW TO CAPTURE PIXELS + READ WEB CONSOLE (this machine, works):** Chrome is at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. (1) Console/exceptions: drive it via
  **CDP** — `--headless=new --remote-debugging-port=PORT --user-data-dir=/tmp/X`, fetch
  `http://localhost:PORT/json`, open the page WebSocket, `Runtime.enable`+`Log.enable`, navigate, read
  `Runtime.exceptionThrown`/`consoleAPICalled`. Node 25 has built-in `WebSocket`+`fetch` (no `ws` dep).
  (2) Pixels headless: `--headless=new --screenshot=out.png --window-size=W,H URL` BUT
  `--virtual-time-budget` FREEZES before async network resolves — for flows that hit the API, use CDP
  `Page.captureScreenshot` after a real `setTimeout` wait. **Avoid `--force-device-scale-factor`** (it
  overflows the viewport). RN-web Pressables do NOT respond to scripted DOM/mouse/touch/pointer events
  in headless Chrome (responder system) — to drive a flow, find the element's `__reactProps$*` and call
  `.onClick(new MouseEvent('click',{bubbles:true}))` directly, OR use the `?q=`/param affordance.
  (3) REAL on-device sim Safari (best proof): `xcrun simctl openurl booted URL` then
  `xcrun simctl io booted screenshot out.png`. Sim shares host loopback so `localhost:3000`/`8765` work.
- Seed `offer_history` is APPEND-ONLY → reruns accumulate snapshots (intentional; B2B price asset).

## Repo conventions (durable)
- **npm workspaces.** `packages/shared` (`@bestoffers/shared`) holds ALL contract types — never duplicate.
- **`.npmrc` has `legacy-peer-deps=true`** — required for the Expo peer matrix; harmless for api.
  In mobile, prefer `npx expo install <pkg>` so versions match the Expo SDK.
- **Money = integer fils** (1 KWD = 1000 fils). Use `formatFils`/`kwdToFils`. No floats for money, ever.
- **Privacy wall:** PII (phone) only in `users`; only `pseudo_id` + bucketed values enter `events`.
  Enforced at the sink by `EventsService` no-PII gate (`PII_FORBIDDEN_KEYS`, scans 1 nesting level).
- **Truthfulness:** price/provider/rank = DATA. LLM authors only `why` text and must cite a real
  attribute (`verifyCitation`); on violation → data-only fallback (never blocks, never invents).
- **Clarifier ≤3 enforced in CODE** (`MAX_CLARIFIER_QUESTIONS` in search.service `advance()`), plus
  never-re-ask via `session.askedDimensions`. Do not rely on the prompt alone.
- **Claude is mockable**: `CLAUDE_CLIENT` DI token; `MockClaudeClient` (default, offline) vs
  `AnthropicClaudeClient` (`CLAUDE_PROVIDER=anthropic`, SDK dynamic-imported so tests need no key).
- Tests: colocated `*.spec.ts`, jest + ts-jest. Shared resolved to source via jest moduleNameMapper.
- DB: `0001_init.sql` is Postgres-compatible; local runner = better-sqlite3 (`npm run migrate`).
  Prod swaps: TEXT json→jsonb, TEXT pk→uuid, add tsvector `search_text`+pg_trgm on `skus`.

## Module ownership map (who picks up what next)
- **Phase 2a backend (bo-dev-lead, DONE mock):** `apps/api/src/{auth,accounts,billing,quota,db}/`.
  Endpoints: `POST /auth/otp/request|verify`, `POST /auth/refresh`; `GET/PATCH /me`, `POST /me/avatar`,
  `POST|GET /me/email-verify`; `POST /billing/checkout|webhook`, `GET /billing/status`; `GET /me/quota`.
  Search path now optional-authed (Bearer → metered). Shared contracts in
  `packages/shared/src/accounts.ts`. AuthModule is `@Global` (DbService/JwtService/AuthGuard everywhere).
- Slice 1 Auth (bo-dev-2): superseded by Phase 2a above (hand-rolled 0001 auth dropped).
- Slice 2 Provider-data (bo-dev-3): **X-cite + Blink LIVE (S2.6 Slice A done)** via Tier-1 adapters in
  `apps/api/src/offers/adapters/` (xcite.adapter, blink.adapter, live-resolver, offer-cache,
  http-fetch, source-validation, provider-adapter.interface). **Eureka now LIVE too (Slice B, Tier-2
  Algolia XHR — eureka.adapter.ts + render-fetch.ts).** **Talabat now LIVE too (ADR-005 Slice F-1, FOOD
  Tier-1 JSON — talabat.adapter.ts + food-resolver.ts + provider-url-cache.ts).** Best Al-Yousifi STILL
  MOCK (`mock-offers.dataset.ts`, live providers' mock rows dropped when LIVE_FETCH on). NEXT: Best
  Al-Yousifi (Tier-2 XHR/render) + Food Slice F-2 PartnershipIngestAdapter; Haiku extraction fallback +
  pre-warm; X-cite sitemap discovery upgrade. ToS: X-cite/Blink/Talabat owner-directed proceed but route
  to counsel + clear `tos_reviewed` before public release; Jahez/Carriage scraping deferred (partnership).
- Slice 3 Search+AI (bo-dev-lead): DONE on mock; live Opus clarify + rank-explain TODO in
  `AnthropicClaudeClient` (structured outputs, adaptive thinking, prompt-cached system prompt, check
  stop_reason → data-only fallback). `SessionStore` is in-memory → move to Redis for prod.
- Slice 4 Admin+analytics (bo-dev-4): Next.js stub + `EventsService` emit/gate done; BullMQ→Postgres
  `events` consumer + admin CRUD (G1/G2) + KPI dashboard (G3) TODO.
- Mobile (bo-dev-2 + lead): minimal RTL results screen + `SearchClient` done; auth/clarifier-chat UI
  + i18n + force-RTL restart UX (flows §6) TODO.

## Deferred QA defects (backlog — MED/LOW, NOT yet fixed)
- **Backend D1-2 (MED):** Stripe `incomplete`/`incomplete_expired` states + `invoice.payment_succeeded`
  not in SubStatus type / DB CHECK / webhook map (F-D1 AC-4).
- **Backend D2-2 (LOW):** anonymous (no-Bearer) search bypasses the gate entirely — by design pending
  [Q-PO] on AC-9; add a meter if anonymous search is ever enabled.
- **Backend D-MISS-1/2 (LOW):** no automated test for SMS-fallback branch (MockOtpSender never throws)
  nor for `assertAvatarUpload` MIME/size rejection — add a throwing-sender + bad-upload test.
- **Frontend D3 (MED):** N4 cropper + avatar action-sheet (Take/Choose/Remove) + JPEG/PNG/WebP+5MB
  client validation missing (device-only picker).
- **Frontend D4 (MED):** M1 receipts/billing-history list; cancel-confirm sheet (strings exist, not
  rendered); canceled "Ends on {date}" shows — because cancel webhook returned null period_end (note:
  the D1-1 COALESCE fix now PRESERVES period_end on cancel when supplied, so M1 can show the date once
  the cancel path passes currentPeriodEnd).
- **Frontend D5 (MED):** email re-verify auto-completes in mock; true pending→verified + 24h expiry +
  resend cooldown + P2b sheet not exercisable offline.
- **Frontend D6 (LOW):** real invalid-email message + name 1–60/charset client validation.
- **Frontend D7 (LOW):** profile phone "…٦٧" and plan "Free" hardcoded — read from profile/billing.
- **Frontend D8 (LOW):** distinct OTP error states (expired/lockout/too-many vs incorrect); backend
  distinguishes, FE flattens to "Incorrect code".
- **Frontend D-cov (INFO):** zero RN component/render tests; add jest-expo + @testing-library/react-native
  (the new resume/explainer logic IS unit-tested via extracted pure helpers, but no screen-render test).
- **Also still owed:** first-sign-in biometric opt-in prompt (isNewUser routes straight to /); per-type
  notif prefs (price-drop / account-security) — single master flag only; "Subscribed!"/"Saved" success
  toasts spec'd but silent. Device-only checklist unchanged (see qa-frontend-report §6).

## Tech debt / open items
- **Phase 2a:** identity plane is LOCAL HS256, not Supabase — swap `JwtService.verifyAccess` for JWKS
  + point DbService/DATABASE_URL at Supabase pooled conn to go live (Slice A real wiring). `StripeBilling
  Provider` + `WhatsApp/TwilioOtpSender` + Supabase `Storage` impl are config-ready stubs needing keys.
  Webhook raw-body: works on JSON re-serialize in mock; for REAL Stripe set `main.ts` rawBody:true so
  signature verification gets exact bytes. Email verification has NO mail provider (mock surfaces the
  token in PATCH response) — wire Supabase Auth email / a mailer for prod. RLS is server-code-enforced
  (id-scoped SQL); real Postgres must also enable the ADR-004 RLS policies. `0001 users` table now
  orphaned (legacy) — drop in a cleanup migration. Avatar not downscaled to 512² yet (F-A1 AC-9 = FE/img-proc).

- **S2.6 live-layer:** X-cite discovery is a hand-verified known-URL map (4 iPhone-16 slugs) — replace
  with sitemap-pdps scan / known-URL cache table in Slice B for breadth. `priceTokenInSource` uses
  substring `includes` (a longer number containing the token would pass) — tighten to a bounded
  numeric regex if false-accepts appear. Offer cache is in-memory `InMemoryOfferCache` (swap Redis
  impl behind `OfferCache`). No `provider_url_cache` table yet (24h URL TTL deferred to Slice B).
- `SessionStore` + `EventsService` sink are in-memory (slice-grade); swap to Redis/BullMQ+Postgres.
- `AnthropicClaudeClient.clarify/explainRanking` IMPLEMENTED + DI-wired (LIVE-NONMOCK pass). Follow-ups:
  no prompt-cache on the system prompt yet; no adaptive-thinking/effort tuning; each search makes 4-5
  sequential Claude round-trips (~10-12s total clarify+explain) — acceptable for demo, parallelize/cache
  for prod. `SessionStore` still in-memory.
- No CI yet; `npm test` is the gate. Add lint/format config in a follow-up.
- Mock-claude intent extraction now covers iPhone/Samsung(Galaxy S25/Ultra)/MacBook Air/Dell XPS;
  add more brands as the catalog grows. `i18n.ts` is a hand table (no ICU/plurals yet).
- Force-RTL restart UX still deferred: web toggle flips copy+alignment only (no I18nManager.forceRTL
  reload) — fine for demo; real device RTL restart is the auth/settings slice.
- **Phase 2b device-only (mock/stub on web, need a real device):** biometric OS prompt
  (expo-local-authentication) — settings persists the app-pref only, secret is device-side; push
  permission prompt + "Open Settings" deep-link (expo-notifications/Linking) — web forces denied;
  SecureStore — web falls back to localStorage (NOT secure); native image picker + N4 cropper —
  edit.tsx uploads a sample PNG on web; real Stripe Checkout/portal sheet — paywall uses a dev
  "confirm subscription" that calls /billing/webhook directly. No receipts list yet on M1 (backend
  has no invoices endpoint). N4 cropper component itself not built (deferred w/ native picker).
- Expo version-mismatch warnings on `demo` (react-dom/native/ts) are non-blocking; align in a follow-up.

## Key decisions
- Hand-wrote a real structure instead of CLI scaffolds (NestJS/Expo CLIs unreliable here); deps from npm.
- SQLite local DB accepted per Sprint 2 goal; schema kept Postgres-portable.

## Open questions / handoffs
- See `## Handoff` in the Sprint 2 task output (what runs, test results, QA verification targets).
