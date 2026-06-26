# QA Simulator Report — On-Device (iOS Simulator) Pass

> Owner: bo-qa-lead-frontend · 2026-06-26 · Target: booted **iPhone 17 Pro** sim (UDID `8E782E23-D51B-4326-8830-01BAE2C87510`), iOS 26.2, Xcode 26.2, node 25, Expo SDK 51 / RN 0.74.0.
> Oracle: `team/analysis/feature-acceptance-criteria.md`. App: `apps/mobile` (Expo). API: `apps/api` (NestJS, mock mode).
> **Bottom line:** The owner-requested *functional* journey is VERIFIED end-to-end against the live mock API on this machine (real OTP→quota→paywall→subscribe→cancel/past_due→profile/email/biometric/notif). BUT I could **not** get the app's UI to render on the simulator: the native iOS build is blocked by a hard RN-0.74-vs-Xcode-26 toolchain incompatibility, and the Expo-Web fallback renders a **blank screen** in the simulator's mobile Safari (a real, reproducible defect). Pixel/visual screenshots of the actual screens remain OWED until the build path is fixed. I am being explicit about exactly what ran and what did not.

---

## 0. Release recommendation

**Functional pass (mock backend) — CONFIRMED. On-device UI pass — STILL BLOCKED.**
The money journey, freemium gate, auth, profile/email lifecycle, and settings toggles all behave correctly at the API contract level (driven live, real responses below). Two HIGH defects from the prior pass (D1 resume, D2 explainer sheets) are now FIXED in code and covered by new tests. Three MED defects (D4 cancel-date, D5 email-pending, D6 email-validation) are now FIXED at the API level (proven by the live run). The **blocker for an actual on-device demo** is now BUILD/RENDER, not feature logic — see §1 and SIM-HIGH-1.

---

## 1. How I tried to get it running — what actually worked, what didn't

### Step 1 — Backend (mock mode): WORKED
- `npm run migrate` + `npm run seed` → `dev.sqlite` (providers=4, skus=15, offers=25).
- `PORT=3000 npm run dev:api` → API healthy: `GET /health` → `{"status":"ok","providers":{"otp":"mock","billing":"mock","claude":"mock"}}`.
- The simulator reaches it at `http://localhost:3000` (iOS sim shares the host loopback) — **no config change needed**; `app.json extra.apiBaseUrl` already points there.

### Step 2 — App onto the simulator: tried 3 paths, all blocked for UI render

**(a) Native build — `npx expo run:ios --device 8E78…` — FAILED (toolchain incompatibility).** This is the core finding. The app has NO checked-in `ios/` project, so prebuild generated one. The build then failed through a chain of version-drift problems that I worked through one by one:
  1. `ios.bundleIdentifier` missing → **fixed** (added `com.bestoffers.mobile` to `app.json`).
  2. `pod install` crashed: `Unicode Normalization not appropriate for ASCII-8BIT` → **fixed** by running with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
  3. `expo-secure-store` declared in `package.json` but **not installed** in `node_modules` (the app imports it) → autolinking failed → **fixed** with `npm install expo-secure-store@~13.0.0`.
  4. Podfile used `:privacy_file_aggregation_enabled`, a `use_react_native!` keyword **not supported by RN 0.74.0** (the Expo prebuild template is newer than the pinned RN) → patched the generated Podfile to drop it.
  5. Swift `ExpoModulesCore` couldn't import non-modular `React-jsinspector` as a static lib → added `use_modular_headers!`; pods then installed (67 pods).
  6. **Terminal blocker:** with modular headers, the build dies with **69× `Redefinition of module 'ReactCommon'`** in `React-RCTAppDelegate`. RN 0.74 ships a hand-written `Pods/Headers/Public/ReactCommon/ReactCommon.modulemap` that collides with the pod-generated one. Tried `DEFINES_MODULE=NO` (no effect) and deleting the duplicate modulemap (then xcodebuild errors `module map file … not found` — the xcconfig still references it). This is a **circular, known incompatibility between RN 0.74 (mid-2024) and the Xcode 26.2 / iOS 26.2 SDK toolchain on this machine.** It is NOT fixable by app code.

**(b) Dev client / Expo Go — NOT viable here.** No `expo-dev-client` dependency; Expo Go for SDK 51 isn't installed on the sim, and installing it needs the same native story or store access. Not attempted further given (a)'s root cause is the SDK/toolchain pairing.

**(c) Expo Web in the simulator's Safari — LOADS but renders BLANK (defect).**
  - `expo start --web` dev server: the generated `index.html` points the bundle at `/../../node_modules/expo-router/entry.bundle` (a monorepo-hoist path that escapes the server root) → **404 on the bundle** → blank. Metro serves neither the literal nor the collapsed path. Config defect.
  - `expo export --platform web` (static): produces a clean `/_expo/static/js/web/entry-*.js` (905 KB, plain JS, `apiBaseUrl` baked in). Served it with `python3 -m http.server` and opened it in the sim. **The simulator fetched `/` (200) and the bundle (200/304), but the page renders blank** even after 8 s. I proved Safari itself renders fine (loaded example.com → text shows — screenshot `01-safari-renders-webpages-OK.png`), so **the blank is an app render failure in the static web export on WebKit**, not a simulator problem. Reproducible. → **SIM-HIGH-1.**

### What I could verify, instead — the live functional journey
Because the UI wouldn't render, I drove the EXACT endpoints the screens call, live against the mock API, with the correct contracts (`phoneE164`/`code`, webhook `{type,userId,status}`). Real responses in §2. This is the same verification basis as the prior pass but re-run on this machine with the current code, and it now exercises the fixed flows (email pending→verify, cancel-with-date, past_due).

---

## 2. Functional journey — REAL live responses (mock API, this machine)

Single identity, fresh phone `+9655…` (random, to avoid the real 30s OTP cooldown — itself a correct rate-limit, see note):

| # | Step | Real response | Verdict |
|---|---|---|---|
| 1 | Anon search | `201 state=clarifying` (unmetered, no Bearer) | PASS |
| 2 | OTP request (WhatsApp) | `{sent:true, channel:"whatsapp", cooldownSeconds:30}` | PASS |
| 3 | OTP verify `000000` | `201 {access, refresh, pseudoId, localePref:"ar", isNewUser:true}` | PASS |
| 4 | Quota fresh | `{used:0, limit:5, premium:false}` | PASS |
| 5.1–5.5 | 5 searches → results | quota `used` increments **1→5**, each at `state=results` (clarifiers skipped, don't count) | PASS — counting boundary correct (F-D2 AC-1) |
| 6 | **6th search** | **`402` `{error:"PAYWALL", used:5, limit:5}`** at the answer step | PASS — gate fires before the 6th result set (F-D2 AC-5) |
| 7 | Checkout | `mock-checkout://confirm?user=<id>&customer=cus_mock_…`; client parses `user` | PASS |
| 8 | Webhook `mock.confirm` | `{applied:true}` | PASS |
| 9 | Billing status | `{status:"active", premium:true, currentPeriodEnd:"2026-07-26…"}` | PASS |
| 10 | Quota after subscribe | `{used:5, limit:5, premium:true}` — gate bypassed | PASS (F-D2 AC-7) |
| 11 | Post-subscribe search | `201 state=results` (unlimited) | PASS |
| 12 | Cancel (`subscription.deleted`) | `{status:"canceled", premium:true, currentPeriodEnd:"2026-07-26…"}` | PASS — **access until period end + REAL date** (fixes prior D4 "Ends on —") |
| 13 | Resume (`subscription.updated status=active`) | `{status:"active", premium:true}` | PASS (F-D1 AC-8) |
| 14 | `invoice.payment_failed` | `{status:"past_due", premium:false}` | PASS (F-D1 AC-9) |
| 15 | Profile GET | `{name:null, email:null, verified:false}` | PASS (new user) |
| 16 | PATCH name+email `"Tester@Example.com "` | `200 {name:"مستخدم تجريبي", email:null, emailPending:"tester@example.com", verified:false, emailVerifyToken:…}` | PASS — **true pending state + lowercased/trimmed** (fixes prior D5/AC-3) |
| 17 | `/me/email-verify` token | `{verified:true}` | PASS — pending→verified lifecycle works |
| 18 | PATCH email `"not-an-email"` | **`400 "invalid email address"`** | PASS — **server validates** (fixes prior D6 server-side) |
| 19 | Biometric toggle | `200 {biometricEnabled:true}` persisted | PASS |
| 20 | Notif toggle | `200 {notifEnabled:true}` persisted | PASS |

**Note (rate-limit, correct behavior):** re-requesting OTP for the same number within 30 s returns `429 "please wait before requesting another code"` — the F-C1 AC-5 cooldown working.

---

## 3. Pass/fail per screen/AC — current state (code review + live API)

Screens were reviewed in code (could not be rendered on-device). Verdicts combine code review with the live API behavior they drive.

| Screen / AC area | Verdict | Evidence / note |
|---|---|---|
| **F-C1 OTP** — phone entry, WhatsApp-first, SMS fallback, 6-box, 30s resend | PASS (logic) | `login.tsx`/`otp.tsx`/`OtpInput`; live OTP req/verify/cooldown confirmed (§2) |
| F-C1 — distinct error states (expired/lockout/too-many) | **FAIL (D8, LOW)** | UI still flattens every verify error to generic "Incorrect code"; backend distinguishes |
| F-C1 — first-sign-in biometric opt-in (AC-10) | **FAIL** | verify routes straight to `/`; no opt-in prompt on `isNewUser` |
| **F-D2 gate** — counting boundary, 5→6th paywall, pill states | PASS | live: increments at `results`, 402 on 6th (§2); `QuotaPill` logic tested |
| F-D2 AC-5 — resume runs blocked search, no re-typing | **PASS (D1 FIXED)** | `src/search/resume.ts` `BlockedSearch` captures the EXACT 402'd call and replays it → lands on results, not clarifiers; unit-tested (`resume.spec.ts`) |
| **F-D1 paywall** — $1/mo block, Subscribe, "Billed in USD", Later | PASS (logic) | `paywall.tsx`; checkout→confirm→resume wired |
| F-D1 M1 — active/canceled/past_due/free states | PASS | live: all four transitions correct (§2); `subscription.tsx` renders each |
| F-D1 — canceled "Ends on {date}" | **PASS (D4 date FIXED)** | API now returns `currentPeriodEnd` on cancel → UI shows a real date, not "—" |
| F-D1 — receipts/billing-history list, cancel-confirm sheet | **FAIL (D4 remainder, MED)** | still not implemented in `subscription.tsx` |
| F-D1 — restore-purchase row on paywall | **FAIL** | not implemented |
| **F-A1 profile view** — avatar/initials, name, email, phone, plan | PARTIAL (D7, LOW) | `profile/index.tsx` still hardcodes phone `"…٦٧"` (line 79) and plan `planFree` (line 83); not read from `profile`/`billingStatus` |
| F-A1 edit — Save gating, name+email, email LTR | PASS (logic) | `profile/edit.tsx` |
| F-A1 — email change → pending → verify, validation | **PASS (D5/D6 FIXED server-side)** | live §2 #16–18; **client-side** name 1–60/charset + inline email message still to confirm rendered (D6 UI remainder) |
| F-A1 — avatar cropper + action sheet (Take/Choose/Remove) + type/size | **FAIL (D3, MED)** | not implemented; device-only picker anyway |
| **F-A2 biometric toggle** — first-time EXPLAINER sheet + Enable/Not-now | **PASS (D2 FIXED)** | `settings.tsx` renders the Modal sheet gated by `src/settings/explainerGate.toggleDecision`; persists only after "Enable"; unit-tested (`explainerGate.spec.ts`) |
| F-A2 — real biometric prompt + enclave token | DEVICE-ONLY | §5 |
| **F-A3 notifications toggle** — pre-permission soft-ask sheet + OS-denied banner | **PASS (D2 FIXED)** + PARTIAL | explainer sheet now renders; per-type prefs (price-drop / account-security) still a single master toggle (AC-1 remainder) |
| RTL/AR-EN — forced-RTL boot, AR/EN copy, OTP digits LTR | PASS (code) | `_layout.tsx forceRTL(true)`; full bilingual table; **NOT screenshot-confirmed on-device** (render blocked) |
| Auth Bearer plumbing | PASS | live: guarded calls need token (401 without), anon search unmetered |

---

## 4. Screenshot inventory (`team/qa/sim/`)

| File | What it proves |
|---|---|
| `01-safari-renders-webpages-OK.png` | The simulator's mobile Safari **renders web content correctly** (example.com text visible) — isolates the blank app render to the app, not the sim/Safari. |
| `02-bestoffers-static-blank-initial.png` | BestOffers static web export loaded in the sim → **blank white** (bundle fetched 200, nothing rendered). |
| `03-bestoffers-static-blank-after-8s.png` | Same, after an 8 s wait + bundle re-exec (304) → **still blank** — confirms it's not a load-timing issue. |

**Screenshots NOT captured (owed, blocked by render):** sign-in/OTP, ranked result cards with X-cite/Blink prices, quota pill, paywall, subscribe-confirm, profile view/edit, settings toggles + explainer sheets, subscription/manage, RTL/AR renderings. These need a working build (SIM-HIGH-1 / SIM-HIGH-2 fixed) before pixels can be captured.

---

## 5. Device-only (genuinely cannot verify even with a working sim render)

Real Face ID/Touch ID prompt + secure-enclave token + biometric-set-change invalidation (F-A2); real push-permission OS prompt + OS-denied "Open Settings" deep link (F-A3); SecureStore Keychain persistence across reinstall; native image picker/crop + HEIC + type/size reject (F-A1); real Stripe Checkout/portal sheet + webhook-delay race (F-D1); true RTL↔LTR layout flip after reload.

---

## 6. Prioritized defect list for the Dev Lead

| ID | Sev | Area | Defect | Repro | Fix direction |
|---|---|---|---|---|---|
| **SIM-HIGH-1** | HIGH | Web build | Static `expo export --platform web` renders a **blank screen** in mobile Safari (and presumably the static demo target). Bundle loads (200) but nothing mounts. | `expo export --platform web` → serve `dist/` → open in iOS sim Safari → blank | Reproduce in a desktop browser with devtools open and read the runtime console error; likely an unhandled exception at mount (suspect `I18nManager.forceRTL` on web, or expo-router single-output mount). Add an error boundary so failures aren't silent. |
| **SIM-HIGH-2** | HIGH | Native iOS build | `expo run:ios` cannot compile: RN 0.74.0 + Expo SDK 51 vs **Xcode 26.2 / iOS 26.2 SDK** → `Redefinition of module 'ReactCommon'` (modular-headers/modulemap collision), preceded by a Podfile keyword unsupported by RN 0.74 (`:privacy_file_aggregation_enabled`) and a missing `expo-secure-store` install. | `npx expo run:ios --device 8E78…` from a clean tree | **Upgrade the toolchain pairing:** bump to Expo SDK 52/53 + RN ≥0.76 (which support new Xcode/iOS SDKs and the new privacy-manifest aggregation), OR pin an older Xcode. Add `expo-secure-store` to a real install. Decide whether to commit an `ios/` project. This is the prerequisite for ANY on-device pixel pass. |
| **SIM-MED-1** | MED | Dev web server | `expo start --web` emits a bundle `src` of `/../../node_modules/expo-router/entry.bundle` (monorepo-hoist path escapes server root) → bundle 404 → blank in any browser served from the dev server. | `expo start --web` → open `/` → bundle 404 | Fix metro `watchFolders`/`projectRoot` or `server` config for the monorepo so the web entry resolves under the server root. |
| D3 | MED | Profile edit | Avatar cropper + action sheet (Take/Choose/Remove) + JPEG/PNG/WebP + 5 MB validation not implemented | Edit → tap avatar | F-A1 AC-7/9/10 (device picker anyway) |
| D4-rem | MED | Subscription M1 | No receipts/billing-history list; no cancel-confirm sheet (strings exist, unused) | Manage → cancel fires immediately, no receipts | F-D1 AC-10 |
| D6-ui | LOW | Profile edit | Client-side: confirm inline email **message** (not "Email ✗") renders, and add name 1–60/charset validation | Enter bad email/name | F-A1 AC-2/3 (server already validates — §2 #18) |
| D7 | LOW | Profile / Settings | Phone `"…٦٧"` and plan `planFree` **hardcoded**, not read from `profile`/`billingStatus` | Subscribe → profile still shows "Free"; phone literal | F-A1 AC-1, F-D1 AC-4 |
| D8 | LOW | OTP verify | No distinct expired/lockout/too-many states; all show generic "Incorrect code" (backend distinguishes) | Wrong code ×5 / wait for expiry | F-C1 AC-11 |
| F-A3-rem | LOW | Settings | Notifications is a single master toggle; per-type (price-drop / account-security) list absent | Settings → one toggle only | F-A3 AC-1 |

**Confirmed FIXED since the prior FE pass (no longer defects):** D1 (resume → `BlockedSearch`), D2 (explainer sheets via `explainerGate`), D4-date (cancel returns real `currentPeriodEnd`), D5 (true email pending→verify lifecycle), D6-server (server rejects invalid email, lowercases/trims).

---

## 7. Test health (kept green)

- **Mobile:** `npm test` → **18/18 pass** (6 suites; new `resume.spec.ts` + `explainerGate.spec.ts`). `tsc --noEmit` → **clean**.
- **API:** `npx jest --runInBand` → **63/63 pass** when run in isolation.
  - **Test-isolation note for Dev Lead:** running the API suite *while the dev API server is up* shows 6 spurious failures — both share `apps/api/dev.sqlite`, so the live server + this report's journey mutate state under the tests. The suite is green once the server is stopped (or pointed at a separate test DB). Recommend an isolated/in-memory DB for `jest` to remove this flakiness.
- I re-seeded `dev.sqlite` to clean state after the journey.

---

## Changes I made to the tree (for transparency)
- `apps/mobile/app.json`: added `ios.bundleIdentifier`/`android.package` (needed for any native build; harmless otherwise).
- Installed `expo-secure-store@~13.0.0` (was declared but missing from `node_modules` — a real gap).
- `apps/mobile/ios/`: generated by prebuild during the (failed) native build, with my Podfile patches. **This is a throwaway artifact** — the Dev Lead should regenerate it after the SDK/Xcode fix (SIM-HIGH-2); it does not compile as-is and should not be relied on / committed.

---

## Handoff
- **Done:** Booted the mock API on this machine and **verified the full owner-requested functional journey live** (OTP→5 free→6th 402 paywall→subscribe→active→cancel-with-date→resume→past_due→profile/email-pending→verify→invalid-email-reject→biometric/notif toggles) — real responses in §2. Exhaustively attempted the native iOS build (worked through 6 distinct toolchain failures) and the Expo-Web fallback; documented the exact terminal blockers. Captured 3 simulator screenshots proving Safari renders but the app does not. Confirmed D1/D2 fixed in code + tests; D4/D5/D6 fixed server-side. Mobile 18/18 + tsc clean; API 63/63 (isolated).
- **Confirmed-good (with proof):** the entire functional/money/auth/profile journey at the API-contract level (§2); freemium counting boundary + paywall trigger; subscription state machine incl. real cancel date + past_due; email pending→verify lifecycle; server-side email validation; resume-blocked-search and explainer-sheet logic (unit-tested). Screenshots: `team/qa/sim/01-…OK.png` (Safari works), `02`/`03-…blank.png` (app doesn't render).
- **Defects for fixing (priority):** **SIM-HIGH-1** (static web export renders blank — get a console trace + error boundary); **SIM-HIGH-2** (native iOS build blocked by RN 0.74 vs Xcode/iOS 26.2 — upgrade Expo SDK/RN, the prerequisite for the pixel pass); **SIM-MED-1** (dev-web monorepo bundle path 404); then D3, D4-rem, D6-ui, D7, D8, F-A3-rem. Plus the API test-isolation DB note (§7).
- **Owner:** bo-dev-lead (SIM-HIGH-1/2, SIM-MED-1, D3/D4/D6-D8 + test-DB isolation); bo-business-analyst (per-type notif set F-A3, restore-purchase UX); PO/owner (§5 device checklist).
- **Remaining device-only checklist (PO/owner, real device):** real biometric prompt + enclave token + biometric-set-change invalidation; real push permission + OS-denied "Open Settings"; SecureStore persistence across reinstall; native image picker/crop + HEIC + type/size reject; real Stripe Checkout/portal sheet + webhook-delay race; true RTL↔LTR layout flip on language switch.
- **Blockers/risks:** **No on-device pixel/visual pass is possible until SIM-HIGH-1 or SIM-HIGH-2 is fixed** — the app simply does not render in the sim today. The native-toolchain mismatch (RN 0.74 vs Xcode 26.2) is the deeper of the two and will recur on any contributor's machine with a current Xcode. Functional logic is sound; the gap is purely build/render.
