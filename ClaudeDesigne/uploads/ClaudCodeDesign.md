# BestOffers — Design Revamp Brief (for Claude Design)

> Purpose: a single, self-contained brief to **revamp the BestOffers app design**.
> Audience: "Claude Design" (the design agent that will produce the revamped UI).
> Authoring split: **Marketing** owns the strategy half (§1–§6 + §11 opener); **bo-ux-lead** completes the UX/design-system/screen half (§7–§10, §12, §11 additions).
> Sources of truth: `team/brand/brand-guidelines.md` (v2), `team/research/market-competitor-scan.md`, `team/analysis/mvp-scope-and-stories.md`, `team/design/mockups/tokens.css`, `team/design/mockups/bestoffers-v2.html`, `team/design/flows-and-ia.md`.
> Claim legend: **VERIFIED** = sourced from research/brand/data · **ASSUMED** = strategic hypothesis to validate.

---

## 1. Product overview & vision  [MARKETING]

**What BestOffers is.** BestOffers is Kuwait's first **Arabic-first, AI-conversational shopping/offers concierge**. The user states an intent in plain language — Kuwaiti/Gulf Arabic, MSA, English, or code-switched ("أبي لابتوب gaming وميزانيتي محدودة") — and the app does the rest:

1. **Understands intent** in dialect or English, RTL-first. **VERIFIED** (mvp-scope C1; brand-guidelines §2.3)
2. **Asks bounded clarifying questions** before searching — sharp, sector-aware, answerable by tap-chips or free text. The product target is **≥5 clarifiers** in the revamp's conversational depth (richer than the MVP's 0–3 baseline) to nail precision before spending a search. **ASSUMED** (revamp goal; MVP AC currently states 0–3 — confirm target with PO/BA)
3. **Searches local providers + Instagram** for live offers across the chosen sector (Electronics, Food). **VERIFIED** (mvp-scope D1; research scan)
4. **Returns ranked offer cards** — image, price (KWD), provider, one-line "why this offer," deep-link CTA. **VERIFIED** (mvp-scope D2/D3)
5. **Hands off via deep-link** to the provider's app/site. **VERIFIED** (mvp-scope E1)

**What it is NOT.** Not a store. **No cart, no checkout, no payments, no inventory.** BestOffers is a **discovery and decision layer**, not a marketplace. Neutrality is the product, not a disclaimer. **VERIFIED** (mvp-scope §2 non-goals; brand §1.4)

**Vision.** Become the default first stop in Kuwait when someone thinks "where's the best deal for X?" — the neutral, intelligent layer that sits above every retailer and delivery app and answers honestly, in the user's own language, in seconds.

**One-line pitch.** *"Ask in your dialect — get the best offer in Kuwait, ranked honestly, in seconds."*  — `اسأل بلهجتك، نجيبك بأفضل سعر`

---

## 2. Target users / personas  [MARKETING]

Three personas, all **bilingual Kuwait shoppers**, drawn from `team/analysis/mvp-scope-and-stories.md` §1. **VERIFIED** (BA personas).

### P1 — Reem · the deal-driven deliberate buyer (primary)
- 29, Kuwaiti, works in a bank. Kuwaiti Arabic first, comfortable in English.
- **Job-to-be-done:** "Find the genuinely best price/spec match for a high-ticket item fast, then buy on the provider's app." She researches before buying.
- **Today's reality:** opens 4–5 retailer apps (Xcite, Eureka, Best Al-Yousifi), re-types the same filters in each, and still isn't sure a "deal" is really a deal. Arabic UIs that break RTL frustrate her.
- **What "finding the best deal" feels like for Reem:** relief from comparison fatigue + the confidence of a verdict she can trust. The design must make her feel *"someone did the comparing for me, and showed their work."*

### P2 — Abdullah · the convenience-first casual user (primary)
- 35, expat resident, English-leaning but reads Arabic, low patience.
- **Job-to-be-done:** "Get a quick, confident pick without thinking hard." Types short, vague intents ("good phone under 150 KWD"). Won't tune filters.
- **Today's reality:** generic search results; too many questions before any value.
- **What it feels like for Abdullah:** speed and certainty. He wants the app to ask only the few questions that matter, then hand him a winner. The design must reward minimal input with maximal confidence.

### P3 — Noura · the household food orderer (Food vertical)
- 41, Kuwaiti, orders family meals several times a week. Arabic-first; **RTL is non-negotiable**.
- **Job-to-be-done:** "Compare comparable dishes/prices across delivery providers, then hand off to the provider app." She thinks in dishes and quantities ("family grilled platter for 4"), not restaurant brands.
- **Today's reality:** every delivery app is a silo; no neutral cross-provider dish/price comparison exists. **VERIFIED** (research scan §B)
- **What it feels like for Noura:** finally seeing the same dish priced side-by-side. The design must make cross-provider comparison feel effortless and trustworthy in fluent Arabic.

**Cross-persona truth — what "finding the best deal" feels like in Kuwait:** today it feels like *work* (open many apps, re-type, second-guess). The emotional white space BestOffers owns is turning that work into a **calm, confident verdict** delivered in the user's own dialect. **ASSUMED** (emotional positioning hypothesis grounded in BA pains).

---

## 3. Positioning & brand promise  [MARKETING]

### The white space (VERIFIED — research scan TL;DR + opportunity statement)
**No Kuwait player combines (a) conversational intent capture, (b) cross-provider neutrality, and (c) Arabic-first UX.** Today shoppers either:
- open 3–5 retailer apps and compare manually, or
- use **PriceScout** — the closest analog, but catalog/filter-based, mobile-phone-narrow, English-leaning, and **not** conversational or Arabic-first, or
- browse flyer/coupon feeds (ClicFlyer, coupon/cashback apps) that solve a *different* job (codes, not "find me the best deal for X").

Food is a marketplace oligopoly (Talabat, Deliveroo, Jahez, Carriage) with **no neutral cross-platform price/offer comparison for consumers** — a genuine white space gated by a data plan. **VERIFIED** (research §B). Market is large and growing: Kuwait online food delivery ~**USD 880M (2024) → ~USD 1,434M (2032), 6.3% CAGR**. **VERIFIED** (gmiresearch, in scan).

### Positioning statement (VERIFIED — brand §1.2)
> **"The one place in Kuwait that finds the best deal for you — not for a retailer."**

### Brand promise — the three-part deal (VERIFIED — brand §1.4)
1. **Best deal** — honest, ranked, cross-provider results with a "why this offer" reason grounded in what you asked.
2. **Smart AI** — understands Kuwaiti/Gulf dialect and intent; clarifies *before* searching, not after.
3. **Trusted / neutral** — no carts, no ads, no checkout. We are the unbiased layer, not a store.

### Differentiation (VERIFIED — brand §1.5)
| vs. PriceScout | vs. ClicFlyer / coupon apps | vs. retailer apps |
|---|---|---|
| Conversational, not catalog | SKU-level live prices, not flyer images | Cross-retailer, not siloed |
| Arabic-first / RTL | Intent-first, not browse-first | Neutral ranking, not self-serving |
| Multi-category roadmap | No code/cashback friction | "Why this offer" reasoning |

### Competitor *looks* to AVOID (design anti-references)  [MARKETING]
The revamp must NOT resemble these category clichés:
- **Retailer-app look** (Xcite/Eureka/Best): dense grids, banner-stacked homepages, red "SALE" urgency badges, endless category nav. We are calm and intent-led, not a storefront.
- **Coupon/flyer-feed look** (ClicFlyer, coupon apps): cluttered discount tiles, percentage-off shouting, loud reds/oranges, ad-dense. We are neutral and quiet; gold is a *quality* signal, never a "promo" shout.
- **Generic-AI-chat look** (templated ChatGPT-clone bubbles, purple gradients, robot avatars, "Powered by AI" badges): looks like everyone's weekend project. We are a premium, branded, trustworthy concierge — the conversation is the means, not the gimmick.
- **MSA-translated-at-you look:** stiff, foreign-feeling Arabic bolted onto an English layout with broken RTL. We are Arabic-first by construction.

---

## 4. Brand identity  [MARKETING — pulled verbatim from brand-guidelines v2]

> Single source of truth: `team/design/mockups/tokens.css`. Values below mirror it. **VERIFIED** (brand §3, §5).

### 4.1 Color palette (hex)
**Brand (teal):**
- `--brand-primary` **#0B6B5B** — primary CTAs, active states, links, logo "Best," active chip (AAA on white & sand)
- `--brand-primary-strong` **#075345** — pressed/active, gradient deep stop
- `--brand-primary-soft` **#E3F2EE** — tinted surfaces, selected chips (bg only)
- `--brand-gradient` **#0E8C74 → #075345** (135°) — hero CTAs, active sector indicator, logo/icon only

**Value accent (deal-gold — strictly reserved):**
- `--accent-gold` **#C8881C** — **price highlight, "best offer" verdict ribbon, spark-mark core, logo underline only**
- `--accent-gold-strong` **#A86E0E** — hover/pressed on gold surfaces
- `--accent-gold-soft` **#FBF0D9** — verdict ribbon fill, quota-warn bg
- `--accent-gradient` **#E0A93B → #C8881C** (135°) — verdict ribbon, gold CTA variant
- **Gold neutrality rule (critical):** gold is a **match-quality / price-quality signal**, NOT a promotional color. Never use it for paid placement, general highlights, nav, or headlines.

**Canvas & surfaces:**
- `--bg-canvas` **#FBF8F3** — screen background (warm Gulf sand; **this is the background, not white** — it is a brand signal)
- `--bg-surface` **#FFFFFF** — cards, inputs, elevated sheets
- `--bg-surface-alt` **#F1ECE3** — skeletons, dividers, recessed wells
- `--bg-elevated` **#FFFFFF** — bottom sheets, paywall surface

**Text:**
- `--text-primary` **#18211F** (AAA on sand) · `--text-secondary` **#5C6864** (AA) · `--text-on-brand` **#FFFFFF** · `--text-on-gold` **#2A1D03** (use this on gold — never white-on-gold at small sizes)

**Borders & state:**
- `--border-default` **#E6DFD4** · `--border-strong` **#D6CDBE**
- `--state-success` **#1E9E6A** · `--state-error` **#C8442F** · `--state-warning` **#B5780A** (always pair state with an icon/label) · `--overlay-scrim` **rgba(20,28,26,0.55)**

**Radius tokens:** `--r-card` 16px · `--r-chip` 999px (full pill) · `--r-button` 14px · `--r-input` 14px · `--r-sheet` 24px

### 4.2 Typography (fonts)
- **Display / Latin headings + prices:** **Rubik** (`--font-display`: `'Rubik','IBM Plex Sans Arabic',system-ui,sans-serif`). Geometric, premium; replaces Inter (Inter is **retired** in v2).
- **Arabic body + UI:** **IBM Plex Sans Arabic** (`--font-body`: `'IBM Plex Sans Arabic','Rubik',system-ui,sans-serif`). Strong RTL shaping, clean diacritics.
- Load both (Google Fonts; Expo `expo-font` equivalents). **Type rules:** never letter-space Arabic; Arabic gets **+2px line-height** over its Latin token; prices are Rubik weight 800, Western digits, wrapped `direction:ltr; unicode-bidi:isolate`, formatted `12.500 KWD`; min body size 16px; eyebrow labels Latin-only.

### 4.3 Logo / spark-mark direction
- **Spark mark:** a four-pointed cross/star from two perpendicular rounded rectangles meeting at a **deal-gold circle core**. Meaning: cross = "best/star"; gold core = the offer/deal moment; teal→gold gradient = trust flowing into value.
- **Wordmark:** "Best" in teal #0B6B5B (700, Rubik) with a gold underline accent; "Offers" in #18211F (700, Rubik); Arabic "أفضل العروض" below in #5C6864 (600, IBM Plex Sans Arabic), RTL-aligned, with a thin #E6DFD4 separator. Arabic is first-class, never a footnote.
- **App icon:** deep-teal gradient bg (#0E8C74 → #075345), oversized white-to-gold spark mark (~85% of canvas), gold radial glow core, **no text**.
- Files: `team/brand/logo-wordmark.svg`, `team/brand/app-icon.svg`.

### 4.4 Imagery rules
- **Photography:** real Kuwait contexts, warm natural light; reflect Gulf diversity incl. women in everyday contexts; **never show a checkout or cart**; phones must show **real app screens, never dummy mockups**.
- **Illustration:** flat, geometric, teal/gold/sand only; spark mark as an enlarged graphic device; **no 3D renders** (gradient is logo/icon only); approved texture = repeated small spark marks at 8% opacity on teal.
- **Data/results UI:** provider-sourced images degrade to a neutral greyscale silhouette on #F1ECE3 — never a broken image; **no mock prices, fake reviews, or fabricated rankings** anywhere.
- **Iconography:** Lucide, outlined 2px stroke, rounded caps, 24×24 grid; directional icons mirror in RTL; active = teal stroke (no filled icons in active state); gold fill reserved for price badge + verdict ribbon only.

---

## 5. Tone & voice  [MARKETING]

> VERIFIED (brand §2). Arabic-first + English, Gulf-friendly, trustworthy/neutral, helpful-not-chatty.

### Core voice rules
1. **Lead with the answer** — never bury the deal behind preamble.
2. **Short sentences, active voice** — "نبحث في المتاجر" not the passive long form.
3. **Honest confidence** — say what we found and why, plainly.
4. **No hype words** — never "amazing / incredible / revolutionary / مذهل." Let the deal speak.
5. **Never apologize for neutrality** — "لا نبيع شيئاً — نحن نجد الأفضل لك" is a strength.
6. **Bilingual parity** — every string exists in AR and EN at equal quality. Arabic is not an afterthought.

### Dialect rules
- **Input:** understand & accept Kuwaiti/Gulf colloquial + AR-EN code-switching (شنو, أبي, زين, وايد, بكم, أرخص). Never reject "wrong Arabic."
- **Output:** reply in clear **MSA** — universally understood, professional, not foreign.

### Example phrases (bilingual pairs)
- Placeholder: `شنو تدوّر؟` / "What are you looking for?"
- Clarifier: `كم ميزانيتك التقريبية بالدينار الكويتي؟` / "What's your approximate budget in KWD?"
- Status: `نبحث في المتاجر…` / "Searching providers…"
- Verdict: `أفضل سعر متاح الآن` / "Best available price right now"
- Trust marker: `لا إعلانات · لا عمولات مخفية · فقط أفضل سعر` / "No ads · No hidden commissions · Just the best price"
- Neutrality: `نحن لا نبيع — نحن نجد` / "We don't sell — we find"
- Empty state: `لا نتائج — وسّع بحثك أو عدّل الطلب` / "No results — broaden or refine your search"
- Onboarding: `أفضل عروض الكويت — في ثوانٍ` / "Kuwait's best offers — in seconds"

**App Store copy:** AR headline `أفضل العروض في الكويت` · EN headline "Kuwait's Best Deals, Found by AI" · AR subtitle `ابحث بلهجتك — نرتّب لك أفضل الأسعار` · EN subtitle "Ask in Arabic or English. Get ranked, honest offers."

---

## 6. Design goals for the revamp  [MARKETING]

**What "better" means here** — the revamp must move the app from *functional* to *premium and distinctive*. Concretely:

### 6.1 Emotional targets (what the user should feel)
| Moment | Target feeling | Persona served |
|---|---|---|
| First open / onboarding | "This is for me — it speaks my language." | All (Arabic-first) |
| Stating intent | "Easy — I just say what I want." | Abdullah |
| Clarifier questions | "Smart questions, not an interrogation." | Reem, Abdullah |
| Results revealed | "Someone did the comparing for me." | Reem |
| The "best-price verdict" | "I can trust this — I see why it won." | All |
| Deep-link hand-off | "Confident hand-off, no second-guessing." | All |

### 6.2 The six design pillars
1. **Premium** — calm, spacious, sand-canvas warmth; nothing cheap, cluttered, or shouty. Generous whitespace, considered typography (Rubik + IBM Plex Sans Arabic), 16px card radius.
2. **Trustworthy / neutral** — visibly unbiased: no ad slots, no sponsored badges, no fake urgency/countdowns. Surface neutrality markers ("no ads · no hidden commissions"). Trust is *quiet*.
3. **"Best-deal" feel** — the product's whole reason for being. Gold (#C8881C) is the scarce, meaningful signal of price/match quality — never a generic highlight.
4. **Distinctive (NOT templated / generic-AI)** — must not read as a ChatGPT-clone or a generic deal app. The conversation is branded, the spark mark and teal/gold/sand system make it unmistakably BestOffers. Avoid purple AI gradients, robot avatars, "Powered by AI" badges.
5. **Arabic-first by construction** — RTL is the default design direction, not a mirror afterthought. Layout, icons, numerals, and flow are designed RTL-first.
6. **Honest & legible** — WCAG AA minimum on every pair; never meaning-by-color-alone; real data only (no mock prices/reviews/rankings in the design).

### 6.3 The signature moment — the "best-price verdict"  (the thing to nail)
The revamp's hero, ownable moment is the **best-price verdict**: when results resolve, the top offer earns a **deal-gold verdict ribbon** with a one-line, intent-grounded reason ("Cheapest 256GB in black" / `أرخص 256 جيجابايت باللون الأسود`). This is the emotional payoff of the entire flow — the instant the user feels *"the comparing is done, and here's the winner, and here's why."* Design it to feel earned, premium, and trustworthy — the screenshot people share. Gold appears here and on the price; nowhere else does it carry this weight.

### 6.4 Explicit non-goals for the design
- No checkout/cart/payment UI, ever (we are not a store).
- No sponsored/promoted-result styling (neutrality is the product).
- No fake countdowns, urgency banners, or red "SALE" shouting.
- No generic-AI visual tropes (purple gradients, robot mascots, chat-app sameness).
- No white default background — sand canvas `#FBF8F3` is the brand surface.

---

## 7. Information architecture & key flows  [UX]

> Source: `team/design/flows-and-ia.md`. **PO RULING applied:** the conversational flow now asks **AT LEAST 5 clarifying questions per sector before searching** (config-driven per-sector sets; chips + skip; "N of 5" progress; AR-first/RTL; Western numerals). The old "0–3 clarifiers" is **superseded** everywhere below. **VERIFIED** (flows-and-ia.md + clarifier-question-sets.md, PO-ratified ≥5 directive).

### 7.1 The real end-to-end flow (the demoable spine)
```
Splash (token + biometric check)
   │ no session                              │ valid session
   ▼                                          ▼
Login — phone (+965)  ──►  OTP verify (WhatsApp; SMS fallback)
   │ first sign-in only → Biometric opt-in (offer, never a gate)
   ▼
▸▸ CATEGORY SELECT  (/categories — FIRST authed screen, authed root)
   Electronics · Food · Real-estate = ACTIVE  ·  Furniture · Cars = "قريباً / Soon" (disabled)
   │ tap an active tile  →  /search?cat=<id>
   ▼
SEARCH / INTENT  (one free-text box, scoped to the chosen category)
   │ submit a valid intent
   ▼
CLARIFIER  (≥5 questions, chips + free text + skip, "N of 5" progress)
   │ all ≥5 dimensions presented (answered OR skipped) → search may fire
   ▼
SEARCHING…  (live, animated, never a frozen spinner)
   ▼
RANKED RESULTS  (best-price VERDICT ribbon on #1 · ranked cards · IG offer cards inline)
   │ tap a card
   ▼
DEEP-LINK HAND-OFF → provider app/site OR Instagram permalink  (terminal EXIT)
   │ return to app
   ▼
RESULTS (state intact)
```
**Gate (≥5):** a provider search MUST NOT dispatch until ≥5 distinct dimensions have been *presented* (clarifier-question-sets RULE-1). A skip widens an axis but still counts toward the 5 — it never short-circuits to search. The whole ≥5 Q&A + 1 search = **one counted search** (F-D2 AC-1; clarifier turns don't burn quota).

### 7.2 Navigation model
- **Pattern:** Expo Router **stack** (not bottom tabs). The product is a single linear funnel; tabs would imply parallel destinations we don't have. Settings/Profile reached via a header overflow icon. **VERIFIED.**
- **Authed root = `/categories`.** Splash/login redirect here (not into search). A persisted session lands here directly.
- **Back behavior (logical, RTL-aware):**
  - Results → Clarifier (answers preserved) → Intent (typed intent preserved) → **Category select** → exit to OS.
  - Hand-off is a *terminal exit*, not a push: returning lands the user back on Results with state intact.
  - "New search" resets clarifier context and returns to a clean Intent screen.
- **RTL nav direction:** in RTL the header back chevron sits at the **start (right)** and points right (▸); new screens enter from the start side. Handled by React Navigation when `I18nManager.isRTL`.

### 7.3 Route table (Expo Router)
| Route | Screen | Guard | Notes |
|---|---|---|---|
| `/` | Splash → redirect | — | token + biometric check |
| `/login` | Phone entry (+965) | unauth | F-C1 |
| `/login/otp` | OTP verify (WhatsApp · SMS fallback) | unauth | F-C1 |
| **`/categories`** | **Category select — FIRST authed screen** | authed | Electronics/Food/Real-estate active; Furniture/Cars "Soon" |
| `/search` | Intent (carries `?cat=<id>`) | authed | one box, per category |
| `/search/clarify` | Clarifier (≥5 Q, "N of 5") | authed | config-driven per-sector set |
| `/search/results` | Ranked results (+ verdict + IG cards) | authed | deterministic order, no sponsored boost |
| `/paywall` | Paywall (modal-route over /search) | authed | 6th search for free users (F-D2) |
| `/profile` · `/profile/edit` | Profile / edit | authed | name/email/avatar (F-A1) |
| `/settings` | Settings (Account/Security/Notifications/General) | authed | language, biometric, sign-out |
| `/subscription` | Manage subscription | authed | plan/renew/cancel (F-D1) |
| `/sectors` | alias / mid-session category switcher | authed | same UI as `/categories` |

> Session guard lives in the router `_layout` (redirect to `/login` on expired session); it is not per-screen.

### 7.4 Admin web (out of mobile scope — high level)
Separate **responsive web** app, LTR/EN acceptable. Three areas behind admin auth: **Providers & Sources** (list/add/enable/health) · **Moderation** (suppression queue + audit trail) · **Analytics** (KPI dashboard, anonymized events only, no PII). Detailed admin wireframes are deferred — Claude Design's revamp targets the **mobile app**.

---

## 8. Screen-by-screen design brief  [UX]

> Each hero screen below: **purpose · key content · states (empty/loading/error/closest-match) · what to revamp.** The v2 mockup (`team/design/mockups/bestoffers-v2.html`, 6 rendered screens) is the visual reference Claude Design **revamps**, not replaces. Every screen is **AR-first/RTL**, Western numerals, ≥44pt touch targets, AA contrast. The signature moment is the **best-price verdict ribbon** (§8.4). **VERIFIED** against the rendered mockup + live code (`apps/mobile/src/components/ResultCard.tsx`, `apps/api/src/search/search.service.ts`).

### 8.1 Category select — `/categories` (the first authed screen)
- **Purpose:** the calm entry point; pick the sector before stating intent. Signals the multi-category vision without a storefront feel.
- **Key content:** eyebrow `BESTOFFERS · أفضل العروض`; warm greeting (`شنو تبي تلقّى اليوم؟`); neutrality line ("بلا إعلانات مدفوعة"); **2×N grid** of tiles — **Electronics · Food · Real-estate = active** (surface card, teal-soft icon chip, start-corner forward chevron); **Furniture · Cars = "قريباً · Soon"** (recessed `--bg-surface-alt`, dashed `--border-strong`, muted icon, Soon tag, `aria-disabled`). Header = avatar (start) + settings overflow (end). Roadmap note card below the grid. **No quota pill here** (metering starts at Intent).
- **States:** *loading* = skeleton tiles · *empty* = n/a (static set; never blank — Electronics/Food/Real-estate always shown) · *error* = config-load fail → retry, default set still rendered.
- **Revamp:** the v2 mockup shows 4 tiles (Electronics/Food active). **Real-estate must now be promoted to an ACTIVE tile** (3 active + 2 Soon). Make the active-tile pressed state and the gold-free calm palette feel premium; the Soon tiles must read as "vision," not "broken."

### 8.2 Search / Intent — `/search?cat=<id>`
- **Purpose:** the one-box center of gravity — say what you want in plain dialect.
- **Key content:** back-to-categories chevron (start) + **searches-remaining quota pill** ("3 عمليات بحث مجانية") + settings (end); category eyebrow (`ELECTRONICS · الإلكترونيات`); hero greeting; **single large search box** (auto-direction per entry: AR→RTL, EN→LTR; mixed "آيفون 17 Pro Max" must not break) + mic affordance; trust hint line; primary gradient CTA ("ابحث عن أفضل عرض"); **recent intents** rows (this-session) to re-run.
- **States:** *loading* = none (instant) · *empty* = CTA disabled until plausible input; garbage submit → friendly re-ask, **does not search** · *error* = sector/config missing → fall back to default category + toast.
- **Revamp:** keep the one-box discipline (no filters). Quota pill must be quietly informative, never alarming until it's the last search.

### 8.3 Clarifier (multi-question, "N of 5") — `/search/clarify`
- **Purpose:** narrow the intent with **≥5 sharp questions** so the search is precise — smart, not an interrogation. (PO ruling; per-sector sets in `team/analysis/clarifier-question-sets.md`.)
- **Key content:** header title (`نضبط بحثك`) + back + a **"N of 5 / ٣ من ٥" progress indicator** (Western numerals, replaces the v2 mockup's old "سؤال 2/3"). Chat column: AI bubble (MSA question) → **chip row** (tap presets incl. an "أي / Any" chip + a dashed **"تخطّي / Skip"** chip) → optional user bubble → next AI bubble. Bottom **composer** (free-text fallback always available). Typing indicator while the AI thinks.
- **Pacing rules (keep ≥5 fast):** **chips-first** (default path = 5 taps, not 5 sentences); **skip is always one tap** and advances (widens that axis, never blocks); pre-stated dimensions from the intent are **not re-asked** but still count toward the 5 (RULE-7); each question maps to exactly one dimension; questions ordered broad→narrow. Target median ≤60s.
- **States:** *loading* = typing indicator (AI generating next Q) · *empty* = n/a · *error* = AI/timeout → "تعذّر الفهم، جرّب صياغة أخرى" while **preserving** the typed intent and answered chips · *closest-match* = if the user skips all 5, search still fires with all axes widened → a valid broad result set (never a dead end).
- **Revamp (important):** the v2 mockup's clarifier shows only a 2/3 counter and 2 questions — **rebuild it for 5–8 questions** with a clear bounded-progress indicator ("3 of 5"), so a longer flow still *feels* short and finite. Reconcile the impulsive persona (P2/Abdullah) by making chip-skip effortless. Every question, chip, skip, and the progress meter render AR-first/RTL with Western digits.

### 8.4 Results + best-price VERDICT ribbon (the signature) — `/search/results`
- **Purpose:** the emotional payoff — "the comparing is done; here's the winner, and here's why." This is the screenshot people share (§6.3).
- **Key content:**
  - Header: back + query summary ("آيفون 17 Pro Max · 512GB") + "رتّبنا N عروض حسب أفضل قيمة لك" + new-search (+) action.
  - **VERDICT card (rank #1):** a **deal-gold gradient ribbon** crowning the top card with a check + intent-grounded reason: `أفضل عرض — أوفر بـ 18 د.ك من المتوسط` / "Best offer — 18 KWD below average". The card itself: image88 · product name (Rubik) · teal "why this offer" pill (references an attribute the user asked for) · provider · **price in deal-gold** (Western digits, LTR-isolated) · go affordance.
  - **Ranked list (#2…N):** compact cards, rank number, name, provider, price, go. **No sponsored markers, no boosting** — neutrality is visible. Order is **deterministic** for the same query+data.
- **States:** *loading* = skeleton cards streaming in + "نبحث في المتاجر…" progress · *empty (no matches)* = friendly empty state + **"وسّع البحث / عدّل"** (never a dead "0 results") · *error (partial)* = render available cards + small note "بعض المصادر غير متاحة الآن" · *error (total)* = error state with **"عدّل البحث"** · *closest-match* = when hard constraints empty the set, the no-match fallback surfaces **real ranked alternatives** clearly labeled as alternatives (never fabricated).
- **Revamp:** the verdict ribbon is the one place boldness is spent — make it feel *earned* and premium (gold gradient + check + `--shadow-lift`), not a "SALE" shout. Gold appears here and on price; nowhere else.

### 8.5 Instagram offer card (the open §8 question — DEFINED HERE)
> Grounded in live code: social offers synthesize one card per IG post from verbatim `handle` + `permalink` + `posted_at` + Claude extraction (`social-resolver.ts`); the CTA opens the **exact post permalink**; `priceFils=0 + priceOnRequest` renders a localized "price on request" label, never a fabricated price (`search.service.ts`); the mobile card already detects `instagram.com/` and shows a "View on Instagram" pill (`ResultCard.tsx`).

- **Purpose:** surface Food / Real-estate offers that live on Instagram **inside the same ranked list** as retailer offers — same trust, clearly sourced, honestly priced.
- **What makes it an IG card (vs. a retailer card):**
  - **Provider line = the IG handle** (e.g. `@restaurant_kw`) instead of a retailer name. Pair with a small Instagram glyph so the source is unmistakable.
  - **Source/recency chip:** small caption "إنستقرام · منذ N يوم / Instagram · N days ago" from `posted_at`, so the user knows it's a social post (freshness matters more for IG than retail).
  - **Image** = the post image; on missing/blocked image, degrade to the neutral greyscale silhouette on `--bg-surface-alt` (never broken).
  - **CTA = explicit pill** "شوف على إنستقرام / View on Instagram" (teal pill, Instagram glyph) → opens the **exact permalink** (the whole card is also tappable). This is the deep-link hand-off for the IG tier.
  - **Price handling (truthfulness — critical):** if the post has a real price, show it in deal-gold like any card. If **DM-priced** (`priceOnRequest`), show the label **"السعر بالخاص — شوف البوست / Price on request — see post"** in `--text-secondary` (NOT gold, NOT a number) — gold is reserved for real prices only. A price-on-request card may still be a strong match but **must not** win the gold verdict ribbon on price alone.
- **Consistency rule:** an IG card uses the **same card anatomy, radius, spacing, and ranking position** as a retailer card — it is not a special "ad" lane and carries no promotional styling (neutrality). The only differences are: handle-as-provider, the Instagram glyph + recency chip, the "View on Instagram" CTA, and the price-on-request label path.
- **States:** *loading* = same skeleton card · *missing image* = greyscale silhouette · *price-on-request* = secondary label + CTA (see post) · *permalink dead* = fall back to the handle's IG profile, then toast + stay on Results (never an error wall).
- **Revamp:** the live mobile card uses an emoji (📷) for the IG glyph as a placeholder — **replace with a proper outlined Instagram icon** (Lucide-style, 2px). Add the recency chip and the price-on-request secondary label treatment, which the current card does not yet visually distinguish.

### 8.6 Paywall — `/paywall` (modal over /search)
- **Purpose:** convert at the 6th search (free tier exhausted), transparently. (F-D2.)
- **Key content:** bottom-sheet (radius 24) with grabber; gold-soft crown; headline ("واصل العثور على أفضل العروض"); sub ("استهلكت عمليات البحث المجانية الخمس"); **big price** "$1 / شهرياً"; value list (unlimited search · price-drop alerts · neutral ranking); primary CTA "اشترك مقابل $1 شهرياً"; ghost "استعادة الشراء"; **fine print "يُحصّل بالدولار الأمريكي"** (KWD app, USD charge — no FX surprise). The blocked intent is preserved to run free immediately after subscribe.
- **States:** *loading* = CTA spinner while opening Stripe Checkout (hosted; **no in-app card form**) · *error* = checkout-open fail → retry · *processing* = post-pay webhook delay → "قيد المعالجة" then unlock on confirmation.
- **Revamp:** premium and calm — a confident upgrade, not a hard wall. No fake urgency/countdown.

### 8.7 Profile / Settings — `/profile`, `/settings`
- **Purpose:** identity (name/email/avatar) + account/security/notification/general controls. (F-A1/A2/A3.)
- **Key content:** profile hero (avatar lg + name + email + Pro tag); **re-verify banner** (warn) when email change is pending; grouped list rows (N1) with leading icon, label, value, chevron — phone (read-only, masked), subscription (status + renew date), language toggle, biometric toggle (N2 switch), notifications, destructive **sign-out** row. Settings adds Account/Security/Notifications/General sections.
- **States:** *loading* = row skeletons · *empty* = email "not set" → initials avatar · *error* = save fails → non-blocking "couldn't save, try again", prior values retained (no field lost) · *closest-match* = n/a · notification OS-permission states A (undetermined) / B (granted) / C (denied → "Open Settings"); biometric only shown when device-capable + post first sign-in.
- **Revamp:** keep the calm list-row system; ensure all toggles, banners, masked numbers render AR-RTL with Western digits.

### 8.8 Subscription manage — `/subscription`
- **Purpose:** show current plan/price/renewal + cancel/resubscribe via Stripe portal. (F-D1.)
- **Key content:** plan block (N7) with status (active / canceled-scheduled / past-due / expired / free), renewal date, price, link to hosted billing portal/history.
- **States:** *active* · *canceled (active-until-period-end)* · *past_due* (with retry/grace messaging) · *expired/free* (re-subscribe CTA) · *loading* skeleton · *error* retry. All status copy AR-RTL + Western digits.

---

## 9. Design system & components  [UX]

> **Canonical source = `team/design/mockups/tokens.css`** (v2). Token *names* are stable; a brand swap is a value edit. §4 already lists the hex/fonts — this section is the **component inventory + the structural rules** Claude Design must honor. **VERIFIED** (tokens.css + bestoffers-v2.html + live `apps/mobile/src/theme`).

### 9.1 Foundations (recap of the token contract)
- **Color:** brand teal `#0B6B5B` (+ 135° gradient `#0E8C74→#075345` on hero CTAs / active state) · **deal-gold `#C8881C` reserved for price + verdict ribbon ONLY** (never nav/headlines/promo) · **sand canvas `#FBF8F3`** (the background is a brand signal, not white) · surface `#FFFFFF` · text primary `#18211F` / secondary `#5C6864` · border `#E6DFD4`.
- **Type:** **Rubik** (display + Latin + prices, weight 800 on price) + **IBM Plex Sans Arabic** (body/UI). Scale: display 28 · h1 22 · h2 18 · body 16 (lh 27, +1 for AR) · price 22/800 · caption 13. Never letter-space Arabic; eyebrow labels are Latin-only.
- **Spacing:** 4px base — xs4 · sm8 · md12 · lg16 · xl24 · 2xl32 · 3xl48.
- **Radius:** **card 16** · **chip 999 (full pill)** · button 14 · input 14 · sheet 24.
- **Elevation:** soft warm-tinted shadows — `--shadow-card` (cards), `--shadow-lift` (hero/verdict/paywall). Never heavy material shadows.
- **Touch targets:** ≥44×44pt everywhere; category tiles ≥150px.

### 9.2 Component inventory (build/revamp these)
| # | Component | Anatomy / variants | Key rule |
|---|---|---|---|
| C1 | **Search box (hero)** | surface card r20, search icon (start), multiline input, mic affordance, trust hint footer | auto-direction per entry; mixed AR/EN must not break |
| C2 | **Primary CTA / button** | `.btn--primary` (gradient), `--gold` (verdict/CTA), `--secondary` (teal outline), `--ghost` | gradient = hero/active only; height 54, radius 14 |
| C3 | **Chip** | default · **selected** (teal fill) · **skip** (dashed) · "Any" | full-pill; clarifier answers + filters; ≥40h |
| C4 | **Clarifier bubble** | AI (surface, tail start) · user (teal, tail end) · typing indicator | MSA copy; chips render below AI bubble |
| C5 | **Progress meter "N of 5"** | text/segmented "٣ من ٥" | Western digits; bounded, visible end |
| C6 | **Result card** | image88 · name (Rubik) · why-pill (teal) · provider · price (gold) · go | image/text mirror in RTL; no horizontal scroll; **no sponsored marker** |
| C7 | **Verdict ribbon** | gold gradient bar + check + intent-grounded reason, crowning rank #1 | the ONE bold moment; `--shadow-lift` |
| C8 | **IG offer card** | result card + **handle-as-provider** + Instagram glyph + recency chip + "View on Instagram" pill + price-on-request label path | same anatomy/rank as retailer card; gold only on real prices |
| C9 | **Category tile** | active (surface + chevron) · **Soon** (recessed + dashed + tag, disabled) | ≥150px; active pressed-scale only |
| C10 | **Quota / searches-remaining pill** | default · **warn** (gold-soft, last search) · **gate** (teal, tap→paywall); hidden for Pro | "3 عمليات بحث مجانية"; Western digits |
| C11 | **Tag / badge** | `--soon` · `--pro` · `--save` | small, quiet |
| C12 | **List row (N1)** | nav · toggle · value · destructive | leading icon chip + label + value + chevron |
| C13 | **Switch (N2)** | off · on · disabled · pending | biometric/notification toggles |
| C14 | **Avatar (N3)** | sm40 · md64 · lg96 + initials fallback + editable camera badge | gradient bg for initials |
| C15 | **OTP 6-box input (N5)** | per-digit, paste-aware, auto-submit, error-shake | Western digits |
| C16 | **Inline banner (N6)** | info · warning · error · success | always icon+label (never color-alone); email re-verify uses warn |
| C17 | **Plan / price block (N7)** | plan name + price + renewal + portal link | subscription states |
| C18 | **Bottom sheet / paywall** | grabber + crown + headline + value list + CTA + fineprint | radius 24; scrim `--overlay-scrim` |
| C19 | **Skeleton / loading** | tiles · cards · rows; "searching" progress label | animated, never frozen spinner |
| C20 | **Toast / empty-state** | forward-action always present | "never a dead end" |

### 9.3 RTL structural rules (non-negotiable for every component)
- Use **logical properties** (start/end, `margin-inline`, `padding-inline`) — never hard left/right. The live RN code already uses `I18nManager.isRTL ? 'row-reverse' : 'row'` and `textAlign:'left'` (which is *start* under RTL) — keep this pattern.
- Directional icons (back chevron, go arrow) **mirror** in RTL; neutral icons (search, mic, camera, Instagram glyph) **do not**.
- Numeric runs wrapped in `.num` / `NumText` to stay **LTR-isolated** inside RTL copy.
- The card's image/text swap sides in RTL automatically via logical layout.

---

## 10. Constraints  [UX]

> Hard constraints every design decision must satisfy. **VERIFIED** (tokens.css NUMERAL RULE, flows-and-ia §4/§6, brand §4, live RN code).

1. **Arabic-first / RTL by construction.** RTL is the **default** design direction; EN mirrors to LTR. Not a retrofitted mirror — layout, flow, icons, and numerals are designed RTL-first. Use logical (start/end) props throughout. Per-field input direction auto-detected (AR→RTL, EN→LTR); mixed strings ("آيفون 17 Pro Max") must never break.
2. **Mobile · Expo / React Native.** Designs map to RN primitives and the existing theme tokens (`apps/mobile/src/theme`). No web-only CSS that can't translate (no arbitrary gradients beyond the two brand gradients, no hover-dependent affordances, no fixed-pixel layouts that break on small screens). Phone logical frame ~390×844. RTL force-restart: `I18nManager.forceRTL` requires a reload — design the language toggle to tolerate a controlled restart.
3. **WCAG AA minimum** on every text/background pair (brand teal is AAA on sand/white; `--text-secondary` is AA). **Never meaning-by-color-alone** — always pair state with an icon/label (errors, warnings, verdict, Soon tiles). Touch targets ≥44×44pt.
4. **English / Western numerals EVERYWHERE (locked).** Prices, quantities, counts, OTP, quota, ranks, timers, phone, dates use Western 0–9 — never Arabic-Indic ٠-٩. Currency **label** stays bilingual ("KWD" / "د.ك"); only digits are Western. KWD has **3 decimals** formatted `412.000 KWD` / `412.000 د.ك`, wrapped LTR-isolated (`.num` / `NumText`). RN: format with `-nu-latn`; never enable Arabic-Indic digit shaping.
5. **Performance / latency.** Searching state is live and animated (never a frozen spinner); results stream as skeleton→cards. Clarifier uses the fast model, chips-first, target median ≤60s for the ≥5 phase. Images degrade gracefully (greyscale silhouette, never broken).
6. **Truthfulness (the product, not a disclaimer).** **No invented prices, fake reviews, or fabricated rankings** anywhere in the design. DM-priced Instagram posts show **"price on request — see post"** (secondary, non-gold), never a made-up KWD figure. Ranking is neutral and deterministic — no sponsored/promoted styling, no fake urgency/countdowns. The verdict reason must reference a real attribute the user asked for.
7. **Non-goals (never design these).** No cart/checkout/payment UI (we are not a store) · no sponsored-result styling · no fake countdowns or "only 2 left" · no generic-AI tropes (purple gradients, robot avatars, "Powered by AI" badges) · no stark-white default background (sand `#FBF8F3` is the surface).

---

## 11. References, inspiration & anti-patterns

### 11.1 Anti-patterns to AVOID  [MARKETING]
Do **not** let the revamp resemble:
- **Retailer storefronts** (Xcite, Eureka, Best Al-Yousifi) — dense grids, stacked banners, red SALE urgency, deep category nav. We are intent-led and calm.
- **Coupon / flyer feeds** (ClicFlyer, WaffarX, AlCoupon) — cluttered discount tiles, percentage-off shouting, loud red/orange, ad-density. Gold is a quality signal here, never a promo shout.
- **Generic AI chat apps** — purple gradients, robot avatars, "Powered by AI" badges, untyped ChatGPT-clone bubbles. The conversation must be branded and premium.
- **MSA-bolted-on / broken-RTL apps** — Arabic must be native by construction, never a mirrored afterthought.
- **Fake-urgency dark patterns** — no countdown timers, no "only 2 left!", no manipulative scarcity. Trust is quiet.

### 11.2 Positive inspiration & references  [UX]
Directional references for the *feeling* to hit — adopt the spirit, not a copy. All must remain Arabic-first/RTL and survive the teal-gold-sand system. **ASSUMED** (curated design direction).

- **Premium fintech trust (calm, neutral, confident):** Wise, Revolut, Mercury — generous whitespace, one accent color used sparingly, money rendered as a confident hero, no clutter. *Take:* the "one bold accent on the value moment" discipline → our gold verdict.
- **Conversational-but-branded (not ChatGPT-clone):** Linear's command surface, Arc's search, Superhuman — fast, opinionated, the AI is a means not a mascot. *Take:* a branded conversation with chips, never robot avatars or "Powered by AI" badges.
- **Arabic-first / RTL done natively:** Careem, Foodics, STC Pay, Rain — Arabic as a first-class design language, correct RTL, dialect-friendly tone. *Take:* RTL-by-construction, bilingual parity, Gulf-native warmth.
- **"Best pick / verdict" patterns:** Wirecutter's "our pick" badge, Google Flights' "best" tag, Booking's quiet quality markers. *Take:* a single earned, trustworthy verdict that shows its reasoning — the opposite of a "SALE" shout.
- **Warm premium surfaces (not stark white):** Notion's warm neutrals, Things 3's restraint, Monzo's confident color blocks. *Take:* the sand canvas as a premium signal; calm over loud.

---

## 12. Deliverables expected from Claude Design  [UX]

> Produce a revamp that devs can apply directly. Concrete, RTL-first, token-true, truthful. Mark each artifact **VERIFIED** (rendered, you saw it) or **ASSUMED** (spec only).

### 12.1 Revamped screen designs (rendered mockups — the core deliverable)
A **rendered** (openable, not text-only) revamp of every hero screen in §8, **AR/RTL primary** with an EN/LTR mirror for at least the spine (Category → Search → Clarifier → Results):
1. **Category select** (3 active: Electronics · Food · Real-estate + 2 Soon)
2. **Search / Intent** (with quota pill)
3. **Clarifier** with the **"N of 5" multi-question** flow (show ≥1 mid-flow state, e.g. "3 of 5", chips + skip)
4. **Results** with the **best-price verdict ribbon** on #1 + ranked cards
5. **Instagram offer card** — both states: real-price and **price-on-request** (in a Food or Real-estate results screen)
6. **Paywall** · **Profile/Settings** · **Subscription**
Plus key non-happy states: Results empty / partial-error, Clarifier skip-all closest-match, missing-image degrade.

### 12.2 Updated tokens
- A revised **`tokens.css`-shaped** token set (same variable names; values only where you improve them) — if you adjust any hue/scale, deliver the **diff** vs the current `team/design/mockups/tokens.css`, and keep: gold reserved for price+verdict, sand canvas, AA contrast, the numeral rule. No new gradients beyond the two brand gradients.
- A short **RN token-map note** so devs update `apps/mobile/src/theme` (color/font/space/radius) without guessing.

### 12.3 Component specs (the §9 inventory)
For each component C1–C20: variants, states (default/pressed/disabled/selected/error/loading), spacing, radius, the token it binds to, and its **RTL behavior** (what mirrors, what doesn't). Call out the four signature components in detail: **verdict ribbon (C7), IG offer card (C8), clarifier + N-of-5 (C4/C5), result card (C6).**

### 12.4 RTL + truthfulness coverage (acceptance gate)
- Every screen shown **AR-first/RTL**; logical props only; Western numerals everywhere (LTR-isolated); directional icons mirrored, neutral icons not.
- **Truthfulness proven:** no invented prices/reviews/rankings; DM-priced IG = "price on request" (non-gold); no sponsored styling; no fake urgency. (If a design tool/skill isn't reachable in the run, say so and deliver precise text specs instead — per the guardrails.)

### 12.5 Hand-off format for bo-dev-lead
- Screen mockups + the token diff + the component spec table, in one place, each artifact labeled **VERIFIED/ASSUMED**.
- A **change list** mapping each revamp delta to the screen/route/component it touches, so dev applies it incrementally (match existing RN patterns; no big-bang rewrite).
- Flag any open design question (e.g. exact Instagram glyph, recency-chip copy) so the PO can resolve before build.

---

## Handoff
- **Done:** `ClaudCodeDesign.md` is **COMPLETE and self-contained** — all 12 sections written. bo-ux-lead authored the UX half: **§7** IA & the real flow (Login→Category→≥5 clarifiers→ranked results→deep-link), nav model, full route table; **§8** screen-by-screen brief for every hero screen incl. the **best-price verdict ribbon** and a fully **defined Instagram offer card UX** (handle-as-provider, recency chip, "شوف على إنستقرام / View on Instagram" → exact permalink, and the truthful **price-on-request** path — grounded in live code `social-resolver.ts`/`search.service.ts`/`ResultCard.tsx`); **§9** design system + a 20-component inventory + RTL structural rules; **§10** constraints (RTL/Arabic-first, Expo-RN, WCAG AA, Western numerals `412.000 KWD`, truthfulness); **§11.2** positive references; **§12** exact deliverables + dev hand-off format. **PO ruling applied throughout: ≥5 clarifiers per sector** (the old 0–3 is superseded; §1's ASSUMED note is now resolved by the PO ruling). Marketing's §1–§6 + §11.1 left intact. Memory updated. No git commit.
- **Next:** PO hands `ClaudCodeDesign.md` to **Claude Design** to produce the revamped, rendered mockups + token diff + component specs per §12. Then bo-dev-lead applies the change list incrementally; bo-brand-designer ratifies the palette/fonts; QA tests against §10 constraints.
- **Owner:** PO (hand to Claude Design); bo-ux-lead (design review of Claude Design's output); bo-dev-lead (apply); bo-brand-designer (ratify tokens).
- **Open (flag, not blocking the hand-off):**
  - §1 still carries marketing's "≥5 is ASSUMED, MVP AC says 0–3" note — the **PO ruling resolves this to ≥5**; recommend a one-line edit to §1 to mark it VERIFIED once the PO confirms in writing (left as marketing wrote it to avoid editing their half).
  - **Real-estate** is now an active category in §7/§8 but the v2 mockup (`bestoffers-v2.html`) still renders only 4 tiles (Electronics/Food) — Claude Design must add the Real-estate active tile + a Food/Real-estate IG-card results screen (no rendered RE mockup exists yet).
  - Minor design questions for Claude Design to resolve: exact Instagram glyph (replace the 📷 emoji placeholder in live code), recency-chip copy/format, and whether the IG card needs a "verified handle" marker.
  - **[VISUAL PASS]** this brief is text/spec; the rendered revamp is Claude Design's job (§12). `sleek-design-mobile-apps` needs SLEEK_API_KEY+egress (unavailable in prior runs) — if unreachable in the design run, fall back to hand-built renderable HTML like `bestoffers-v2.html` and flag it.
```
