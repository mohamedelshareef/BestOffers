# BestOffers — Full REAL-mode sim run (PO demo)

**Date:** 2026-06-26 · **QA:** bo-qa-lead-frontend · **Device:** iPhone 17 Pro sim (iOS 26.2, UDID 8E782E23-…7510)
**Mode:** FULL REAL — API `claude=anthropic, liveFetch=on, social=apify, social-extractor=anthropic`; `billing=mock, otp=mock` (demo). `/health` = ok.
**Build:** mobile web RE-EXPORTED (stale dist had old categories) → served on :8765 (auto-scroll variant :8766 for the IG-card shot). Bundle points at `http://localhost:3000`. Native iOS build still blocked (SIM-HIGH-2), web build is the render surface.

All screenshots are REAL `simctl io booted screenshot` captures of the actual running app.

## Screenshot inventory + verdict

| # | File | Screen | Verdict |
|---|------|--------|---------|
| 1 | `run-01-categories.png` | Category landing | **PASS** |
| 2 | `run-02-electronics-clarifier.png` | Electronics clarifier | **PASS** |
| 3 | `run-03-electronics-cards.png` | Electronics ranked cards | **PASS** |
| 4 | `run-04-food-talabat.png` | Food — Talabat dishes | **PASS** |
| 5 | `run-05-food-instagram.png` | Food — Instagram offers + CTA | **PASS** |
| 6 | `run-06-realestate-empty.png` | Real Estate search | **FAIL (no offers in live mode)** — see D-RUN-1 |

## What rendered (detail)

**1. Categories (PASS)** — sand/teal v2 skin, RTL, Western numerals. Three ACTIVE tiles: الإلكترونيات/Electronics, الطعام/Food, **عقارات (شقق)/Real Estate**, plus السيارات/Cars as "قريباً · Soon". (Re-export was required: the previously-served dist showed the OLD layout — Electronics+Food active, Furniture+Cars Soon, NO Real Estate.)

**2. Electronics clarifier (PASS)** — query "iPhone 16" → MSA question "أي سعة تخزين تبي للآيفون 16؟" with chips ١٢٨/٢٥٦/٥١٢ جيجا + "تخطّي" (skip) + "بحث جديد". Live API returns clarifying state (storage→color→budget, 3 Qs, code-capped).

**3. Electronics ranked cards (PASS)** — exact-rich query "iPhone 16 128GB أسود" → results, **REAL live prices**:
- #1 Apple iPhone 16 128GB Black — **X-cite — 219.900 KWD** — why "مطابق تماماً، أسود ١٢٨ جيجا كما طلبت", real product image
- #2 128GB Ultramarine — X-cite — 219.900 KWD
- (#4 Best Al-Yousifi 429.000, #5 Blink 364.900 below the fold — confirmed in API payload)
- Gold **verdict ribbon**: "من المتوسط دك 103.200 أفضل عرض — أوفر ✓", header "رتّبنا 6 عروض حسب أفضل قيمة لك". Ribbon sits on #1 which IS the cheapest here (D-V2-3 not triggered on this query).
- `src=live`, real xcite.com / blink.com.kw deeplinks.

**4. Food — Talabat (PASS)** — query "kfc" → 59 cards, header "رتّبنا 59 عروض", ribbon "من المتوسط دك 2.347 أفضل عرض — أوفر ✓":
- Captain Nacho Sprinkle Cup — Kfc — **Talabat — 0.100 KWD** (real food image)
- Kentucky Ranch / Dynamite Sauce — 0.250 KWD … through 20 Pc Loaded Bucket 11.000 KWD
- 55 REAL Talabat dishes, real `talabat.com/kuwait/kfc` deeplinks. **D-V2-1 (Food=0 cards) is RESOLVED.**

**5. Food — Instagram offers + CTA (PASS)** — bottom of the food list shows REAL IG offer cards with the explicit CTA pill **"شوف على إنستقرام"** (View on Instagram):
- "عرض يوم الثلاثاء" — **@offer_food_kw** — "السعر بالخاص — شوف البوست"
- "عرض شهر يونيو للشخصين شامل الأكل (ست منيو)" — **@kuwait_eateries**
- (also @mug.cr ×2 in payload)

**REAL Instagram permalinks CONFIRMED** (the CTA opens these exact posts; all returned HTTP 200 live):
- @mug.cr → https://www.instagram.com/p/DZMsnMqjvl3/ (Iced Salted Vanilla Latte)
- @mug.cr → https://www.instagram.com/p/DZrtB_9j6RG/ (Earl Grey Matcha)
- @offer_food_kw → https://www.instagram.com/p/DZ2S4cCMAQd/ (عرض يوم الثلاثاء)
- @kuwait_eateries → https://www.instagram.com/p/DZ5RXEoiONs/ (عرض شهر يونيو للشخصين)

**6. Real Estate (FAIL in live mode)** — query "شقة للإيجار السالمية" → screen renders correctly (header عقارات, query echoed) but shows the empty state **"لا نتائج — وسّع أو عدّل البحث"**. Returned `state: empty, 0 cards` in ~5s (no Apify call).

## Defects

| ID | Sev | Defect | Repro / root cause |
|----|-----|--------|--------------------|
| **D-RUN-1** | **HIGH** | Real Estate returns **0 offers in FULL REAL mode** — no IG flat cards/permalinks render for any query. | Root cause: `apps/api/src/offers/adapters/social/apify-social-provider.ts:32` — `realestate: []` (no IG handles seeded for the live Apify lane; deferred to Phase-2 per ADR-006). `apify-social-provider.ts:88-89` short-circuits to `[]` when handles empty. RE flat offers exist ONLY in the **mock** social provider (`salmiya.rentals`, `mahboula.flats`, real `instagram.com/p/<code>/` permalinks). So Real Estate is demoable only with `SOCIAL_PROVIDER=mock`; under the task's real-mode contract it is empty. **Backend fix:** seed verified KW real-estate IG handles into the live HANDLES map (mirror the food allow-list pattern). |
| **D-V2-2** | MED | RE empty state is the bare "لا نتائج — وسّع أو عدّل البحث" with NO broaden chips (violates F-SR1 AC-14 "never a dead end"). Reconfirmed live. | search empty path emits no `broadenSuggestions` here. |
| D-V2-3 | MED | Verdict ribbon assumes card #1 = cheapest; ranker sorts by match-quality. Not triggered on this run's queries (ribbon landed on the genuine cheapest), but unfixed. | Known. |

## Notes / honesty
- D-V2-1 (Food=0 cards, prior HIGH) is now **RESOLVED** — Talabat + IG both live.
- Could NOT drive taps natively (`simctl` has no tap; `idb` unavailable). Search/clarifier/results were driven via the screen's `?q=` auto-run deep-link; the Food IG-card scroll used a non-destructive auto-scroll spa variant (build artifacts untouched).
- Real Estate render shown is the honest live result (empty), not a mock substitution.
