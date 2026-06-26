# Memory — QA Lead — Frontend (bo-qa-lead-frontend)

> READ at task start. UPDATE at end with durable facts only. Keep lean; prune stale.

## Current state (2026-06-26 — v2 DEVICE QA, app NOW RENDERS on sim)
- Report: `team/qa/qa-v2-device-report.md` (NEW). Prior: `qa-simulator-report.md`, `qa-frontend-report.md`.
- **SIM-HIGH-1 RESOLVED:** the web build now RENDERS in the sim (Safari, served :8765). Real shots `team/qa/sim/00-launch..07-settings.png` (category, intent, login, otp, paywall, subscription, profile, settings). Prior blank-render no longer repros on this build.
- **PASS (render+look):** category-first landing (Electronics+Food active, Furniture/Cars Soon), intent screen (eyebrow+back chevron), OTP/login (+965, SMS fallback, resend timer), paywall ($1/mo), settings (biometric disabled "غير متوفر", notif single master toggle, plan مجاني), graceful error states (profile/subscription unauthed). v2 sand/teal/gold, RTL mirrored, Western numerals everywhere (format.ts -nu-latn + NumText).
- **Electronics live search PASS at data layer:** real providers Eureka/Best Al-Yousifi/Blink, real KWD prices, real deeplinks, truthful why-this, clarifier MSA+chips. Exact-rich query shows zero alternative tags (F-SR1 AC-2 ✔).
- **NEW HIGH DEFECTS (for Dev Lead):**
  - **D-V2-1 (HIGH):** Food/Talabat returns 0 cards for EVERY query (برجر/بيتزا/شاورما/kfc…). Talabat endpoints reachable+parseable via curl (restaurants 200/42 slugs, kfc page vendorId 5804, menu JSON 55KB result.menu.menuSection[].itm[]) but API adapter yields nothing. Food category fully non-functional. Root cause in adapter (UA/CF from Node fetch / 4s timeout / parse) — backend fix.
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
