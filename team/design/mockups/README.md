# BestOffers — Visual Design v2 (mockups)

> Owner: bo-ux-lead · 2026-06-26 · Arabic-first / RTL · WCAG AA
> Open **`bestoffers-v2.html`** in any browser to see all 6 hero screens rendered with Arabic content.
> Tokens live in **`tokens.css`** (single source of truth). This is the visual-pass that was OWED in `feature-screens.md`.

## Files
- `bestoffers-v2.html` — renderable gallery: **Category select (NEW, screen 0)** · Search/Intent · Clarifier · Results · Paywall · Profile.
- `tokens.css` — v2 design-system tokens (color, type, spacing, radius, elevation, components) + **NUMERAL RULE** (Western 0-9 everywhere; see block at bottom of file).

## 2026-06-26 update — category-first + Western numerals
- **New screen 0 · Category select** (the app's first authed screen). 2×2 tiles: **Electronics + Food active** (surface card, teal-soft icon, forward chevron) · **Furniture + Cars "قريباً/Soon"** (recessed `surface-alt`, dashed border, muted, non-tappable). Tapping an active tile → Search/Intent for that category. Route `/categories`.
- **Numerals locked to Western 0-9 everywhere** (prices, OTP, quota, ranks, counts). Currency label stays "KWD/د.ك"; digits Western. Existing Arabic-Indic digits in the mockup (ranks ٢/٣, clarifier ٥١٢) were corrected to `.num` Western. New components: `.cat-tile` (active/soon), `.cat-grid`, `.cat-note`.

## Tooling note
- `frontend-design` skill **applied** (aesthetic direction below). `sleek-design-mobile-apps` skill needs `SLEEK_API_KEY` + egress to `sleek.design` — not available in this sandbox, so mockups are **hand-built** real HTML/CSS (fully openable). PO can optionally re-render via Sleek later; the look is locked here.

## Aesthetic thesis (what makes v2 better, not templated)
- **Subject-grounded:** the Gulf *souk* moment of "finding the best price you can trust."
- **Canvas:** warm Gulf **sand `#FBF8F3`** (premium, not stark white; deliberately NOT the AI cream-serif cliché).
- **Brand:** deep **teal-evergreen `#0B6B5B`** = trust / verified good deal (gradient on hero CTAs & active sector).
- **Value accent:** a single reserved **deal-gold `#C8881C`** — appears ONLY on price + the best-offer verdict. Boldness spent in one place (neutrality preserved: gold = match-quality, never paid).
- **Signature element:** the **best-price VERDICT ribbon** crowning the #1 result (gold gradient + check + "أوفر بـ X د.ك من المتوسط"). This is the one memorable device.
- **Type:** **Rubik** (display, excellent Arabic shaping, geometric/premium) + **IBM Plex Sans Arabic** (body). Confirms the brand font question.

## v2 token changes vs v1 (placeholder) system
| Token | v1 | v2 | Why |
|---|---|---|---|
| `bg.canvas` | `#FFFFFF` | `#FBF8F3` sand | warmth/premium, Gulf identity |
| `brand.primary` | `#0E7C66` | `#0B6B5B` + gradient | deeper, more confident; gradient on hero |
| `brand.accent` | `#F5A623` | `#C8881C` deal-gold | AA on light, less "alert", more "value" |
| `text.primary` | `#10151A` | `#18211F` | green undertone, harmonizes |
| `border.default` | `#E1E4E8` | `#E6DFD4` | warm hairline matches sand |
| card radius | 12 | **16** | softer, more premium |
| chips | radius 10 | **full pill** | friendlier concierge feel |
| type display/body | IBM Plex / Cairo TBD | **Rubik + IBM Plex Sans Arabic** | confirmed pairing |
> Token **names are unchanged** — only values upgraded. Brand swap stays a value edit. All pairs re-checked WCAG AA.

## Mockup → component map
| Screen | Components used (DS §1.4 / N1–N8) |
|---|---|
| **Category select (0)** | **category tiles (`.cat-tile` active/soon), `.cat-grid` 2×2, Soon tag, info note, avatar sm (N3), settings overflow** |
| Search/Intent | hero search box, quota pill (N8, 3-left), back-to-categories chevron, avatar sm (N3), primary CTA, recent-intent rows |
| Clarifier | AI/user chat bubbles, answer chips + skip chip, typing indicator, composer (input bar + send) |
| Results | **best-price verdict (signature)** + result card (image/name/why-this-offer/provider/price-gold/deep-link), ranked list rows |
| Paywall | sheet (N7 plan/price block, value bullets), primary CTA, restore link, fine-print (USD note) |
| Profile | avatar lg (N3), N6 warning banner (email re-verify), N1 rows (nav/value/destructive), Pro tag |

## What devs (bo-dev-lead / bo-dev-2) change to apply v2 — ADDITIVE, non-breaking
1. **Theme tokens only.** Update the RN theme map values to match `tokens.css` `:root` (colors, radius 16/pill, fonts). Token **names already match** the existing semantic system — no component API changes.
2. **Fonts:** add `Rubik` + `IBM Plex Sans Arabic` (Google Fonts / `expo-font`). Display role = Rubik, body = IBM Plex Sans Arabic. Keep digits LTR (`.num` pattern = `direction:ltr; unicode-bidi:isolate`).
3. **Hero CTA + active sector** use the brand gradient (`expo-linear-gradient`), not flat fill.
4. **Result card:** add the **verdict ribbon** wrapper for rank #1 only (gold gradient + check + savings line). Price uses gold; everything else stays neutral. No sponsored markers.
5. **Chips → full-pill**; selected = solid brand. **Quota pill** color logic unchanged (5–2 secondary → 1 warning gold-soft → 0 brand "Subscribe" gate).
6. **Paywall** = bottom sheet, sand canvas, gold crown, brand-gradient CTA; price block neutral (no fake scarcity). USD fine-print stays.
7. Keep all RTL logical props, ≥44pt targets, AA contrast, reduce-motion (verdict/typing) — unchanged from S1-2 §1.5.

8. **Category-first flow (NEW):** add `/categories` as the post-login landing (authed root); render 4 tiles (Electronics+Food active → `router.push('/search?cat=<id>')`; Furniture+Cars disabled). Add a header back on `/search` → `/categories`. `/search` now always takes a `cat` param.
9. **Western numerals (NEW, locked):** format ALL numbers with Latin digits regardless of locale (`-nu-latn`); never enable Arabic-Indic digit shaping; wrap numeric runs in `.num`.

> The v2 re-skin (items 1–7) and the category-first + numeral changes (items 8–9) ship together. Re-skin is additive; the category screen is one new route + a landing redirect change — low risk.
