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
- **🔴 FOOD LIST REBALANCED (2026-06-27) — meal/rice-weighted + DISH-CATEGORY tagged.** Trigger: live-test bug "Bukhari food" (rice dish رز بخاري) returned cakes from @layers_kw because old seed was bakery-heavy (16 bakers, ~2 rice/grill). Now every handle has `dish_category` so matcher routes rice→rice not dessert. Counts: rice 8 · home-meal 6 · grill 6 · meal-prep 16 · dessert 9 (cut from 16) · cloud 5. File `food-instagram-accounts.md` fully rewritten with category-tagged `HANDLES_FOOD` dict + query→category map for dev.
- **NEW verified rice/meal sellers (the missing block):** rice → bukhari_kuwait, alamir_bukhari, maidaalmandi, malekalmajbous, machbos_daqoos, manasif_, mansafna_kw, kabsa.house · home-meal → homechefkw, kuwait_kitchens, beitelmansaf, kuwaitkitchensgroup · grills(added) → mashawi_alzayn, mishkak_kw (+ mashawi.kw, mashawikw).
- **EXCLUDED non-Kuwait look-alikes (do not re-add):** 1.bukhari.qa (QA), mrbukhari.iq (IQ), baitalmajbousqa (QA), home_cooking.sa, almatbakh_alkuwaiti (UAE), kuwaiti.cuisine_in_uae, roz.kitchen (Jeddah), afghan_bukhari_786/hadramoot.resturant/bukhari.mubbhar (geo-unconfirmed). CONFIRM-geo: kabsawberyeni, mpkuwaiti, mashawialdeera, sawani_mashawi.
- **Prior dessert-heavy seed (carried, mostly trimmed):** kept layers_kw, thecakeshop_kuwait, bakehaus.kuwait, js_bakery, bakingstudiokuwait, sheezbakes, cakentakekw, zahracakes_kwt, baker_tanya.kw. Meal-prep block unchanged (16).
- **Verified direct seeds — REAL ESTATE (4):** majestic_kuwait, amadell_for_rent, q8_rent, reokuwait (CONFIRM: rent_kuwait).
- **🟢 DEEP-DIVE PASS (2026-06-27) — DB-READY seed delivered.** New artifact `team/research/ig-accounts-seed.json` = machine-readable array (handle, sector, category, follower_tier, recency, posts_prices, lang, status, note) for bo-dev-lead to import straight into `tracked_accounts`. Both MD files expanded + JSON is now source-of-truth for import.
  - **FOOD ~58 handles (54 V + 4 CONFIRM):** rice 9 · home-meal 4 · grill 12 · meal-prep 18 · dessert 13 · cloud 6. NEW verified: grills koalakw(~119K)/tgrill_kuwait/alhassangrills/mashawinagrill; desserts bakeryhousekw/chestnutkwt/thebakerykwt/pandacakes.kw; cloud sulafkitchen; meal-prep dietfix/dietbux. Reclassified kuwait_kitchens→CONFIRM (bio leans kitchen-fitout, not meals).
  - **REAL ESTATE 14 handles (11 V + 3 CONFIRM):** rent 9 (added rent_aqar~34K, q8house_rent~11K, real_estate_rent_q8, q8kw2020) · agency rent+sale 3 (besthomesq8~12K, aljahra_realestate~52K, q8aqarcom~6K) · CONFIRM aqar_kw0, rent_kuwait. SALE-only IG = empty (portal-dominated; q84sale/Boshamlan aggregate it better — do not invent SALE handles).
  - **Rejected non-KW this pass:** we5ei, mutbkh_baiti, abha3705 (SA/no-KW-signal home cooks); cul.inksa, mellow.ksa, homebakerysaudi (KSA). Mandi search returned Talabat-only listings (not IG-direct) → not seeded.
  - **IG STILL RED to automate** (re-confirmed login-walled header on koalakw/tgrill_kuwait/aljahra_realestate). JSON = WHAT to track; HOW-to-ingest unresolved → bo-dev-lead/Architect.
  - **Still needs authenticated hashtag/geo harvest (flagged, NOT fabricated):** (1) individual مطبخ منزلي home-cook long tail (#مطبخ_منزلي_الكويت etc — open-web = SA/UAE/TikTok noise); (2) من المالك private-landlord long tail; (3) SALE-only direct IG listers (likely low ROI vs portals).
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

## Kuwait area gazetteer (2026-06-27) — ADR-007 Q3, RE area matching generalize
- **Built COMPLETE KW residential gazetteer → `team/research/kuwait-area-gazetteer.json` (84 areas, 6 governorates)** + `.md` summary. Replaces the prior 12-area AREA_GROUPS in `realestate-relevance.ts` (too small — Jabriya/Mishref leaked/missed).
- Each entry = `{en, ar, aliases:[EN translit + AR with/without ال + ة/ه ى/ي variants], governorate}`. DROP-IN ready: slug(en)→aliases = AREA_GROUPS.
- VERIFIED vs EN Wikipedia "Areas of Kuwait" + AR "قائمة مناطق الكويت" (fetched 2026-06-27). Counts: Capital 25 · Hawalli 19 · Farwaniya 17 · Ahmadi 18 · Jahra 12 · MubarakAlKabeer 11.
- EXCLUDED on purpose (not flat-rental → keeps matcher precise): industrial/port (Shuaiba, Subhan, Amghara, Ardiya Herafiya, Mina Abdulla port), agri/desert/outlying (Wafra, Abdali, Salmi, Kabd, Subiya, Bahra, Kazma, Nuwaiseeb, Zoor, Failaka). Kept new-but-rented megaprojects (Mutlaa, Saad Al-Abdullah, Sabah Al-Ahmad City, Khairan City).
- Dev caveat: two "Qairawan/Qaisariya" (Capital القيروان vs Jahra القيصرية) kept as separate keys; Salwa سلوى/السالوة both aliased. Handed to bo-dev-lead to wire.

## Domain-AI-search research (2026-06-27) → `team/research/domain-ai-search-approaches.md`
- **Q: how do comparable products make AI search domain-accurate (owner: "AI isn't trained for this project")? A: taxonomy + embeddings + LLM-grounding — NOT fine-tuning, NOT more hand-tables.** This is the external evidence behind ADR-007 §2.2/Q4.
- **Industry pattern (VERIFIED):** Amazon = embeddings + cross-encoder re-rank. Instacart = hierarchical taxonomy backbone + embeddings (cluster by category/brand) + 2025 LLM "Intent Engine" (inject taxonomy context, embedding guardrail re-rank) — the closest analog to copy. Algolia/Typesense = typo+synonym dicts (= the treadmill we're escaping) now layering vectors. E-comm 2026 consensus = **hybrid BM25+vector fused via RRF**.
- **Arabic-specific (VERIFIED):** embeddings are the *documented* tool for dialect↔MSA + normalization variance; Arabic underrepresented in e-comm datasets. Best AR embed models: Cohere embed-multilingual-v3 (~$0.10/1M, AR≈EN), BGE-M3, MS E5; self-host MiniLM/mpnet = $0/call.
- **🔑 Claude has NO native embeddings API (VERIFIED, Anthropic docs)** → Anthropic recommends Voyage AI. Embeddings come from a 3rd-party model, not Claude. Our embed workload = tiny (fixed KW vocab embedded once + short query terms) = cents one-time + sub-ms pgvector lookups; pgvector free on Supabase Pro $25/mo. Match spends NO Claude tokens → cheaper than today.
- **Recommendation handed to bo-prompt-engineer + bo-tech-architect:** layered (1) finish curated KW taxonomy backbone — brand→product-type is the MISSING piece (area gazetteer 84 + food dish_category already built) → (2) prompt grounding (disambiguation rules + top-20) → (3) embeddings as long-tail fallback authority retiring hand-tables → (4) hybrid lexical+semantic (Supabase tsvector+pgvector, no new vendor) → (5) optional Instacart-style embedding guardrail. Fine-tuning REJECTED for v1 (no labelled data, Claude not the target, brittle).
- **Open:** embed-model pick (Cohere vs BGE-M3 self-host); threshold tuning needs a KW eval set (starter = dated bug cases Samsung-phone/Bukhari-rice/Jabriya-flat); confirm pgvector enabled; who builds brand→product-type catalog (likely researcher/BA).

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
