# Flows & Information Architecture — Electronics MVP (S1-1)

> Owner: bo-ux-lead · Status: dev-ready draft · 2026-06-25 · **Updated 2026-06-26 (category-first restructure + Western-numeral lock)**
> Scope: **Electronics + Food active.** Furniture/Cars shown as "Soon" tiles on the first screen (vision signal, not designed).

---

## CHANGE LOG — 2026-06-26 (owner requirement)
1. **Category-first flow.** The app's FIRST authed screen is now **Category select** (`/categories`). The user picks a sector; selecting one navigates to the **Search/Intent** screen for that category. Journey: **Category select → Search (intent) → Clarifier → Results.** The app no longer drops straight into search. **Electronics AND Food are both active**; **Furniture + Cars** appear as disabled "قريباً / Soon" tiles to signal the multi-category vision.
2. **Numerals = Western (0-9) everywhere — LOCKED.** Resolves open question S0-3. All digits (prices, quantities, counts, OTP, quota, ranks, timers, phone) are Western/Latin. Currency label stays bilingual ("KWD" / "د.ك"); only the digits are Western. See §4 row "Numerals" and `mockups/tokens.css` NUMERAL RULE block.
   - The old "Sector picker" (§2.2 B, route `/sectors`) is **superseded by the Category select screen** (`/categories`) as the entry point. `/sectors` is kept as an alias / mid-session sector switcher; new builds wire `/categories` as the post-login landing.

---
> Source: `Concept.txt`, `team/backlog.md` (locked decisions), `team/analysis/mvp-scope-and-stories.md` (stories A1–G3), `team/research/localization-arabic.md`.
> Stack: React Native / Expo. Arabic-first, RTL-default, bilingual AR/EN. Non-goals honored: **no payments / cart / checkout / inventory.**

---

## 0. Design principles (carried into every flow)
1. **One box, plain language.** The intent screen is the product's center of gravity; everything else is fast scaffolding around it. (C1)
2. **AI interrogates, then delivers.** 0–3 bounded clarifiers, never an interrogation; skippable. (C2)
3. **Arabic-first, RTL-native — not retrofitted.** AR is the primary design direction; EN mirrors. (F1, localization scan §A/§C)
4. **Neutrality is visible.** No sponsored slots, no ranking boosts, no "ad" labels. (D2.6)
5. **Never a dead end.** Every empty/error/loading state offers a forward action. (Cross-cutting §5)
6. **Hand-off, not checkout.** The terminal action is always "go to provider." (E1)

---

## 1. Information Architecture

### 1.1 App map (mobile)
```
BestOffers (mobile)
│
├── PUBLIC / UNAUTH
│   ├── Splash / launch (token check, biometric prompt if enrolled)        [A2, A3]
│   ├── Login — phone entry (+965 default)                                  [A1.1]
│   └── OTP verify (masked destination, resend timer)                       [A1.2–A1.5]
│
└── AUTHED (tab-less, stack-driven — see §2.1)
    ├── ▸▸ Category select  ← FIRST authed screen  (the new entry point) [B1]
    │     Electronics ▸ active · Food ▸ active · Furniture ▸ "قريباً/Soon" · Cars ▸ "قريباً/Soon"
    │     Tap an active tile → Search/Intent for that category.
    │
    ├── Search flow (per category = Electronics or Food)
    │   ├── Intent screen (single free-text box + recent intents)           [C1]
    │   ├── Clarifier conversation (0–3 Q, chips + free text)                [C2, C3]
    │   ├── Searching / loading                                             [D1.2]
    │   ├── Results (ranked cards) · empty-state · partial-error note        [D1, D2, D3]
    │   └── → Deep-link hand-off (leaves app)                                [E1]
    │
    └── Settings (overflow, low-frequency)
        ├── Language toggle AR ↔ EN                                         [F1.2]
        ├── Biometric enable/disable                                        [A2.4]
        └── Sign out                                                        [A3.2]
```

**Category as entry point:** the Category select screen is where every authed session begins (after splash/login). The Search/Intent screen carries a **back affordance (header chevron)** that returns to Category select **without losing the session** (B1.4). The active category is also echoed as the eyebrow on the Search screen ("ELECTRONICS · الإلكترونيات"). Two categories are now selectable (Electronics, Food); Furniture/Cars are visible-but-disabled to communicate roadmap.

### 1.2 Navigation model
- **Pattern:** **Stack navigation** (Expo Router), not bottom tabs. Rationale: the MVP is a single linear funnel (login → sector → intent → clarify → results → hand-off); tabs imply parallel destinations we don't have yet. Settings is reached via a header overflow icon, not a tab.
- **Back behavior:** OS/hardware back and the in-app header back are equivalent. Back from Results → Clarifier (preserves answers, C3.1). Back from Clarifier → Intent (preserves typed intent). **Back from Intent → Category select** (the new first screen). Back from Category select → exits to OS (it is the authed root; no further back).
- **RTL nav direction:** In RTL the header back chevron sits on the **right** and points **right (▸)**; forward motion animates right-to-left reversed (new screens enter from the left). Expo Router/React Navigation handles this when `I18nManager.isRTL` is true — **devs must launch with RTL forced for AR** (see §6).
- **Deep-link hand-off** is a *terminal exit*, not a navigation push: it opens an external app/URL. On return, the user lands back on the Results screen with state intact (E1.5).
- **New search** resets the clarifier context (C3.3) and returns to a clean Intent screen.

### 1.3 Route table (Expo Router)
| Route | Screen | Guard | Maps to |
|---|---|---|---|
| `/` | Splash → redirect | — | A2, A3 |
| `/login` | Phone entry | unauth only | A1 |
| `/login/otp` | OTP verify | unauth only | A1 |
| **`/categories`** | **Category select (FIRST authed screen / authed root)** | authed | **B1** |
| `/search` | Intent screen (**category** in params, e.g. `?cat=electronics`) | authed | C1 |
| `/search/clarify` | Clarifier conversation | authed | C2, C3 |
| `/search/results` | Ranked results | authed | D1, D2, D3 |
| `/settings` | Settings | authed | A2, A3, F1 |
| `/sectors` | (alias / mid-session category switcher — same UI as `/categories`) | authed | B1 |

> **Post-login landing changed:** splash/login now redirect to **`/categories`** (was `/search`/`/sectors`). `/categories` is the authed root. `/search` is only reachable by selecting an active category tile and always receives a `cat` param. `/sectors` retained as an alias for backward compat + future "switch category" entry; new flow uses `/categories`.
> Session guard: protected routes redirect to `/login` on expired session (A3.3). Persisted session skips login → lands on `/categories` (A3.1).

### 1.4 Admin web IA (high level only)
Separate **responsive web** app (not mobile), LTR-primary (admin tooling, internal), English UI acceptable for MVP. Three areas behind admin auth:

```
Admin Web
├── Providers & Sources         [G1]
│   └── List · Add/Edit · Enable/Disable · Health & last-sync status
├── Moderation                  [G2]
│   └── Offer/source suppression queue · suppress action · audit trail (who/when)
└── Analytics                   [G3]
    └── KPI dashboard (Activation, Search-to-result, Time-to-result, Clarifier
        efficiency, CTR, Retention) · date-range picker · refresh-cadence label
```
- **Nav model:** left sidebar (Providers / Moderation / Analytics) + top bar (admin identity, sign out).
- **Data boundary:** analytics is read from **anonymized event logs only** (no PII) (G3.2, cross-cutting §3). Suppression/disable changes take effect within the price-freshness window (G1.2, G2.2).
- Detailed admin wireframes are **out of S1-2 scope** (mobile-first); flagged for a later sprint.

---

## 2. Core end-to-end flow (Electronics)

### 2.1 Happy path (the demoable spine)
```
Splash
  │ (no session)                         │ (valid session)
  ▼                                       ▼
Login (phone +965) ──OTP──► OTP verify ──► [first-ever sign-in?]──► Biometric opt-in prompt
                                                                          │
                                                                          ▼
                                                          ▸▸ Category select  (/categories)
                                                             Electronics·Food active;
                                                             Furniture·Cars "Soon" (disabled)
                                                                          │ tap an active category
                                                                          ▼
                                                                   Intent screen  (/search?cat=…)
                                                                          │ type "iPhone 17 Pro Max", submit
                                                                          ▼
                                            ┌─── intent already specific? ──► (skip clarifiers) ───┐
                                            ▼                                                        │
                                   Clarifier Q1 (e.g. storage) ─chip/skip─►                          │
                                   Clarifier Q2 (color) ─chip/skip─►                                 │
                                   Clarifier Q3 (budget) ─chip/skip─►  (max 3, C2.1)                 │
                                            │                                                        │
                                            └────────────────────────► Searching… ◄─────────────────┘
                                                                          │
                                                                          ▼
                                                              Ranked results (≥3 cards)
                                                                          │ tap card
                                                                          ▼
                                                       Deep-link hand-off → provider app/site (EXIT)
                                                                          │ return to app
                                                                          ▼
                                                              Results (state intact)
```

### 2.2 Step-by-step with states

#### Step A — Login: phone + OTP  (A1)
- **Entry:** Splash finds no valid session.
- **Phone entry:** `+965` country code pre-filled and editable; numeric keypad; inline validation rejects bad formats *before* submit (A1.1). CTA "إرسال الرمز / Send code" disabled until a plausible number is entered.
- **Submit → OTP:** OTP dispatched; navigate to OTP verify showing **masked destination** ("…٦٧" / "…67") and a **resend countdown** (A1.2).
- **OTP verify:** 6-digit input (auto-advance, paste-aware, auto-submit on full). Correct + within TTL → route to sector picker (A1.3). Wrong → inline error + retry, up to lockout limit (A1.4). Resend disabled until timer hits 0; OTP expires after TTL (A1.5).
- **States:** loading (sending / verifying), error (invalid number, wrong OTP, lockout reached, expired OTP → "اطلب رمزاً جديداً / Request a new code"), success.
- **Biometric opt-in (A2):** shown **once, after the first successful sign-in only**, as an offer not a gate. Decline → continue. Accept + device-capable → enrolled for next launch (A2.2). Never blocks the flow.

#### Step B — Category select  (B1)  ← FIRST authed screen (`/categories`)
- **This is the app's entry point after login.** 2×2 grid of large, tappable category tiles, each = icon + AR title (h3) + EN label (uppercase eyebrow).
- **Active tiles: Electronics + Food** — surface card (`--bg-surface`), teal-soft icon chip, a forward chevron in the top-start corner. Tapping → Intent screen scoped to that category, passed as `?cat=electronics` / `?cat=food` (B1.2).
- **"Soon" tiles: Furniture + Cars** — recessed `--bg-surface-alt` fill, **dashed `--border-strong`** border, muted icon, **"قريباً · Soon" tag** in the top-start corner. `disabled` / `aria-disabled="true"`; not tappable (no navigation, no error). They exist purely to signal the multi-category vision.
- No quota pill on this screen (search metering starts at the Intent screen, not here). Avatar + settings overflow in the header.
- Small info note below the grid: "نضيف أقساماً جديدة قريباً…" — reinforces roadmap without a dead end.
- Tile states: **default · pressed** (scale 0.985, active only) · **disabled** (Soon). All labels + icons render AR-RTL and EN (B1.5); touch targets ≥150px tile height (well above 44pt min).
- Category is changeable later without losing session via the Search-screen header back → Category select (B1.4).
- **Visual:** see screen **0 · Category select** in `team/design/mockups/bestoffers-v2.html`.

#### Step C — Intent screen  (C1)
- **Single free-text box**, large, centered, placeholder in active language ("شنو تدوّر؟ / What are you looking for?"). One box, no filters.
- **Auto-direction:** input flips to **RTL for Arabic, LTR for English at the input level**, detected per-entry; mixed AR/EN (e.g. "آيفون 17 Pro Max") must not break layout (C1.2, F1.4).
- **Recent intents** (optional, this-session only) appear as tappable rows below the box to re-run quickly.
- **Submit:** empty/garbage input → friendly re-ask, **does not search** (C1.3). Valid → pass intent + sector context to AI (C1.4).

#### Step D — Clarifier conversation  (C2, C3)
- **Chat-style** screen: AI asks **0–3** short MSA questions (C2.1). For Electronics typical dimensions = **storage → color → budget**.
- Each question answerable by **tap-chips and/or free text** (C2.2). A **"تخطّي / Skip"** affordance per question; AI proceeds with best-effort assumptions and may note them on the result (C2.3).
- If intent is already specific, **skip straight to search** (C2.4).
- **Loop guard:** never re-ask the same dimension twice (C2.6).
- **Context retained** for the search session (C3.1); refinements like "أرخص / cheaper" or "بدون اللون الأسود" update results **without restarting** the flow (C3.2). Starting a new search clears context (C3.3).
- Chips + questions render bilingual with correct RTL (C2.5).

#### Step E — Searching  (D1)
- Visible **loading state** while querying data-feasible Electronics providers (D1.2). Honors "real-time but fast" target; surfaces progress, not a frozen spinner (see §3 loading copy).

#### Step F — Ranked results  (D2, D3)
- Vertical list of **ranked result cards** (top N, no horizontal scroll within a card) (D2.3). Each card: **image · one-line "why this offer" · price (KWD) · provider name · deep-link CTA** (D2.1, D3).
- Order = match-quality ranking, **deterministic** for same query+data (D2.2); **no sponsored boosting** (D2.6, neutrality).
- "Why this offer" references ≥1 attribute the user asked for and is truthful to data (D3.1–D3.3).
- Bilingual + RTL + KWD formatting; missing image/field degrades gracefully (placeholder, never broken card) (D2.4, D2.5).

#### Step G — Deep-link hand-off  (E1)
- Tap card → open provider **app if installed, else website**, to the matching product (E1.1). If exact item can't resolve → provider's nearest valid page, **not an error** (E1.2).
- No payment/checkout in our app (E1.3). Hand-off logged anonymized (provider, sector, query class) (E1.4). Return-to-app graceful, session intact (E1.5).

---

## 3. Empty / loading / error states (per screen)

| Screen | Loading | Empty | Error |
|---|---|---|---|
| **Login phone** | "جارٍ الإرسال… / Sending…" on CTA | — | Invalid number inline; network → retry toast |
| **OTP** | "جارٍ التحقق… / Verifying…" | — | Wrong OTP inline + attempts left; lockout banner; expired → request new code |
| **Category select** | Skeleton tiles | n/a (static set: 2 active + 2 Soon) | Config load fail → retry; Electronics + Food still shown by default (never a blank first screen) |
| **Intent** | — | Empty box → CTA disabled; garbage submit → friendly re-ask (C1.3) | Sector/config missing → fall back to Electronics + toast |
| **Clarifier** | Typing indicator (AI thinking) | — | AI/timeout → "تعذّر الفهم، جرّب صياغة أخرى / Couldn't understand, try rephrasing" + keep typed intent |
| **Searching** | Progress label "نبحث في المتاجر… / Searching providers…" (animated, not frozen) | — | Total search failure → error state with **"عدّل البحث / Edit search"** (never blank, D1.3) |
| **Results** | Skeleton cards while streaming in | **No matches** → friendly empty-state + **"وسّع البحث / عدّل / Broaden / Edit"** (D1.3) | Partial provider failure → render available cards + small note "بعض المصادر غير متاحة الآن / Some sources unavailable" (D1.4) |
| **Hand-off** | Brief "نفتح المتجر… / Opening provider…" | — | Deep link unresolved → open provider home (E1.2); link totally dead → toast + stay on Results |

**Cross-cutting:** logging never blocks/slows the flow (§3 BA constraint); no screen exposes payment/cart/checkout/inventory (§1 BA constraint); no dead ends (§4 BA constraint).

---

## 4. RTL & bilingual behavior (applies app-wide — F1)

| Concern | Rule |
|---|---|
| **Default direction** | **RTL is the default**; AR is the primary design. EN mirrors to LTR. (Localization §C.3) |
| **Layout mirroring** | Entire layout mirrors in RTL: back chevron + page motion (§1.2), list alignment, card internals (image/text swap sides), icons that imply direction flip. **Directionally-neutral icons (search, camera) do NOT flip.** |
| **Language toggle** | In Settings; switches AR↔EN **app-wide** and **persists across sessions** (F1.2). Toggling RTL↔LTR requires an RN `I18nManager` direction change (see §6). |
| **Input direction** | Per-field auto-detect: AR→RTL, EN→LTR, at the input level so the intent box and chat feel native (C1.2). |
| **Mixed content** | "iPhone 17 Pro Max" inside an Arabic string must render without breakage — use bidi-aware text rendering; never hard-force a single direction on the whole string (F1.4). |
| **Numerals / currency / dates** | **LOCKED (2026-06-26): numerals are ALWAYS Western / Latin 0-9 — everywhere** (prices, quantities, counts, OTP, quota, ranks, timers, phone, dates). Never Arabic-Indic ٠-٩. Resolves open question S0-3. Currency **label** stays bilingual ("KWD" / "د.ك"); only digits are Western, e.g. `412.000 د.ك`. RN: do not enable Arabic-Indic digit shaping; format with the `-nu-latn` numbering system even when locale is `ar`. Wrap numeric runs in `.num` (LTR-isolated). (F1.3) |
| **Output language** | AI **understands Kuwaiti/Gulf colloquial + code-switch**, **responds in MSA + English mirror** (localization §A). Clarifier copy authored in MSA. |
| **Copy availability** | Every user-facing string exists in AR + EN with correct RTL (cross-cutting §2). No hard-coded strings; all via i18n keys. |

---

## 5. Story → screen traceability

| Story | Where satisfied |
|---|---|
| A1 Mobile+OTP login | Login phone, OTP verify (§2.2 A) |
| A2 Biometric opt-in | Splash biometric prompt, opt-in after first sign-in, Settings toggle (§2.2 A, §1.1) |
| A3 Session & sign-out | Splash session check, route guards, Settings sign-out (§1.3) |
| B1 Pick a sector | Sector picker (§2.2 B) |
| C1 State intent | Intent screen (§2.2 C) |
| C2 Bounded clarifiers | Clarifier conversation (§2.2 D) |
| C3 Context retained | Clarifier persistence + refinement (§2.2 D) |
| D1 Search providers | Searching state + partial-error handling (§2.2 E, §3) |
| D2 Ranked cards | Results (§2.2 F) |
| D3 Why-this-offer | Result card reason line (§2.2 F) |
| E1 Deep-link hand-off | Hand-off (§2.2 G) |
| F1 RTL & bilingual | §4 (app-wide) |
| G1–G3 Admin web | §1.4 |

---

## 6. Dev notes / constraints
- **Force RTL for Arabic:** `I18nManager.forceRTL(true)` requires an app reload to take effect; plan the language toggle to trigger a controlled restart or use a direction-aware layout lib. Architect/Dev Lead to confirm restart UX.
- **Session guard** belongs in the router layout (Expo Router `_layout` redirect), not per-screen. **Post-login landing is `/categories`** (the authed root), not `/search`.
- **Category-first wiring:** `/categories` renders 4 tiles (Electronics, Food active; Furniture, Cars disabled "Soon"). Active tile → `router.push('/search?cat=<id>')`. Disabled tiles are non-interactive. Search-screen header back → `/categories`.
- **Western numerals:** keep app number formatting on Latin digits regardless of UI locale (`-nu-latn`); do not turn on Arabic-Indic digit shaping anywhere. Wrap numbers in `.num`.
- **Clarifier loop guard** (C2.6) and **0–3 cap** (C2.1) are enforced in the Claude integration layer (bo-tech-architect S1-4), surfaced by UX as "skip / proceed."
- **Determinism** of ranking (D2.2) is a backend contract; UX assumes stable order per query+data.
- **Anonymized hand-off logging** (E1.4) is fire-and-forget; must not delay the external open.

---

## Handoff
- **Done:** Electronics MVP IA (app map, stack-nav model, route table, RTL nav direction), end-to-end core flow with step states, full empty/loading/error matrix, app-wide RTL/bilingual rules, admin-web IA (high level), story→screen traceability.
- **Next:** S1-2 wireframes + design system (this sprint, same owner); bo-tech-architect to confirm RTL-restart UX, ranking determinism contract, clarifier-loop enforcement, deep-link resolution per provider.
- **Owner:** bo-ux-lead (design); bo-tech-architect (S1-3/S1-4 contracts); PO (ratify).
- **Blockers/risks:** ~~Numeral preference unresolved~~ **RESOLVED 2026-06-26 — Western 0-9 everywhere (locked).** RTL force-restart UX needs dev confirmation; deep-link reliability per provider unverified.
- **2026-06-26 update:** category-first restructure (new `/categories` entry, Electronics+Food active, Furniture+Cars "Soon") + Western-numeral lock applied across IA §1.1/§1.2/§1.3, flow §2, states §3, RTL §4, dev-notes §6. Mockup screen 0 added to `bestoffers-v2.html`. See top CHANGE LOG.
