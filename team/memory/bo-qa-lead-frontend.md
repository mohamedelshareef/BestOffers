# Memory — QA Lead — Frontend (bo-qa-lead-frontend)

> READ at task start. UPDATE at end with durable facts only. Keep lean; prune stale.

## Current state (2026-06-27 — DEMO-10 sim run DONE: 10 shots captured, credit restored)
- **CREDIT RESTORED** — /search/intent returns 201 w/ live clarifiers; full pipeline green.
- **NEW HARD GOTCHA FOUND + FIXED (durable, affects ALL future sim demos):** sim Safari throws `TypeError: Load failed` on a CROSS-ORIGIN fetch :8765(page)→:3000(API). Page loads & direct :3000/health loads in sim, but the cross-origin POST /search/intent silently fails → effect fires, run() called, NO API hit, screen stays on intent (looks like "deep-link doesn't auto-run"). FIX = same-origin: (a) `/tmp/bo-spa.js` now PROXIES `/search/intent`,`/search/answer`,`/me/`,`/billing/`,`/auth/`,`/health`,`/accounts/` → 127.0.0.1:3000 (NB: do NOT proxy bare `/search` — that's the SPA page route); (b) `apps/mobile/app.json extra.apiBaseUrl=""` (relative/same-origin; config.ts `?? 'http://localhost:3000'` keeps "" since not nullish). Rebuilt web export clean (`rm -rf dist .expo node_modules/.cache && npx expo export --platform web --clear`). Stale `.expo` cache had baked apiBaseUrl=:3100 — ALWAYS --clear + nuke .expo when baseUrl changes.
- **2nd FIX (search.tsx, durable):** static web export hydrates with params already set, so the `[params.q]` mount effect can be SKIPPED → deep-link never auto-ran. Added a ref-guarded mount-once effect gated to `skipClarifiers` (`demoFired` ref, deps `[skipClarifiers, params.q]`) that fires run() once. DEMO-only (skipclar=1); normal ≥5 flow untouched. Dev to ratify both fixes.
- **10 SHOTS (team/qa/sim/demo10-01..10.png) — VERIFIED renders:** 1 غسالة صحون→7 dishwasher cards Eureka 149.9/159.0 KWD ✔relevant ✔real ✔cake-free. 2 iPhone 17 Pro Max→5 cards 354.9/419.9 ✔. 3 laptop→5 MacBook Pro 839.9/999.0 ✔. 4 تلفزيون→11 cards (streamers rank above actual TVs — minor relevance) ✔real. 5 rice→14 Talabat rice/biryani 0.75–1.1 KWD ✔CAKE-FREE. 6 burger→16 BurgerKing 0.65–1.0 ✔. 7 كيك→15 desserts but #1 cookie/#2 mousse rank above cake (soft dessert-bucket miss, no savory leak) ✔. 8 بخاري→**HONEST-EMPTY** (regression vs prior 15 rice cards — live Talabat Bukhari-route feed variance; flag to dev). 9 flat in Salwa→HONEST-EMPTY (known D-RUN-1 RE no-IG-handles). 10 شقة للايجار السالمية→HONEST-EMPTY (same D-RUN-1). All empties show broaden CTA "لا نتائج — وسّع أو عدّل البحث" (F-SR1 AC-14 ✔, no fake cards, no price-sanity violation).
- **Servers LEFT RUNNING:** API :3000 real-mode (claude=anthropic,liveFetch=on,social=apify,otp/billing=mock) pid 88075; SPA+proxy :8765 (`node /tmp/bo-spa.js`). Sim iPhone 17 Pro (8E782E23) booted. Bundle entry=8c39a3c (same-origin baseUrl).

## Prior state (2026-06-27 — DEMO-10 sim run BLOCKED: Anthropic out of credit)
- **HARD BLOCKER (PAYMENTS — surfaced to PO):** real-mode :3000 (`CLAUDE_PROVIDER=anthropic`) returns **500 on EVERY /search/intent**. Root cause = Anthropic API `400 invalid_request_error: "Your credit balance is too low to access the Anthropic API."` (verified by direct curl to api.anthropic.com w/ root .env key — key is VALID, account out of credit; req_011CcTbnZzPvUQAuwTRVzgNB). `startIntent` runs `claude.clarify()` in Promise.all WITHOUT a fallback (only generateClarifierSet has config-fallback) → clarify rejects → whole intent throws 500. No query can reach clarifiers OR results. Can't fix (payments = not authorized). Mock provider would be a false-green → refused.
- **GOTCHA RE-CONFIRMED:** `node -r dotenv/config dist/main.js` loads `.env` from CWD. MUST launch API from REPO ROOT (`node -r dotenv/config apps/api/dist/main.js`), NOT from apps/api (no apps/api/.env → key silently missing → different 500 "ANTHROPIC_API_KEY missing"). Root .env has ANTHROPIC+APIFY keys.
- **Fresh build DONE + servers LEFT RUNNING:** rebuilt build:types + apps/api (tsc, clean), deleted apps/mobile/dist + `npx expo export --platform web` fresh (base URL baked http://localhost:3000, skipclar present in bundle). API real-mode on :3000 (claude=anthropic,liveFetch=on,social=apify,otp=mock,billing=mock) launched from ROOT. SPA `/tmp/bo-spa.js` on :8765 (root+/search 200). Sim iPhone 17 Pro (8E782E23) BOOTED. :3300/:3301 leftover QA APIs still up.
- **RENDER PROOF (real shots):** `team/qa/sim/demo10-blocked-categories.png` (category landing renders perfect — 3 active tiles, Cars Soon, RTL), `team/qa/sim/demo10-blocked-search.png` (search screen renders w/ "laptop" prefilled but auto-run 500s → UI catches error, falls back to empty intent screen, NEVER reaches results). Frontend/serving stack 100% healthy; ONLY blocker is Anthropic credit.
- **DEMO mechanism CONFIRMED EXISTS in build:** `?q=<>&cat=<>&skipclar=1` deep-link (search.tsx:53,125 autoSkipToTerminal) auto-answers every clarifier __skip__ to terminal — DEMO-ONLY, normal flow still asks ≥5. So once credit restored, the 10-shot run is a straight re-run of `xcrun simctl openurl booted` per query.
- The 10 demo queries (cat I used): 1 غسالة صحون=electronics(appliance), 2 iPhone 17 Pro Max=elec, 3 laptop=elec, 4 تلفزيون=elec, 5 rice=food, 6 burger=food, 7 كيك=food, 8 بخاري=food, 9 flat in Salwa=realestate, 10 شقة للايجار السالمية=realestate.

## Prior state (2026-06-27 — 300-CASE SUITE RUN COMPLETE → 220/300, report delivered)
- **Report: `team/qa/search-run-report.md`** (full pass/fail + clusters). Warm/deterministic live run: **220/300 (73%)** — Electronics 64/100, Food 56/100, **RE 100/100**.
- **RUN METHOD:** isolated API :3300 `CLAUDE_PROVIDER=mock LIVE_FETCH=on SOCIAL_PROVIDER=apify APIFY_RESULTS_LIMIT=8 SQLITE_PATH=/tmp/bo-qa-run.sqlite`, boot via `node -r dotenv/config dist/main.js` (root `.env` has APIFY/ANTHROPIC keys; `start` script does NOT auto-load dotenv). Harness `/tmp/bo-run300.mjs` (CONC=1 sequential to avoid live-Apify cold-cache throttle false-empties). Results `/tmp/bo-run300-warm.json`. Also :3301 = deterministic `LIVE_FETCH=off SOCIAL_PROVIDER=mock` (mock food/RE sparse — NOT a faithful relevance oracle). BOTH LEFT RUNNING.
- **CRITICAL FLAKE FINDING:** live Apify is cold-cache flaky under concurrency — a 4-way batch produced ~10 false-empties. Verified: re-probe each empty 2-3× warm; ALL 80 fails are STABLE (real), zero cache artifacts. Always run the suite SEQUENTIAL + verify empties warm.
- **BUILD WAS BROKEN (surfaced to PO):** dev WIP returned `coverageReason` on SearchResponse but field absent from type → `search.service.ts:351` TS2353. I added optional `coverageReason?: 'ok'|'genuine_no_match'|'provider_failure'|'timeout'` to `packages/shared/src/domain.ts` (matches CoverageReason union in offers.service.ts) to build+run fresh dist. Dev to ratify.
- **DEFECT CLUSTERS (ranked, routed to dev):**
  - **C1 catalog-0 ELEC (HIGH, 36):** AR-routing + appliance + typo return empty though real stock exists. 22 AR / 14 EN / 5 typo. EN flagship phones/laptops + dishwasher(E006 FIXED) pass; AR transliteration, appliances (AC/vacuum/fridge/washer/TV/AirPods/watch), typos (ayfon/labtop/telvison/refrigirator) all 0. Root: resolver keys EN-canonical only; SLICE-Q1 didn't generalize.
  - **C2 catalog-0 FOOD (HIGH, 22):** same shape in Talabat lane. AR + specific-dish (cheesecake/tiramisu/donuts/breakfast/cappuccino/salad/pizza hut/fried chicken) + typos (biryni/burgr/shwarma) empty. EN canonical (rice/cake/burger/kfc/mcdonalds/mandi/kabsa/mansaf/latte) pass.
  - **C4 food no-dump GR3 (MED, 9):** **`Tes P Hut` is a live TEST VENDOR leaking into prod Talabat results** + beverages front-rank desserts; long-tail (ramen/tacos) dumps test-vendor instead of honest-empty. REMOVE test vendor.
  - **C3 rice-pudding leak (LOW, 11):** only "Rice Pudding" surfaces in savory-rice queries — **headline rice→cake regression is FIXED** (no cake/cheesecake). food-relevance.ts rice bucket needs dessert-subtype exclusion.
  - **C5 (MED,1):** F035 food gibberish returns cards (no honest-empty guard on food path; elec guards correctly).
- **RE GREEN:** all area (35 KW areas), tenure, price-unit (R024 300k/R080 500k/R081 200k) traps PASS via honest-empty+broaden+coverageReason=genuine_no_match. Non-empty RE still blocked on IG handles (D-RUN-1).

## Prior state (2026-06-27 — search suite EXPANDED to 300 cases, 100 PER SECTOR)
- **Search hardening suite DESIGNED (not yet run) — now 300 cases:** `team/qa/search-test-cases.md` + runnable `team/qa/search-test-cases.json` (JSON validated: **300 cases, 0 dup IDs, exactly 100/sector, sequential IDs E001-100/F001-100/R001-100 complete, no malformed**). Owner directive: search runs across ALL sectors → **Electronics 100 / Food 100 / Real-estate 100** (NOT 100 split). **123 AR / 177 EN**. Schema unchanged `{id,category,query,lang,failureMode,expectation:{state,relevant,oracle}}`. IDs are 3-digit (E001…) — note: OLD refs were E01-40/F01-35/R01-25; those map to E001-040/F001-035/R001-025.
- **Per-sector failure-mode (in meta.breakdown.per_sector):** Electronics — FM-CATALOG 67, baseline 11, FM-TYPO 7, FM-BRANDONLY 6, FM-OFFCATALOG 5, FM-CONSTRAINT 4. Food — baseline 48, FM-RELEVANCE 42, FM-TYPO 7, FM-OFFCATALOG 3. RE — FM-AREA 61, FM-TENURE 13, FM-CONSTRAINT 9, FM-PRICEUNIT 7, FM-OFFCATALOG 5, FM-TYPO 5. Totals: baseline 59, FM-CATALOG 67, FM-RELEVANCE 42, FM-AREA 61, FM-TENURE 13, FM-PRICEUNIT 7, FM-TYPO 19, FM-BRANDONLY 6, FM-OFFCATALOG 13, FM-CONSTRAINT 13 (new mode for budget/spec/bedrooms/furnished/cheapest).
- **RE area coverage now ~35 KW areas AR+EN:** Salmiya/Salwa/Jabriya/Mahboula/Hawally + unlisted Zahra/Mishref/Bayan/Rumaithiya/Sabah Al-Salem/Mangaf/Fintas/Farwaniya/Jahra/Abu Halifa/Sharq/Dasma/Adailiya/Shaab/Bnaid Al-Qar/Qortuba/Surra/Khaitan/Jleeb/Messila/Funaitees/Abu Fteira/Sabah Al-Ahmad. Price-unit absurd-rent traps now 300k/500k/200k (R024/R080/R081).
- **Harness contract (unchanged):** POST /search/intent {sector,locale,intentRaw,pseudoId} → skip-loop POST /search/answer {searchSessionId,dimension,answer:"__skip__"} through ≥5 gate (MIN_CLARIFIER_QUESTIONS=5) to terminal. Reuse `skipToTerminal` (clarifier-test-util.ts). Distinct pseudoId/case = un-metered. 5 global rules GR1 gate≥5, GR2 truthful, GR3 no-dump, GR4 honest-empty+broaden, GR5 price-sanity (rent 50-3000, sale ≥10k).
- **ADR-007 failures locked (meta.adr007_regression_locks):** E006/E007 dishwasher 0-results, F001/F008 rice↔cake, F002 Bukhari→cake, F003/F004/F005 machboos drift, F009 كيك, R001/R002 Jabriya wrong-area, R009-R015 unlisted areas, R024 300k-rent.
- **RUN IS DEFERRED:** PO triggers AFTER SLICE Q1 (electronics catalog-free discovery) lands — running now = false-red on the 67 FM-CATALOG electronics cases. RE non-empty also blocked on live KW RE IG handles (D-RUN-1); until seeded their PASS bar = honest-empty+broaden. WORKFLOW §7: iterate until AC holds across all 300, not first green.

## Prior state (2026-06-27 — LATEST-BUILD owner handoff + Bukhari→cake fix)
- **Rebuilt CLEAN for owner:** killed stale :8765, `build:types`+`build apps/api` (no errors), DELETED `apps/mobile/dist` then `npx expo export --platform web` (fresh, bundle base URL baked=http://localhost:3000 — grep-confirmed). API restarted real-mode :3000 (claude=anthropic,liveFetch=on,social=apify,extractor=anthropic,otp/billing=mock), health 200. SPA via `/tmp/bo-spa.js` on :8765 (root+/categories both 200). Both LEFT RUNNING. Login code 000000.
- **Bukhari→cake FIX — VERIFIED at data layer** (sim has no tap tooling; drove clarifier flow via /search intent+answer skip-loop, `/tmp/bo-drive2.js`):
  - بخاري (food) → 15 cards ALL rice/biryani/mansaf (Tikka Rice, Saffron/White Rice, Chicken+Lamb Biryani, mansaf @scale.kuwait). ZERO cake. Rice-routed.
  - كيك (food) → 21 cards real desserts (Chocolate Cake, Lotus/Oreo Cheesecake, Saffron Milk Cake, Tiramisu, Umm Ali, Kunafa, Mafroukeh + IG @bakehaus cake). Clean separation.
- **Category landing RENDERS on sim — VERIFIED** (`team/qa/sim/handoff-categories.png`): Electronics+Food+RealEstate active, Cars Soon, RTL AR, v2 theme.

## Prior state (2026-06-27 — FRESH-BUILD sim handoff for owner)
- **Rebuilt CLEAN for owner demo:** killed stale :8765, `npm run build:types` + `build apps/api` (no errors), DELETED `apps/mobile/dist` then `npx expo export --platform web` (fresh). API restarted real-mode :3000 (claude=anthropic,liveFetch=on,social=apify,extractor=anthropic,otp/billing=mock). Serve fresh dist via custom Node SPA-fallback server `/tmp/bo-spa.js` on :8765 (`serve -s` 301→404s deep routes; don't use it — use the node fallback). Bundle base URL baked = http://localhost:3000.
- **Clarifiers FIRE — VERIFIED on sim** (shot `build-01-elec-clarifier.png` electronics "1 من 5" MSA Q+chips; `build-02-food-clarifier.png` food "2 من 5" party-size). Server ≥5 gate walks model→storage→color→budget→condition then dispatches (5 distinct, count/total render). Both via `/search?cat=..&q=..` auto-run.
- **Food relevance FIXED — VERIFIED at data layer** (sim can't tap past clarifier gate to reach results screen; no tap tooling). "Chilled with rice" → 14 cards ALL rice/biryani (Tikka Rice, Saffron Rice, Chicken/Lamb Biryani, rice bowls), NO sauces, NO Test-vendor. food-relevance.ts filter working.
- **Real Estate "Salwa" — IMPROVED:** now returns 1 real card "3BR · Salwa" from @q8_rent (was 0 in D-RUN-1). Partial close of the data gap; still thin, not the build.
- Login code (mock OTP) = 000000. Both servers LEFT RUNNING (API pid varies on :3000, SPA on :8765).

## Prior state (2026-06-26 — FULL REAL-mode sim run for PO demo)
- Report: `team/qa/sim/run-report.md` (NEW, 6 real shots `team/qa/sim/run-01..06`). Prior: `qa-v2-device-report.md`, `qa-simulator-report.md`.
- **FULL REAL run (claude=anthropic, liveFetch=on, social=apify, extractor=anthropic; billing/otp=mock):**
  - **Categories PASS** — NOW 3 active tiles Electronics+Food+**RealEstate(عقارات شقق)**, only Cars Soon. NOTE: served dist was STALE (old 2-active layout) — had to RE-EXPORT (`cd apps/mobile && npx expo export --platform web`). Always re-export before a demo.
  - **Electronics PASS** — clarifier (MSA storage Q + chips), exact-rich query → ranked cards X-cite 219.900 / Blink 364.900 / Best Al-Yousifi, gold verdict ribbon, real deeplinks, src=live.
  - **Food PASS — D-V2-1 RESOLVED** — "kfc" → 59 cards: 55 real Talabat dishes (real talabat.com/kuwait/kfc links) + 4 real IG offers. IG CTA pill "شوف على إنستقرام" RENDERS. Real permalinks @offer_food_kw/p/DZ2S4cCMAQd, @kuwait_eateries/p/DZ5RXEoiONs, @mug.cr ×2 — ALL HTTP 200 live.
  - **Real Estate FAIL (D-RUN-1 HIGH)** — 0 offers in live mode. Root cause: `apify-social-provider.ts:32 realestate: []` (no live IG handles; Phase-2 ADR-006). RE flats exist only in MOCK provider. Screen renders empty "لا نتائج". Backend must seed KW real-estate IG handles for live demo.
- Driving tip: search auto-runs from `?q=` deep-link (search.tsx:87). Food/RE need ~25-30s for Apify; browser fetch doesn't share curl's cache. IG cards are at list bottom — used non-destructive auto-scroll spa variant on :8766 to shoot them.

## Prior state (v2 DEVICE QA)
- Report: `team/qa/qa-v2-device-report.md`. Prior: `qa-simulator-report.md`, `qa-frontend-report.md`.
- **SIM-HIGH-1 RESOLVED:** the web build now RENDERS in the sim (Safari, served :8765). Real shots `team/qa/sim/00-launch..07-settings.png` (category, intent, login, otp, paywall, subscription, profile, settings). Prior blank-render no longer repros on this build.
- **PASS (render+look):** category-first landing (Electronics+Food active, Furniture/Cars Soon), intent screen (eyebrow+back chevron), OTP/login (+965, SMS fallback, resend timer), paywall ($1/mo), settings (biometric disabled "غير متوفر", notif single master toggle, plan مجاني), graceful error states (profile/subscription unauthed). v2 sand/teal/gold, RTL mirrored, Western numerals everywhere (format.ts -nu-latn + NumText).
- **Electronics live search PASS at data layer:** real providers Eureka/Best Al-Yousifi/Blink, real KWD prices, real deeplinks, truthful why-this, clarifier MSA+chips. Exact-rich query shows zero alternative tags (F-SR1 AC-2 ✔).
- **NEW HIGH DEFECTS (for Dev Lead):**
  - **D-V2-1 (HIGH) — RESOLVED 2026-06-26:** Food/Talabat now returns real cards live ("kfc"→55 dishes + 4 IG). Was 0 cards for every query. Verified on full real run.
  - **D-RUN-1 (HIGH, NEW):** Real Estate = 0 offers in live mode. `apify-social-provider.ts:32 realestate: []` — no live IG handles seeded (Phase-2 ADR-006). RE flats only in mock provider. Backend: seed verified KW real-estate IG handles into live HANDLES map.
  - **D-V2-2 (HIGH):** empty state is bare 0-results, NO broadenSuggestions → violates F-SR1 AC-14 "never a dead end"; also no provider-error degraded flag to distinguish from true no-match.
  - **D-V2-3 (MED):** verdict ribbon assumes card #1=cheapest (search.tsx:144 "ranked cheapest-first") but ranker.ts sorts by match-QUALITY (spec+stock+price tiebreak). Live: #1=419.500 while #4=369.900 cheaper. "Best offer" crown + "saves vs average" can sit on a non-cheapest card / misstate savings.
  - **D-V2-4 (MED):** login shows dev-code hint "000000" but build runs OTP_PROVIDER=twilio (dev code rejected unless mock). Blocks on-device authed QA + misleads testers.

## SIMULATOR / BUILD (durable — affects everyone's machine)
- **Web build on :8765 NOW RENDERS in sim Safari** (open with `xcrun simctl openurl booted http://localhost:8765/...`). SIM-HIGH-1 (blank mount) no longer repros on this build. Use deep URLs to reach screens: `/categories /search?cat=electronics /login /login/otp /paywall /subscription /profile /settings`.
- **No on-device tap tooling:** `simctl` has no tap subcommand; `idb` NOT available (brew `idb-companion` formula missing). So typed-search submission, clarifier taps, EN-toggle, and 6th-search live gate CANNOT be driven via the sim — verify those at API/code level. Screenshots (render proof) are fine via `simctl io booted screenshot`.
- **Native `expo run:ios` still BLOCKED** (RN 0.74 vs Xcode/iOS 26.2 ReactCommon redefinition) — SIM-HIGH-2 unchanged; pixel pass uses the web build instead.
- API test flakiness: jest while dev API up → spurious fails (shared dev.sqlite). Green isolated. Want separate test DB.

## Key decisions / known facts
- Test infra is LOGIC-ONLY (ts-jest, testEnvironment:node). NO RN component render tests (no @testing-library/react-native, no jest-expo). RTL/layout/visual = code-review + bundle only.
- Web demo uses localStorage for refresh token (honestly NOT secure); real SecureStore = device-only.
- Locale toggle flips COPY+textAlign live but NOT a true layout flip (I18nManager.forceRTL needs reload). App boots forced-RTL (correct AR default).

## Defects (for Dev Lead) — status as of sim pass
- **FIXED:** D1 (resume now `src/search/resume.ts` BlockedSearch — replays exact 402'd call, tested), D2 (explainer sheets via `src/settings/explainerGate.ts` + Modal in settings.tsx, tested), D4-date (cancel returns real currentPeriodEnd), D5 (true email pending→verify lifecycle live), D6-server (server rejects invalid email + lowercases/trims).
- **SIM-HIGH-1 (HIGH, NEW):** static web export renders BLANK in mobile Safari (mount fails silently). Need console trace + error boundary.
- **SIM-HIGH-2 (HIGH, NEW):** native iOS build blocked (RN0.74 vs Xcode/iOS 26.2). Upgrade Expo SDK/RN — prereq for pixel pass.
- **SIM-MED-1 (MED, NEW):** dev `expo start --web` bundle src `/../../` 404 (monorepo path).
- **D3 (MED):** avatar cropper + action sheet (Take/Choose/Remove) + JPEG/PNG/WebP+5MB validation not implemented.
- **D4-rem (MED):** subscription M1 — no receipts/billing-history list, no cancel-confirm sheet (strings unused).
- **D6-ui (LOW):** confirm inline email MESSAGE renders (not "Email ✗"); add client name 1–60/charset validation.
- **D7 (LOW):** profile hardcodes phone "…٦٧" (profile/index.tsx L79) + plan planFree (L83); settings L114 plan hardcoded. Not read from profile/billingStatus.
- **D8 (LOW):** OTP verify flattens all errors to "Incorrect code"; no distinct expired/lockout/too-many states.
- **F-A3-rem (LOW):** notifications is single master toggle; per-type (price-drop/account-security) list absent.

## Device-only (could NOT verify headlessly) — PO/owner checklist
Real biometric prompt + secure-enclave token (F-A2), real push permission prompt + OS-denied deep-link (F-A3), SecureStore Keychain/Keystore persistence, native image picker/crop + HEIC handling (F-A1), real Stripe Checkout/portal sheet + webhook race (F-D1), true RTL layout-flip after reload, pixel/screenshot visual pass (design tooling not in env — owed).

## Open questions / handoffs
- Confirm with BA: when gate fires mid-clarifier, what exactly should resume run? (drives D1 fix)
- Visual mockup pass still OWED (noted by UX lead; tooling absent here).
