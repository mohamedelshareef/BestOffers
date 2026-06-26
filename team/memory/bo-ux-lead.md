# Memory — UX/UI Design Lead (bo-ux-lead)

> Persistent memory for the BestOffers UX/UI Design Lead.
> READ at task start. UPDATE at task end with durable facts only (decisions, current state, open items, handoffs).
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state
- **S1-1 + S1-2 DONE.** Delivered `team/design/flows-and-ia.md` (IA + flows) and `team/design/wireframes-and-design-system.md` (wireframes + design system). Scope: Electronics MVP only; Food = sector-picker "Soon" tile, not designed.
- **Feature screens DONE (2026-06-26).** Delivered `team/design/feature-screens.md` for owner-requested F-A1/A2/A3, F-C1, F-D1, F-D2.
- **VISUAL PASS DONE (2026-06-26) — owed debt cleared.** Delivered renderable mockups: `team/design/mockups/bestoffers-v2.html` (now **6 screens**: Category select · Search/Intent · Clarifier · Results · Paywall · Profile, Arabic/RTL) + `team/design/mockups/tokens.css` (v2 DS) + `mockups/README.md` (token diff + dev apply notes). `frontend-design` skill applied; `sleek-design-mobile-apps` needs SLEEK_API_KEY+egress (unavailable) so mockups hand-built (still real/openable).
- **CATEGORY-FIRST + WESTERN-NUMERAL restructure DONE (2026-06-26).** Updated `flows-and-ia.md` (CHANGE LOG + IA/routes/flow/states/RTL/dev-notes), added mockup screen 0, locked numeral rule in `tokens.css`, README updated. Handed to bo-dev-lead.

## Key decisions
- **CATEGORY-FIRST (2026-06-26):** FIRST authed screen = **Category select** (`/categories`, authed root, post-login landing). 2×2 tiles: **Electronics + Food ACTIVE** · **Furniture + Cars "قريباً/Soon"** (disabled, vision signal). Tap active → `/search?cat=<id>`. `/search` header back → `/categories`. `/sectors` kept as alias/mid-session switcher. Mockup = screen 0 in `bestoffers-v2.html` (`.cat-tile` active/soon, `.cat-grid`, `.cat-note`).
- **NUMERALS LOCKED = Western 0-9 EVERYWHERE (2026-06-26, resolves S0-3):** prices, qty, counts, OTP, quota, ranks, timers, phone, dates. Currency label bilingual "KWD/د.ك", digits Western. RN: `-nu-latn`, never enable Arabic-Indic shaping; wrap in `.num`. Rule block lives at bottom of `tokens.css`.
- **Nav model:** Expo Router **stack** (not tabs) — single linear funnel. Settings via header overflow. Routes: `/` `/login` `/login/otp` `/categories` `/search` `/search/clarify` `/search/results` `/settings` (+`/sectors` alias). Session guard in router `_layout`.
- **Core flow:** Splash → Login(+965)→OTP → (biometric opt-in once) → **Category select** → Intent(one box, per category) → Clarifier(0–3 Q, chips+free text, skippable, loop-guard) → Searching → Ranked results → Deep-link hand-off (terminal exit, returns to Results).
- **RTL-default, AR-first.** Use logical (start/end) props; directional icons flip, neutral icons (search/camera) don't. Input direction auto-detected per entry. AI understands Kuwaiti/Gulf colloquial+code-switch, replies MSA+EN.
- **Design tokens — v2 REFRESH (values in `mockups/tokens.css`; names stable, brand swap = value edit):**
  - Aesthetic thesis: Gulf souk "best price you trust." Canvas = warm **sand `#FBF8F3`** (not white/cream-cliché). Brand = deep **teal-evergreen `#0B6B5B`** + 135° gradient on hero CTAs/active sector. Value accent = single reserved **deal-gold `#C8881C`** ONLY on price + best-offer verdict (neutrality kept). text.primary `#18211F`, border `#E6DFD4`.
  - **Signature element = best-price VERDICT ribbon** (gold gradient + check + "أوفر بـ X د.ك من المتوسط") crowning rank-#1 result.
  - Type CONFIRMED: **Rubik** (display, strong Arabic shaping) + **IBM Plex Sans Arabic** (body). display28 / h1 22 / h2 18 / body16(lh27, +1 AR) / price22(800) / caption13. Western digits LTR-isolated (`.num`).
  - Spacing: 4px base (xs4 sm8 md12 lg16 xl24 2xl32 3xl48); **card radius 16** (up from 12), chips **full-pill**, button radius 14, sheet 24.
  - Touch targets ≥44×44pt.
  - Key components: search box (hero), clarifier chat bubble + chips, result card (image88 / name / why-this-offer / price KWD accent / provider / deep-link CTA), button, chip/badge, skeleton, toast.
- **Result card** anatomy locked: image+text mirror sides in RTL; no horizontal scroll; no sponsored markers (neutrality).
- **New components (feature-screens.md §NEW):** N1 list/menu row (nav/toggle/value/destructive variants), N2 switch (off/on/disabled/pending), N3 avatar (sm40/md64/lg96 + initials fallback + editable camera-badge), N4 image cropper modal (1:1), N5 OTP 6-box input (promoted, paste/auto-submit/error-shake), N6 inline banner (info/warning/error/success), N7 plan/price block, N8 searches-remaining counter pill (5→1 warning→0 Subscribe; hidden for Pro).
- **New routes:** `/profile`, `/profile/edit`, `/settings` (extended w/ Account/Security/Notifications/General sections), `/login/otp` (WhatsApp variant), `/paywall` (modal-route over /search), `/subscription`.
- **Feature decisions:** WhatsApp-first OTP + SMS fallback (appears on WA-undeliverable). Email change = old email stays login identity until new verified (re-verify banner on Profile). Biometric/Notifications toggles use first-time explainer/soft-ask sheets; notifications OS-permission states A(undetermined)/B(granted)/C(denied→Open Settings). Paywall after 5 free searches, $1/mo USD (KWD app → fine-print "billed in USD"), Stripe Checkout/portal hosted (NO in-app card form). Manage states: free/active/canceled-scheduled/past-due/expired. Metering: 1 search = 1 intent→results cycle (refinements don't count — UX assumption, confirm). Fail-open on metering errors.
- **Admin web:** separate responsive web, LTR/EN ok; areas = Providers&Sources / Moderation / Analytics(KPI). Detailed wireframes deferred.

## Open questions / handoffs
- ~~[R? S0-3] Numeral preference~~ **RESOLVED 2026-06-26: Western 0-9 everywhere (owner-locked).**
- **RTL force-restart UX:** `I18nManager.forceRTL` needs reload — bo-dev-lead/architect to confirm restart pattern on language toggle.
- **bo-brand-designer:** v2 mockups now propose a concrete palette (sand/teal-evergreen/deal-gold) + font pairing (Rubik + IBM Plex Sans Arabic) + signature (best-price verdict ribbon). Brand to RATIFY or override these v2 values (not from scratch), deliver logo + iconography aligned to it, keep AA + neutrality. Align tokens to `mockups/tokens.css`.
- **bo-tech-architect (S1-4):** owns clarifier 0–3 cap + loop guard + dialect glossary; ranking must be deterministic per query+data; anonymized hand-off logging fire-and-forget.
- Deep-link reliability per provider unverified.
- **[VISUAL PASS OWED]** sleek-design-mobile-apps / frontend-design skills + mockup-render not reachable in this env — feature-screens.md is text specs; run visual pass when tooling available.
- **[BA] confirm:** paywall hard-gate vs soft-dismiss; metering boundary (refinement counts?); quota reset rules; past-due search-access grace.
- **[architect] F-B1/F-C1/F-D1:** Supabase (avatar storage + auth), WhatsApp OTP provider, Stripe + KWD/USD handling, where search metering lives.
