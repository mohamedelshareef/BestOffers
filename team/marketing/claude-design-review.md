# Claude Design REVAMP — Marketing Review (brand · positioning · copy)

> Reviewer: bo-marketing-lead · 2026-06-27
> Scope: brand expression, positioning, copy, and App Store/landing — the marketing-owned aspects only. UX/component review is bo-ux-lead's.
> Files reviewed (all opened/read in `ClaudeDesigne/`): `BestOffers Revamp.dc.html` (index), `BestOffers Prototype.dc.html` (app spine), `BestOffers Landing.dc.html`, `BestOffers App Store.dc.html`.
> Claim legend: **VERIFIED** = read directly in the file / sourced from brand+brief · **ASSUMED** = my hypothesis to validate.
> Sources of truth: `ClaudCodeDesign.md` §1–§6/§11, `team/brand/brand-guidelines.md` v2.

---

## TL;DR verdict

**Strong adopt with two must-fix blockers.** The revamp lands the positioning, the gold-verdict signature, the neutrality story, and AR-first/RTL convincingly. Two issues must be fixed before any public use:

1. **WRONG FONTS in all 4 files** — loads **Plus Jakarta Sans + Tajawal**, not the brand's **Rubik + IBM Plex Sans Arabic**. The Revamp index even *claims* "Rubik + IBM Plex" in its own system panel while loading the wrong fonts. **BLOCKER — brand-identity violation.** **VERIFIED**
2. **Fabricated App Store credibility stats** — "4.9 · 2.3K Ratings · #1 Shopping · 4+ Years Old." The app is unlaunched; these are invented. **BLOCKER — truthfulness violation (guardrail #1; brand §3.6 "no fabricated reviews/rankings").** **VERIFIED**

Everything else is on-brand or a minor fix. Detail below.

---

## 1. Brand fit

### On-brand (adopt) — VERIFIED
- **Palette is exact.** Every file declares the v2 tokens verbatim: teal `#0B6B5B`/`#075345`/`#E3F2EE`, deal-gold `#C8881C`/`#E0A93B`/`#FBF0D9`, sand canvas `#FBF8F3`, surface `#FFFFFF`, surface-alt `#F1ECE3`, ink `#18211F`/`#5C6864`, on-gold `#2A1D03`, borders `#E6DFD4`/`#D6CDBE`, the two brand gradients. No off-palette colors introduced in the product UI.
- **Gold discipline is correct — the hardest brand rule, passed.** Gold appears ONLY on price values and the verdict ribbon, nowhere else (nav, CTAs, headlines all stay teal/ink). The hero "Find the best offer" CTA is the teal gradient, not gold. This is the single most-violated rule in deal apps and the revamp respects it across all screens. Excellent.
- **Sand canvas as background**, not white — the brand signal is honored on every phone screen and the landing body.
- **Verdict ribbon = the signature, nailed.** Gold-gradient ribbon + check + intent-grounded one-line reason crowning rank #1, with `--shadow-lift`-style elevation. It reads as *earned/premium*, not a "SALE" shout. This is exactly §6.3.
- **Neutrality is visible and quiet.** "بلا إعلانات مدفوعة · ترتيب محايد" on categories; "ترتيب محايد · بلا نتائج مموّلة" footer on results; trust strip on landing. No sponsored lanes, no ad slots, no fake countdowns. Matches §6.2 pillar 2.
- **AR-first/RTL by construction.** Prototype renders AR and EN phones side-by-side, `dir` flips, logical props (`inset-inline-*`, `margin-inline-*`), directional icons mirror via `scaleX(-1)`, neutral icons (search/mic/Instagram) don't. Western numerals everywhere, prices LTR-isolated (`direction:ltr;unicode-bidi:isolate`), KWD 3-decimal `412.000`. This is the brand's #1 differentiator and it's done right.
- **No generic-AI tropes.** No purple gradients, no robot avatars, no "Powered by AI" badge. The conversation is branded (teal bubbles, chips, sharp MSA). Anti-reference avoided.
- **Spark mark** present and roughly correct (two perpendicular rounded bars + gold core) on app icon, nav, footer.
- Radius tokens correct: card 16, chip 999 (full pill), button 14, sheet-ish 18–24, input 14-ish.

### Off-brand (must fix) — VERIFIED
- **FONTS (BLOCKER).** All four files load `Plus Jakarta Sans` + `Tajawal` and set `--disp`/`--body` to them. Brand §3.2 mandates **Rubik** (display + Latin + prices) and **IBM Plex Sans Arabic** (Arabic body/UI); Inter is retired and these two are non-negotiable. The Revamp index `system` panel literally says *"Rubik for display & prices · IBM Plex Sans Arabic for body"* while the CSS loads neither — a self-contradiction that proves the substitution was unintended. **Tajawal in particular is a different Arabic voice than IBM Plex Sans Arabic** and changes the Gulf-premium feel. Must swap the `@import` and the `--disp`/`--body` stacks to the brand pair in all 4 files.
- **Headings bind to `--body`, not `--disp`** in several large headings (landing `h1/h2`, prototype screen `<h1>`). Even once fonts are fixed, display/hero type must be the display font (Rubik) per §3.2. Low effort, important for the premium feel.

### ASSUMED (validate)
- The substitution was likely a tooling/availability constraint in the design run (Rubik/IBM Plex not loaded), not a deliberate brand decision — the index panel naming the correct fonts supports this. Treat as a find-and-replace fix, not a redesign.

---

## 2. Copy review

### On-message (adopt) — VERIFIED against brand §2 voice rules
- **Positioning line lands**, bilingual, verbatim-aligned: Landing AR `المكان الوحيد الذي يجد أفضل صفقة لك — لا لتاجر` / EN "One place that finds the best deal for you — not for a retailer." Matches brand §1.2.
- **One-line pitch** matches the brief: "Ask in your dialect — get the best offer in Kuwait, ranked honestly" / `اسأل بلهجتك — نجيبك بأفضل سعر` (landing hero `اسأل بلهجتك — نجيبك...` variant). On-brand.
- **Three-part deal** reproduced cleanly: Best deal · Smart AI · Trusted & neutral, each with the right body copy. Matches brand §1.4.
- **Neutrality stated positively**, never apologetic: "نحن لا نبيع — نحن نجد" footer; "بلا سلّة، بلا دفع، بلا إعلانات." Matches voice rule #5.
- **No hype words.** Scanned for مذهل / amazing / revolutionary / incredible — none present. Voice rule #4 passed.
- **Dialect-in / MSA-out modeled correctly.** Input examples use Kuwaiti (`شنو تبي تلقّى اليوم؟`, `لابتوب gaming بميزانية محدودة`, code-switch retained); system/clarifier output is clean MSA (`كم ميزانيتك التقريبية؟`, `نضبط بحثك`). Matches §2.3.
- **Trust markers verbatim:** `بلا إعلانات · بلا عمولات مخفية · فقط أفضل سعر`. Matches brand §2.4.
- **Pricing copy is honest:** "Billed in USD. KWD prices shown in-app — no FX surprises" / `يُحصّل بالدولار الأمريكي... بلا مفاجآت صرف` — exactly the transparency the paywall brief (§8.6) demands. Adopt.
- **Verdict reasons are intent-grounded and truthful in shape:** "512GB black — matches your ask" / `512GB أسود — مطابق لطلبك`; "18.000 KWD below average"; food "3.000 KWD less for the same platter." These reference real attributes the user asked for — correct pattern (these are illustrative sample data, acceptable in a mockup).
- **App Store headline/subtitle match brand §2.5 verbatim:** AR `أفضل العروض في الكويت`, EN "Kuwait's Best Deals, Found by AI", AR subtitle `ابحث بلهجتك — نرتّب لك أفضل الأسعار`, EN "Ask in Arabic or English. Get ranked, honest offers." (subtitle rendered as the longer Arabic-first variant — fine).
- **App Store long description is on-voice and truthful** — leads with the answer, states "We are not a store. No cart, no checkout, no ads," frames Instagram offers as "priced truthfully, never invented." Strong.

### Copy fixes — flag
- **[BLOCKER · truthfulness] App Store stats strip fabricates social proof.** `4.9 · 2.3K Ratings`, `#1 Shopping`, `4+ Years Old` are invented for an unlaunched product. This violates guardrail #1 and brand §3.6/§4 content-neutrality ("no fabricated reviews or fake rankings in any material"). **Fix:** for a pre-launch listing, replace ratings/age/#1 with truthful, non-fabricated facts — e.g. "New", "AR · EN", "Kuwait", "Shopping", "38 MB" — or drop the ratings tile entirely until real reviews exist. Keep the `4+` *age-rating* only if it means the content rating (it currently reads "Years Old," which implies tenure — reword to "Age Rating · 4+").
  - Note: the prototype settings screen uses sample user data (Reem Al-Anzi, "Pro", renews May 12) — that is acceptable placeholder content *inside a product mockup*, not a public truth claim. The App Store stats are different: they are public marketing claims and must be true.
- **[Medium] "$1 / month" hero number** is gold-adjacent and large on the landing pricing block — confirm $1/mo is the PO-agreed, real price before this goes public (brief §8.6 uses "$1/شهرياً", so consistent — just flagging it as a real commercial claim, not copy to invent). **ASSUMED** it's ratified; confirm with PO.
- **[Low] "iPhone 17 Pro Max" sample** — fictional/forward model used as demo data. Fine for a mockup; if any of these screenshots ship to the actual App Store listing, swap to a real, currently-purchasable product so the listing isn't showing a product that doesn't exist (truthfulness of *marketing screenshots*). **ASSUMED**
- **[Low] Landing hero `h1` uses `--body`** (also a font issue) — once Rubik is in, ensure the hero headline is display weight. Copy itself is good.

---

## 3. Differentiation

**Distinctive — adopt. VERIFIED.**
- **Does NOT read as generic-AI.** No chat-app sameness: branded teal bubbles, chip-first clarifier, "N of 5" bounded progress, no robot mascot, no purple, no "AI" badge. The conversation is a *means*, per pillar 4.
- **Does NOT read as a retailer storefront or coupon feed.** No dense grids, no banner stacks, no red SALE, no percentage-off shouting, no ad tiles. Calm sand canvas + generous spacing + one accent. Avoids all three anti-reference looks (§3 "competitor looks to avoid").
- **The "best-price verdict" signature is the ownable moment and it's unmistakable** — gold ribbon + reason on rank #1, echoed as the hero on the landing ("The best-price verdict") and as screenshot #4 on the App Store ("see why it won"). The brand's signature is consistent across product, web, and store. This is the screenshot people share (§6.3) and the revamp builds the whole narrative around it. Excellent differentiation.
- **IG-offer card is a genuine differentiator and handled truthfully** — handle-as-provider (`@grill_house_kw`), Instagram glyph, recency chip ("Instagram · 2 days ago"), "View on Instagram" CTA, and the **price-on-request** path renders a secondary non-gold label ("السعر بالخاص — شوف البوست / Price on request — see post") — never a fabricated price, and a price-on-request card does NOT win the gold ribbon. This nails brief §8.5 + constraint #6 and is the cross-provider-neutral story competitors can't tell.

**Gap:** the *only* thing undercutting distinctiveness is the wrong typeface — Plus Jakarta + Tajawal is a more generic, common pairing; Rubik + IBM Plex Sans Arabic is part of what makes BestOffers look like itself. Fix the fonts and the distinctiveness is fully intact.

---

## 4. Adopt / Fix / Reject (marketing-owned)

| # | Item | Verdict | Action | Owner |
|---|---|---|---|---|
| 1 | Palette / token system (all files) | **ADOPT** | None — exact to v2 | — |
| 2 | Gold discipline (price + verdict only) | **ADOPT** | None — correct | — |
| 3 | Verdict-ribbon signature | **ADOPT** | None — it's the hero, nailed | — |
| 4 | Neutrality/trust copy + markers | **ADOPT** | None — on-voice, positive | — |
| 5 | AR-first/RTL + Western numerals | **ADOPT** | None — by construction | — |
| 6 | IG card + price-on-request truthfulness | **ADOPT** | None — truthful, differentiating | — |
| 7 | Positioning / 3-part deal / pitch copy | **ADOPT** | None — verbatim-aligned | — |
| 8 | **Fonts: Plus Jakarta + Tajawal** | **FIX (BLOCKER)** | Swap `@import` + `--disp`/`--body` to **Rubik + IBM Plex Sans Arabic** in all 4 files; bind hero/display headings to `--disp` | bo-dev-lead / Claude Design |
| 9 | **App Store fabricated stats (4.9·2.3K·#1·"4+ yrs")** | **FIX (BLOCKER)** | Replace with truthful pre-launch facts or remove ratings tile until real reviews exist; reword "4+ Years Old" → "Age Rating · 4+" | bo-content-creator (copy) + bo-dev-lead (markup) |
| 10 | Revamp index claims "Rubik/IBM Plex" while loading wrong fonts | **FIX** | Resolves automatically with #8 | bo-dev-lead |
| 11 | "$1/month" + "iPhone 17 Pro Max" as public claims | **CONFIRM** | PO confirms $1 price is real; swap demo product to a real one *if* these screenshots ship to the store | PO / bo-marketing-lead |
| 12 | Landing/store headings on `--body` | **FIX (minor)** | Bind to `--disp` after font swap | bo-dev-lead |

**Reject:** nothing. No element needs to be thrown out.

---

## What content / brand / dev should change (prioritized)
1. **DEV (blocker):** font swap to Rubik + IBM Plex Sans Arabic across all 4 files; display headings → `--disp`. This is a ~4-line edit per file (the `@import` href + two CSS vars) plus heading bindings.
2. **CONTENT (blocker):** rewrite the App Store stats strip to remove invented ratings/rankings/tenure; keep only truthful pre-launch facts. Provide AR+EN parity.
3. **BRAND:** ratify the corrected fonts render correctly in Arabic (IBM Plex Sans Arabic shaping/diacritics + Rubik prices) before sign-off — bo-brand-designer.
4. **PO:** confirm $1/mo is the real committed price; decide whether mockup screenshots (with the fictional iPhone 17 / sample providers) will ship to the live store listing or be replaced with real-product captures.

---

## Handoff
- **Done:** Reviewed all 4 Claude Design revamp files for brand/positioning/copy/truthfulness. **Verdict: strong ADOPT with 2 BLOCKERS.** On-brand: palette exact, gold discipline correct, verdict-ribbon signature nailed, neutrality + AR-first/RTL + Western-numeral truthfulness all honored, copy verbatim-aligned to brand §1–§2, IG price-on-request truthful, distinctive vs all 3 anti-reference looks. **2 BLOCKERS:** (1) wrong fonts — Plus Jakarta Sans + Tajawal loaded instead of brand-mandated Rubik + IBM Plex Sans Arabic in ALL 4 files (index even mislabels itself); (2) fabricated App Store credibility stats (4.9 rating / 2.3K ratings / #1 Shopping / "4+ Years Old") on an unlaunched app — truthfulness violation. No element rejected. Review at `team/marketing/claude-design-review.md`. Memory updated. No git commit.
- **Next:** (1) bo-dev-lead / Claude Design — font swap to Rubik + IBM Plex Sans Arabic + bind display headings to `--disp` in all 4 files; (2) bo-content-creator — rewrite App Store stats strip to truthful pre-launch facts (AR+EN parity); (3) bo-brand-designer — ratify corrected Arabic font rendering; (4) PO — confirm $1/mo real price + decide if mockup screenshots ship to the live store or get real-product captures.
- **Owner:** PO to route fixes to bo-dev-lead (fonts), bo-content-creator (store stats), bo-brand-designer (ratify).
- **Blockers/risks:** Do NOT publish the App Store listing or landing with the current fonts or the fabricated stats — both violate brand/truthfulness guardrails. Until fixed, the revamp is internally-demoable but not publishable.
