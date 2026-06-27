# Claude Design REVAMP — Review & Dev-Ready Integration Plan

> Author: bo-ux-lead · 2026-06-27 · Reviews the Claude Design output in `ClaudeDesigne/`
> (`BestOffers Revamp.dc.html` index, `BestOffers Prototype.dc.html`, `BestOffers Landing.dc.html`, `BestOffers App Store.dc.html`)
> against our v2 system (`team/design/mockups/tokens.css` + `bestoffers-v2.html`) and the brief `ClaudCodeDesign.md`.
> Scope of THIS doc: what changed · adopt/adapt/reject · token diff · per-screen change list · dev integration plan.

## 0. Truthfulness note on the artifacts (read first)

- **What these files are:** Claude Design "**.dc.html**" components — real, concrete design *code* (full markup + a live React-style data model `DCLogic`/`renderVals`), driven by `support.js`. The Prototype is genuinely interactive (state machine: `cats → search → clarify(×5) → results`, AR+EN side-by-side, 3 sectors). The data, layout, tokens, and copy are all explicit in source — this is NOT a text hand-wave.
- **VERIFIED-source (read, fully legible):** I read every screen's markup + data. Design content is real and concrete.
- **NOT independently re-rendered in THIS env (flagged):** the HTML does **not** bundle React/ReactDOM (no CDN, no `createRoot`); `support.js` requires `window.React`, which only Claude's Design canvas injects. Opening the files standalone here would throw `window.React is not available yet`. So I could **read** the design exactly but could not capture a fresh pixel screenshot in this run. Per guardrail #1 I label the *visual* deliverables **VERIFIED-source / ASSUMED-pixel** and flag it: **the PO/Claude-Design canvas should do the final visual pass; bo-dev-2 should render once before building.** Nothing below depends on a claim I could not read from source.

---

## 1. What the revamp changed vs our v2

The revamp is **not a redirection** — it is a faithful, higher-fidelity build of the v2 system + the §8 brief, with a few concrete deltas. Same teal/gold/sand DNA, same verdict ribbon, same gold-neutrality discipline, same Western-numeral rule, RTL-default.

### 1.1 Tokens (color) — IDENTICAL to v2
Every brand hex matches `tokens.css` exactly (read from each file's CSS-var block):
`--teal #0B6B5B` · `--teal-strong #075345` · `--teal-soft #E3F2EE` · `--gold #C8881C` · `--gold-strong #A86E0E` · `--gold-soft #FBF0D9` · `--canvas #FBF8F3` · `--surface #FFFFFF` · `--surface-alt #F1ECE3` · `--ink #18211F` · `--ink2 #5C6864` · `--on-gold #2A1D03` · `--border #E6DFD4` · `--border-strong #D6CDBE` · `--success #1E9E6A` · `--error #C8442F` · `--warning #B5780A` · gradients `135deg #0E8C74→#075345` and `#E0A93B→#C8881C`. **No color change to adopt.**

### 1.2 Typography — THE ONE REAL CONFLICT
- **All four files use `Plus Jakarta Sans` (display+Latin) + `Tajawal` (Arabic)** — NOT our locked `Rubik` + `IBM Plex Sans Arabic`.
- Self-contradiction inside the revamp: the index file's "system" panel *says* "Rubik for display & prices · IBM Plex Sans Arabic for body," but the loaded `<link>` and the `--disp/--body` vars are Jakarta+Tajawal. So the revamp claims our type and ships different type.
- This is the only material divergence from the v2 contract. See §2 (reject) + §3 (token diff).

### 1.3 Type scale / weights — minor drift (not on our scale)
Revamp uses ad-hoc px (h1 25–26 / card name 15.5 / price 19 in results, 22 in landing hero / eyebrow 11 letter-spacing 2px). Our v2 scale is display28 / h1 22 / h2 18 / body16 / **price 22/800** / caption13. The revamp's **results-card price is 19px**, below our `--price-size 22`. Adopt our scale; keep the revamp's clean visual hierarchy.

### 1.4 Spacing / radius — small premium nudges
- Search box radius **18** and clarifier composer/cards **14–16**; v2 card radius is **16** (`--r-card`). Category tiles **16**. Mostly aligned; the **search hero box at 18** is a deliberate, nice nudge (matches our C1 "r20" intent loosely). Keep card=16, allow hero search box 18–20.
- Bottom-sheet/sheet radius not exercised in the prototype (no paywall/subscription screen rendered — see gap §4).

### 1.5 Components — what the revamp actually built (new vs v2 mockup)
| Built in revamp | vs our v2 mockup (`bestoffers-v2.html`) |
|---|---|
| **5-question clarifier** with real per-sector chip sets, AI/user bubbles, **"N of 5 / N من 5"** counter + **animated progress bar fill** | v2 had only a 2/3 counter, 2 questions. **Revamp delivers the ≥5 rebuild we owed.** |
| **3 active categories** (Electronics·Food·Real-estate) + 2 Soon (Furniture·Cars), 5-tile grid w/ Soon dashed tag + active corner chevron | v2 had 4 tiles, Electronics/Food only. **Real-estate promotion delivered.** |
| **IG offer card** = Instagram glyph (proper outlined Lucide-style, replaces 📷), **handle-as-provider** (LTR-isolated `@grill_house_kw`), **recency chip** ("إنستقرام · قبل يومين"), **"شوف على إنستقرام" pill**, and the **price-on-request** path ("السعر بالخاص — شوف البوست", `--ink2`, non-gold, no number) | v2 had no IG card at all. **Fully delivered per §8.5, truthful.** |
| **Verdict ribbon** = gold gradient bar + check-in-circle + label + intent-grounded reason, gold border + gold-tinted lift shadow on rank-1 card | Matches v2 signature; cleaner execution. |
| **Result card** anatomy: 80px image well w/ rank badge (top-start), name, teal why-pill, provider row, price (gold, LTR), go chevron (mirrors in RTL) | Matches our C6 spec. Note image is **80px** (brief says image88). |
| **Quota pill**, recent-searches rows, settings (profile hero + Pro tag + grouped rows + teal toggle + destructive sign-out) | Settings/profile delivered as a real screen. |
| **AR↔EN parity**: every screen rendered twice, `dir` swap, `flip` (scaleX(-1)) on directional icons only (back, go, arrow, send) — neutral icons (search, mic, IG, settings, shield) do NOT flip | Strong RTL-by-construction. Uses logical props (`inset-inline-*`, `border-start-start-radius`, `margin-inline-end`). |

### 1.6 Screen layouts
Spine screens match our §7 flow exactly: Category → Search/Intent (back chevron + quota pill + settings) → Clarifier (back + title + N-of-5 + progress bar + bubbles + chips + composer) → Results (back + query summary + count + new-search "+" + ranked cards + verdict + neutrality footer) → Settings. The **stack nav model** (no tabs) is honored. Marketing-owned Landing + App Store pages are also delivered (consistent tokens, $1/mo USD fine print, "billed in USD" — truthful).

---

## 2. Adopt / Adapt / Reject (per element)

### ADOPT (better or equal — ship as-is)
1. **The whole 5-question clarifier interaction** (bubbles + chips + Skip(dashed)/Any chips + N-of-5 counter + progress-bar fill). This is the rebuild we owed; pacing is chips-first, one tap per axis. **Adopt the structure verbatim.**
2. **Per-sector clarifier question sets** rendered in the prototype (Electronics: budget→storage→colour→new/open-box→store; Food: people→dish→budget→delivery/pickup→area; Real-estate: type→bedrooms→rent/buy→budget→area). Cross-check against `team/analysis/clarifier-question-sets.md` before wiring (config is source of truth) — but the UX shape is right.
3. **IG offer card** — glyph, handle-as-provider (LTR-isolated), recency chip, "شوف على إنستقرام / View on Instagram" pill, and the **price-on-request label** (non-gold, no fabricated number). **Truthful and exactly per §8.5.** Adopt.
4. **Verdict ribbon** execution (gold gradient + check circle + label + reason, gold border + tinted lift). Adopt.
5. **Real-estate as a 3rd active category** + 5-tile grid + Soon dashed treatment. Adopt.
6. **RTL handling pattern** (logical props + flip-directional-only). Adopt — and mirror it in RN with `I18nManager.isRTL` + `scaleX(-1)` on directional icons only.
7. **Neutrality footer** on results ("ترتيب محايد · بلا نتائج مموّلة"). Quiet trust marker. Adopt.
8. **All brand color tokens + gradients** — identical, nothing to change.

### ADAPT (good idea, conform to our contract before shipping)
1. **Price-size 19 → 22/800** on result cards (our `--price-size`). The verdict/hero prices already feel right; just bump card price to 22 weight 800. (Keep Western digits + LTR isolation, which the revamp already does.)
2. **Result image well 80 → 88px** to match our C6 (`image88`). Cosmetic; keeps proportion.
3. **Search hero box radius 18–20** — allow it as a deliberate hero exception; everything else stays card=16. Add an explicit `--r-input-hero: 18px` rather than free-floating.
4. **Type scale** — bind the revamp's nice hierarchy to our named tokens (display28/h1 22/h2 18/body16/caption13) so devs don't hardcode 25/26/15.5.
5. **Image placeholder** — the prototype uses a category glyph in the image well; in production this is the **provider/post image**, degrading to the **greyscale silhouette on `--surface-alt`** (our truthfulness rule). Adapt the empty/missing-image state into the component (the revamp's well is the right container).

### REJECT (conflicts with a locked constraint)
1. **Fonts: Plus Jakarta Sans + Tajawal → REJECT. Keep Rubik + IBM Plex Sans Arabic.** This is the one hard conflict. Reasons: (a) v2/brand contract is locked on Rubik + IBM Plex Sans Arabic (brand §4.2, Inter retired); (b) **Tajawal is a fine Arabic face but is NOT what brand ratified** — IBM Plex Sans Arabic was chosen for diacritic clarity + RTL shaping at our body sizes; (c) bilingual parity + "Arabic-first by construction" means we don't swap the Arabic face without brand sign-off. **Devs must NOT copy the `<link>` / `--disp` / `--body` from the revamp files.** Use our `tokens.css` font vars. (If brand later *wants* to revisit Jakarta/Tajawal, that's a separate brand decision — flag, don't silently adopt.)
2. **Nothing else to reject** — no sponsored styling, no fake urgency, no invented prices, no carts appeared. Truthfulness + neutrality held throughout (price-on-request handled correctly; gold only on real prices; deterministic ranked order with explicit rank badges).

### WATCH (not wrong, but verify)
- **Verdict reason copy is illustrative** ("أوفر بـ 18.000 د.ك من المتوسط"). In production this string MUST be computed from real data and reference an attribute the user actually asked for — never a static design string. (Already our rule; just don't let the demo copy leak into prod.)
- **Image88 + rank badge overlap**: rank badge sits top-start over the image well; fine, but ensure it doesn't cover product imagery — consider badge outside the well on real images.

---

## 3. Updated design tokens / components (concrete diffs for `tokens.css` + RN theme)

**Net result: tokens are 95% already correct. Only 3 concrete edits.**

### 3.1 `tokens.css` — KEEP (no change)
All `--brand-*`, `--accent-*`, `--bg-*`, `--text-*`, `--border-*`, `--state-*`, gradients, radius, spacing, numeral rule — **unchanged**. The revamp validated them 1:1.

### 3.2 `tokens.css` — ADD (3 additive tokens, no breaking change)
```css
/* Hero search box may use a slightly larger radius than standard inputs */
--r-input-hero: 18px;       /* search/intent box only; standard input stays 14 */

/* Result-card media well (provider/post image) */
--media-well: 88px;         /* C6 image size — devs stop hardcoding 80 */

/* (Optional, documentation only) progress-bar fill height used by clarifier */
--clarifier-bar-h: 4px;
```

### 3.3 `tokens.css` — DO NOT CHANGE fonts (explicit guard)
Leave:
```css
--font-display: 'Rubik', 'IBM Plex Sans Arabic', system-ui, sans-serif;
--font-body:    'IBM Plex Sans Arabic', 'Rubik', system-ui, sans-serif;
```
**Ignore the revamp's `Plus Jakarta Sans`/`Tajawal` link.** (Add a one-line comment in tokens.css: "Revamp .dc.html used Jakarta/Tajawal — NOT ratified; keep Rubik + IBM Plex Sans Arabic.")

### 3.4 RN theme map (`apps/mobile/src/theme`)
| Token | Value | RN note |
|---|---|---|
| price size/weight | **22 / 800** | result-card price (revamp shipped 19 — bump up) |
| media well | **88×88** | `ResultCard` image container |
| hero input radius | **18** | search box only; other inputs 14 |
| fonts | **Rubik + IBM Plex Sans Arabic** | via `expo-font`; do NOT load Jakarta/Tajawal |
| everything else | unchanged | already in theme from v2 |

**bo-brand-designer must RATIFY:** (a) the 3 additive tokens (trivial), and (b) explicitly **re-affirm Rubik + IBM Plex Sans Arabic over the revamp's Jakarta/Tajawal** — this is the only decision that needs a brand signature.

---

## 4. Per-screen change list (mapped to our real screens/routes)

| Screen / route | Revamp delivered | Action for dev |
|---|---|---|
| **Categories** `/categories` | 5-tile grid, 3 active + 2 Soon, neutrality chip, roadmap card, avatar+settings header | **Add Real-estate active tile** (currently Electronics/Food only in live app). Soon = `--surface-alt` + dashed `--border-strong` + Soon tag, `aria-disabled`. |
| **Search/Intent** `/search?cat=` | back chevron + quota pill + settings; eyebrow; greeting; hero search box (r18) + mic; trust line; gradient CTA; recent rows | Apply hero box radius 18; quota pill quiet (warn only on last search). Keep one-box discipline. |
| **Clarifier** `/search/clarify` | **5-question** flow, AI/user bubbles, chip sets (incl. Any + dashed Skip), **N of 5** counter + progress-bar fill, composer fallback | **Replace** the v2 2/3 clarifier with this 5-Q build. Wire questions from `clarifier-question-sets.md` config (don't hardcode demo strings). Skip widens axis, still advances + counts. |
| **Results** `/search/results` | verdict ribbon on #1, ranked cards (rank badge #2..N), why-pill, provider, price (gold), go chevron, neutrality footer | Bump price to 22/800, image well 88; verdict reason from real data; greyscale-silhouette missing-image state. |
| **IG offer card** (in Food/RE results) | IG glyph, handle-as-provider, recency chip, "View on Instagram" pill, **price-on-request** label path | Adopt as-is into `ResultCard.tsx`: replace 📷 emoji with the outlined IG glyph; add recency chip + price-on-request branch (non-gold). CTA → exact `permalink`. |
| **Settings/Profile** `/settings` `/profile` | profile hero (avatar+name+Pro tag+email LTR-isolated), grouped rows (phone masked, subscription, email, language, biometric/notif toggles), destructive sign-out | Adopt list-row + toggle system; keep masked phone + email LTR-isolated; Western digits in renew date. |
| **Paywall** `/paywall` | **NOT rendered in the prototype** (only on Landing as $1/mo + "billed in USD" fine print) | **GAP** — build paywall from our §8.6 spec + v2 mockup; reuse revamp's sheet styling language. Brief's bottom-sheet (r24) not exercised. |
| **Subscription** `/subscription` | NOT rendered | **GAP** — build from §8.8 + v2; not in revamp. |

**Non-happy states NOT shown in the prototype (build from our specs):** Results empty / partial-error, clarifier skip-all closest-match, missing-image degrade, OTP/login screens, quota-warn + quota-gate pill states, paywall processing state. The revamp covers the happy spine + settings only.

---

## 5. Dev-ready integration plan (additive, ordered — for bo-dev-lead / bo-dev-2)

**Principle:** additive, match existing RN patterns, no big-bang rewrite. Tokens barely move; most work is the clarifier rebuild + IG card.

**Phase 0 — tokens (bo-dev-lead, ~XS)**
1. Add `--r-input-hero:18`, `--media-well:88`, `--clarifier-bar-h:4` to `tokens.css` + RN theme. Add the "fonts NOT swapped" comment. **Do not touch fonts.** Confirm RN still loads Rubik + IBM Plex Sans Arabic.

**Phase 1 — Results + IG card (bo-dev-2, highest value)**
2. `ResultCard.tsx`: bump price → 22/800; image well → 88; add **rank badge**, **greyscale-silhouette** missing-image state.
3. **IG card branch** in `ResultCard.tsx`: replace 📷 → outlined Lucide-style IG glyph (neutral, does NOT flip in RTL); add **recency chip** (from `posted_at`); **price-on-request** path → label "السعر بالخاص — شوف البوست / Price on request — see post" in `--text-secondary`, **no number, never gold**; "View on Instagram" teal pill → exact `permalink`. (Grounds: `social-resolver.ts`, `search.service.ts`.)
4. Verdict ribbon: confirm gold gradient + check + **data-driven** reason (not the demo string). Neutrality footer.

**Phase 2 — Clarifier ≥5 rebuild (bo-dev-lead, the owed rebuild)**
5. Rebuild `/search/clarify` to the revamp's bubble+chip+N-of-5 model. Wire questions from `clarifier-question-sets.md` (≥5 gate, Skip advances+counts, Any widens). Progress-bar fill = `step/5`. Counter "N of 5 / N من 5" Western digits, LTR-isolated.

**Phase 3 — Categories + Search (bo-dev-2)**
6. Add **Real-estate active tile** to `/categories`; Soon treatment for Furniture/Cars.
7. Search: hero box radius 18; quota pill states (default/warn/gate).

**Phase 4 — Settings/Profile polish (either)**
8. Apply the revamp's list-row/toggle/profile-hero styling to `/settings` `/profile` (Western digits, masked phone, LTR-isolated email).

**Phase 5 — Gaps NOT in revamp (build from our specs, not the revamp)**
9. Paywall `/paywall` (§8.6, sheet r24, $1/mo, "billed in USD"), Subscription `/subscription` (§8.8), OTP/login, and all non-happy states.

**Acceptance gates (QA):** every screen AR-first/RTL; Western numerals LTR-isolated; directional icons mirror, neutral don't; no invented prices; price-on-request non-gold; no sponsored styling; fonts = Rubik + IBM Plex Sans Arabic (NOT Jakarta/Tajawal); contrast AA.

---

## Handoff
- **Done:** Reviewed all 4 Claude Design `.dc.html` revamp outputs against v2 + the brief; delivered `team/design/claude-design-review.md` with what-changed, adopt/adapt/reject, a concrete token diff, a per-screen change list, and an ordered additive dev plan. Verified each artifact from source (markup + data model fully legible, design is real code) — flagged that I could not re-render pixels in this env (no React bundled; renders only in Claude's Design canvas) → **PO/canvas should do the final visual pass; bo-dev-2 renders once before building.** Memory updated. No git commit.
- **Prioritized ADOPT list:** (1) 5-Q clarifier interaction + per-sector chip sets; (2) IG offer card incl. truthful price-on-request; (3) verdict ribbon; (4) Real-estate active tile + Soon treatment; (5) RTL flip-directional-only pattern; (6) all brand color tokens (already 1:1). ADAPT: price→22/800, image well→88, hero box r18, bind to named type scale, missing-image silhouette. **REJECT: the font swap — keep Rubik + IBM Plex Sans Arabic, ignore Jakarta/Tajawal.**
- **Dev integration plan:** Phase 0 tokens → P1 Results+IG card (bo-dev-2) → P2 clarifier ≥5 rebuild (bo-dev-lead) → P3 categories/search → P4 settings polish → P5 build the GAPS (paywall, subscription, OTP, non-happy states) from OUR specs, not the revamp.
- **bo-brand-designer must RATIFY:** (a) re-affirm **Rubik + IBM Plex Sans Arabic over the revamp's Plus Jakarta Sans + Tajawal** — the single decision needing a brand signature; (b) the 3 trivial additive tokens (`--r-input-hero 18`, `--media-well 88`, `--clarifier-bar-h 4`).
- **Owner:** bo-dev-lead + bo-dev-2 (apply, ordered); bo-brand-designer (ratify fonts/tokens); PO (run/approve the visual pass in the Design canvas).
- **Blockers/risks:** (1) **Font divergence** — devs must not copy the revamp's `<link>`/`--disp`/`--body`; build will look "off-brand" if they do. (2) **Gaps** — paywall/subscription/OTP/non-happy states are NOT in the revamp; build from our specs. (3) **Demo copy leakage** — verdict reason + clarifier strings in the prototype are illustrative; production must be data-driven from `clarifier-question-sets.md` + real ranking. (4) **Pixel-render not done here** — re-render in the canvas before sign-off.
