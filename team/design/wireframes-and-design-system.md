# Wireframes & Design System — Electronics MVP (S1-2)

> Owner: bo-ux-lead · Status: dev-ready draft · 2026-06-25
> Companion to `flows-and-ia.md` (S1-1). Stack: React Native / Expo. Arabic-first, RTL-default, bilingual AR/EN.
> Visual identity is a **PLACEHOLDER** — bo-brand-designer finalizes color/type/logo. Tokens below are semantic so a brand swap is a token change, not a rebuild.
> Non-goals honored: no payments / cart / checkout / inventory.

---

## PART 1 — Design System (lightweight)

### 1.1 Color tokens (semantic; placeholder values)
> Use **semantic** names in code (`color.brand.primary`), not raw hex. bo-brand-designer overrides the hex; structure stays.

| Token | Placeholder | Usage |
|---|---|---|
| `color.brand.primary` | `#0E7C66` (teal-green = "trusted / good deal") | Primary CTAs, active states, links |
| `color.brand.primaryPressed` | `#0A5E4D` | Pressed/active CTA |
| `color.brand.accent` | `#F5A623` (warm amber = "offer/value") | Price highlight, badges, "best" marker |
| `color.bg.canvas` | `#FFFFFF` | Screen background |
| `color.bg.surface` | `#F6F7F8` | Cards, input fields, chips |
| `color.bg.surfaceAlt` | `#ECEEF0` | Skeletons, dividers fill |
| `color.text.primary` | `#10151A` | Headings, body |
| `color.text.secondary` | `#5B6670` | Captions, helper, provider name |
| `color.text.onBrand` | `#FFFFFF` | Text on primary buttons |
| `color.border.default` | `#E1E4E8` | Card/input borders |
| `color.state.success` | `#1E9E6A` | Confirmations |
| `color.state.error` | `#D64545` | Inline errors, lockout |
| `color.state.warning` | `#C77700` | Partial-results note, "some sources unavailable" |
| `color.overlay.scrim` | `rgba(16,21,26,0.5)` | Modal/biometric scrim |

- **Contrast:** all text/background pairs meet **WCAG AA** (≥4.5:1 body, ≥3:1 large text). Placeholder pairs above are AA-compliant; brand must preserve this when overriding.
- **No color-only meaning:** error/success/warning always pair with an icon or text (accessibility).

### 1.2 Type scale
> Arabic + Latin. Use a font with strong Arabic shaping (e.g. **IBM Plex Sans Arabic** or **Cairo** — bo-brand-designer confirms). Arabic glyphs need slightly more line-height.

| Token | Size / Line | Weight | Usage |
|---|---|---|---|
| `type.display` | 28 / 38 | 700 | Sector picker title, big moments |
| `type.h1` | 22 / 32 | 700 | Screen titles |
| `type.h2` | 18 / 28 | 600 | Card product name, section heads |
| `type.body` | 16 / 26 | 400 | Body, input text, chat |
| `type.bodyStrong` | 16 / 26 | 600 | Emphasis, provider name |
| `type.price` | 20 / 28 | 700 | Result price (KWD) |
| `type.caption` | 13 / 20 | 400 | Helper, timers, "why this offer" |
| `type.button` | 16 / 24 | 600 | CTA labels |

- **AR line-height:** add ~+2px vs Latin to avoid clipped diacritics. Never letter-space Arabic.
- **Numerals:** Western digits default for prices/KWD (per S1-1 §4, pending S0-3 **[R?]**).

### 1.3 Spacing & layout
- **Base unit = 4px.** Scale: `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`.
- **Screen padding:** `lg (16)` horizontal.
- **Card radius:** `12`; input/chip radius: `10`; button radius: `12`. **Logical, not physical** corners so RTL mirrors cleanly.
- **Elevation:** subtle — cards use `border.default` + soft shadow (y2, blur8, 8% black). Avoid heavy material shadows.
- **Touch targets:** **min 44×44pt** (iOS) / 48×48dp (Android) for every interactive element (accessibility §1.5).

### 1.4 Key components

**Button (primary / secondary / text)**
- Primary: `brand.primary` fill, `text.onBrand`, radius 12, height 52, full-width on auth/CTA screens. Pressed → `primaryPressed`. Disabled → 40% opacity, not tappable.
- Secondary: `bg.surface` fill, `brand.primary` text + border. Text button: no fill, `brand.primary` label.
- States: default · pressed · disabled · loading (inline spinner replaces label, label width preserved).

**Search box (Intent screen — the hero)**
- Elements: large rounded field (`bg.surface`, border, radius 12, min-height 56), leading **search icon** (non-mirroring), placeholder in active language, multiline-capable.
- Behavior: per-entry direction auto-detect (AR→RTL caret/right-align, EN→LTR); submit via keyboard return or a primary "ابحث / Search" button below.
- States: empty (CTA disabled) · typing · invalid/garbage (inline friendly re-ask, no search) · submitting.

**Clarifier chat bubble**
- **AI bubble:** leading-aligned (right in RTL, left in LTR), `bg.surface`, radius 12 (tail corner squared), `type.body`. Optional typing indicator (3 animated dots) while AI thinks.
- **User answer:** trailing-aligned, `brand.primary` tint bg, `text.onBrand`.
- **Answer chips:** pill row under an AI question — `bg.surface` + border, selected = `brand.primary` fill. Tappable (≥44pt). Includes a **"تخطّي / Skip"** chip. Free-text answer also allowed via the same input bar.
- States: question shown · chip selected · skipped (greyed, "تم التخطّي / Skipped") · refining (re-query without reset).

**Result card** (maps D2.1, D3)
```
RTL layout (mirror of below):
┌───────────────────────────────────────────────┐
│ [IMAGE 88×88]   Product name (h2)              │
│  rounded 10     "why this offer" (caption,     │
│  placeholder     references a requested attr)  │
│  if missing      Provider name (bodyStrong,    │
│                  secondary)                    │
│                                                │
│        Price KWD (type.price, accent)   [ →  ]│  ← deep-link CTA
└───────────────────────────────────────────────┘
```
- Elements: image (88×88, radius 10, **placeholder** if missing — never broken), product name (h2, 2-line max), **why-this-offer** line (caption, intent-grounded), provider name (bodyStrong/secondary), **price** (`type.price`, `brand.accent`, KWD), **deep-link CTA** (icon button or "اذهب للمتجر / Go to store").
- No horizontal scroll inside a card (D2.3). No sponsored/ad markers (neutrality, D2.6).
- States: default · pressed (whole card tappable → hand-off) · image-loading (skeleton) · degraded (missing field → graceful placeholder).

**Chip / Badge**
- "قريباً / Soon" badge on Food tile (`bg.surfaceAlt`, secondary text). "أفضل عرض / Best" optional marker uses `brand.accent` (match-quality only, never paid).

**Toast / Inline note**
- Non-blocking. Partial-results note uses `state.warning` + icon. Errors use `state.error` + icon + retry affordance.

**Skeleton loaders**
- `bg.surfaceAlt` shimmer for sector tiles, result cards, image slots. Used during search streaming and screen loads.

### 1.5 Accessibility rules
- **Contrast:** WCAG **AA** minimum on all text and meaningful icons (§1.1).
- **Touch targets:** ≥44×44pt / 48×48dp; ≥8px between adjacent targets.
- **RTL mirroring:** use **logical** props (start/end, not left/right) everywhere; layout, paddings, chevrons, card internals mirror in RTL. **Directionally-neutral icons (search, camera, image) do NOT flip;** directional ones (back chevron, arrows) do.
- **Dynamic type:** respect OS font scaling; layouts reflow, never clip (esp. Arabic line-height).
- **Screen readers:** every control has an AR + EN accessible label; result card announces "name, price, provider, opens provider." Decorative images marked decorative.
- **Color independence:** state never conveyed by color alone (icon/text always paired).
- **Focus/keyboard:** OTP and inputs support paste and external keyboards; logical focus order respects reading direction.
- **Motion:** typing indicator and shimmer respect "reduce motion."

---

## PART 2 — Screen wireframes (text)

> Format: **Screen → elements → states → behavior.** RTL described as default; EN = mirror. Maps to stories in `mvp-scope-and-stories.md`.

### W1 — Splash  (A2, A3)
- **Elements:** centered logo placeholder, subtle loader.
- **States:** checking session · biometric prompt (if enrolled) · routing.
- **Behavior:** valid session → `/sectors`; enrolled biometric → OS prompt then `/sectors`; no/expired session → `/login`. No interactive content beyond biometric.

### W2 — Login: phone entry  (A1)
- **Elements:** title (h1 "سجّل الدخول / Sign in"), helper (caption), **phone field** with `+965` prefix (editable, numeric keypad), primary button "إرسال الرمز / Send code".
- **States:** empty (CTA disabled) · valid (CTA enabled) · invalid format (inline error under field) · sending (button loading) · network error (retry toast).
- **Behavior:** inline-validate before submit (A1.1); on success → `/login/otp` with masked destination. RTL: field label/prefix mirror; digits stay LTR within field.

### W3 — OTP verify  (A1)
- **Elements:** title, masked destination ("أرسلنا رمزاً إلى …٦٧ / Code sent to …67"), **6-box OTP input** (auto-advance, paste, auto-submit), **resend** link with countdown, "تغيير الرقم / Change number" text link.
- **States:** entering · verifying (loading) · wrong (inline error + attempts left) · lockout (banner, A1.4) · expired (CTA → request new code) · resend-disabled (timer) → resend-enabled.
- **Behavior:** correct+valid → biometric opt-in (first time) else `/sectors` (A1.3). RTL: OTP boxes fill in reading order; digits LTR.

### W4 — Biometric opt-in (modal/sheet)  (A2)
- **Elements:** icon, title "تسجيل دخول أسرع؟ / Faster sign-in?", body, "تفعيل / Enable" primary, "ليس الآن / Not now" text.
- **States:** offered · enabling · enabled · declined.
- **Behavior:** shown once after first sign-in; never blocks; decline → continue (A2.1). Settings can toggle later (A2.4).

### W5 — Sector picker  (B1)
- **Elements:** title (display "اختر القسم / Choose a sector"), **sector tiles**: **Electronics** (icon + label, active), **Food** (icon + label + "قريباً/Soon" badge, disabled). Furniture/Cars hidden (MVP).
- **States:** loading (skeleton tiles) · ready · Food-disabled.
- **Behavior:** tap Electronics → `/search` scoped Electronics (B1.2). Food non-tappable (B1.1, scope: not designed further). RTL: grid flows right-to-left; icons non-directional (no flip). Session preserved when re-entering later (B1.4).

### W6 — Intent screen  (C1)
- **Elements:** sector header chip "Electronics ▾" (returns to picker, S1-1 §1.1), **hero search box** (W: §1.4), primary "ابحث / Search" button, **recent intents** rows (this-session, optional), overflow → Settings.
- **States:** empty (CTA disabled) · typing · garbage submit (friendly re-ask, no search, C1.3) · submitting.
- **Behavior:** per-entry direction auto-detect (C1.2, F1.4); submit passes intent+sector to AI (C1.4) → `/search/clarify`. RTL default; placeholder localized.

### W7 — Clarifier conversation  (C2, C3)
- **Elements:** chat thread (AI bubbles + user answers), **answer chips** per question, persistent **input bar** (free text) + send, "تخطّي / Skip" affordance.
- **States:** AI thinking (typing indicator) · question+chips · answered · skipped · refining (no reset) · proceeding to search · error (couldn't-understand re-ask, keeps intent).
- **Behavior:** 0–3 Q max (C2.1); chip or free text (C2.2); skip → best-effort + note (C2.3); already-specific → skip to search (C2.4); loop guard no repeat dimension (C2.6); context retained, refinements update without restart (C3.1–3.2). On completion → Searching. RTL: AI bubbles right-aligned, user left-aligned (mirror in LTR).

### W8 — Searching (transient)  (D1)
- **Elements:** animated progress label "نبحث في المتاجر… / Searching providers…", optional skeleton result cards.
- **States:** searching · partial (some sources done) · total failure (→ error with "عدّل البحث / Edit search").
- **Behavior:** never a frozen spinner; "real-time but fast"; auto-advances to Results as cards stream (D1.2). No dead end (D1.3).

### W9 — Results  (D2, D3, E1)
- **Elements:** header (intent summary + "بحث جديد / New search"), **ranked result cards** (W: §1.4, top N), partial-source note if any (warning), empty-state block if none.
- **States:** loading (skeletons) · ranked list · **empty** ("لا نتائج — وسّع أو عدّل البحث / No results — broaden or edit" + action, D1.3) · partial-error (cards + note, D1.4) · degraded card (placeholder image/field, D2.4).
- **Behavior:** deterministic order, match-quality only, no sponsorship (D2.2, D2.6); each card why-line references a requested attribute (D3); tap card → hand-off; "New search" clears clarifier context (C3.3). RTL: card internals mirror (image/text swap sides); KWD + digits formatted (F1.3).

### W10 — Deep-link hand-off (transient)  (E1)
- **Elements:** brief "نفتح المتجر… / Opening provider…" overlay.
- **States:** resolving · opening external · fallback (provider home) · dead-link toast.
- **Behavior:** open provider app if installed else web to matching item (E1.1); unresolved → nearest valid page (E1.2); log anonymized hand-off (E1.4); return → Results intact (E1.5). No checkout in-app (E1.3).

### W11 — Settings  (A2, A3, F1)
- **Elements:** **language toggle AR↔EN**, **biometric** switch, **sign out** (destructive), app version.
- **States:** default · language-switching (may trigger RTL restart, S1-1 §6) · signing out.
- **Behavior:** language toggle app-wide + persists (F1.2); biometric enable/disable (A2.4); sign out clears session → `/login` (A3.2).

---

## PART 3 — Brand alignment note
- All visuals above are **placeholder semantic tokens**. **bo-brand-designer** finalizes: exact palette (preserving WCAG AA + the "trust/neutrality" positioning from the concept), the Arabic+Latin type pairing, logo, iconography, and the "best offer" accent treatment.
- Design system structure (token names, type scale roles, spacing scale, component anatomy, RTL rules) is **stable** and brand-agnostic — a brand swap edits token *values*, not component structure.

---

## Handoff
- **Done:** Lightweight design system (semantic color tokens, type scale, 4px spacing scale, key components: search box / clarifier bubble / result card / button / chip / skeleton / toast), accessibility rules (AA contrast, ≥44pt targets, logical-prop RTL mirroring, dynamic type, screen-reader labels, color-independence), text wireframes W1–W11 for every core screen with elements/states/behavior, story traceability, brand-placeholder note.
- **Next (bo-dev-lead):** scaffold Expo Router routes per S1-1 §1.3; implement i18n + `I18nManager` RTL (confirm force-RTL restart UX); build components from §1.4 against semantic tokens; wire clarifier 0–3 cap + loop guard to Claude layer (bo-tech-architect S1-4); honor deterministic ranking + anonymized logging contracts.
- **Next (bo-brand-designer):** override placeholder color/type tokens, deliver logo + iconography + "best offer" accent, keeping WCAG AA and neutrality positioning; confirm Arabic font (IBM Plex Sans Arabic / Cairo candidate).
- **Owner:** bo-ux-lead (design), bo-dev-lead (build), bo-brand-designer (identity), bo-tech-architect (AI/ranking/logging contracts).
- **Blockers/risks:** numeral preference unresolved **[R? S0-3]** (defaulted Western+KWD); RTL force-restart UX needs dev confirmation; final Arabic font pending brand; admin-web detailed wireframes deferred to a later sprint.
