# BestOffers — Search-Pipeline Hardening Test Suite (300 cases — 100 per sector)

**Author:** bo-qa-lead-frontend · **Created:** 2026-06-27
**Status:** **DESIGNED — NOT YET RUN.** Trigger the run AFTER SLICE Q1 (electronics catalog-free discovery) lands.
**Owner bar:** an **extremely strong, issue-free search pipeline across ALL sectors** — search runs across every sector, so each sector gets a full 100-case exhaustive suite (not 100 split).
**Machine-readable harness:** `team/qa/search-test-cases.json` (the runnable source of truth — 300 cases).
**Oracle sources:** `team/architecture/ADR-007-search-quality.md` (known weaknesses) · `team/analysis/feature-acceptance-criteria.md` (F-SR1) · `team/analysis/clarifier-question-sets.md` · `apps/api/src/search/clarifier-sets.ts`.

> Every PASS/FAIL is checked against the AC oracle, not vibes. A case that returns an honest-empty (with broaden suggestions) where no live data exists is **PASS**, not FAIL. Dumping unrelated cards to look "full" is **FAIL**. Per ADR-007, a search feature is not "passed" until it holds across the WHOLE case set — one happy-path pass is not a pass.

---

## 1. Distribution

| Sector | Count | AR / EN |
|--------|-------|---------|
| Electronics (E001–E100) | 100 | 34 AR / 66 EN |
| Food (F001–F100) | 100 | 40 AR / 60 EN |
| Real estate (R001–R100) | 100 | 49 AR / 51 EN |
| **Total** | **300** | **123 AR / 177 EN** |

Failure-mode spread (so fixes are targetable):

| Mode | Cases | What it hardens |
|------|-------|-----------------|
| `baseline` | 59 | Common products/dishes/areas that must already work |
| `FM-CATALOG` | 67 | Electronics off the 16-item `MOCK_SKUS` wall (ADR-007 RC#1, the Q1 fix) — every non-phone/laptop type |
| `FM-RELEVANCE` | 42 | Category-routing traps (rice↔cake), long-tail dishes not in the synonym table |
| `FM-AREA` | 61 | RE wrong-area leak + unlisted-area resolution (12-area allow-list vs ~60, ADR-007 Q3) |
| `FM-TENURE` | 13 | Rent vs sale separation (tenure inferred, not asked) |
| `FM-PRICEUNIT` | 7 | Sale price shown as monthly rent (the 400k/300k/500k-rent class) |
| `FM-TYPO` | 19 | Misspelling / transliteration drift (machboos/machbous, ayfon, salmia, jabreya) |
| `FM-BRANDONLY` | 6 | Brand-only queries (Apple/Samsung/LG/Sony/Huawei) → that brand's catalog |
| `FM-OFFCATALOG` | 13 | Generic/uncovered/gibberish/off-category → honest-empty, never a dump |
| `FM-CONSTRAINT` | 13 | Budget/spec/bedrooms/furnished/cheapest constraints handled, never mislabeled |

Per-sector failure-mode counts (from the JSON `meta.breakdown.per_sector`):

- **Electronics (100):** FM-CATALOG 67, baseline 11, FM-TYPO 7, FM-BRANDONLY 6, FM-OFFCATALOG 5, FM-CONSTRAINT 4.
- **Food (100):** baseline 48, FM-RELEVANCE 42, FM-TYPO 7, FM-OFFCATALOG 3.
- **Real estate (100):** FM-AREA 61, FM-TENURE 13, FM-CONSTRAINT 9, FM-PRICEUNIT 7, FM-OFFCATALOG 5, FM-TYPO 5.

**ADR-007 live failures locked as regression cases** (`meta.adr007_regression_locks`): E006/E007 (Dish washing Machine + غسالة صحون 0-results), F001/F008 (rice↔cake both directions), F002 (Bukhari→cake), F003 (machboos drift), F004/F005 (machboos/machbous transliteration), F009 (كيك), R001/R002 (Jabriya wrong-area), R009–R015 (unlisted areas Zahra/Mishref/Bayan/Rumaithiya/Sabah), R024 (300k-rent).

---

## 2. How the harness runs each case (the ≥5-clarifier flow, auto-skip)

The suite is runnable end-to-end through the live API. For each case:

1. **POST `/search/intent`** `{ sector, locale, intentRaw: query, pseudoId: "qa-harness-<id>" }`
   - A **distinct `pseudoId` per case** (e.g. `qa-harness-E001`) keeps it **un-metered** (no freemium 402 — anonymous pseudoIds aren't metered).
2. **Drive the ≥5-clarifier gate (auto-skip):** while `state === 'clarifying'`, POST `/search/answer` `{ searchSessionId, dimension: questions[0].dimension, answer: "__skip__" }`. Every sector presents `MIN_CLARIFIER_QUESTIONS = 5` before dispatch. Loop until `state` is `results` or `empty`. Guard at 12 steps — this is exactly the existing `skipToTerminal` helper in `apps/api/src/search/clarifier-test-util.ts`.
3. **Evaluate the terminal response** against the case oracle (`state`, `cards[]`, `broadenSuggestions`, `fallbackServed`).

Terminal `ResultCard` fields the oracle reads: `productName`, `providerName`, `priceFils`/`priceLabel`, `deeplinkUrl`, `source`, `whyCitedAttribute`, `relation?`, `matchesPreferences?`.

---

## 3. Global pass rules (apply to EVERY case, on top of the per-case oracle)

| # | Rule |
|---|------|
| **GR1 — clarifier gate** | ≥5 questions presented before any terminal state. Dispatching before 5 = **FAIL** regardless of results. |
| **GR2 — truthful data** | Every card's price/provider/deeplink is REAL provider data, never LLM-fabricated. `deeplinkUrl` is a well-formed http(s) URL on the provider's own domain. |
| **GR3 — no unrelated dump** | No off-category/off-intent filler. Honest-empty beats a padded list. |
| **GR4 — honest empty** | A genuine no-match `state='empty'` MUST carry ≥1 `broadenSuggestion` (never a bare 0 — F-SR1 AC-14, D-V2-2). A **provider-failure** empty must be flagged distinctly (`coverage_reason`, ADR-007 Q5) and is **not** a clean PASS. |
| **GR5 — price sanity** | Electronics within plausible KWD retail; food dish within plausible order KWD; RE **rent 50–3,000 KWD/mo**, **sale ≥10,000 KWD**. A rent card >3,000 KWD/mo = **FAIL**. |

---

## 4. Electronics (100) — E001–E100

> The headline target: **`FM-CATALOG` cases were 0-results before SLICE Q1** because the lane was bound to a 16-item phone/laptop `MOCK_SKUS`. Post-Q1 they must return real Blink/Eureka offers (or a truthful "not covered"), never a blanket 0 and never phones/laptops as filler. 67 of the 100 are FM-CATALOG — the whole non-phone/laptop appliance + accessory surface.

- **Phones (baseline + catalog + brand):** E001–E003, E041–E050, E095 — iPhone 17/16/15, Galaxy S25/S24/A55, Pixel 9, OnePlus 13, Huawei, Xiaomi, generic جوال/موبايل, cheapest variants.
- **Laptops:** E004, E005, E051–E055 — MacBook Air/Pro, Dell XPS, HP, Lenovo ThinkPad, ASUS ROG, لابتوب جيمنج.
- **Tablets:** E020, E056–E058 — iPad Air/Pro, Galaxy Tab, تابلت.
- **TVs:** E010, E011, E059–E061 — Samsung/LG OLED, 43"/55"/65"/75", شاشة.
- **Fridges/freezers:** E012, E013, E062–E064 — LG/Samsung fridge, side-by-side, ثلاجة, chest freezer.
- **Washers/dryers/dishwashers:** E006–E009, E065–E068 — *the ADR-007 dishwasher 0-results lock*, front-load washer, نشافة/tumble dryer, Bosch dishwasher.
- **Cooking appliances:** E021, E022, E069–E072 — microwave, built-in/gas oven, air fryer.
- **Vacuums:** E034, E073, E074 — Dyson, robot vacuum, مكنسة.
- **ACs:** E014, E015 — split unit, مكيف.
- **Audio:** E016, E017, E075–E078 — AirPods, Sony/Bose headphones, JBL speaker, سماعة بلوتوث.
- **Wearables:** E032, E033, E079–E081 — Apple/Galaxy Watch, ساعة ذكية.
- **Cameras:** E082–E084 — Canon EOS R6, GoPro, كاميرا.
- **Gaming/accessories:** E018, E019, E031, E085–E091 — PS5, Xbox, Switch, gaming laptop, mouse/keyboard, power bank, شاحن, cable.
- **Brand-only (FM-BRANDONLY):** E023 Apple, E024 Samsung, E025 سامسونج, E092 LG, E093 Sony, E094 هواوي — ≥3 cards all that brand, no cross-brand leak.
- **Typos/transliteration (FM-TYPO):** E027 ayfon 16, E028 iphon, E029 samesung, E095 ايفون برو ماكس, E096 labtop, E097 telvison, E098 refrigirator.
- **Off-catalog / honest-empty (FM-OFFCATALOG):** E035 blender, E036/E099 gibberish, E037 أحذية (shoes), E100 كنب جلد (sofa).
- **Constraint specials (FM-CONSTRAINT):** E038 exact-rich 1TB titanium (exact-first, no alt tag — F-SR1 AC-2), E039/E049 cheapest iPhone, E040 headphones under 50 KWD (over-budget delta — F-SR1 AC-13).

**Per-case oracle:** see JSON `cases[].expectation.oracle`. General electronics PASS = ≥1 card of the RIGHT product type with a real price + real deeplink; FAIL = 0 (catalog regression) OR wrong product type dumped as filler.

---

## 5. Food (100) — F001–F100

> The marquee trap is **category routing: rice must NOT return cake, and cake must NOT return rice.** Long-tail dishes (sushi/ramen/tacos/manakish/falafel/pasta/noodles) are the ADR-007 §1.2 "not in the synonym table" cases — relevant or honest-empty, never random restaurants. Transliteration variants test the AR↔EN drift ADR-007 names.

- **Rice family / rice↔cake traps (FM-RELEVANCE, regression-locked):** F001 rice→rice-only, F002 بخاري→rice, F003 مجبوس, F036/F037 kabsa/كبسة, F038/F039 mansaf/منسف, F042/F043 white-rice/رز بخاري, F044 lamb biryani — all must be rice-family, ZERO cake.
- **Biryani/mandi/machboos transliteration (FM-TYPO):** F004 machboos, F005 machbous, F040 machboos laham, F041 majboos, F096 biryni → all route to rice family.
- **Cake/dessert traps (FM-RELEVANCE):** F008 cake→dessert-only, F009 كيك, F010 chocolate cake, F032/F033 kunafa/كنافة, F063/F064 cheesecake/تشيز كيك, F065 tiramisu, F066/F067 ice cream/آيس كريم, F068 donuts, F069 كنافة نابلسية, F070 umm ali, F099 كيكه شوكولاته — dessert family, ZERO rice/savory.
- **Burgers/pizza:** F011/F012 burger/برجر, F045 double cheeseburger, F046 تشيز برجر, F047 chicken burger, F013/F014 pizza, F048/F049 pepperoni, F050 calzone.
- **Grills:** F015–F017 grilled chicken/دجاج مشوي/مشاوي, F051 mixed grill, F052 kebab, F053 تكة, F054 lamb chops, F086 wagyu steak.
- **Breakfast:** F055/F056 breakfast/فطور, F057 pancakes, F058 eggs benedict.
- **Seafood:** F059/F060 seafood/سمك مشوي, F061/F062 shrimp/روبيان.
- **Coffee/beverages:** F018/F019 coffee/قهوة, F030 قهوة مختصة, F071 latte, F072 cappuccino, F073 كرك, F074 fresh juice.
- **Healthy/meal-prep/home-kitchen:** F031 وجبات دايت, F075/F076 salad/سلطة, F077 meal prep, F078 keto, F079/F080 home kitchen/مطبخ بيتي.
- **Vendors (Talabat):** F020 kfc (RESOLVED: 59 cards, real talabat links), F081 mcdonalds, F082 pizza hut, F083 subway, F084 ماكدونالدز, F085 hardees.
- **Long-tail not-in-table (FM-RELEVANCE):** F025 sushi, F026 ramen, F027 tacos, F028 مناقيش, F029 فلافل, F087/F088 pasta/معكرونة, F089 noodles, F092 hot dog, F093 هريس, F094 جريش, F095 مرقوق — relevant cuisine OR honest-empty, **FAIL = random restaurant dump.**
- **Fried chicken / other mains:** F090/F091 fried chicken/دجاج مقلي.
- **Typos (FM-TYPO):** F097 burgr, F098 shwarma (+ F096 biryni above).
- **Off-catalog/gibberish (FM-OFFCATALOG):** F034 زبدية, F035 xyzqwfood, F100 zzzqfooood → honest-empty, never fabricate.

**Per-case oracle:** general food PASS = cards belong to the queried dish family; **the routing traps additionally require ZERO cross-family leak** (no cake under rice, no rice under cake, no savory under dessert); long-tail PASS = relevant-or-honest-empty, never a random-restaurant dump.

---

## 6. Real estate (100) — R001–R100

> Three live failure classes from ADR-007: **(a) wrong-area leak** (Jabriya → Al-Zahra), **(b) unlisted areas not resolvable** (only 12 of ~60 areas — this suite covers ~35 KW areas in AR+EN), **(c) sale price shown as monthly rent** (the 400k/300k/500k/200k-rent class). Note D-RUN-1: live RE returned 0 in real mode until KW real-estate Instagram handles are seeded — until then, an honest-empty WITH broaden suggestions is the PASS bar, and a bare 0 (D-V2-2) is a FAIL.

- **Known/listed-area precision (FM-AREA — keep ONLY that area):** R001/R002 Jabriya *(headline wrong-area bug)*, R003/R004 Salmiya *(D-RUN-1 live-empty)*, R005/R006 Salwa *(vs Salmiya near-spelling)*, R007/R008 Mahboula, R026–R029 Hawally/Salmiya.
- **Unlisted-area resolution (FM-AREA — the Q3 gazetteer target, NOT in original 12):** R009–R015 Zahra/Mishref/Bayan/Rumaithiya/Sabah Al-Salem (regression-locked), plus an expanded gazetteer sweep R030–R065: Mangaf, Fintas, Bayan, Rumaithiya, Sabah Al-Salem (EN), Farwaniya, Jahra, Abu Halifa, Sharq, Dasma, Adailiya, Shaab, Bnaid Al-Qar, Qortuba, Surra, Khaitan, Jleeb, Messila, Funaitees, Abu Fteira, Sabah Al-Ahmad, Zahra block-3 — each in AR and/or EN. PASS after gazetteer = that-area-only or honest-empty; **FAIL = every-area dump** (the unlisted-area leak where `detectQueryAreas` is empty → unfiltered).
- **Descriptive / no-area (FM-AREA):** R022 شقة, R084 near sea, R085 قريبة من الجامعة, R089 شقة جديدة, R090 penthouse, R100 verbose luxury AR — keep provider order, never invent area filtering, sane prices.
- **Tenure separation (FM-TENURE):** R016/R017 sale Mishref/Jabriya, R071/R072 sale Salmiya, R073 rent villa Mishref, R074 sale Jahra, R075 rent Sabah Al-Salem, R076/R077 shop rent, R086/R087 generic rent/sale, R088 عقار للبيع, R023 بيت للايجار. PASS = correct tenure only; **FAIL = a sale flat under a rent query (or vice-versa).**
- **Constraints (FM-CONSTRAINT):** R018 2BR rent Salmiya, R019 studio rent Hawally, R066 studio Salmiya, R067 3BR Jabriya, R068 غرفتين Salmiya, R069/R070 furnished, R082/R083 cheapest rent. Rooms/furnished soft, area+tenure hard.
- **Price-unit sanity (FM-PRICEUNIT — the absurd-rent class):** R020/R021 Jabriya budget, R078/R079 Mahboula budget, **R024 Salwa rent 300000** *(the exact owner bug)*, R080 rent 500000, R081 ايجار 200000 — every rent 50–3,000 KWD/mo; absurd figures MUST reclassify to sale/"price on request". FAIL = any rent card >3,000 KWD/mo.
- **Area spelling/transliteration (FM-TYPO):** R091 جابريه, R092 salmia (must not cross-leak to Salwa), R093 jabreya, R094 mahbula, R095 الساليمه.
- **Off-catalog (FM-OFFCATALOG):** R025 قصر للبيع, R096 حلوي (sweets → not-covered), R097 office, R098 land for sale, R099 gibberish → relevant-or-honest-empty, never random rent flats.

**Per-case oracle:** RE PASS = every card matches the asked **area** (or nearby-tagged) AND **tenure**, with **sane prices** (rent 50–3,000 KWD/mo, sale ≥10,000 KWD); honest-empty (with broaden suggestions) is PASS where no live flat exists. FAIL = off-area leak, wrong tenure, or an out-of-band price.

---

## 7. Reporting format (when the run happens)

Per case, the harness records: `id`, `query`, `lang`, `state`, `cardCount`, top-3 `{productName, providerName, priceLabel, area/tenure where applicable, deeplinkUrl, source}`, `broadenSuggestions?`, `fallbackServed?`, plus **PASS/FAIL + the failing rule** (GR1–GR5 or the per-case oracle). Group the summary by sector then by failure-mode so Dev can target the highest-fail bucket first (expected pre-fix: `FM-CATALOG` electronics + `FM-AREA` RE). Every result tagged **VERIFIED** (real API output) — no ASSUMED passes. Per ADR-007 / WORKFLOW §7, the suite is "passed" only when the AC holds across the WHOLE 300-case set, re-tested each loop — not on first green.

---

## Handoff
- **Done:** Expanded the search-hardening suite from 100 to **300 cases — 100 per sector** (Electronics E001–E100, Food F001–F100, Real-estate R001–R100), per owner directive (search runs across ALL sectors; bar = extremely strong, issue-free pipeline). `team/qa/search-test-cases.json` (runnable source of truth) + this doc. **Validated: 300 cases, 0 duplicate IDs, valid JSON, exactly 100 per sector, sequential IDs complete, no malformed cases.** Same schema `{id, category, query, lang, failureMode, expectation:{state, relevant, oracle}}` and the same harness contract (POST /search/intent → skip-loop /search/answer through the ≥5 gate to terminal → check oracle + GR1–GR5; distinct pseudoId/case). Lang mix 123 AR / 177 EN. Every ADR-007 live failure kept as a locked regression case (`meta.adr007_regression_locks`). Added one failure mode `FM-CONSTRAINT` for budget/spec/bedrooms/furnished/cheapest cases.
- **Next:** **PO triggers the run AFTER SLICE Q1 (electronics catalog-free discovery) lands** — the gating fix for the 67 FM-CATALOG electronics cases. Running now = false-red on those. RE non-empty also depends on live KW real-estate IG handles (D-RUN-1); until seeded, RE PASS bar = honest-empty + broaden suggestions. On trigger: run the harness, produce per-case PASS/FAIL grouped by sector→failure-mode, file defects (severity + repro), hand HIGH ones to Dev Lead, iterate until AC holds across the whole 300 (WORKFLOW §7).
- **Owner:** PO (trigger timing); bo-dev-lead (Q1 electronics fix is the prerequisite + RE handle seeding); bo-qa-lead-frontend (execute the run + report); bo-qa-backend (coordinate so data-layer relevance assertions don't gap/overlap).
- **Blockers/risks:** Run is **intentionally deferred** — electronics Q1 fix is mid-build. RE non-empty blocked on live IG handle seeding (D-RUN-1, HIGH). FM-OFFCATALOG honest-empty PASS depends on `broadenSuggestions` (D-V2-2 still open for RE) and the `coverage_reason` provider-failure distinction (ADR-007 Q5, not yet built). No on-device tap tooling, so this harness runs at the API layer; UI render regressions still need the web-build screenshot pass.
