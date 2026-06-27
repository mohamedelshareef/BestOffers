# Memory — Content Creator (bo-content-creator)

> Persistent memory for the BestOffers Content Creator.
> READ at task start. UPDATE at task end with durable facts only (decisions, current state, open items, handoffs).
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state
- App Store listing copy (AR + EN) delivered: `team/marketing/app-store-copy.md` (2026-06-27).
- Fabricated stats removed from `.dc.html` mockup copy; replaced with truthful pre-launch fields (see Decisions below).

## Key decisions

### Approved copy assets (brand-guidelines §2.5 — VERIFIED)
- **AR app name:** بست أوفرز
- **EN app name:** BestOffers
- **AR subtitle (30-char):** ابحث بلهجتك — أفضل أسعار الكويت (29 chars)
- **EN subtitle:** "Kuwait's Best Deals, Found by AI" (34 chars — confirm Apple enforces 30; trimmed fallback: "Kuwait Deals, Found by AI" = 25 chars)
- **AR headline (brand):** أفضل العروض في الكويت
- **EN headline (brand):** Kuwait's Best Deals, Found by AI
- **Positioning tagline (AR):** نحن لا نبيع — نحن نجد
- **Positioning tagline (EN):** We don't sell — we find.
- **One-line pitch (AR):** اسأل بلهجتك، نجيبك بأفضل سعر
- **One-line pitch (EN):** Ask in your dialect — get the best offer in Kuwait, ranked honestly, in seconds.

### Removed fabrications (never to reappear in any public asset)
- 4.9 rating / 2.3K Ratings / 2.3 ألف تقييم — invented; app is unlaunched, zero reviews exist.
- "#1 Shopping" / "#1 تسوّق" — no chart position held; claiming one is false advertising.
- "4+ Years Old" / "سنوات" as a sub-label implying tenure — the "4+" content age rating is valid but must be labeled "Age Rating" / "التصنيف العمري", not "Years Old".

### Stats strip — truthful pre-launch fields (EN | AR)
| Field | EN value | EN sub | AR value | AR sub |
|---|---|---|---|---|
| Size | 38 MB | iOS · Android | 38 MB | iOS · Android |
| Category | Shopping | Kuwait | تسوّق | الكويت |
| Languages | AR · EN | Arabic-first | AR · EN | عربي أولاً |
| Age Rating | 4+ | Content | 4+ | المحتوى |
| Price | Free | $1/mo after | مجاني | $1/شهر بعدها |

### Voice reminders
- No hype words: never "amazing / incredible / revolutionary / مذهل".
- Lead with the answer; short sentences; active voice.
- Arabic output = MSA (accept Kuwaiti/Gulf dialect input, reply in MSA).
- Neutrality stated positively, never apologetically.
- Bilingual parity: Arabic is not an afterthought.
- No invented stats, ratings, rankings, or savings claims in any copy asset.

### ASO keywords (first pass — needs volume validation)
- EN (95 chars): offers,deals,Kuwait,shopping,concierge,compare,prices,Arabic,AI,food,electronics,real estate,best
- AR: عروض,أسعار,تسوّق,الكويت,مقارنة,ذكاء اصطناعي,إلكترونيات,طعام,عقارات,أفضل سعر

## Open questions / handoffs
- PO to confirm: $1/month price is live commercial price (ASSUMED from brief).
- PO to confirm: 5 free searches quota is locked (ASSUMED from brief F-D2).
- PO to confirm: EN subtitle character count with Apple's current limit; approve trimmed variant if needed.
- PO to provide: Privacy policy URL and support URL (required for App Store submission).
- PO to confirm: legal entity / seller name for Apple Developer account.
- Dev to confirm: actual binary size (38 MB ASSUMED from mockup).
- ASO keywords: validate against live keyword-volume tool before submission.
- bo-dev-lead: must swap fabricated stats strip in `ClaudeDesigne/BestOffers App Store.dc.html` to the truthful fields above before any public use of that mockup.
