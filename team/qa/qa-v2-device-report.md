# QA — v2 Frontend / Device Report (iPhone 17 Pro sim)

> Owner: bo-qa-lead-frontend · 2026-06-26 · Build: v2 (mobile app v0.1.0)
> Device: iPhone 17 Pro simulator (UDID 8E782E23…2510), iOS 26.2.
> Render path: **Expo web build served on :8765**, opened in the simulator's Safari (`simctl openurl`).
> API: :3000 LIVE — claude=anthropic, **LIVE_FETCH=on**, **OTP_PROVIDER=twilio**, BILLING_PROVIDER=mock.
> Proof: real on-device screenshots in `team/qa/sim/` (00–07). AC oracles:
> `feature-acceptance-criteria.md`, `no-match-fallback-ac.md`, `flows-and-ia.md`, `tokens.css`.

---

## 0. Headline

- **The app RENDERS on-device now.** Prior memory's SIM-HIGH-1 ("web export renders BLANK in
  the sim") is **NO LONGER reproducing** on this build — every screen mounted and painted.
  Screenshots `00`–`07` are real captured pixels.
- **Category-first flow, OTP/login, paywall, settings, error states: PASS** (rendered + correct
  v2 look, RTL, Western numerals).
- **Electronics live search: PASS at the data layer** (real X-cite-class providers — Eureka, Best
  Al-Yousifi, Blink — real KWD prices, real deeplinks, truthful "why this").
- **TWO HIGH defects:** (D-V2-1) **Food category returns ZERO offers for every query** with a
  **bare dead-end empty** (no cards, no broaden suggestions) — Talabat live adapter yields nothing
  inside the API even though the endpoints are reachable + parseable via curl; (D-V2-2) the
  empty-empty state ships **no `broadenSuggestions`**, violating F-SR1 AC-14 ("never a dead
  no-results").
- **Device-only limit (honest):** OTP is wired to **live Twilio**, the dev code `000000` is
  rejected unless `OTP_PROVIDER=mock`, and no live SMS recipient is provisioned → **I could not
  obtain an authed session on-device.** So authed-only AC (quota "N of 5" pill, 6th-search paywall
  trigger, profile content, subscription active/cancel, biometric real prompt) were verified at
  the **API/code level**, not by a live signed-in device tap. Marked below.

---

## 1. Pass / Fail per screen + AC

| # | Screen / AC area | Result | Shot | Notes |
|---|---|---|---|---|
| 1 | **Category-first landing** (`/categories`) | **PASS** | `00-launch.png` | Lands on Category select. Electronics + Food = **active** tiles; Furniture + Cars = **"قريباً · Soon"** (dashed, muted, recessed). Sand canvas, teal, RTL, Rubik/IBM Plex AR, Western numerals (status bar 4:02). Sign-in chip + EN toggle + overflow present. ✔ flows-and-ia §1.1, B1. |
| 2 | **Category → Search hand-off** (`/search?cat=electronics`) | **PASS** | `01-search-electronics.png` | Category **eyebrow "الإلكترونيات"** (teal) + **back chevron** (top-start, RTL-correct ▸). Intent prompt "شنو تدوّر؟", single box, placeholder "مثال: آيفون 17 برو ماكس" (Western "17"), "ابحث" CTA disabled-until-input. ✔ category eyebrow + back chevron AC. |
| 3 | **Switching category resets funnel** | **PASS (code)** | — | `/search` always takes a fresh `cat` param; clarifier session keyed per intent (verified live: new intent = new `searchSessionId`). New-search clears context (search.tsx). |
| 4 | **Search journey — live (Electronics)** | **PASS (data)** | live API run | intent→clarifier(storage/color/budget MSA Qs + full-pill chips)→**ranked result cards**. Real providers **Eureka / Best Al-Yousifi / Blink**, real KWD (419.500 / 424.000 / 429.000 / 369.900 …), real deeplinks, source mix cache+**live**. "why this" truthful (cites 256GB/color). ✔ C1/C2/D2/D3. |
| 5 | **Best-price verdict ribbon on #1** | **PASS render / MED correctness** | search.tsx + VerdictRibbon | Ribbon "أفضل عرض / Best offer" + gold gradient + ✓ crowns card #1 only; gold reserved. **BUT** see D-V2-3: #1 is ranked by **match-quality, not cheapest**, so a lower-priced card can sit below it and the "saves vs average" math assumes #1 = cheapest. |
| 6 | **No-match fallback (relevant alternatives, tagged)** | **PARTIAL** | API runs | Contract is fully wired (`relation`/`fallbackServed`/`overBudgetDeltaFils`, closest/alternative/within_budget/related). Electronics exact-rich query correctly showed **no** alternative tags (AC-2 ✔). Could not exercise a real electronics fallback trigger on-device (needs a sparse-exact query); **food path can't be tested at all (D-V2-1).** |
| 7 | **No "dead no-results"** (F-SR1 AC-14) | **FAIL** | food API | Food empties return `state:empty, cards:[], no broadenSuggestions` — a bare 0-results dead end. **D-V2-2 HIGH.** |
| 8 | **Search — Food (Talabat) live** | **FAIL** | food API | **Every** food query (برجر, بيتزا, شاورما, مندي, كباب, دجاج, كباب, kfc…) → `empty`, 0 cards. Talabat HTML (200, 42 real slugs), restaurant page vendorId (5804), and menu JSON (`result.menu.menuSection[].itm[]`, 55KB) ALL fetch + parse via curl — but the API adapter yields nothing. **D-V2-1 HIGH.** |
| 9 | **Freemium quota pill "N of 5"** | **DEVICE-ONLY GAP** | settings shot | `QuotaPill` hides when quota=null (unauthed) — correct fail-open. Pill only renders for an authed free user; **unreachable under live Twilio** (no session). Verified in code: pill reads server `QuotaStatus`. |
| 10 | **6th search → paywall → subscribe → unlimited** | **DEVICE-ONLY GAP / paywall PASS** | `04-paywall.png` | Paywall screen renders perfectly (gold crest, "$1 / شهر", "استهلكت عمليات البحث المجانية الخمس", unlimited + price-drop benefits, "اشترك مقابل $1 شهرياً", USD note). The 5→6 **gate trigger** needs an authed session (re-verified server-side in prior pass; not re-driven live this session). |
| 11 | **Accounts — OTP login** | **PASS (render)** | `02-login.png`, `03-otp.png` | Login: "سجّل الدخول", +965 prefix, phone field, WhatsApp send CTA. OTP: "أدخل الرمز", 6 per-digit boxes, "تم", **SMS fallback** "جرّب SMS", resend timer "0:28", "تغيير الرقم". Western numerals, RTL. ✔ F-C1 UI. **(MED: login shows "وضع تجريبي: الرمز 000000" but live build is Twilio — see D-V2-4.)** |
| 12 | **Accounts — profile** | **PASS error-handling / content GAP** | `06-profile.png` | "الملف الشخصي" + "تعديل" + graceful error banner + "إعادة المحاولة" (unauthed → fetch fails as expected). Content (name/email/avatar/phone) needs a session — device-only gap. |
| 13 | **Settings + toggles** | **PASS** | `07-settings.png` | Account (Profile ›, Subscription→مجاني), Security (**Biometric toggle disabled "غير متوفر على هذا الجهاز"** — correct, no biometric on sim, F-A2 AC-2 ✔), Notifications (**single master toggle** — known F-A3-rem), Language→العربية, Sign out (red), "الإصدار 0.1.0". v2 + RTL. |
| 14 | **Subscription screen** | **PASS error-handling / content GAP** | `05-subscription.png` | "الاشتراك" renders graceful error banner (unauthed). Active/cancel/renew/receipts content needs a session — device-only gap (+ known D4-rem: no receipts list / cancel-confirm sheet). |
| 15 | **v2 visual** (sand/teal/gold, Rubik/IBM Plex AR) | **PASS** | all shots | Warm sand canvas, deep-teal brand, **gold reserved to price/verdict/paywall only**, soft warm shadows, full-pill chips/CTAs. Matches tokens.css. |
| 16 | **RTL mirroring** | **PASS** | all shots | App boots forced-RTL: back chevrons on the right (▸), text right-aligned, headers/rows mirrored, +965 & numbers LTR-isolated inside RTL. (True layout-flip on AR↔EN toggle still needs a reload — known.) |
| 17 | **Western (Latin) numerals everywhere** | **PASS** | all shots + code | Status bar, +965, OTP timer 0:28, version 0.1.0, prices 419.500, "$1", "5 free" all Western. `format.ts` enforces `-nu-latn` + `toLatinDigits` guard; cards use `NumText` (.num LTR-isolation). ✔ tokens.css NUMERAL RULE. |
| 18 | **Accessibility** | **PASS (basic)** | code | Buttons carry `accessibilityRole`/`accessibilityLabel`; verdict ribbon `accessibilityRole="summary"`; tap targets ≥44pt (tiles ≥150px). Full a11y audit (screen-reader, contrast sweep) not run in this env. |
| 19 | **Deep-link hand-off** | **PASS (code)** | ResultCard.tsx | Card tap → `Linking.openURL(card.deeplinkUrl)` (or `onHandoff`). Real deeplinks present on every card. Live external-open not exercised on-device. |

---

## 2. Defect list

| ID | Sev | Title | Repro | Expected vs Actual |
|---|---|---|---|---|
| **D-V2-1** | **HIGH** | Food (Talabat) returns ZERO offers for every query | API up (LIVE_FETCH=on). POST `/search/intent` sector=food any dish (برجر/بيتزا/شاورما/kfc) → skip clarifiers → `state:empty, cards:[]`. Independently: `GET talabat.com/kuwait/restaurants`→200/182KB/42 slugs; `…/kuwait/kfc`→`"vendorId":5804`; `…/nextMenuApi/v2/branches/5804/menu`→200/55KB/`result.menu`. | Expected: food queries return real Talabat dish cards (live prices). Actual: 0 cards every time → **entire Food category non-functional**, despite Talabat endpoints being reachable + correctly-shaped from this machine. Root cause is in the API adapter path (UA/Cloudflare from Node fetch, 4s timeout, or slug→menu parse mismatch) — for Dev Lead. |
| **D-V2-2** | **HIGH** | Empty state is a bare "0 results" dead end (no broaden suggestions) | Any food empty (above): response has **no `broadenSuggestions`**, `cards:[]`. | F-SR1 AC-14: an empty-empty must carry ≥1 actionable broadening control (remove color / raise budget / browse category) — **never a bare no-results**. Actual: bare empty, no controls, no degraded/provider-error flag to distinguish "no match" from "provider failed". Violates the core "never a dead end" principle. |
| **D-V2-3** | **MED** | Verdict ribbon assumes card #1 = cheapest, but ranker isn't cheapest-first | Live electronics "iPhone 17 Pro Max 256GB": #1 Eureka **419.500**, but #4 Blink **369.900** (cheaper) is below it. `search.tsx:144` comments "cards are ranked cheapest-first" and computes savings = `avg − cards[0].priceFils`; VerdictRibbon crowns #1 as "أفضل عرض/Best offer". | API ranker (`ranker.ts`) sorts by **match-quality score** (spec+stock+cheaper-as-tiebreak), NOT pure price — so #1 may be priced above a lower card. The "Best offer" crown + "saves X vs average" can sit on a non-cheapest card and misstate savings (clamped ≥0 so not negative, but misleading). Decide: rename to "Top match", or compute savings vs the true min price, or guarantee #1 is the cheapest exact. |
| **D-V2-4** | **MED** | Login advertises dev code "000000" while backend runs live Twilio | `/login` shows "وضع تجريبي: الرمز 000000". But `OTP_PROVIDER=twilio` → `verifyOtp` rejects `000000` (dev code accepted only when provider=mock). | A tester following the hint cannot log in; OTP request also 500s without a valid Twilio recipient. Gate the "dev code" hint on actual mock mode, or run the demo build with `OTP_PROVIDER=mock`. (Blocks on-device authed QA.) |
| **D-V2-5** | **LOW** | Quota pill / profile / subscription unverifiable on-device | Reaching `/profile`, `/subscription` unauthed shows graceful error banners (good); but no authed content could be shown because no session is obtainable (D-V2-4). | Not a UI bug — a **test-data/config gap**. The error+retry states themselves render correctly. |

**Carried-over known defects (still valid, from prior memory):** F-A3-rem (notifications single master toggle — seen in `07`), D7 (subscription plan hardcoded "مجاني/Free"), D4-rem (no receipts/cancel-confirm in subscription), D3 (avatar cropper/validation), D6-ui, D8.

---

## 3. Device-only limits (honest — could NOT verify on-device)

- **Authed session** (live Twilio, no SMS recipient) → no quota pill render, no 6th-search live
  gate, no profile/subscription content, no real biometric prompt. *(Re-verifiable by running the
  demo build with `OTP_PROVIDER=mock` + code 000000, OR provisioning a Twilio test number.)*
- **Real Stripe Checkout/portal** (build is BILLING_PROVIDER=mock) — paywall renders, but no real
  charge sheet.
- **Real push permission prompt + OS-denied deep-link** (F-A3).
- **True RTL layout-flip after locale toggle** (needs `I18nManager.forceRTL` + reload; toggle is
  tap-gated in this Safari render — couldn't drive it).
- **EN-locale copy + Western-numeral-in-EN** verified in code (`format.ts` `-nu-latn`), not via a
  live EN toggle tap (no tap tooling: `simctl` has no tap, `idb` unavailable in env).
- Native biometric/Keychain, native image picker/HEIC, real external deeplink open.

---

## 4. Release-readiness call

**NO-GO for a Food-inclusive release. CONDITIONAL-GO for an Electronics-only v2 demo.**

- **Electronics** v2 is demo-ready: category-first flow, live clarifier + real-price ranked cards,
  verdict ribbon, paywall, OTP/settings all render correctly on-device with the right v2 look, RTL,
  and Western numerals.
- **Blockers before shipping Food / claiming "never a dead end":**
  1. **D-V2-1 (HIGH)** — fix the Talabat adapter so Food returns real cards.
  2. **D-V2-2 (HIGH)** — empty/empty-empty must ship `broadenSuggestions` (+ a provider-error
     degraded state distinct from true no-match).
- **Should-fix before demo:** D-V2-3 (verdict "best offer" must not crown a non-cheapest card or
  misstate savings), D-V2-4 (dev-code hint vs live Twilio — also blocks on-device authed QA).
- **Owed re-test (not blockers):** full authed journey on-device once D-V2-4 is resolved (quota
  pill "N of 5", live 6th-search gate, profile/subscription content).

---

## 5. Screenshot index (`team/qa/sim/`)

| File | Screen |
|---|---|
| `00-launch.png` | Category select (Electronics/Food active, Furniture/Cars Soon) |
| `01-search-electronics.png` | Intent screen (electronics eyebrow + back chevron) |
| `02-login.png` | Phone/OTP login (+965, WhatsApp, dev-code hint) |
| `03-otp.png` | OTP verify (6 boxes, SMS fallback, resend timer) |
| `04-paywall.png` | Freemium paywall ($1/month, benefits) |
| `05-subscription.png` | Subscription (graceful error, unauthed) |
| `06-profile.png` | Profile (graceful error + retry, unauthed) |
| `07-settings.png` | Settings (account/security/notifications/language/signout) |

> Stale `*blank*` / `render-*` / `v2-*` shots in the folder are from prior sessions; this session's
> proof is `00`–`07` + `01-search-electronics`.
