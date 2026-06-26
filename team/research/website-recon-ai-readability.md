# Website Recon — AI-Reads-the-Site Feasibility

> Owner: bo-researcher · Date: 2026-06-26 · Decision informed: Architect's design of the **live AI-fetch pipeline** (AI reads public provider websites at query time, extracts + ranks offers). NO affiliation/feeds/pre-built DB.
> Legend: ✅ verified by live fetch · 🟡 inferred · 🔸 directional. Verdicts: **GREEN** = AI can read live via plain fetch · **AMBER** = needs rendered/headless browser or workaround · **RED** = blocked (bot wall / app-only).

## TL;DR (lead with the answer)
- **The single most important finding:** for the SPA sites, *category/search/list pages return only an empty HTML shell to a plain fetcher* (products injected by JS), BUT **Xcite individual product pages (`/p`) render full price+SKU+stock+image in server HTML.** So readability is *page-type-dependent*, not just site-dependent.
- **Electronics is workable for the AI-fetch model — with a rendered browser as the default.** Only **Xcite** is partially plain-fetchable (product pages). Eureka, Best Al-Yousifi, Blink need JS rendering.
- **Food is much harder.** Talabat list pages render but **prices load via API** (need render/API); Jahez and Carriage are **bot-walled (403 / Cloudflare 526)** to plain fetchers → RED/AMBER for a fast live read.
- **Net:** Electronics = mostly **AMBER** (1 GREEN-ish), Food = **AMBER→RED**. The "real-time but fast" goal collides with the need for headless rendering on most sites — budget for a rendering layer + caching.

---

## Electronics

| Provider | URL (fetched) | Public access (no login) | Search URL pattern | AI-readability (plain HTML vs JS/API) | Anti-bot / blocks | Data quality (SKU/price/avail/img) | Verdict |
|---|---|---|---|---|---|---|---|
| **X-cite** | xcite.com/ ; /search?q=iphone ; /mobile-phones/c ; **/apple-iphone-16-...-black/p** ✅ | ✅ Yes — prices public | ✅ `xcite.com/search?q=...` and category `…/c` | **Mixed.** Homepage = server HTML; **category `/c` + `/search` = JS-injected (shell only to plain fetch)**; **product `/p` = FULL server HTML (price "219.900 KD", SKU 659220, in-stock label, images)** ✅ | None seen (no Cloudflare/CAPTCHA on fetch) ✅ | ✅ Excellent on `/p`: SKU, KWD price, sale-vs-was, stock label, multi-image | **GREEN (product pages)** / AMBER for list discovery |
| **Eureka** | eureka.com.kw/ ✅ ; /products/browse/phones/mobile-phones (indexed) | ✅ Guest browsing; KWD shown ("KD") | 🟡 path-based `…/products/browse/{cat}` + `…/products/details/{id}` | **JS-heavy — AngularJS SPA** ✅ (`{{::}}` bindings in source; content populated by JS) | None seen on fetch; SPA itself is the barrier | 🟡 Structured once rendered (id/name fields seen in bindings); not in raw HTML | **AMBER** (needs rendered browser) |
| **Best Al-Yousifi** | best.com.kw/ ; /en/c/mobiles-nn/ ; /en/All-Categories/…/c/convertibles-nn/ ✅ | ✅ Indexed, public, KWD | ✅ category `…/c/{slug}-nn/` (SEO-friendly, search-indexed) | **JS shell** ✅ — every page (home + category) returns only the `Best Al-Yousifi` title/header to a plain fetch; products not in raw HTML | None seen on fetch; SPA is the barrier | 🟡 Not in raw HTML; pages ARE Google-indexed so content exists post-render | **AMBER** (needs rendered browser) |
| **Blink** (real URL = **blink.com.kw**) ✅ | blink.com.kw/ ; /collections/electronics ; /collections/all ✅ | ✅ Public | ✅ Shopify default `…/search?q=` + `/collections/{x}` + `/products/{handle}` | **JS-injected (Shopify storefront).** Raw fetch returned nav/footer only; **but Shopify exposes `/products/{handle}.json` + structured product JSON** = easy structured read 🟡 | None seen ✅ | 🟡 Shopify = clean structured product objects (variants, price, SKU, availability, images) via `.json` | **AMBER (easy)** — Shopify `.json` endpoint or light render |

**Identity note:** Blink's real URL is **https://www.blink.com.kw/** ("Kuwait's Largest Online Store", Shopify-based). ✅ verified.

## Food

| Provider | URL (fetched) | Public access (no login) | Search URL pattern | AI-readability | Anti-bot / blocks | Data quality | Verdict |
|---|---|---|---|---|---|---|---|
| **Talabat** | talabat.com/kuwait ; /kuwait/restaurants ; /kuwait/pizza-hut ✅ | ✅ Restaurant lists + menus browsable without login; no forced location wall on these paths | ✅ `…/kuwait/restaurants`, `…/kuwait/cuisine/{type}`, `…/kuwait/{restaurant-slug}` | **Mixed.** Restaurant cards + dish names = server HTML ✅; **prices NOT in raw HTML → load via API/JSON** ❌ | None triggered on these fetches (no Cloudflare/DataDome seen) — but known to defend menu APIs 🟡 | 🟡 Names/links yes; **KWD prices need the menu API / rendered page** | **AMBER** (render or hit menu API for prices) |
| **Deliveroo** | deliveroo.com.kw/ ✅ (resolves, active in KW) | 🟡 Homepage open; **requires postcode** to reveal restaurants | 🟡 postcode-gated discovery | 🟡 Hybrid (static shell + JS filtering by location) | No homepage login wall; location gate is the friction | 🟡 Prices behind location-gated JS | **AMBER** — usable but location-gated; **continuity risk** (DoorDash GCC pullback) |
| **Jahez** | jahez.net/ (403) ; portal.jahez.net/alamat/restaurant.htm (403) ✅ | ❌ **Bot-blocked** — plain fetch returns **HTTP 403 Forbidden** on both main site and web portal | 🟡 web portal exists (`portal.jahez.net`) but blocked | ❌ Can't read at all via plain fetch | **403 / bot wall** ⚠️ verified | n/a (blocked) | **RED** (plain fetch) → AMBER only with full browser + evasion |
| **Carriage** (real URL = **trycarriage.com/en/kw**) ✅ | trycarriage.com/en/kw ; /en/kw/about_us (526) ✅ | ❌ **Cloudflare error 526** (origin/SSL) on plain fetch — not readable | 🔸 web menus exist per docs | ❌ Can't read via plain fetch | **Cloudflare-fronted** ⚠️ verified (526) | n/a (blocked) | **RED** (plain fetch) → AMBER with full browser |

---

## What this means for the AI-fetch architecture

**1. A headless/rendered browser is the default, not the exception.** Only Xcite *product* pages are plain-fetchable today. Every SPA (Eureka AngularJS, Best Al-Yousifi, Blink Shopify) and every food site needs JS execution to surface prices. Plan for a **rendering layer** (headless Chromium / rendering API) as the core component.

**2. Exploit structured shortcuts where they exist — they beat rendering on speed:**
- **Xcite:** scrape `/p` product pages directly (full server HTML) → fastest path; use `/search?q=` only to *discover* product URLs (may need render or sitemap).
- **Blink (Shopify):** hit `/products/{handle}.json` (and `/collections/{x}/products.json`) → clean JSON, no rendering needed. Likely the *easiest* electronics source.
- **Talabat / Eureka / Best Al-Yousifi:** sniff the background **JSON/XHR endpoints** the SPA calls; reading those APIs directly is far faster than full-page render. (Eureka/Best are Angular; Talabat menu data is API-driven.)

**3. "Real-time but fast" is in tension with rendering + anti-bot.** Per-query live render of multiple sites = multi-second latency and bot-detection exposure. Mitigations the Architect must weigh:
   - **Short-TTL cache** of recently-fetched products/menus (e.g. minutes for food promos, longer for electronics SKUs) so most queries hit warm data.
   - **Pre-warm / background crawl** of popular SKUs/restaurants so query-time work is a refresh, not a cold fetch.
   - **Parallel fetch with per-site timeouts** and graceful partial results (rank what came back).
   - **Discovery vs price split:** use cheap plain-fetch/sitemap/`.json` for discovery, reserve expensive render only when needed.

**4. Hardest sites (rank):** Jahez (403 wall) and Carriage (Cloudflare 526) are the hardest — blocked even before rendering; need a real browser + residential egress and will be slow/fragile. Talabat is medium (renders but defends price APIs). Eureka/Best/Blink are tractable with rendering/JSON. Xcite is easiest.

**5. ToS / legal flags (noted, NOT blocking per owner's direction):**
   - Reading public pages live at query time still likely runs against marketplace/retailer ToS (esp. Talabat/Jahez/Carriage anti-scraping clauses) and the 403/Cloudflare blocks are *intentional* signals of non-consent. ⚠️
   - Shopify `.json` and SEO-indexed pages are lower-risk (publicly served). Xcite `/p` is public.
   - Per-query republishing of competitor prices/images may raise IP/database-right and trademark questions. Flag to counsel; owner has directed proceeding.

---

## Sources (all fetched/verified 2026-06-26 unless noted)
- Xcite — https://www.xcite.com/ , https://www.xcite.com/search?q=iphone , https://www.xcite.com/mobile-phones/c , https://www.xcite.com/apple-iphone-16-6-1-inch-128gb-black/p (price+SKU verified)
- Eureka — https://www.eureka.com.kw/ , https://www.eureka.com.kw/products/browse/phones/mobile-phones (AngularJS confirmed)
- Best Al-Yousifi — https://best.com.kw/ , https://best.com.kw/en/c/mobiles-nn/ , https://best.com.kw/en/All-Categories/Computers-and-Tablets/Laptops/Convertibles/c/convertibles-nn/ (JS shell)
- Blink — https://www.blink.com.kw/ , https://www.blink.com.kw/collections/electronics , https://www.blink.com.kw/collections/all (Shopify)
- Talabat — https://www.talabat.com/kuwait , https://www.talabat.com/kuwait/restaurants , https://www.talabat.com/kuwait/pizza-hut (list renders, prices API)
- Deliveroo — https://deliveroo.com.kw/ (resolves, postcode-gated)
- Jahez — https://www.jahez.net/ (403) , https://portal.jahez.net/alamat/restaurant.htm (403)
- Carriage — https://trycarriage.com/en/kw (526) , https://www.trycarriage.com/en/kw/about_us (526)
