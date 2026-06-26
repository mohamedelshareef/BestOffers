# QA Frontend Report — Phase-2b Owner Features (F-A1/A2/A3, F-C1, F-D1, F-D2)

> Owner: bo-qa-lead-frontend · 2026-06-26 · Status: first verification pass
> Oracle: `team/analysis/feature-acceptance-criteria.md` (AC) + `team/design/feature-screens.md` (specs)
> Target: `apps/mobile` (Expo / React Native, RTL-default, AR-first), mock-mode wired to `apps/api` (NestJS).
> Scope of this pass: code review + mobile test suite + served web bundle + live mock-API journey.
> **Honesty flags:** test infra is logic-only (no RN render tests); RTL/visual = code-review only; several flows are **device-only** (see §6). Pixel/screenshot visual pass is OWED — design tooling not reachable in this env.

---

## 0. Release recommendation

**CONDITIONAL PASS for a clickable demo. NOT release-ready.**
The end-to-end money journey is wired and works against the mock backend; the freemium gate counts and blocks correctly; auth plumbing (Bearer token) is correct. But several spec'd screen behaviors are stubbed or missing (explainer sheets, cropper, receipts, distinct OTP error states) and one HIGH-severity journey defect (post-subscribe resume) undercuts the core conversion promise. Fix D1–D2, then re-test on a device for the §6 items before any release.

---

## 1. Test execution — real output

`npm test` in `apps/mobile` (ts-jest, `testEnvironment: node`):

```
PASS src/api/accountsClient.spec.ts
  AccountsClient
    ✓ attaches Authorization: Bearer on guarded calls
    ✓ does NOT attach a token on the auth endpoints
    ✓ throws a typed ApiError carrying the status
    ✓ parses the userId out of the mock checkout URL
PASS src/api/searchClient.spec.ts
    ✓ posts the intent contract and parses ranked cards
    ✓ throws on a non-ok response
PASS src/components/initials.spec.ts
    ✓ takes first + last initial for multi-word names
    ✓ takes up to two letters for a single word
    ✓ falls back to ؟ when nothing is known
PASS src/api/paywall.spec.ts
    ✓ throws PaywallRequired with the gate body on 402
    ✓ attaches the Bearer token when a token is present
    ✓ omits the Bearer token for anonymous (no token) searches

Test Suites: 4 passed, 4 total
Tests:       12 passed, 12 total
```

- `npx tsc --noEmit` (mobile): **clean (exit 0).**
- Web bundle: `dist/` exports cleanly; wired copy present in bundle ("Mock mode: code is 000000", "Subscribe to continue", "Keep finding the best offers", "Best Offers Pro", "Billed in USD").

**Coverage gap (durable):** all 12 tests are pure-logic unit tests of API clients + the initials helper. There are **zero component-render / interaction tests** (no `@testing-library/react-native`, no `jest-expo`). No automated test exercises a screen, RTL mirroring, the OTP boxes, the paywall route, or the resume flow. This is a test-strategy gap, not a passing-bar — record it for the Dev Lead.

---

## 2. Journey integrity — verified live against the mock API

I booted `apps/api` in mock mode and drove the EXACT endpoints the screens call. Result of the full funnel (single session, one identity):

| Step | Observed | Verdict |
|---|---|---|
| Signed-out search | `/search/intent` 201, unmetered (no Bearer) | PASS — anonymous stays clickable |
| OTP request (WhatsApp) | `{sent:true, channel:"whatsapp", cooldownSeconds:30}` | PASS |
| OTP verify (dev `000000`) | issues `access`+`refresh`+`pseudoId`, `isNewUser:true` | PASS |
| Quota fresh | `{used:0, limit:5, premium:false}` | PASS |
| Searches 1–5 (driven to `results`) | quota increments 1→5; each `used:n` | PASS — counts at result moment, not on clarifier turns |
| Search #6 | **402 PAYWALL** at the answer (post-clarifier) step | PASS — gate fires before delivering the 6th result set |
| Checkout (mock) | `mock-checkout://confirm?user=…&customer=…` | PASS — client parses userId correctly |
| Webhook confirm | `{applied:true}`; status → `active/premium:true`; `currentPeriodEnd` set | PASS |
| Quota after subscribe | `{used:5, limit:5, premium:true}` | PASS — premium bypass; pill hidden |
| Post-sub search | `results` (unlimited) | PASS at the API level |
| Cancel webhook | status → `canceled, premium:false` | PASS (but see D4 — `currentPeriodEnd:null`) |
| Resume webhook | status → `active, premium:true` | PASS |

**Counting boundary (F-D2 AC-1) is correctly implemented:** quota only increments when `state=results` (a ranked set is produced). Clarifier Q&A turns within one search do NOT count. This is the right oracle behavior and it matches the AC. Good.

**HIGH defect surfaced by this journey — see D1.** The 6th search is blocked *after* its clarifier resolved, but the FE preserves only the original raw intent and re-runs `startIntent` on resume — which restarts the clarifier loop rather than delivering the blocked result set.

---

## 3. Pass/fail per screen vs spec + AC

### F-C1 — OTP (C1 request / C2 verify)
| Item | Verdict | Note |
|---|---|---|
| +965 prefix, phone validation, WhatsApp-first CTA, SMS-fallback link on failure | PASS | `login.tsx` valid regex `^\+965\d{7,8}$`; SMS link reveals on send failure |
| N5 6-box, auto-advance, paste-fills-all, auto-submit, error border, digits LTR | PASS | `OtpInput.tsx` correct; `writingDirection:'ltr'` per box; boxes mirror via forced-RTL |
| Resend 30s cooldown → enabled, SMS retry | PASS | countdown + "Try SMS" present |
| Distinct error states: expired / lockout / too-many-attempts vs incorrect | **FAIL (D8)** | every verify error renders generic "Incorrect code"; backend DOES distinguish (expiry/attempt-lock verified live), FE flattens it |
| First-sign-in → biometric opt-in (AC-10) | **FAIL** | `isNewUser` returned by API but verify screen routes straight to `/`; no biometric opt-in prompt |
| AR/EN copy | PASS | all strings keyed |

### F-A1 — Profile view (P1) / edit (P2) / re-verify (P2b)
| Item | Verdict | Note |
|---|---|---|
| View: avatar (initials fallback), name, email, phone (read-only), plan row | PARTIAL | renders; but phone hardcoded `"…٦٧"` and plan hardcoded "Free" (D7) — not read from data |
| Avatar initials fallback (N3) | PASS | `initials.ts` tested; `？` fallback when unknown |
| Edit: Save disabled until dirty+valid, name+email fields, email LTR | PASS | `dirty`+`emailValid` gating correct |
| Email validation message | PARTIAL (D6) | invalid email shows "Email ✗" (label+glyph), not a real message; name 1–60/charset (AC-2) not validated client-side |
| Email change → pending → re-verify, 24h expiry, resend cooldown | **FAIL (D5)** | mock auto-verifies immediately; pending→verified lifecycle + P2b discrete sheet not exercisable; banner logic present but never reaches a true pending state |
| Avatar type/size constraints (JPEG/PNG/WebP, 5MB), cropper (N4) | **FAIL (D3)** | no client validation; cropper not implemented; uploads a hardcoded sample PNG |
| Remove avatar action | **FAIL** | no remove-photo affordance; action sheet (Take/Choose/Remove) not implemented |

### F-A2 — Biometric toggle (S1)
| Item | Verdict | Note |
|---|---|---|
| Toggle only on capable device; disabled+caption on web | PASS | `biometricCapable = Platform.OS!=='web'`; disabled + "Not available" caption |
| First-time enable EXPLAINER sheet + OS prompt + Not-now | **FAIL (D2)** | strings exist (`biometricExplainTitle/Body`, enable/notNow) but NO sheet rendered; toggle persists directly with no OS prompt gating |
| Only-after-first-OTP-sign-in availability (AC-1) | **FAIL** | no gating tying availability to first sign-in |
| Real biometric secret / enclave (AC-7/8) | DEVICE-ONLY (§6) | code comments acknowledge device requirement |

### F-A3 — Notifications toggle (S1)
| Item | Verdict | Note |
|---|---|---|
| Toggle + OS-denied banner + Open Settings | PARTIAL | denied banner + "Open Settings" present (no-op on web, correct); permission set to 'denied' on web honestly |
| Pre-permission soft-ask EXPLAINER sheet (State A) | **FAIL (D2)** | strings exist (`notifExplainTitle/Body`) but no sheet; toggle requests directly |
| Per-type prefs (price-drop / account-security) | **FAIL** | only a single master `notifEnabled`; per-type list (AC-1) absent |

### F-D2 — Freemium gate (D1 pill / D2 paywall)
| Item | Verdict | Note |
|---|---|---|
| Counter pill 5..2 / 1-left warning / 0→Subscribe chip / premium hidden / fail-open | PASS | `QuotaPill.tsx` pure-function logic correct; verified states |
| Counting boundary (results, not clarifiers) | PASS | verified live (§2) |
| 6th → paywall, blocked intent preserved | PARTIAL→FAIL (D1) | paywall fires correctly; intent preserved but resume re-runs raw intent → restarts clarifiers, not the resolved search |
| AR/EN | PASS | keyed |

### F-D1 — Paywall (D2) / Subscription (M1)
| Item | Verdict | Note |
|---|---|---|
| Paywall: $1/mo plan block, bullets, Subscribe CTA, "Billed in USD", Later/dismiss | PASS | mock checkout→dev-confirm→resume wired |
| Post-subscribe: unlock, pill hidden, toast | PARTIAL | unlock works; "Subscribed!" toast string exists but not shown (silent route) |
| Restore purchase / sign-in row (spec D2 item 6) | **FAIL** | not implemented on paywall |
| M1 status states: free/active/canceled/past_due | PASS (mechanics) | all four render with correct pills + actions; verified via webhooks |
| M1 receipts / billing-history list | **FAIL (D4)** | not implemented |
| M1 cancel-confirm sheet | **FAIL (D4)** | strings exist, sheet not rendered (cancel fires immediately) |
| Canceled "Ends on {date}" | **FAIL (D4)** | API returns `currentPeriodEnd:null` on cancel → UI shows "Ends on —" |
| past_due "Update payment" | PARTIAL | button just mock.confirms to active (acceptable for mock; real = portal, device-only) |

---

## 4. RTL / bilingual

| Check | Verdict | Note |
|---|---|---|
| App boots forced-RTL (AR default) | PASS | `_layout.tsx` `I18nManager.forceRTL(true)` |
| AR/EN toggle flips copy + text alignment live | PASS | `locale.ts` singleton + `useLocale()` |
| True RTL↔LTR LAYOUT flip on toggle | KNOWN-LIMIT | only copy+alignment flip live; full layout flip needs reload (documented in code). Acceptable for AR-primary; EN users get correct copy but layout stays RTL-mirrored until reload. Flag for product. |
| OTP boxes fill right-to-left under RTL | PASS (by design) | `flexDirection:row` under forced-RTL mirrors; digits forced LTR per box |
| Logical props (start/end) used for mirroring | PASS | Avatar badge uses `start:0`; rows use flexDirection row |
| No hard-coded user-facing strings | MOSTLY PASS | all via i18n EXCEPT hardcoded `"…٦٧"` phone + literal plan "Free" (D7) and `version "0.1.0"` |
| Every new string has AR+EN | PASS | i18n table complete for rendered copy |
| States empty/loading/error/success present | PARTIAL | intent/profile/subscription have loading+error; several success TOASTS spec'd but not rendered (paywall, saved) |

**Note (honesty):** RTL correctness here is asserted from code review only — no rendered screenshot or RN render test confirms pixel mirroring. A device/emulator pass is required to confirm visual RTL.

---

## 5. Auth plumbing

| Check | Verdict | Evidence |
|---|---|---|
| Bearer attached to protected calls (/me, /me/quota, /billing, metered /search) | PASS | `accountsClient.send` + `searchClient.post` read `tokenProvider()` at request time; unit-tested + live-verified |
| No token on auth endpoints (/auth/otp/*) | PASS | tested (`does NOT attach a token on auth endpoints`) |
| Anonymous search unmetered, signed-in metered | PASS | live-verified (anon 201 unmetered; authed counts) |
| Session restore on boot via refresh token | PASS (logic) | `restore()` exchanges refresh→access; persisted via SecureStore(native)/localStorage(web) |
| Token storage security | WEB INSECURE / DEVICE-ONLY | web uses localStorage (acknowledged not secure); real Keychain/Keystore = device-only (§6) |
| 401/malformed-token handling | PASS | API rejects; client throws typed ApiError. (Live test confirmed 401 on bad token.) |

---

## 6. Device-only — could NOT verify headlessly (PO/owner must run on a real device)

These are genuinely impossible to confirm in this environment (no device, no native modules, no design-render tooling). They are not defects — they are untested surfaces:

1. **Real biometric prompt + secure-enclave token** (F-A2 AC-3/7/8) — Face ID / Touch ID / Android BiometricPrompt; enclave-gated refresh token; invalidation on biometric-set change.
2. **Real push-permission OS prompt + OS-denied deep-link to Settings** (F-A3 AC-2/4) — `Linking.openSettings()` is a no-op stub on web.
3. **SecureStore (Keychain/Keystore) persistence across reinstall** (F-C1/F-B1) — web uses localStorage.
4. **Native image picker + crop + HEIC handling + type/size enforcement** (F-A1 AC-7/9) — edit screen uploads a hardcoded PNG on web.
5. **Real Stripe Checkout / customer-portal sheet + webhook-delay race** (F-D1 AC-1/5/edge) — mock uses a self-confirm webhook driver.
6. **True RTL↔LTR layout flip after controlled reload** — only copy/alignment flip live here.
7. **Pixel/visual mockup pass** — design-render skill not reachable in this env (also flagged by UX lead). All RTL/visual verdicts above are code-review-level, not screenshot-confirmed.

---

## 7. Defect table

| ID | Sev | Screen | Defect | Repro | Expected (AC/spec) |
|---|---|---|---|---|---|
| D1 | HIGH | Intent / Paywall | Post-subscribe resume re-runs the raw INTENT, restarting clarifiers, not the blocked result set | Sign in, search 5×, 6th search answer clarifiers → 402 paywall → subscribe → app re-runs intent and asks the clarifier questions again | F-D2 AC-5: blocked intent runs immediately as first unlimited search, "no re-typing" — should deliver results |
| D2 | HIGH | Settings | Biometric + notification first-time EXPLAINER sheets not rendered; toggles flip directly with no OS-prompt gating UI / "Not now" path | Settings → toggle biometric or notifications; no sheet appears | F-A2 spec (first-time enable sheet), F-A3 State-A pre-permission soft-ask |
| D3 | MED | Profile edit | N4 cropper + action-sheet (Take/Choose/Remove) not implemented; no JPEG/PNG/WebP + 5MB validation; uploads hardcoded sample | Edit → tap avatar → sample PNG uploads, no picker/crop/remove | F-A1 AC-7/9/10, spec N4 |
| D4 | MED | Subscription M1 | No receipts/billing-history list; no cancel-confirm sheet; canceled shows "Ends on —" (currentPeriodEnd null); past_due "Update payment" mock-confirms | Manage → cancel fires immediately, no date, no receipts | F-D1 AC-7/10, spec M1 |
| D5 | MED | Profile / edit | Email re-verify auto-completes in mock; true pending→verified + 24h expiry + resend cooldown + P2b sheet not exercisable | Edit email → immediately "verified" | F-A1 AC-4/5/6, spec P2b |
| D6 | LOW | Profile edit | Invalid-email shows "Email ✗" not a real message; name 1–60/charset validation absent | Enter "abc" in email → "Email ✗" | F-A1 AC-2/3 |
| D7 | LOW | Profile / Settings | Phone "…٦٧" and plan "Free" hardcoded, not read from profile/billing | Subscribe → profile still shows "Free" | F-A1 AC-1, F-D1 AC-4 |
| D8 | LOW | OTP verify | No distinct expired / lockout / too-many-attempts states; all show generic "Incorrect code" | Enter wrong code 5× or wait for expiry | F-C1 AC-11 (explicit, distinct error states) |
| D-cov | INFO | — | Zero RN component/interaction tests; no RTL/render coverage | `npm test` is all logic units | test strategy gap |

---

## 8. Confirmed-good (no defects)

- Bearer-token auth plumbing (attach on guarded, omit on auth) — unit + live verified.
- Freemium **counting boundary** (results, not clarifiers) and the 5→gate→paywall trigger.
- Quota pill state machine (5..2 / 1-warning / 0-subscribe / premium-hidden / fail-open).
- OTP N5 input (6-box, paste, auto-advance, auto-submit, LTR digits, error border) + 30s resend cooldown + SMS retry.
- Subscription status mechanics for all four states (free/active/canceled/past_due) and cancel/resume/confirm webhooks.
- AR-first forced-RTL boot + complete bilingual string table for all rendered copy.
- Avatar initials fallback (never broken image), tested.
- 12/12 mobile tests pass; mobile typecheck clean; web bundle exports clean.

---

## Handoff
- **Done:** First FE verification pass for F-A1/A2/A3, F-C1, F-D1, F-D2. Ran mobile suite (12/12 pass) + mobile typecheck (clean) + web export check + a full live mock-API journey (sign-in → 5 free → 6th paywall → subscribe → unlimited → cancel/resume, all transitions correct). Pass/fail per screen/AC, RTL/bilingual + auth-plumbing review, 8 defects (2 HIGH) + 1 coverage gap, and the device-only checklist. Report at `team/qa/qa-frontend-report.md`; memory updated.
- **Confirmed-good (ship-safe for demo):** auth Bearer plumbing; freemium counting boundary + gate + pill states; OTP input + resend/SMS; subscription status mechanics; forced-RTL + bilingual copy; avatar fallback.
- **Defects for the Dev Lead (priority order):**
  - **D1 (HIGH)** — fix resume to deliver the blocked result set, not restart clarifiers (track the resolved search/session, not just raw intent). Confirm intended resume semantics with BA when the gate fires mid-clarifier.
  - **D2 (HIGH)** — render the F-A2/F-A3 first-time explainer sheets + OS-prompt gating (strings already exist).
  - **D3–D5 (MED)** — cropper+avatar action sheet+validation; M1 receipts + cancel-confirm + canceled-date; email pending→verified lifecycle.
  - **D6–D8 (LOW)** — real email/name validation messages; un-hardcode phone/plan; distinct OTP error states.
  - **D-cov** — add `jest-expo` + `@testing-library/react-native` and at least: paywall-resume, quota-pill states, OTP-input, RTL-mirror smoke.
- **Device-test checklist for PO/owner (the §6 items, must run on a real device before release):** real biometric prompt + enclave token + biometric-set-change invalidation; real push permission + OS-denied "Open Settings" deep link; SecureStore persistence across reinstall; native image picker/crop + HEIC + type/size reject; real Stripe Checkout/portal sheet + webhook-delay reconciliation; true RTL↔LTR layout flip on language switch; and the **pixel/visual mockup pass** (design-render tooling absent in this env — owed).
- **Owner:** bo-dev-lead (D1–D8 fixes + test infra); bo-business-analyst (resume semantics for D1, per-type notif set for F-A3); PO/owner (device checklist + visual pass); bo-qa-backend (peer — confirm webhook/quota authority, which I verified at the contract level FE-side).
- **Blockers/risks:** D1 undercuts the core conversion promise (user re-does work right after paying) — fix before any user test. No automated RTL/render coverage means visual regressions are invisible to CI. Several "success" toasts spec'd but silent. App-store IAP-vs-Stripe policy (BA Q#1) still unresolved upstream and will reshape D1/F-D1 payment UI.
