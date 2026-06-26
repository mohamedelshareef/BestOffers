# Memory — Research & Market Intelligence Lead (bo-researcher)

> Persistent memory for the BestOffers Research & Market Intelligence Lead.
> READ at task start. UPDATE at task end with durable facts only (decisions, current state, open items, handoffs).
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state
- Sprint 0 research S0-1/S0-2/S0-3 DONE (2026-06-25). Artifacts in `team/research/`: market-competitor-scan.md, provider-data-feasibility.md, localization-arabic.md.
- **MODEL CHANGE (2026-06-26): NO affiliation/feeds/DB. AI reads provider WEBSITES live at query time, extracts + ranks offers.** Re-evaluated under this lens → `team/research/website-recon-ai-readability.md` (live fetches, verified).

## Website recon verdicts (AI-reads-the-site, fetched 2026-06-26)
- **Readability is page-TYPE dependent, not just site-dependent.** SPA list/search pages return empty HTML shell to a plain fetcher; some product pages render full data.
- **Xcite = easiest (GREEN-ish):** product `/p` pages have full server HTML (price KWD + SKU + stock + image) ✅. Category `/c` + `/search?q=` are JS-injected (shell only). Use `/p` for price, search/sitemap for discovery.
- **Blink (real URL = blink.com.kw, Shopify) = AMBER-easy:** list pages JS, but Shopify `/products/{handle}.json` gives clean structured JSON — likely easiest electronics source.
- **Eureka = AMBER:** AngularJS SPA, needs JS render (or sniff its XHR/JSON API).
- **Best Al-Yousifi = AMBER:** JS shell on every page (home+category return only title); SEO-indexed so content exists post-render. Needs render.
- **Talabat = AMBER:** restaurant lists + dish names server-rendered, but PRICES load via API/JSON (need render or menu API). No bot wall hit on tested paths.
- **Deliveroo (deliveroo.com.kw) = AMBER:** active, but postcode-gated discovery; DoorDash GCC pullback continuity risk.
- **Jahez = RED (plain fetch):** jahez.net + portal.jahez.net both HTTP 403 bot-blocked. Needs full browser + evasion.
- **Carriage (real URL = trycarriage.com/en/kw) = RED (plain fetch):** Cloudflare 526. Needs full browser.
- **Architecture implication:** headless/rendered browser is the DEFAULT (only Xcite /p is plain-fetchable). Exploit structured shortcuts (Shopify .json, SPA XHR APIs). "Real-time but fast" tension → short-TTL cache + pre-warm crawl + parallel fetch w/ timeouts + partial results. Hardest = Jahez, Carriage (blocked pre-render), then Talabat (price API).
- **Legal (noted, NOT blocking per owner):** live read still likely vs ToS esp. food; 403/Cloudflare = intentional non-consent signals. Shopify .json + SEO pages lower-risk. Flag to counsel.

## Real Estate (flats) recon — AI-reads-the-source (fetched 2026-06-26) → `team/research/real-estate-providers-feasibility.md`
- **Real Estate = GREEN, EASIEST category yet, buildable day-1.** KW property portals are SEO-driven → **server-render full listing data (price KWD, area+block, beds, baths, sqm, furnished, floor, images, link) into raw HTML** = no headless render needed (opposite of electronics SPAs / food walls).
- **Data source = PORTALS, not agencies/developers.** Portals already aggregate all agencies + private landlords.
  - **q84sale (4Sale) = GREEN primary:** list `…/property/for-rent/apartment-for-rent/1` + detail `…/listing/{id}` both server-rendered; detail gives beds/baths/sqm/furnished/floor/features/16 image URLs ✅ verified.
  - **Boshamlan = GREEN co-primary:** "largest free RE app/site in KW"; rent/sale/exchange; cards server-rendered w/ posted timestamps ✅.
  - **Hilite Homes (agency) = GREEN secondary** (self-hosted priced inventory, 130+ areas) ✅.
  - **Bayut KW / Sakan / OpenSooq KW = RED (HTTP 403 bot-walled)** ✅ verified. Dubizzle KW = untested, assume guarded (EMPG group).
  - **Instagram = RED — NOT a data source.** Login wall, header-only to unauth fetch (no posts/captions/prices), Graph API only for owned accts, ToS+anti-bot. Marketing channel only ✅ verified @reokuwait.
  - **Developers (Mabanee/Tamdeen/URC/Alargan) = NOT a flat-listings source** (project/corporate sites, no per-unit prices).
- **Build needs:** plain-fetch crawler (q84sale+Boshamlan list→detail), listing schema, **cross-portal de-dup** (phone/area/price/bed or image-hash), AR↔EN area alias map, intent slots {rent-vs-buy, area, budget, bedrooms, furnished + refiners}, short-TTL cache + timestamp surfacing.
- **Open for PO:** Rent vs Sale MVP scope (recommend Rent-first); ToS sign-off (portals SEO-public = lower-risk, IG = hard no); listing-staleness handling.

## 🔴 SOURCING RULE (OWNER CORRECTION 2026-06-26) — DIRECT sellers/listers, NOT aggregators
- **For Food & Real Estate IG seed lists: track the accounts that SELL/LIST the item themselves** (home kitchens, home cooks, meal-prep individuals, grills, home-bakers, cloud/IG restaurants; furnished-apt operators, direct brokers/landlords). **NOT offers-repost / aggregator pages.** Prior lists wrongly leaned on aggregators (@offer_food_kw etc.) — removed.
- Aggregators may be used as a *discovery feed to find direct sellers*, never as the tracked seller. Do NOT fabricate handles — mark [V] verified vs [CONFIRM]; if a real handle can't be verified, say "harvest live", don't invent.
- **Files rewritten/created:** `food-instagram-accounts.md` (direct-seller list, ~35 [V] handles) + `real-estate-instagram-accounts.md` (direct flat-listers, ~5 [V] handles). Both have the DIRECT-not-aggregator banner + a "Seed list for bo-dev-lead" block for `HANDLES.food` / `HANDLES.realestate`.
- **Verified direct seeds — FOOD (37):** meal-prep: basickuwait, scale.kuwait, chefpaulkitchen, portionkw, themealboxkw, cleaneats.co, numou.life, dietstation, wolfnutrition.kw, linasanddinasretail, dietcenterkw, thedietcare, lofatgroup, proteinkw, tuningkw, caloriecontrol · bakers: layers_kw, thecakeshop_kuwait, bakehaus.kuwait, bakingstudiokuwait, cake_art_kwt, heavenly.cake, bakingtonstreet, sheezbakes, bakesandtreats_kuwait, thefrostingnook, _cake_n_cake, cakentakekw, itsmesini, js_bakery, zahracakes_kwt, baker_tanya.kw · grills: mashawi.kw, mashawikw · cloud: kuwaitkitchensgroup, burgerinn.kw, bbtkw, mug.cr, collective_kw.
- **Verified direct seeds — REAL ESTATE (4):** majestic_kuwait, amadell_for_rent, q8_rent, reokuwait (CONFIRM: rent_kuwait).
- **Two honest gaps (live-harvest, not hand-listable):** (1) individual مطبخ منزلي home-kitchen long tail; (2) من المالك broker/landlord long tail. Open-web search returns Saudi/UAE/TikTok/directory noise, not curatable KW IG handles → need authenticated IG hashtag/geo crawl + human curation. Did NOT invent handles for these.
- **RE caveat:** portals (q84sale + Boshamlan) stay the GREEN primary RE data source; IG direct-listers are secondary/discovery only. IG remains RED to automate (login wall) for both categories.

## Food-via-Instagram category recon (2026-06-26, SUPERSEDED by direct-seller rewrite above) → `team/research/food-instagram-accounts.md`
- **Owner wants a Food category seeded from Kuwait food IG accounts** (home/cloud kitchens, desserts, meal-prep, offers accounts) — the IG-only long tail Talabat misses.
- **Gap verdict = REAL & complementary.** Differentiator = IG-only DM/WhatsApp-order long tail + time-boxed promo offers (weekend boxes, "today only") + vendors off Talabat to dodge 15-30% commission. We're a discovery layer, NOT ordering.
- **Seed list delivered (~50 accts, grouped):** best food-specific aggregators = @offer_food_kw, @offers_in_kuwait, @kuwait_eateries [all V]. Meal-prep (cleanest priced offers) = @basickuwait, @themealboxkw, Calo, Numou. Home-bakers (DM-priced, IG-only) = @js_bakery, @zahracakes_kwt, @baker_tanya.kw, @layers_kw. Cloud = @kuwaitkitchensgroup (KKG). Cafes = @mug.cr, @collective_kw. Burgers = @burgerinn.kw, @bbtkw. Influencers (@kuwaitfoodguide etc.) = discovery only, NOT offer sources.
- **Handles marked [V]=verified-exists (search-indexed IG title) vs [I]=inferred, confirm before tracking.** Did NOT fabricate handles. Home-kitchen long tail can't be hand-listed → must HARVEST via hashtag/geo crawl (#مطبخ_منزلي_الكويت etc.) then human-curate.
- **INGESTION CAVEAT (reconfirmed):** IG = RED data source. Unauth fetch = login-walled shell (no captions/prices) — verified again on @offer_food_kw, @basickuwait. Graph API = owned accts only. Build-how is unresolved.
- **Posting patterns:** aggregators/meal-prep/roasteries post most days (rich 20-30d window); home-bakers/kitchens sporadic + Story-heavy (24h expiry = MISS risk for 30d history). Many offers = "price via DM" (no price in post) → need policy. Prices often baked into image poster → may need OCR not just caption NLP. AR-first + AR/EN mix + dialect + emoji.
- **Open for PO:** (1) how many accts to start (recommend ~15-20: aggregators + meal-prep first); (2) AR/EN handling; (3) price-less/DM-only posts — show as "price on request" vs drop?; (4) Story-only & image-baked-price offers — capture (OCR/live) or skip?; (5) IG ingestion legality + method sign-off.

## Key decisions / validated findings (sourced; see artifacts for URLs+dates)
- **Category white space confirmed:** no KW player does AI-conversational, cross-provider, intent-first, Arabic-first offer discovery. Closest = PriceScout (electronics price-tracking) — narrow (phones), catalog/filter UX, English-leaning, NOT conversational. That's the gap to own.
- **Electronics = day-1 feasible.** Xcite/Eureka/Best Al-Yousifi = public SKU-level catalogs; PriceScout proves multi-retailer scrape works in KW. Xcite has affiliate programs (ArabClicks/Admitad/DCMnetwork) = ToS-blessed channel + referral revenue. Recommend hybrid: affiliate-where-available + resilient scrape, SKU-grouping, live+short-TTL cache.
- **Food = NOT day-1 (AMBER, sequenced).** Talabat/Deliveroo/Jahez/Carriage = closed marketplaces, NO public consumer price API (Talabat partner API is restaurant-only). Scraping possible but fragile + ToS-exposed. Food needs partnership-led data plan (direct restaurant onboarding = best, also feeds B2B thesis). Do NOT gate Electronics launch on Food.
- **Localization rule:** Kuwaiti/Gulf colloquial + code-switch INPUT → MSA + English OUTPUT, RTL-first. Claude strong on MSA; Anthropic says dialect "still developing" but Claude has slight Gulf-dialect edge vs GPT. De-risk via few-shot Kuwaiti examples + dialect→MSA glossary in system prompt + native QA.
- **Market size:** KW online food delivery ~USD 880M (2024) → ~1,434M (2032), 6.3% CAGR. Talabat dominant (~85K active users late Q3'25); Deliveroo now under DoorDash (GCC pullback risk).

## Open questions / handoffs
- Legal: scraping ToS sign-off needed before any scraping ships (esp. Food). → PO/counsel.
- Confirm whether Xcite affiliate feed carries SKU-level price (vs links only). → Architect.
- Monitor Deliveroo Kuwait continuity under DoorDash GCC pullback.
- Native Kuwaiti QA pass to validate dialect glossary. → UX/BA.
