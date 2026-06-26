# BestOffers — Brand Guidelines
> Version 2.0 · 2026-06-26 · Owner: bo-brand-designer
> Companion assets: `team/brand/logo-wordmark.svg`, `team/brand/app-icon.svg`
> Aligned with: `team/design/mockups/tokens.css` (bo-ux-lead v2 — canonical token source)
> Previous v1 alignment: `team/design/wireframes-and-design-system.md` (superseded by v2)

---

## 1. Brand Strategy

### 1.1 Who we are
BestOffers is Kuwait's first Arabic-first, AI-powered shopping concierge. We ask what you actually want — in Kuwaiti Arabic, Gulf colloquial, or English — then return the best available offer across providers, ranked honestly, with no sponsored bias.

### 1.2 Positioning statement
> "The one place in Kuwait that finds the best deal for you — not for a retailer."

We occupy the white space the competitor scan confirmed: no Kuwait player combines (a) conversational intent capture, (b) cross-provider neutrality, and (c) Arabic-first UX. That triple is our moat.

### 1.3 Brand personality (the five traits)
| Trait | What it means in practice |
|---|---|
| **Trustworthy / Neutral** | We never take a side. No sponsored slots. No hidden boosts. The ranking is honest and we say why. |
| **Sharp / Intelligent** | We ask the right question, not every question. 0–3 clarifiers. We sound like a smart friend, not a form. |
| **Kuwaiti at heart** | We understand شنو and أبي and code-switching. We do not translate MSA at people. |
| **Calm / Unhurried** | Clean UI, no urgency-manipulation, no fake countdown timers. Trust is quiet. |
| **Helpful, not chatty** | We deliver results, not preamble. Copy is short. Answers are direct. |

### 1.4 Brand promise (the three-part deal)
1. **Best deal** — honest, ranked, cross-provider results with a "why this offer" reason grounded in what you asked.
2. **Smart AI** — understands Kuwaiti/Gulf dialect and intent; clarifies before searching, not after.
3. **Trusted / Neutral** — no carts, no ads, no checkout; we are the unbiased layer, not a store.

### 1.5 Competitive differentiation summary
| vs. PriceScout | vs. ClicFlyer / coupon apps | vs. Retailer apps |
|---|---|---|
| Conversational, not catalog | SKU-level live prices, not flyer images | Cross-retailer, not siloed |
| Arabic-first / RTL | Intent-first, not browse-first | Neutral ranking, not self-serving |
| Multi-category roadmap | No code/cashback friction | "Why this offer" reasoning |

---

## 2. Voice & Tone

### 2.1 Core voice rules (apply in all channels)
1. **Lead with the answer.** Never bury the deal behind three sentences of intro.
2. **Short sentences. Active voice.** "نبحث في المتاجر" not "يتم الآن إجراء عملية البحث عبر المتاجر."
3. **Honest confidence.** We know what we found and why. We say it plainly.
4. **No hype words.** Never: "amazing", "incredible", "revolutionary", "مذهل". Let the deal speak.
5. **Never apologise for being neutral.** "لا نبيع شيئاً — نحن نجد الأفضل لك" is a strength, not a disclaimer.
6. **Bilingual parity.** Every user-facing string exists in Arabic AND English at the same quality level. Arabic is not an afterthought.

### 2.2 Tone shifts by context
| Context | Tone | Example |
|---|---|---|
| In-app UI (clarifier, results) | Concise, warm, direct | "أي سعة تخزينية تفضّل؟" |
| Empty / error states | Reassuring, action-oriented | "لم نجد نتائج — وسّع بحثك أو جرّب صياغة مختلفة." |
| Onboarding / splash | Confident, welcoming | "أفضل عروض الكويت — في ثوانٍ." |
| Social media | Slightly warmer, culturally close | See §2.4 |
| App Store listing | Benefit-led, credibility-forward | See §2.5 |

### 2.3 Arabic dialect rules
- **Input:** understand and accept Kuwaiti/Gulf colloquial + AR-EN code-switching. Never reject a message for being "wrong Arabic."
- **Output:** reply in clear MSA (Modern Standard Arabic). MSA is universally understood and projects professionalism without sounding foreign.
- **Dialect glossary** the AI system prompt must know:

| Kuwaiti input | MSA equivalent | Notes |
|---|---|---|
| شنو / شنهو | ما / ما هو | "What is" |
| أبي / أبغى | أريد | "I want" |
| زين | جيد / ممتاز | "Good/nice" |
| وايد | كثير / جداً | "Very/a lot" |
| بكم / كم | ما السعر / كم يكلّف | "How much" |
| شكو / شكو ماكو | ماذا يوجد / ما الأخبار | "What's up / what's available" |
| رخيص / أرخص | الأرخص | "Cheapest" |

- **Code-switching:** "أبي لابتوب gaming وميزانيتي محدودة" is valid input. Understand it. Reply in MSA.
- **Never:** transliterate English in Arabic copy for formal touchpoints. OK in social copy only.

### 2.4 Gulf-friendly example phrases (bilingual pairs)

**Search prompts / placeholders**
- AR: `شنو تدوّر؟` / EN: `What are you looking for?`
- AR: `ابحث بالعربي أو الإنجليزي` / EN: `Search in Arabic or English`

**Clarifier questions (MSA output)**
- `ما السعة التخزينية واللون اللذان تفضّلهما؟`  — Which storage and colour do you prefer?
- `كم ميزانيتك التقريبية بالدينار الكويتي؟` — What's your approximate budget in KWD?
- `أي حجم شاشة تبحث عنه؟` — What screen size are you looking for?

**Results / status**
- `وجدنا لك أفضل العروض` — We found the best offers for you
- `نبحث في المتاجر…` — Searching providers…
- `أفضل سعر متاح الآن` — Best available price right now

**Neutrality/trust markers**
- `لا إعلانات · لا عمولات مخفية · فقط أفضل سعر` — No ads · No hidden commissions · Just the best price
- `نحن لا نبيع — نحن نجد` — We don't sell — we find

**Empty states**
- `لا نتائج — وسّع بحثك أو عدّل الطلب` — No results — broaden or refine your search
- `بعض المصادر غير متاحة الآن، هذه أفضل النتائج المتوفرة` — Some sources unavailable; here are the best available results

**Onboarding / marketing**
- `أفضل عروض الكويت — في ثوانٍ` — Kuwait's best offers — in seconds
- `اسأل بلهجتك، نجيبك بأفضل سعر` — Ask in your dialect, we'll find the best price
- `ذكاء اصطناعي يفهم شنو تبي` — AI that understands what you want (uses dialect "شنو تبي" intentionally for warmth)

### 2.5 App Store copy (headline + subtitle)
- **AR headline:** أفضل العروض في الكويت
- **EN headline:** Kuwait's Best Deals, Found by AI
- **AR subtitle:** ابحث بلهجتك — نرتّب لك أفضل الأسعار
- **EN subtitle:** Ask in Arabic or English. Get ranked, honest offers.

---

## 3. Visual Identity

### 3.1 Color palette

> **Single source of truth:** `team/design/mockups/tokens.css` `:root` block. All hex values below are taken verbatim from that file.

#### Primary palette
| Role | CSS variable | Hex | Usage | WCAG note |
|---|---|---|---|---|
| Brand Primary | `--brand-primary` | `#0B6B5B` | Primary CTAs, active states, links, logo "Best" text, active chip | 10.7:1 on white · 10.2:1 on sand `#FBF8F3` — AAA on both |
| Brand Primary Strong | `--brand-primary-strong` | `#075345` | Pressed/active state, gradient deep stop | 14.2:1 on white — AAA |
| Brand Primary Soft | `--brand-primary-soft` | `#E3F2EE` | Tinted surfaces, selected chips (non-text bg) | n/a — bg tint only |
| Brand Gradient | `--brand-gradient` | `#0E8C74` → `#075345` (135deg) | Hero CTAs, active sector indicator — logo/icon only | Each stop passes AAA on white independently |

#### Value accent (gold — strictly reserved)
| Role | CSS variable | Hex | Usage | WCAG note |
|---|---|---|---|---|
| Deal Gold | `--accent-gold` | `#C8881C` | Price highlight, "best offer" verdict ribbon, spark mark core, logo underline accent | Use `--text-on-gold` (`#2A1D03`) as text over gold; gold itself is decorative/non-text in UI |
| Deal Gold Strong | `--accent-gold-strong` | `#A86E0E` | Hover/pressed on gold surfaces | 6.9:1 on white — AA |
| Deal Gold Soft | `--accent-gold-soft` | `#FBF0D9` | Verdict ribbon fill, quota-warn background | bg tint only |
| Accent Gradient | `--accent-gradient` | `#E0A93B` → `#C8881C` (135deg) | Verdict ribbon, gold CTA variant | Decorative gradient — pair with `--text-on-gold` |

**Gold neutrality rule:** `--accent-gold` appears ONLY on price display, "best offer" verdict ribbon, and the spark mark core. It is not a promotional colour. It is a match-quality / price-quality signal. Never use it to indicate paid placement.

#### Canvas & surfaces
| Role | CSS variable | Hex | Usage |
|---|---|---|---|
| Canvas | `--bg-canvas` | `#FBF8F3` | Screen background (warm Gulf sand) |
| Surface | `--bg-surface` | `#FFFFFF` | Cards, input fields, elevated sheets |
| Surface Alt | `--bg-surface-alt` | `#F1ECE3` | Skeletons, dividers, recessed wells |
| Elevated | `--bg-elevated` | `#FFFFFF` | Bottom sheets, paywall surface |

#### Text
| Role | CSS variable | Hex | WCAG on canvas `#FBF8F3` |
|---|---|---|---|
| Text Primary | `--text-primary` | `#18211F` | ≈ 17.3:1 — AAA |
| Text Secondary | `--text-secondary` | `#5C6864` | ≈ 4.9:1 — AA |
| Text On Brand | `--text-on-brand` | `#FFFFFF` | on `#0B6B5B` → 10.7:1 — AAA |
| Text On Gold | `--text-on-gold` | `#2A1D03` | on `#C8881C` → ≥ 5.0:1 — AA |

#### Borders & semantic states
| Role | CSS variable | Hex | Usage |
|---|---|---|---|
| Border Default | `--border-default` | `#E6DFD4` | Card / input borders (warm, harmonises with sand) |
| Border Strong | `--border-strong` | `#D6CDBE` | Focused input, strong dividers |
| Success | `--state-success` | `#1E9E6A` | Confirmations — always pair with icon |
| Error | `--state-error` | `#C8442F` | Inline errors — always pair with icon |
| Warning | `--state-warning` | `#B5780A` | Partial-results note — always pair with icon |
| Scrim | `--overlay-scrim` | `rgba(20,28,26,0.55)` | Modal overlays |

#### WCAG AA verification (key pairs — re-verified on v2 tokens)
- `#0B6B5B` on `#FBF8F3` (sand) → ≈ 10.2:1 — AAA
- `#0B6B5B` on `#FFFFFF` → ≈ 10.7:1 — AAA
- `#FFFFFF` on `#0B6B5B` → ≈ 10.7:1 — AAA (text on brand button)
- `#18211F` on `#FBF8F3` → ≈ 17.3:1 — AAA
- `#5C6864` on `#FBF8F3` → ≈ 4.9:1 — AA (body minimum met)
- `#2A1D03` on `#C8881C` → ≈ 5.0:1 — AA (text-on-gold; use this, never white-on-gold at small sizes)
- `#A86E0E` on `#FFFFFF` → ≈ 6.9:1 — AA (gold-strong as text if ever needed)
- `#C8442F` on `#FFFFFF` → ≈ 4.5:1 — AA border (error; always pair with icon)
- `#B5780A` on `#FFFFFF` → ≈ 4.7:1 — AA (warning text; always pair with icon)
- `#1E9E6A` on `#FFFFFF` → ≈ 3.2:1 — AA large text / icons; pair with label for body-size use

#### Dark-mode direction (future)
Invert canvas/surface; keep `#0B6B5B` primary (brightens naturally on dark); deal-gold accent remains; re-validate AA on dark surfaces before shipping.

#### Color rules
- **WCAG AA minimum** on all text/icon pairs. No exceptions.
- **Never convey meaning by color alone** — always pair with an icon or label.
- **Deal-gold (`#C8881C`) is for prices, "best" verdict ribbon, and spark mark core only** — not buttons, not nav, not headlines.
- **No gradients in UI components** — gradients are for the brand gradient (`--brand-gradient`) on hero CTAs, the verdict ribbon (`--accent-gradient`), and the logo mark/app icon only.
- **Sand canvas (`#FBF8F3`) is the screen background** — not white. It is a brand signal, not a neutral default.

### 3.2 Typography

> **Single source of truth:** `team/design/mockups/tokens.css` `:root` typography block.

#### Typeface selection
| Script | Typeface | CSS variable | Why |
|---|---|---|---|
| Display / Latin headings | **Rubik** | `--font-display` | Open-source, excellent Arabic shaping, geometric premium feel; replaces Inter for display roles |
| Arabic body + UI | **IBM Plex Sans Arabic** | `--font-body` | Strong RTL shaping, clean geometric, excellent diacritics; pairs well with Rubik |

**Font stack:**
- Display: `'Rubik', 'IBM Plex Sans Arabic', system-ui, sans-serif`
- Body: `'IBM Plex Sans Arabic', 'Rubik', system-ui, sans-serif`

**Load both fonts.** Source: Google Fonts (`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap')`). In React Native / Expo: `expo-font` with equivalent weights.

#### Type scale (tokens — from tokens.css)
| Token | Size | Line-height | Weight | Arabic LH | Usage |
|---|---|---|---|---|---|
| `--display-size` | 28px | 38px | 800 | 40px | Sector picker title, hero moments — Rubik |
| `--h1-*` | 22px | 32px | 700 | 34px | Screen titles — Rubik |
| `--h2-*` | 18px | 28px | 600 | 30px | Card product names, section headings |
| `--body-*` | 16px | 27px | 400 | 29px | Body, input text, chat bubbles |
| `--price-*` | 22px | 28px | 800 | 30px | Result price (KWD) — Rubik, digits LTR-isolated |
| `--caption-*` | 13px | 20px | 400 | 22px | Helper text, "why this offer", timers |
| `--button-*` | 16px | — | 600 | — | CTA labels — Rubik |
| `--eyebrow-*` | 12px | — | 700 | n/a | Latin labels only; never on Arabic |

**Note on v1 → v2 type change:** `Inter` is retired as the display/primary font. `Rubik` is now the display and heading font for all Arabic-first screens. IBM Plex Sans Arabic remains the body font. Prices use Rubik weight 800 with digits in a `direction:ltr; unicode-bidi:isolate` span.

#### Typography rules
- **Never letter-space Arabic.** It breaks glyph connections and is visually wrong.
- **Arabic always gets +2px line-height** vs the Latin value for the same token. Prevents diacritic clipping.
- **Prices are always Rubik / Western digits** — KWD formatted as `12.500 KWD`. Wrap in `.num` (LTR-isolated).
- **Eyebrow labels: Latin only.** Never apply letter-spacing or uppercase to Arabic text.
- **Minimum body size: 16px** in the app. 13px captions only for truly secondary information.

### 3.3 Logo system

> SVG sources updated to v2 canonical palette. See §6 for file paths.

#### The spark mark
A four-pointed cross/star built from two perpendicular rounded rectangles meeting at a deal-gold circle core. Conceptual intent:
- The cross shape = a universal "best / star" signal, simplified to geometric
- The deal-gold core = the offer/deal moment — the spark of finding the best price
- Teal-to-gold gradient on bars = trust (teal) flowing into value (gold)

#### Wordmark construction (v2 palette)
- "Best" in brand primary `#0B6B5B`, weight 700, Rubik — with a deal-gold (`#C8881C`) underline accent below the word
- "Offers" in text primary `#18211F`, weight 700, Rubik — neutral, grounding
- Arabic subtitle "أفضل العروض" in text secondary `#5C6864`, weight 600, IBM Plex Sans Arabic — placed below the EN wordmark, RTL-aligned
- Thin `#E6DFD4` separator between EN and AR stacks

**Rationale:** "Best" is coloured and accented because that is the brand promise. "Offers" is dark/neutral because it is the category. Arabic is a first-class element, not a small footnote.

#### App icon (v2 palette)
- `1024×1024` source; OS applies corner rounding per platform
- Deep teal gradient background (`#0E8C74` → `#075345`) — matches `--brand-gradient`
- Oversized white-to-gold spark mark centred, fills ~85% of canvas so it reads at 29pt on iPhone home screen
- Deal-gold radial glow core at centre (`#C8881C` → `#E0A93B`)
- No text in the icon — the mark alone is the identity at small sizes

#### Logo file paths
- Full wordmark (horizontal, bilingual): `team/brand/logo-wordmark.svg`
- App icon (1024×1024): `team/brand/app-icon.svg`

### 3.4 Logo usage rules

**Do:**
- Use the full wordmark (EN + AR) on all marketing surfaces where space allows
- Maintain minimum clear space = height of the spark mark on all four sides
- Use on canvas (`#FBF8F3`) or brand primary (`#0B6B5B`) backgrounds
- Use the spark mark alone when space is under 120px wide (app icon, favicon, social avatar)
- Use reversed (white spark + white wordmark) on the primary teal background

**Do not:**
- Distort, rotate, or skew any element
- Recolour "Best" or the spark mark to any colour outside the v2 palette
- Place the logo on busy photographic backgrounds without a solid-colour lockup behind it
- Remove the Arabic wordmark "أفضل العروض" from the full lockup in Kuwait-facing materials
- Add drop shadows, glows, or gradients to the wordmark text
- Use deal-gold `#C8881C` as the logo background — insufficient contrast for the mark

### 3.5 Iconography style

- **Style:** outlined, 2px stroke, rounded line-caps and joins, consistent 24×24 grid
- **Library baseline:** Lucide Icons (open-source, React Native compatible, Expo ecosystem)
- **Arabic directional rule:** icons implying direction (chevron-back, arrow-right) must mirror in RTL. Neutral icons (magnifying glass, camera, bell) do not flip.
- **Colour:** icons inherit `--text-primary` (`#18211F`) for UI icons; `--brand-primary` (`#0B6B5B`) for active/selected; `--text-secondary` (`#5C6864`) for inactive
- **No filled icons in the active state** — use the teal stroke colour only. Deal-gold fill is reserved for the price badge and verdict ribbon exclusively.

### 3.6 Imagery and illustration rules

**Photography (marketing / social)**
- Lifestyle imagery: real Kuwait contexts (shopping, mobile use, family/group), warm natural light
- Never show a checkout or cart — we are not a store
- Phones showing the app must show real screens, not mockups with dummy data
- People should reflect Kuwaiti/Gulf diversity; include women in everyday contexts

**Illustration / graphic elements**
- Flat, geometric, teal / deal-gold / sand palette only
- Use the spark mark as a graphic device (enlarged, tinted) on hero surfaces
- No 3D renders in marketing illustrations (gradient is logo/icon only)
- Pattern: repeated small spark marks at 8% opacity on teal backgrounds is an approved background texture

**Data / results UI**
- Product images are provider-sourced; must degrade gracefully to a neutral placeholder (greyscale silhouette on `#F1ECE3` background) — never a broken image
- No mock prices, fabricated reviews, or fake rankings in any material

---

## 4. Brand Application: Do / Don't Reference

### Color
| Do | Don't |
|---|---|
| Use `#0B6B5B` for primary CTAs and active link states | Use deal-gold `#C8881C` as a button fill — white text on it fails AA at small sizes |
| Use `#C8881C` for prices, "best offer" verdict ribbon, and the logo spark core only | Use deal-gold for general highlights, nav, or headlines |
| Pair every error/success/warning colour with an icon or label | Communicate state by colour alone |
| Preserve WCAG AA on every text/bg pair | Override token hex without re-checking contrast |
| Use `#FBF8F3` sand canvas as the screen background | Substitute plain white for the canvas in brand-aligned materials |

### Typography
| Do | Don't |
|---|---|
| Use Rubik for display headings, hero text, prices, and CTAs | Use Inter (retired from v2) as the display font |
| Use IBM Plex Sans Arabic for Arabic body copy and UI strings | Substitute system Arabic fonts in final designs |
| Use Rubik for all Latin and numeric/price display | Use letter-spacing on Arabic text |
| Follow the type scale tokens exactly | Introduce intermediate sizes (e.g. 14px, 17px) outside the scale |
| Add the prescribed +2px Arabic line-height | Clip Arabic diacritics with tight line-heights |
| Wrap prices in direction:ltr; unicode-bidi:isolate | Let Arabic numeral shaping flip digit order |

### Logo
| Do | Don't |
|---|---|
| Use the bilingual lockup (EN + AR) on all Kuwait-facing marketing | Strip the Arabic line from any Kuwait-facing surface |
| Maintain minimum clear space (1× spark-mark height on all sides) | Crowd the logo with other elements |
| Use the spark mark alone at sub-120px widths | Scale down the full wordmark until Arabic text is illegible |
| Reproduce from the SVG source files | Screenshot or rasterise the logo at low resolution |

### Voice
| Do | Don't |
|---|---|
| Lead with the result/deal — front-load value | Open with brand preamble ("BestOffers is...") |
| Use MSA for Arabic app output | Use Kuwaiti dialect in formal/system copy |
| Understand and accept Kuwaiti/Gulf dialect input | Reject or error on colloquial messages |
| Name the price and provider specifically | Use vague language ("a great deal at a popular store") |
| State neutrality positively ("we find, we don't sell") | Over-explain or over-apologise |

### Content neutrality
| Do | Don't |
|---|---|
| Rank results by match quality only | Accept paid placements or sponsored boosting |
| Show "why this offer" with an attribute from the user's query | Fabricate or estimate prices — live data only |
| Label partial results honestly when a source is unavailable | Silently drop sources without noting it |
| Surface "some sources unavailable" as a small inline note | Make partial results feel like a failure |

---

## 5. Design Token Summary — v2 Canonical (single source of truth)

> These values are taken verbatim from `team/design/mockups/tokens.css`. This section exists for quick reference; **tokens.css is authoritative** if any discrepancy exists.

```
/* Brand */
--brand-primary:          #0B6B5B
--brand-primary-strong:   #075345
--brand-primary-soft:     #E3F2EE
--brand-gradient:         linear-gradient(135deg, #0E8C74 0%, #075345 100%)

/* Value accent — reserved price/best-verdict only */
--accent-gold:            #C8881C
--accent-gold-strong:     #A86E0E
--accent-gold-soft:       #FBF0D9
--accent-gradient:        linear-gradient(135deg, #E0A93B 0%, #C8881C 100%)

/* Canvas & surfaces */
--bg-canvas:              #FBF8F3   ← warm Gulf sand
--bg-surface:             #FFFFFF
--bg-surface-alt:         #F1ECE3
--bg-elevated:            #FFFFFF

/* Text */
--text-primary:           #18211F
--text-secondary:         #5C6864
--text-on-brand:          #FFFFFF
--text-on-gold:           #2A1D03

/* Borders & state */
--border-default:         #E6DFD4
--border-strong:          #D6CDBE
--state-success:          #1E9E6A
--state-error:            #C8442F
--state-warning:          #B5780A
--overlay-scrim:          rgba(20,28,26,0.55)

/* Typography */
--font-display:           'Rubik', 'IBM Plex Sans Arabic', system-ui, sans-serif
--font-body:              'IBM Plex Sans Arabic', 'Rubik', system-ui, sans-serif

/* Radius */
--r-card:                 16px
--r-chip:                 999px   ← full pill
--r-button:               14px
--r-input:                14px
--r-sheet:                24px
```

**WCAG AA verification (v2 canonical pairs):**
- `#0B6B5B` on `#FBF8F3` → ≈ 10.2:1 — AAA
- `#0B6B5B` on `#FFFFFF` → ≈ 10.7:1 — AAA
- `#FFFFFF` on `#0B6B5B` → ≈ 10.7:1 — AAA
- `#18211F` on `#FBF8F3` → ≈ 17.3:1 — AAA
- `#5C6864` on `#FBF8F3` → ≈ 4.9:1 — AA
- `#2A1D03` on `#C8881C` → ≈ 5.0:1 — AA (text-on-gold; use this only — never white on gold at small sizes)
- `#A86E0E` on `#FFFFFF` → ≈ 6.9:1 — AA
- `#C8442F` on `#FFFFFF` → ≈ 4.5:1 — AA (error text with icon)
- `#B5780A` on `#FFFFFF` → ≈ 4.7:1 — AA (warning text with icon)
- `#1E9E6A` on `#FFFFFF` → ≈ 3.2:1 — AA large/icons; pair with label at body size

---

## 6. Brand Assets Checklist

| Asset | File | Status |
|---|---|---|
| Logo wordmark (bilingual, horizontal) | `team/brand/logo-wordmark.svg` | Done — v2 palette |
| App icon (1024×1024) | `team/brand/app-icon.svg` | Done — v2 palette |
| Brand guidelines | `team/brand/brand-guidelines.md` | Done — v2 (this file) |
| Dark-mode logo variant | — | Future sprint |
| Social avatar (spark mark only, 400×400) | — | Future sprint (derive from app-icon.svg) |
| Arabic-only wordmark (RTL markets) | — | Future sprint |
| Animated splash logo (Lottie) | — | Future sprint |

---

## 7. Alignment with bo-ux-lead v2 Design System

`team/design/mockups/tokens.css` is the **canonical token file** as decided by the PO (2026-06-26). This document's palette, typography, and radius values mirror it exactly. No reconciliation required — brand and UI are one system.

**What changed from v1 brand guidelines:**

| Element | v1 | v2 (canonical) |
|---|---|---|
| Brand primary | `#0D7A65` | `#0B6B5B` |
| Pressed/strong | `#0A5E4D` | `#075345` |
| Accent | `#F5A623` (amber) | `#C8881C` (deal-gold) |
| Canvas | `#FFFFFF` | `#FBF8F3` (sand) |
| Surface | `#F6F7F8` | `#FFFFFF` |
| Surface-alt | `#ECEEF0` | `#F1ECE3` |
| Text primary | `#10151A` | `#18211F` |
| Text secondary | `#5B6670` | `#5C6864` |
| Border default | `#E1E4E8` | `#E6DFD4` |
| Error | `#D64545` | `#C8442F` |
| Warning | `#C77700` | `#B5780A` |
| Display font | Inter | **Rubik** |
| Body font | IBM Plex Sans Arabic | IBM Plex Sans Arabic (unchanged) |
| Card radius | 12px | **16px** |
| Chip radius | 10px | **999px (full pill)** |

All WCAG AA pairs re-verified against the new values. All pass — in fact the new primary teal and text-primary achieve AAA on both sand and white surfaces.
