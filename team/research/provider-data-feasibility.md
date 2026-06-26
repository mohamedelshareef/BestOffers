# S0-2 — Provider Data-Feasibility Matrix (THE KEY RISK)

> Owner: bo-researcher · Date: 2026-06-25 · Decision informed: MVP sequencing (Electronics day-1 vs Food sequenced) and Architect's data-acquisition design.
> Legend: ✅ verified · 🟡 assumption/inference · 🔸 directional. Access channels: **(a)** affiliate feed/API · **(b)** public web/scrape · **(c)** closed/no access.

## TL;DR (lead with the answer)
- **Electronics is day-1 feasible.** Each retailer has a public product catalog with SKU-level prices, and the precedent (PriceScout) proves cross-retailer price extraction works in Kuwait today. Xcite additionally offers **affiliate programs** = a cleaner, ToS-blessed channel and a revenue hook. ✅
- **Food is NOT day-1.** Talabat/Deliveroo/Jahez are **closed marketplaces with no public consumer price API**; menu/price data exists only behind their apps. Obtaining it means scraping (fragile, ToS-exposed) or per-restaurant partnerships. **Food = sequenced behind a provider-data plan, not buildable on the same data path as Electronics.** ✅
- **Net verdict:** Electronics = **GREEN (day-1)**. Food = **AMBER (sequenced, needs a plan + legal review)**.

---

## Why Electronics is day-1 and Food is not (one paragraph)
Electronics retailers in Kuwait are **individual e-commerce sites**: prices are public, structured, SKU-level, and per-store — exactly the shape a comparison layer needs, and already proven extractable (PriceScout). Food prices live inside **delivery marketplaces** that expose *vendor-side* / partner APIs (for restaurants to manage menus), **not consumer-facing price APIs**. The same dish has different prices across Talabat/Deliveroo/Jahez and within app-only promos — so a neutral comparison is *more* valuable in Food, but the data is locked behind apps and ToS. This is a **sequencing decision, not a blocker**: ship Electronics on clean obtainable data, run a Food provider-data workstream in parallel.

---

## Electronics — provider matrix

| Provider | (a) Affiliate feed/API | (b) Public web/scrape | (c) Closed | Freshness | Fragility | Legal/ToS | Verdict |
|---|---|---|---|---|---|---|---|
| **Xcite** | ✅ Affiliate programs live (ArabClicks, Admitad, DCMnetwork) — link-tracked, commission on validated sales | ✅ Public catalog scrapeable; PriceScout already tracks it | — | Near-real-time (site is source of truth) | Med (site redesigns break scrapers) | **Affiliate = sanctioned**; scrape = check robots/ToS 🟡 | **Day-1 ✅** — prefer affiliate where it carries price/SKU feed; scrape to fill gaps |
| **Eureka** | 🟡 Not confirmed in scan | ✅ Public catalog; PriceScout tracks it | — | Near-real-time | Med | Scrape ToS review needed 🟡 | **Day-1 ✅** (scrape) |
| **Best Al-Yousifi** | 🟡 Not confirmed | ✅ Public site + flyers | — | Near-real-time (site); flyer-promos slower | Med | Scrape ToS review 🟡 | **Day-1 ✅** (scrape) |
| **Blink** 🔸 | 🟡 | ✅ Tracked by PriceScout (named) | — | Near-real-time | Med | ToS review | **Day-1 ✅** (scrape) |
| (Aggregator precedent) **PriceScout** | n/a | ✅ Proves 24/7 multi-retailer scrape + SKU-grouping works in KW | — | "Real-time" claimed | — | — | **Proof of feasibility ✅** |

**Architect note:** Hybrid model — **affiliate feed where available (Xcite) + resilient scraping** for the rest, normalized to a common SKU/price schema. Affiliate also seeds monetization (referral) and is the most ToS-defensible channel. "Real-time but fast" = live fetch on query + short-TTL cache; SKU-grouping (à la PriceScout) is required to compare "the same product."

## Food — provider matrix

| Provider | (a) Affiliate/API | (b) Public web/scrape | (c) Closed | Freshness | Fragility | Legal/ToS | Verdict |
|---|---|---|---|---|---|---|---|
| **Talabat** | ❌ No public consumer API; **Partner API restricted to registered restaurants** | 🟡 Technically scrapeable (commercial scrapers exist: Apify, Bright Data, ScrapingBee) but **app-gated, geo/auth-sensitive, ToS-exposed** | ✅ Effectively closed for consumer price data | Volatile (per-restaurant, promo-driven) | **High** (app/API changes, anti-bot) | **ToS likely prohibits scraping**; legal review mandatory ⚠️ | **Sequenced 🟡** — not day-1 |
| **Deliveroo** | ❌ No public consumer price API | 🟡 Scrapeable in theory | ✅ Closed | Volatile | High | ToS-exposed; **also under DoorDash, GCC pullback risk** | **Sequenced 🟡** |
| **Jahez** | ❌ No public consumer API | 🟡 Scrapeable in theory | ✅ Closed | Volatile | High | ToS-exposed | **Sequenced 🟡** |
| **Carriage** | ❌ 🟡 | 🟡 | ✅ Closed | Volatile | High | ToS-exposed | **Sequenced 🟡** |

**Why scraping food is the wrong day-1 bet:** menus/prices are behind app auth + location context, change constantly with promos, are defended by anti-bot, and almost certainly violate marketplace ToS. Third-party scraping APIs exist (proving it's *possible*) but inherit all the fragility + legal exposure — unacceptable as a core dependency.

---

## Food provider-data plan (the required workstream)
Ranked by defensibility:
1. **Direct restaurant partnerships / B2B onboarding** ✅ best — restaurants share menu+price+promo directly (mirrors the B2B data thesis in the backlog); neutral, legal, monetizable.
2. **Menu-management / POS aggregator integrations** 🟡 — partner with a platform that already holds multi-restaurant menu data.
3. **Affiliate/partnership with a delivery platform** 🟡 — explore if any KW marketplace offers a referral/partner program (none confirmed in scan).
4. **Public-page scraping** 🔸 last resort — only after legal review; treat as fragile, non-core, kill-switchable.

**Recommendation:** Launch MVP **Electronics-only on live data**; run Food as a **partnership-led data workstream** (option 1) targeting a curated set of restaurants for a controlled Food beta. Do **not** gate Electronics launch on Food.

---

## Open risks to flag to PO/Architect
- **Scraping ToS/legal exposure** (both verticals, esp. Food) — needs counsel sign-off before any scraping ships. ⚠️
- **Scraper fragility** — site/app redesigns break feeds; budget for monitoring + maintenance.
- **Affiliate feed completeness** — confirm whether Xcite affiliate feed carries SKU-level price (vs links only); if links-only, still need scrape for price. 🟡
- **Deliveroo Kuwait continuity** under DoorDash GCC pullback — monitor. 🟡

---

## Sources (accessed 2026-06-25)
- PriceScout (feasibility proof) — https://getpricescout.com/
- Xcite affiliate — https://www.arabclicks.com/advertisers/xcite-affiliate-program/ , https://www.admitad.com/store/offers/xcite-kw/ , https://www.dcmnetwork.com/affiliate-marketing/xcite-affiliate-program/
- Xcite / Eureka / Best Al-Yousifi sites — https://www.xcite.com/ , https://www.eureka.com.kw/ , https://best.com.kw/
- Talabat no public API / partner-only + third-party scrapers — https://apify.com/thirdwatch/talabat-scraper , https://brightdata.com/products/web-scraper/talabat , https://www.scrapingbee.com/scrapers/talabat-api/
- Deliveroo/DoorDash GCC pullback — https://ir.doordash.com/news/news-details/2026/DoorDash-to-Wind-Down-Deliveroo-and-Wolt-Operations-in-Four-Countries/default.aspx
