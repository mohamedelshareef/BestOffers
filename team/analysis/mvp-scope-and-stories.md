# MVP Scope, Personas & User Stories (S0-4)

> Owner: bo-business-analyst · Status: draft for PO review · 2026-06-25
> Source: `Concept.txt`, `team/backlog.md` (locked decisions). Items marked **[R?]** await `bo-researcher` confirmation.

---

## 1. Personas (Kuwait bilingual shoppers)

### P1 — "Reem", the deal-driven deliberate buyer (primary)
- 29, Kuwaiti, works in a bank, bilingual (Kuwaiti Arabic first, comfortable in English).
- Behavior: researches before buying high-ticket electronics; opens 4–5 apps (X-cite, Eureka, Best Al-Yousifi) to compare; hates re-typing filters.
- Goal: find the genuinely best price/spec match fast, then buy on the provider's own app.
- Pain: comparison fatigue; Arabic UIs that break RTL; unsure if a "deal" is actually a deal.
- Wins when: one plain-language ask returns a trustworthy ranked shortlist with a deep link.

### P2 — "Abdullah", the convenience-first casual user (primary)
- 35, expat resident, English-leaning but reads Arabic, low patience.
- Behavior: types short, vague intents ("good phone under 150 KWD", "grilled chicken near me"); won't tune filters.
- Goal: a quick, confident pick without thinking hard.
- Pain: generic search results; too many questions before any value.
- Wins when: AI asks at most 1–3 sharp clarifying questions, then delivers.

### P3 — "Noura", the household food orderer (Food vertical)
- 41, Kuwaiti, orders family meals several times a week, Arabic-first, RTL essential.
- Behavior: thinks in dishes and quantities ("family grilled platter for 4"), not in restaurant brands.
- Goal: compare comparable dishes/prices across delivery providers, then hand off to the provider app.
- Pain: each delivery app is a silo; no cross-provider dish/price comparison.
- Wins when: she states a dish + people count and gets ranked comparable offers with deep links. **[R?]** — depends on Food provider-data feasibility (S0-2).

---

## 2. MVP Scope

### In scope (MVP)
- Auth: mobile number + OTP; biometric **opt-in** after first sign-in.
- Sector picker: Electronics + Food (Food gated on S0-2 data plan).
- Conversational intent capture in Arabic (Kuwaiti/Gulf + MSA) and English, RTL-first.
- AI clarifying questions (bounded, sector-aware).
- Provider search across in-scope, data-feasible providers within the chosen sector.
- Ranked result cards: image, one-line "why this offer," price, provider, deep link.
- Deep-link hand-off to provider site/app.
- Bilingual AR/EN UI with full RTL.
- Light admin web: provider/source management, content moderation, basic analytics.
- Day-one anonymized intent/search logging (see monetization doc) — silent, no UX cost.

### Out of scope (non-negotiable non-goals)
- No in-app payments, cart, or checkout.
- No inventory, stock, or fulfilment.
- No becoming a marketplace / no sponsored ranking at MVP (neutrality is the product).
- Saved searches & price-drop alerts → **fast-follow**, not day-one.
- Furniture & Cars sectors → roadmap.
- Social / sharing / reviews / user accounts beyond auth → later.

### Thinnest end-to-end Electronics slice (the demoable spine)
> Login → pick **Electronics** → type one intent → AI asks ≤3 clarifiers → search ≥1 real provider feed → return ≥3 ranked cards → tap → deep-link opens provider. English-only path acceptable for the very first internal demo; AR/RTL is required before any external release.

### What Food adds on top of that slice
- Dish-oriented intent vocabulary (dish + sides + quantity + people) vs. spec-oriented (model/storage/color/budget).
- Provider set = food-delivery/restaurant sources, which are **harder to source** (consumer price APIs limited) — Food ships only behind a confirmed S0-2 data plan **[R?]**.
- Location/area context likely needed for availability and pricing **[R?]**.
- Deep link resolves to a dish/restaurant in the provider app, not a SKU page.

---

## 3. Epics & User Stories (INVEST, with AC, MoSCoW-prioritized)

> AC are the QA oracle. MoSCoW: **M**ust / **S**hould / **C**ould / **W**on't(MVP).

### EPIC-A — Authentication & Onboarding

**A1 — Mobile + OTP login** · *Must*
*As a Kuwait shopper, I want to sign in with my mobile number and an OTP, so that I can access the app without a password.*
1. User enters a number with Kuwait country code (+965) default; invalid formats are rejected inline. **[R?]** confirm supported countries.
2. On submit, an OTP is sent; UI shows a masked destination and a resend timer.
3. Correct OTP within validity window authenticates and routes to sector picker.
4. Wrong OTP shows an error and allows retry up to a defined lockout limit.
5. Resend is disabled until the timer elapses; OTP expires after a defined TTL.
6. All copy renders correctly in AR (RTL) and EN.

**A2 — Biometric login opt-in** · *Should*
*As a returning user, I want to enable biometric login, so that I sign in faster on later visits.*
1. After first successful OTP sign-in, user is offered (not forced) to enable biometrics.
2. If enabled and device supports it, next launch offers biometric unlock.
3. Biometric failure/decline falls back to OTP login.
4. User can disable biometrics in settings.

**A3 — Session & sign-out** · *Must*
*As a user, I want my session to persist and to be able to sign out, so that I stay logged in but stay in control.*
1. Session persists across app restarts until expiry or sign-out.
2. Sign-out clears the session and returns to login.
3. Expired session routes to login on next protected action.

### EPIC-B — Sector Selection

**B1 — Pick a sector** · *Must*
*As a user, I want to choose a sector after login, so that the AI searches the right providers.*
1. Sector picker shows Electronics and Food (Food shown only if enabled by config/flag).
2. Selecting a sector opens the conversational intent screen scoped to that sector.
3. Roadmap sectors (Furniture, Cars), if displayed, are clearly "coming soon" and non-selectable.
4. Selection is changeable later without losing the session.
5. Labels/icons render in AR (RTL) and EN.

### EPIC-C — Conversational Intent & Clarifying Questions

**C1 — State intent in plain language** · *Must*
*As a user, I want to type what I want in one box in Arabic or English, so that I don't fight with filters.*
1. A single free-text input accepts AR (Kuwaiti/Gulf + MSA) and EN. **[R?]** dialect coverage from S0-3.
2. Input direction auto-switches to RTL for Arabic, LTR for English.
3. Empty/garbage input prompts a friendly re-ask rather than searching.
4. Submitted intent is passed to the AI with the active sector context.

**C2 — AI asks bounded clarifying questions** · *Must*
*As a user, I want the AI to ask only the few questions that matter, so that results are precise without an interrogation.*
1. AI asks **0–3** clarifying questions max before searching (e.g., Electronics: storage/color/budget; Food: sides/quantity/people).
2. Each question is answerable by tap-chips and/or free text.
3. User can skip a question; AI proceeds with best-effort assumptions and may note them.
4. If the intent is already specific, AI skips straight to search.
5. Questions and chips render bilingually with correct RTL.
6. A loop guard prevents the AI from re-asking the same dimension twice.

**C3 — Conversation context retained in a search** · *Should*
*As a user, I want my earlier answers remembered within a search, so that I don't repeat myself.*
1. Answers given in C2 persist for the duration of that search session.
2. Refining intent ("make it cheaper", "بدون بصل") updates results without restarting the flow.
3. Starting a new search clears prior clarifier context.

### EPIC-D — Provider Search & Ranked Results

**D1 — Search in-scope providers** · *Must*
*As a user, I want the AI to scan local providers for my request, so that I see real available offers.*
1. Search queries only data-feasible providers for the active sector **[R?]** (S0-2 matrix).
2. A visible loading state is shown while searching.
3. If no offers match, a clear empty-state with a "broaden/edit" action is shown (not a blank screen).
4. Provider/source errors are handled gracefully — partial results still render with a note.
5. Price freshness meets the "real-time but fast" target (architect-defined cache strategy).

**D2 — Ranked result cards** · *Must*
*As a user, I want a ranked shortlist of offer cards, so that I can pick the best one at a glance.*
1. Each card shows: product/dish image, one-line "why this offer," price (KWD), provider name, deep-link CTA.
2. Results are ordered by a defined ranking rationale (e.g., price/spec match); ordering is deterministic for the same query+data.
3. A reasonable result count is shown (e.g., top N) with no horizontal scroll on a card.
4. Missing image/field degrades gracefully (placeholder, never a broken card).
5. Cards render bilingually with correct RTL alignment and KWD formatting.
6. Neutrality: no paid/sponsored boosting at MVP; ranking reflects only match quality.

**D3 — "Why this offer" explanation** · *Should*
*As a user, I want a one-line reason each offer is recommended, so that I trust the shortlist.*
1. Each card includes a concise, intent-grounded reason (e.g., "Cheapest 256GB in black").
2. The reason references at least one attribute the user asked for.
3. Reason text is bilingual and truthful to the underlying data (no invented claims).

### EPIC-E — Deep-Link Hand-off

**E1 — Hand off to provider** · *Must*
*As a user, I want tapping a card to take me to the provider to buy, so that I complete the purchase there.*
1. Tapping a card opens the provider's app (if installed) or website to the matching product/dish.
2. If the deep link can't resolve to the exact item, it falls back to the provider's nearest valid page (not an error).
3. Best Offers takes no payment and runs no checkout — hand-off only.
4. The hand-off (anonymized: provider, sector, query class) is logged for analytics/CTR.
5. Return-to-app behavior is graceful (session intact).

### EPIC-F — Bilingual & RTL

**F1 — Full Arabic-first RTL experience** · *Must*
*As an Arabic-first user, I want the whole app in correct RTL Arabic, so that it feels native.*
1. Every MVP screen renders correctly in RTL with no clipped/mirrored-wrong elements.
2. Language toggle switches AR↔EN app-wide and persists across sessions.
3. Numerals, currency (KWD), and dates follow the chosen locale conventions. **[R?]** numeral preference from S0-3.
4. Mixed AR/EN content (e.g., "iPhone 17 Pro Max") renders without layout breakage.

### EPIC-G — Light Admin Web

**G1 — Provider/source management** · *Must*
*As an admin, I want to manage providers and sources, so that search uses the right, enabled feeds.*
1. Admin can list, add, edit, enable/disable a provider/source per sector.
2. Disabling a source removes it from user search within the freshness window.
3. Source health/last-sync status is visible.

**G2 — Content moderation** · *Should*
*As an admin, I want to flag/suppress bad offers or content, so that users see trustworthy results.*
1. Admin can suppress a specific offer/source from results.
2. Suppressed items stop appearing within the freshness window.
3. Moderation actions are auditable (who/when).

**G3 — Basic analytics dashboard** · *Should*
*As an admin/PO, I want core usage metrics, so that we can track product health.*
1. Dashboard shows the MVP KPIs in §4 over a selectable date range.
2. Metrics are derived from anonymized event logs.
3. Data refresh cadence is stated on the dashboard.

### EPIC-H — Fast-follow (post-MVP, listed for traceability) · *Won't (MVP)*
- **H1 Saved searches**, **H2 Price-drop alerts**, **H3 Multi-sector watchlists** — full stories in `feature-monetization-proposal.md`.

---

## 4. KPIs (success metrics)

| KPI | Definition | Why it matters | Target signal |
|---|---|---|---|
| **Activation** | % of new sign-ins that complete ≥1 search returning ≥1 result within first session | Proves the core loop delivers value on day one | Set baseline in first cohort; improve sprint-over-sprint |
| **Search-to-result rate** | % of submitted intents that reach a non-empty ranked result set | Measures search/data quality & clarifier effectiveness | High; empty-rate is the inverse to watch |
| **Time-to-result** | Median seconds from intent submit to ranked cards shown | "Real-time but fast" promise | Low median; track p90 |
| **Clarifier efficiency** | Avg. clarifying questions asked before a successful search | Guards against interrogation fatigue | ≤3, trending toward fewer |
| **Click-through (hand-off) rate** | % of result sessions with ≥1 deep-link tap | Proves shortlist is trusted/actionable; core to affiliate value | High; primary monetization proxy |
| **Retention (D7 / D30)** | % of activated users returning at D7 and D30 | Sustainable usage, prerequisite for premium/B2B | Establish baseline; grow with fast-follow features |

> All KPIs computed from anonymized event logs (no PII in analytics). Definitions are the QA/analytics oracle.

---

## 5. Cross-cutting acceptance constraints (apply to every story)
1. No screen exposes payment, cart, checkout, or inventory state.
2. Every user-facing string is available in AR and EN with correct RTL.
3. No PII enters analytics events; logging never blocks or slows the user flow.
4. Graceful degradation: provider/network failures never produce a dead-end screen.

---

## Handoff
- **Done:** Personas (3), MVP in/out scope honoring non-goals, thinnest Electronics slice + Food delta, epics A–H with INVEST stories + numbered AC, MoSCoW priorities, KPI definitions.
- **Next:** PO to ratify scope & priorities; bo-researcher S0-2/S0-3 outputs to resolve **[R?]** markers; feed into bo-ux-lead (flows/wireframes) and bo-tech-architect (data/freshness).
- **Owner:** PO (prioritization), bo-researcher (data/dialect), bo-business-analyst (revisions).
- **Blockers/risks:** Food vertical depends on provider-data feasibility (S0-2); dialect/numeral/locale specifics depend on S0-3; deep-link reliability per provider unverified.
