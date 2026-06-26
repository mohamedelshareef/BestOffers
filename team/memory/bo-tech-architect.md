# Memory — Technical Architect (Lead) (bo-tech-architect)

> READ at task start. UPDATE at end with durable facts only. Keep lean (<150 lines); prune stale.

## Current state
- S1-3 + S1-4 delivered. Artifacts: `team/architecture/system-design.md`, `team/architecture/ai-and-data-pipeline.md`.
- MVP = Electronics on live data (Food = later partnership stub, no core schema change needed).

## Chosen stack (ADR-001)
- Mobile: React Native / Expo (locked).
- Backend: **Node.js + TypeScript, NestJS modular monolith** (single language across BE/admin/mobile).
- DB: **PostgreSQL** (managed) — OLTP + JSONB + pg_trgm/FTS + append-only price history.
- Cache: **Redis** (short-TTL offer cache, clarifier session state, rate-limit, scrape locks).
- Scrapers: **Playwright workers on BullMQ** (isolated from request path).
- Admin web: **Next.js**. Hosting: container PaaS + managed PG/Redis. No K8s/microservices (YAGNI).
- LLM (ADR-002): **Claude Opus 4.8 (`claude-opus-4-8`)** for clarify + rank/why; **Haiku 4.5 (`claude-haiku-4-5`)** for lang-detect/normalize. Anthropic **TS SDK**. Adaptive thinking, structured outputs, prompt-cached few-shot prefix. Workflow tier (code-orchestrated), not an agent.

## Data model summary
- Money = integer **fils** (1 KWD = 1000 fils). **Privacy wall: phone PII only in `users`; only `pseudo_id` enters `events`.**
- Tables: users, auth_otps, app_sessions, providers, skus, offers (current+TTL), **offer_history (append-only = B2B price asset)**, search_sessions (ephemeral/Redis), events (anonymized, BA schema).
- **SKU-grouping** (compare same product): Tier1 gtin/mpn → Tier2 brand+model+attrs → Tier3 fuzzy pg_trgm w/ threshold; below threshold leave ungrouped. Claude assists normalization at ingest, NOT live path.
- Pipeline (**ADR-003 supersedes affiliate assumption**): **NO affiliate feeds — AI reads provider sites LIVE at query time**, extracts+ranks. Spine unchanged: `ProviderAdapter` → normalize → SKU-group → upsert offers + append history. **"Real-time but fast" = live fetch + short-TTL cache (electronics price ~15min, URL cache ~24h, food ~5min; pre-warm top-N hot SKUs); parallel fan-out, per-site timeout (T1 1.5s / T2 5s), ~6s query budget, graceful partial results (rank what returned, omit/label-stale on timeout).**

## Live AI-fetch pipeline (ADR-003)
- **3 fetch tiers behind one `ProviderAdapter` iface** (`{providerId,sector,tier,enabled; discover()→ProductRef[]; fetch()→RawPage; extract()→NormalizedOffer[]; health()}`). Tier routing is internal; orchestrator only calls `resolveOffers` (unchanged).
  - T1 `http`: **X-cite `/p` (deterministic HTML parse), Blink `/products/{handle}.json`** — GREEN, ship first, NO Claude, ~0.2-0.8s.
  - T2 `render`: Eureka(Angular)/Best(JS)/Talabat(API price) — Playwright pool on BullMQ, ~2-6s; prefer XHR/JSON sniff over full render.
  - T3 `render_residential`: Jahez(403)/Carriage(CF526) — **DEFERRED/optional**, browser+residential egress, flagged.
- **Extraction = HYBRID deterministic-first.** T1 = code parser, zero tokens. Hard pages = Haiku 4.5 extract from **pre-trimmed** slice (strip scripts/nav, select product region, <~4KB; prefer JSON-LD/OG/Shopify JSON). **Server-side fetch-then-feed** (NOT Claude web-fetch). **Truthfulness: copy verbatim, null if absent; code drops any price token not present in source slice.**
- **Discovery vs price split:** discover URLs via sitemap/`.json`/`provider_url_cache` (cheap, no render); reserve render for price. X-cite: discover via sitemap, price via cheap `/p`.
- **Resilience:** retry 1x backoff, realistic UA + Accept-Language en,ar, Redis scrape-lock, per-provider failure isolation (`allSettled`), per-adapter kill-switch (`providers.enabled`), health auto-mute on N consecutive extract failures (site redesign → 1 source degrades, app survives). Monitor fetch_success/extract_confidence/p95/cache_hit/claude_calls.
- **Build slices:** A=X-cite+Blink T1 adapters live, replace mock in `resolveOffers` (no Claude) → B=T2 render+Haiku fallback+pre-warm → C=T3 residential (deferred). New schema: `provider_url_cache`.
- **Legal:** live per-query read/republish raises ToS/IP beyond affiliate model → counsel. X-cite/Blink lowest-risk lead; T2/T3 behind `tos_reviewed`+kill-switch. Owner directing, not blocking.

## Interface contracts (build slices, 4 devs)
- Slice1 Auth (Dev A): `/auth/otp/request|verify|refresh|logout` → {access,refresh,pseudo_id,locale_pref}.
- Slice2 Provider-data (Dev B): `resolveOffers(skuCandidates, providerSet) → Offer[]{price_fils,provider,deeplink,source,fetched_at}`; `normalize(adapter,raw)`; `getEnabledProviders(sector)`.
- Slice3 Search+AI (Dev C): `/search/intent`, `/search/answer` → {state, questions?[], cards?[]}. Builds against mock resolveOffers.
- Slice4 Admin+logging (Dev D): `logEvent(type,payload)` fire-and-forget (async queue→events); admin CRUD providers/moderation/KPIs.
- Parallel: 1/2/4 independent; 3 against mocks.

## AI design (S1-4)
- 3 bounded calls: Opus intent+clarifier (≤3 Qs, code-enforced loop guard + asked-dimension set) → Opus rank+why → Haiku/rules detect+normalize.
- Dialect: accept Kuwaiti/Gulf colloquial + code-switch INPUT; reply MSA+EN; RTL-first. System prompt = cached few-shot Kuwaiti examples + dialect→MSA glossary. Sentence-level lang detection for code-switching.
- Ranking deterministic per (query, data snapshot); price/rank from DB, Claude only explains ("why" must cite an asked attribute; no invented claims).
- Logging non-blocking, pseudo_id only, no free-text PII (bucketed), aggregated/anon for B2B.

## Accounts / Billing / Supabase (ADR-004)
- **Split-plane decision:** Supabase = identity+DB+storage plane; NestJS = product/AI plane (ADR-003 intact). NOT a replacement.
- Supabase *is* the single managed Postgres for ALL tables (ADR-001/003 run unchanged in `public`); NestJS connects via service-role/pooled conn (bypasses RLS). Supabase adds Auth+Storage+RLS on top.
- **Amends ADR-001:** DB hosting = Supabase; hand-rolled OTP/session auth SUPERSEDED → drop `auth_otps`+`app_sessions`. `users` collapses into `profiles` keyed by `auth.users.id`. **Phone PII now lives in `auth.users` (Supabase) — strengthens privacy wall; only `pseudo_id` (on profiles) enters events.**
- Auth = Supabase phone identity + **WhatsApp OTP** via pluggable `OtpSender` iface (mock|meta_whatsapp|twilio|360dialog), SMS fallback. Lead impl = Meta Cloud API (auth-template). Biometric (F-A2) = device-side: refresh token in SecureStore/Keychain under Face/Touch ID; no OTP re-prompt.
- New tables: `profiles`(pseudo_id,name,email,avatar_url,locale,notif_enabled,notif_prefs,biometric_enabled), `notification_tokens`, `subscriptions`(stripe ids,status,period_end), `search_quota`(used_count). RLS: owner read-self; subscription+quota writes SERVER-ONLY (clients never write status). Avatars = Supabase Storage bucket, path `{uid}/avatar.ext`.
- **Stripe (F-D1):** $1/mo USD, Stripe-hosted checkout, **webhook = source of truth** (checkout.completed, sub.updated, sub.deleted, invoice.payment_failed). premium = status in (active,trialing). `BillingProvider` iface (mock|stripe); mock BILLING_DEV_GRANT toggles premium. KWD shown as display-only approx; charge stays USD. Fee ~2.9%+30¢ (~33% of $1) — flagged.
- **Freemium gate (F-D2):** `search_quota.used_count`, server-side, keyed by user_id, enforced at `/search/intent` when a real search executes. Atomic: `UPDATE...SET used_count+1 WHERE used_count<5 RETURNING`; no row → 402 PAYWALL. Premium bypass checked first. Default reset rule = LIFETIME 5 (PO to confirm vs monthly).
- **Mock-mode default:** OTP_PROVIDER=mock + BILLING_PROVIDER=mock + local Supabase → app runs offline, no real keys. `.env.example` updated with all Supabase/WhatsApp/Stripe vars.
- **Build slices:** A=Supabase+profiles+RLS+JWKS verify+drop old auth (FIRST), then B=WhatsApp OTP ∥ C=Stripe, then D=freemium gate (consumes C.isPremium). Contracts frozen in ADR-004.
- **PO must create:** Supabase (Pro ~$25/mo launch), WhatsApp Business (Meta auth-template, days to approve), Stripe ($1/mo USD price). None block dev (all mocked).

## Food data strategy (ADR-005)
- **Live spike 2026-06-26 (VERIFIED real HTTP):** Talabat list/resto `200`; **menu price API `GET /nextMenuApi/v2/branches/{vendorId}/menu` → 200, 140KB JSON, 130 priced items, NO auth/challenge** (item fields `nm`/`pr`/`opr`=old-price=promo). Discovery: `/{country}/restaurants` slugs → `/{slug}` `__NEXT_DATA__.props.pageProps.data.vendorId` (verified 670845). **This UPGRADES Talabat from recon-AMBER to Tier-1 buildable-now** (no render needed — recon's "render for price" was wrong). Jahez `403` Cloudflare `cf-mitigated:challenge` (intentional wall). Carriage `526` Cloudflare origin unreachable. Deliveroo `302→/en/ 200`, restaurants postcode-gated.
- **Per-provider verdict:** Talabat=BUILDABLE-NOW (Tier-1 JSON, like Blink); Deliveroo=NEEDS-RENDER (postcode, +continuity risk); Jahez=NEEDS-PROXY (Tier-3 residential) prefer partnership; Carriage=PARTNERSHIP-ONLY.
- **3 lanes, all behind unchanged `ProviderAdapter`/`resolveOffers`:** L1 `TalabatAdapter` tier:"http" deterministic JSON, no Claude. L2 **`PartnershipIngestAdapter` (NEW `tier:"ingest"`)** — reads OUR `partner_menus` (admin CSV upload / `POST /ingest/menu` api-key), NEVER fetches a 3rd-party app → covers Jahez/Carriage-only restaurants LEGALLY. L3 render/residential DEFERRED+flagged.
- **New schema:** `partner_menus`(partner_id,restaurant,item,price_fils,old_price_fils?,...) + `partners`(id,api_key_hash,tos_reviewed,enabled). Reuse `provider_url_cache` for slug→vendorId (24h). Food offer TTL ~5min.
- **Phases:** F-1 Talabat adapter (ships first, no Claude/proxy) → F-2 partnership ingest+admin upload (parallel, BD signs restaurants) → F-3 Deliveroo render (optional) → F-4 Jahez residential (deferred, needs counsel+proxy budget). Dish-grouping = Food analogue of SKU-group (pg_trgm, conservative threshold; trust-critical).
- **Legal:** Talabat API lower-risk than walled apps but still internal endpoint → ToS/IP to counsel, behind `tos_reviewed`+kill-switch. Jahez 403/Carriage 526 = intentional non-consent → scraping = clearest violation, deferred; partnership = cleanest path. Owner directing, not blocking.

## Instagram-as-source strategy (ADR-006)
- **Vision:** track curated IG accounts that sell ONLY on IG (KW home-kitchens/restaurants = FOOD; agents posting flats = REAL ESTATE) → pull last 20-30d posts → Claude reads caption+image → structured offer → result card CTA = IG **permalink** deep-link. Net-NEW supply Talabat/portals can't reach. Snippet+link only, never republish.
- **Crux resolved:** IG direct fetch = RED (header-only, login wall) STILL TRUE — that was about OUR fetch. Fix = **commercial IG data API does acquisition off our box; we consume structured post JSON** (same move as ADR-005 partnership-ingest).
- **Provider (VERIFIED live 2026-06-26):** LEAD = **Apify `apify/instagram-scraper`** — input=profile URL, `onlyPostsNewerThan` (=last N days), `resultsLimit`, returns `url`(permalink)+caption+timestamp+media+`price_range`. Pricing $2.30/1k (Starter $30/mo)→$1.90 Scale→$1.50 Business; PAYG $2.70/1k. FALLBACK = **Bright Data IG Scraper API** pay-per-record ~$1-1.5/1k. Phyllo/creator-APIs = opt-in-only (account must authorize) = NOT for "track any account". Graph API = own/granted accounts only; oEmbed = single post. NO official API for arbitrary public accounts.
- **Cost (50 food+20 RE daily, SMART delta path):** ~$30-60/mo all-in (Apify ~$20-30 + Haiku ~$8-15). Naive full re-pull ~$140-185/mo. **Cost is a non-issue.**
- **Pipeline (behind unchanged spine, NEW `tier:'social'`):** `tracked_accounts`(curated allow-list) → BullMQ scheduled delta-pull (Apify, newerThan=30d, limit=30) → `SocialIngestAdapter` → **Haiku extract** to schemas {food: item/desc/price_fils(null if absent)/restaurant/area/permalink/posted_at; RE: rent|sale/area/rooms/rent_kwd_fils/furnished/permalink/posted_at} → `social_offers` store (TTL 6-12h, IG posts static) → dedup → `resolveOffers` merge → permalink CTA (`instagram://` + https fallback). **Truthfulness HARD-GUARDED in code:** price null unless literal token in source; permalink/posted_at verbatim from Apify row (non-hallucinatable); is_offer classifier drops non-offers; image-vision only when caption lacks price. New `SocialProvider` sub-iface (mock|apify|brightdata). `SOCIAL_PROVIDER=mock` default (dev no key).
- **Phases:** P1 Apify adapter + tracked_accounts admin + Haiku extract + social_offers + permalink CTA, FOOD-first ~10 curated accts, gated tos_reviewed=false internal-only → P2 RE accts + Bright Data failover → P3 opt-in partner OAuth (Graph API, clean ToS).
- **Cost control:** onlyPostsNewerThan deltas + last_pull_at + resultsLimit cap + 6-12h cache (search NEVER triggers live Apify) + monthly result cap + per-account/global kill-switch + curated allow-list (NO open "track any account" at MVP).
- **LEGAL = biggest flag in project:** scraping IG via 3rd party = against Meta ToS, WE are directing party (higher exposure than portals/Talabat). + caption/image IP (snippet+link only, prefer text-only no thumbnail) + PII in captions (phone/name → privacy wall). Counsel sign-off BEFORE public; build gated. Owner directing not blocking. P3 opt-in = clean long-term answer.
- **New schema:** `tracked_accounts`, `social_offers`, providers row per social provider (tos_reviewed,enabled). `.env`: SOCIAL_PROVIDER, APIFY_TOKEN, APIFY_IG_ACTOR, SOCIAL_MONTHLY_RESULT_CAP.

## Key decisions
- ADR-001 backend stack; ADR-002 Claude integration; ADR-003 live-fetch; ADR-004 accounts/billing/Supabase; **ADR-005 Food data strategy (Talabat JSON API + partnership ingest)**; **ADR-006 Instagram-as-source (Apify/Bright Data API + Claude extract, tier:'social', permalink CTA)**. All in architecture/ files.

## Open questions / risks / handoffs
- **ADR-003: live-fetch/republish ToS+IP sign-off → counsel** (owner directing, not blocking). GREEN (X-cite/Blink) lowest-risk lead; T2/T3 behind `tos_reviewed`+kill-switch. (Affiliate model dropped.)
- X-cite discovery route (sitemap vs render `/search`) → confirm in Slice A spike.
- Dialect glossary needs native-QA pass [R?] (S0-3). Privacy/consent copy pending legal [R?] (S0-5).
- Scraper fragility (site redesigns) — health status + kill-switch + monitoring budget.
- SKU-grouping false positives = wrong price comparison (trust-critical).
- Infra cost MVP < ~$150/mo; Claude tokens = dominant variable cost (controlled via Haiku tiering + caching + bounded loop).
