# Memory — Branding & Visual Identity (bo-brand-designer)

> Persistent memory for the BestOffers Branding & Visual Identity.
> READ at task start. UPDATE at task end with durable facts only (decisions, current state, open items, handoffs).
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state
- **Brand identity v2.0 DONE (2026-06-26).** Reconciled to UX v2 canonical tokens (PO decision).
- **Single source of truth for all tokens:** `team/design/mockups/tokens.css`
- **Brand guidelines (v2):** `team/brand/brand-guidelines.md` — palette, type, logo, voice, do/don'ts all updated.
- **Logo assets updated to v2 palette:** `team/brand/logo-wordmark.svg`, `team/brand/app-icon.svg`
- v1 token set (Inter, #0D7A65, #F5A623, white canvas) is retired. Do not reference it.

## Key decisions (brand tokens — v2 canonical, durable)

### Color tokens (from tokens.css — verbatim)
- `--brand-primary`        → `#0B6B5B` (deep teal-evergreen; ≈10.2:1 on sand, AAA)
- `--brand-primary-strong` → `#075345` (pressed / gradient deep stop)
- `--brand-primary-soft`   → `#E3F2EE` (tinted surfaces, selected chip bg)
- `--brand-gradient`       → `linear-gradient(135deg, #0E8C74 0%, #075345 100%)`
- `--accent-gold`          → `#C8881C` (deal-gold; price/best-verdict/spark-core ONLY)
- `--accent-gold-strong`   → `#A86E0E`
- `--accent-gold-soft`     → `#FBF0D9`
- `--accent-gradient`      → `linear-gradient(135deg, #E0A93B 0%, #C8881C 100%)`
- `--bg-canvas`            → `#FBF8F3` (warm Gulf sand — screen background)
- `--bg-surface`           → `#FFFFFF` (cards, inputs)
- `--bg-surface-alt`       → `#F1ECE3` (skeletons, dividers)
- `--text-primary`         → `#18211F` (≈17.3:1 on sand, AAA)
- `--text-secondary`       → `#5C6864` (≈4.9:1 on sand, AA)
- `--text-on-brand`        → `#FFFFFF`
- `--text-on-gold`         → `#2A1D03` (≈5.0:1 on gold, AA — use this, never white on gold small)
- `--border-default`       → `#E6DFD4`
- `--border-strong`        → `#D6CDBE`
- `--state-success`        → `#1E9E6A`
- `--state-error`          → `#C8442F`
- `--state-warning`        → `#B5780A`
- `--overlay-scrim`        → `rgba(20,28,26,0.55)`

### Typography (v2 canonical)
- Display / headings / prices / CTAs: **Rubik** (400/500/600/700/800) — replaces Inter
- Arabic body + UI strings: **IBM Plex Sans Arabic** (400/500/600/700) — unchanged
- `--font-display`: `'Rubik', 'IBM Plex Sans Arabic', system-ui, sans-serif`
- `--font-body`: `'IBM Plex Sans Arabic', 'Rubik', system-ui, sans-serif`
- Source: Google Fonts; Expo: expo-font
- Price token: `--price-*` = 22px / 28px / weight 800 / Rubik; digits in `direction:ltr; unicode-bidi:isolate`
- Arabic always +2px line-height vs Latin value. Never letter-space Arabic.

### Radius (v2)
- `--r-card`: 16px (up from 12)
- `--r-chip`: 999px (full pill)
- `--r-button`: 14px; `--r-input`: 14px; `--r-sheet`: 24px

### Logo (v2 palette — assets updated)
- Spark mark: teal→deal-gold gradient (`#0B6B5B`→`#C8881C`); deal-gold circle core `#C8881C`
- Wordmark: "Best" in `#0B6B5B` Rubik 700 + deal-gold `#C8881C` underline; "Offers" in `#18211F` Rubik 700
- Arabic: "أفضل العروض" in `#5C6864` IBM Plex Sans Arabic 600; separator `#E6DFD4`
- App icon: brand-gradient bg (`#0E8C74`→`#075345`); white→`#C8881C` spark bars; `#E0A93B`→`#C8881C` core glow
- Assets: `team/brand/logo-wordmark.svg`, `team/brand/app-icon.svg`

### Voice (confirmed rules — unchanged from v1)
- Output: MSA Arabic; input: accept Kuwaiti/Gulf colloquial + AR-EN code-switching
- Lead with the answer; short sentences; active voice; no hype words; bilingual parity
- Neutrality stated positively ("we find, we don't sell")
- Dialect glossary: شنو→ما / أبي→أريد / زين→جيد / وايد→كثير / شكو→ماذا يوجد / رخيص→الأرخص

### Gold neutrality rule (non-negotiable)
Deal-gold `#C8881C` = match-quality / price-quality signal only. Never indicates paid placement. Appears on: price display, best-price verdict ribbon, spark mark core, wordmark underline accent. Nowhere else.

## Open questions / handoffs
- bo-content-creator + bo-social-media: use brand-guidelines.md §2 voice rules; palette now v2 (sand canvas, teal, deal-gold)
- bo-dev-lead / bo-dev-2: update RN theme map to tokens.css values; add Rubik via expo-font; token names unchanged
- Future sprint: dark-mode logo variant, social avatar (400×400 spark mark), Arabic-only wordmark, Lottie splash animation
- Numeral preference (Arabic-Indic vs Western) remains open — defaulted Western + KWD per UX lead
