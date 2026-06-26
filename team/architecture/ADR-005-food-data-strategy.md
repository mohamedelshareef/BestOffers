# ADR-005 — Food Data Strategy (Talabat, Deliveroo, Jahez, Carriage)

> Owner: bo-tech-architect · Status: accepted (owner-directed: Food must work) · 2026-06-26
> Builds on ADR-003 (live AI-fetch pipeline, `ProviderAdapter` spine). Inputs: `provider-data-feasibility.md` (S0-2), `website-recon-ai-readability.md`. **Reuses the unchanged spine:** `ProviderAdapter` → `normalize` → SKU/dish-group → `offers`/`offer_history`, `resolveOffers(...) → Offer[]`, TTL cache, kill-switch, `providers.tos_reviewed`. Only adds Food adapters + one new adapter *kind* (partnership ingest).
> Legend: ✅ verified by live spike (2026-06-26) · 🟡 inferred · 🔸 directional.

---

## TL;DR (lead with the answer)

The owner wants Food working. Here is the **honest, verified** picture after a live spike against all four providers today:

| Provider | Live spike result (✅ real HTTP) | Data path | Verdict |
|---|---|---|---|
| **Talabat** | List `200`, restaurant page `200`, **menu JSON API `/nextMenuApi/v2/branches/{vendorId}/menu` → `200`, 140 KB, 130 priced items with discount field** ✅ | Same-origin JSON API, no auth, no bot challenge | **BUILDABLE-NOW** (Tier-1 HTTP+JSON, like Blink) |
| **Deliveroo** | Home `302 → /en/` → `200` ✅; restaurants **postcode-gated** 🟡 | Render + location context | **NEEDS-RENDER** (Tier 2, postcode flow) + continuity risk |
| **Jahez** | `403` on main + portal; **`server: cloudflare`, `cf-mitigated: challenge`, "Just a moment / Enable JavaScript"** ✅ | Cloudflare JS-challenge bot wall | **NEEDS-PROXY** (Tier 3 residential) OR partnership |
| **Carriage** | `526` (Cloudflare origin/SSL error); `server: cloudflare` ✅ | Cloudflare-fronted, origin unreachable to us | **PARTNERSHIP-ONLY** (can't even render today) |

**The headline:** the earlier recon called Talabat "AMBER — prices via API, need render." The spike **disproves the render requirement** — Talabat's price API is a **plain same-origin JSON GET**, the easiest food source by far. So **Food can ship a real beta with ZERO scraping of any walled app**: Talabat via its JSON API (lowest-risk, structured) + a **partnership-ingest adapter** for a curated restaurant set (covers Jahez/Carriage-only restaurants legally). Deliveroo is a render-tier add. Jahez/Carriage scraping is deferred and flagged — not needed to launch Food.

---

## Context — the live spike (REAL output, 2026-06-26)

Run from a plain Node/curl client, realistic UA, `Accept-Language: en,ar`. **All codes below are real, not inferred.**

```
Talabat list   GET /kuwait/restaurants        → 200  181 KB  text/html (Next.js SSR)
Talabat resto  GET /kuwait/pizza-hut          → 200  167 KB  __NEXT_DATA__ present
   → names in SSR (My Box, Triple Treat Box, Baked Chicken Wings, Pepsi) but PRICES NOT in SSR HTML
   → vendorId=670845 extracted from __NEXT_DATA__.props.pageProps.data
Talabat MENU   GET /nextMenuApi/v2/branches/670845/menu  → 200  140 KB  application/json   ★
   → result.menu.menuSection[16] → 130 priced items
   → item fields: { nm:name, pr:price, opr/oldPriceMoney:was-price, priceMoney, img, ... }
   → real sample: 2.95 "My Box", 3.5 "Triple Joy Deal", 6.95 "Watch Party Deal", "2 KD Deals" section
   → NO auth header, NO cookie, NO bot challenge, NO Cloudflare interstitial. Plain GET.
api.talabat.com/v2/...  → 404 ;  talabat.com/sitemap.xml → 404 (sitemaps gz under /_sitemap/)

Deliveroo  GET /                → 302 → /en/ → 200 (server: cloudflare). Restaurants postcode-gated (recon 🟡).
Jahez      GET jahez.net/       → 403 ; portal.jahez.net → 403
   → server: cloudflare ; cf-mitigated: challenge ; cf-ray present ; body = "Just a moment / Enable JavaScript"
   → i.e. an INTENTIONAL Cloudflare JS-challenge bot wall, not a misconfig.
Carriage   GET trycarriage.com/en/kw  → 526 (Cloudflare: origin/SSL handshake fail) ; server: cloudflare
   → origin is unreachable to a plain client; we cannot read or render it at all today.

robots.txt: Talabat allows sitemaps, no blanket Disallow seen on these paths; Deliveroo Disallow: /api/.  (legal ≠ robots; see flags)
```

**Interpretation (honest):**
- **Talabat is the big win and was under-rated.** Its consumer price data is a public same-origin JSON endpoint — same shape as Blink's Shopify `.json` (Tier-1). It even carries `opr`/old-price = native **promo/discount detection**, which is exactly the "best offer" thesis.
- **Jahez 403 and Carriage 526 are confirmed walls** — Cloudflare, intentional. A plain fetch will never read them. Jahez *might* yield to a full browser + residential egress (Tier 3, costly, ToS-hostile). Carriage 526 means even the origin is gated — render alone may not help; treat as **partnership-only**.
- **Deliveroo works but is postcode-gated** and under DoorDash GCC-pullback continuity risk (S0-2) — render-tier, lower priority.

---

## Decision

**Three-lane Food strategy, all behind the unchanged `ProviderAdapter` spine. Lead with the two lanes that need NO walled-app scraping.**

```
                       resolveOffers(dishCandidates, providerSet)   ← unchanged (ADR-003)
                                        │  parallel fan-out, per-site timeout, partial results
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                                ▼                               ▼
  LANE 1: TALABAT API             LANE 2: PARTNERSHIP INGEST       LANE 3: RENDER/PROXY
  Tier-1 http+JSON                (no scraping at all)             (deferred / flagged)
  /nextMenuApi/v2/branches/{id}   provider/restaurant-supplied     Deliveroo (Tier-2 render,
  → 130 priced items, opr=promo   menu+price feed → same adapter   postcode flow)
  BUILDABLE NOW ✅                 iface. Covers Jahez/Carriage-     Jahez (Tier-3 residential)
                                  only restaurants LEGALLY ✅       Carriage = partnership-only
        └───────────────────────────────┴───────────────────────────────┘
                                        ▼
              normalize → DISH-group → upsert offers + offer_history → TTL cache (food ~5 min)
                                        ▼
                                  Offer[] → Opus rank+why (ADR-002, unchanged)
```

**Why this order:** Lane 1 ships a *real* multi-restaurant Food experience on verified-obtainable structured data with the lowest technical and ToS risk of any food source. Lane 2 gives a **legal, partnership-blessed** path to the restaurants that live only on the walled apps (Jahez/Carriage) — so we get coverage without fighting Cloudflare. Lane 3 (render/proxy) is the expensive, fragile, ToS-hostile last resort and is **not required to launch a Food beta**.

---

## Lane 1 — Talabat (Tier-1 `http`, BUILDABLE NOW)

**Adapter `talabat` — same `ProviderAdapter` interface as Blink, `tier:"http"`, deterministic JSON parse, NO Claude.**

- **discover()** → resolve dish/restaurant intent to `vendorId`s:
  - `GET /{country}/restaurants` (and `/{country}/cuisine/{type}`) SSR HTML → restaurant **slugs** (verified: `burger-co`, `chicken-tikka`, …).
  - `GET /{country}/{slug}` → parse `__NEXT_DATA__.props.pageProps.data` → **`vendorId`** (verified: 670845). Persist slug→vendorId in `provider_url_cache` (24 h TTL) so repeat queries skip this.
- **fetch()** → `GET /nextMenuApi/v2/branches/{vendorId}/menu` → JSON (verified 200, 140 KB).
- **extract()** → deterministic parse of `result.menu.menuSection[].itm[]`:
  - `nm` → title, `pr` → `price_fils` (×1000; KWD), `opr`/`oldPriceMoney` → was-price ⇒ **`is_promo` + discount %**, `img`/`imgurl` → image, section name → category.
  - **Truthfulness (hard rule, ADR-003 §2):** copy `pr`/`opr` verbatim from the JSON; null if absent; code drops any price not present in the payload. No Claude in this lane = truthful by construction.
- **Cache:** food TTL ~5 min (promos volatile); discovery (slug→vendorId) 24 h.
- **Group:** dish-grouping = the Food analogue of SKU-grouping — group the *same dish at the same restaurant across providers* once Lane 2/3 add other sources; within Talabat alone, each item is one offer. (Tier-1 fuzzy `pg_trgm` on dish name + restaurant, same machinery as ADR-001 SKU Tier-3; below threshold leave ungrouped — do NOT falsely equate different dishes.)
- **Risk:** API is undocumented/internal → can change shape or add anti-bot at any time → guard with `AdapterHealth` auto-mute + kill-switch (ADR-003 §5). **ToS still applies — flagged below.**

**Verdict: buildable-now. This is Slice F-1 and the first thing the Dev Lead builds for Food.**

---

## Lane 2 — Partnership / direct-restaurant ingest (NO scraping; covers the walled apps legally)

For restaurants that exist only on Jahez/Carriage (or any partner who wants in), we **do not scrape** — we **ingest a provider-/restaurant-supplied menu+price feed** through the **same spine**. This is the S0-2 #1 "direct restaurant partnership" path, made concrete.

**New adapter kind: `PartnershipIngestAdapter` (implements `ProviderAdapter`, `tier:"ingest"`).**
- It does **no live fetch of a third-party app.** `fetch()` reads from **our own store** (a `partner_menus` table / Supabase Storage upload), populated by:
  - an **admin upload** (CSV/JSON menu) in the Next.js admin, or
  - a small **partner ingest endpoint** `POST /ingest/menu` (API-key per partner), or
  - a scheduled pull from a partner-supplied URL the partner consents to.
- `extract()` normalizes the partner schema → `NormalizedOffer[]` → identical normalize→group→offers spine.
- **Truthfulness rule still binds:** prices come verbatim from the partner-supplied data; `source:"partner"`, `fetched_at` = upload/ingest time; cards labeled so users see provenance.
- **Legal posture = the cleanest of all lanes:** the data owner gives us the data → no ToS/anti-bot conflict. This is the **right way to represent Jahez/Carriage-only restaurants** in a controlled Food beta without touching their Cloudflare walls.

**Why this matters for the owner's goal:** Food can show a credible, multi-restaurant beta on **Talabat (Lane 1) + a curated partner set (Lane 2)** — zero scraping of any blocked app — and scale by signing restaurants, which is also the B2B data thesis in the backlog.

**Verdict: buildable-now (adapter + admin upload); coverage depends on signing restaurants (PO/BD work, not engineering).**

---

## Lane 3 — Render / residential proxy (DEFERRED, flagged)

| Provider | What it needs | Cost / risk | Recommendation |
|---|---|---|---|
| **Deliveroo** | Tier-2 Playwright render + **postcode injection** to reveal restaurants, then sniff its menu XHR | Render CPU/RAM; postcode-per-area complexity; **continuity risk** (DoorDash GCC pullback, S0-2) | Build **after** Lane 1, only if demand justifies; medium effort |
| **Jahez** | Tier-3: full browser **+ residential egress proxy** to pass Cloudflare JS-challenge (`cf-mitigated: challenge` verified) | Paid residential proxy ($), slow (~4–10 s), fragile, **most ToS-hostile** (403 = explicit non-consent) | **Prefer Lane 2 (partnership) instead.** Build Tier-3 only with PO + counsel go |
| **Carriage** | `526` = origin unreachable even to a browser via normal path; render alone may not fix | Unknown until a real browser test; likely needs proxy too | **Partnership-only** in practice; do not invest in scraping |

YAGNI: **Lane 3 is not on the Food-beta critical path.** Fighting Cloudflare with residential proxies is costly, fragile, and the clearest ToS violation (the 403/526 are intentional non-consent signals). The partnership lane reaches the same restaurants legally.

---

## Phased plan (pragmatic, simplest-viable-first)

- **Phase F-1 (ships first, buildable now):** Talabat Tier-1 JSON adapter (Lane 1) — real prices + promo detection — wired into `resolveOffers` replacing the Food mock for Talabat. Dish-grouping (intra-Talabat). **No Claude, no proxy, no partnerships needed.** ✅
- **Phase F-2 (parallel, no engineering blocker):** Partnership-ingest adapter + admin menu upload (Lane 2). Onboard a **curated restaurant set** (PO/BD signs them). Gives legal Jahez/Carriage-only coverage. ✅
- **Phase F-3 (optional, flagged):** Deliveroo Tier-2 render (postcode flow) — only if demand + continuity hold.
- **Phase F-4 (deferred, needs counsel + budget):** Jahez Tier-3 residential — **only if** partnership coverage proves insufficient AND legal+cost clear. Carriage stays partnership-only.

---

## Buildable interfaces & slices (for bo-dev-lead)

**No new orchestrator surface.** Everything plugs into ADR-003's `ProviderAdapter` + `resolveOffers`. Two adapters + one new tier value.

```ts
type FetchTier = "http" | "render" | "render_residential" | "ingest";   // + "ingest" (new)

// LANE 1 — Talabat (tier:"http"), deterministic JSON, NO Claude
class TalabatAdapter implements ProviderAdapter {
  providerId="talabat"; sector="food"; tier="http"; enabled=true;
  discover(q): ProductRef[]  // slug from /restaurants → vendorId from {slug} __NEXT_DATA__ → cache
  fetch(ref): RawPage        // GET /nextMenuApi/v2/branches/{vendorId}/menu  (json)
  extract(raw): NormalizedOffer[]  // result.menu.menuSection[].itm[] → {nm,pr,opr,img}
                                   // price_fils=pr*1000; is_promo = opr>pr; source:"http"
}

// LANE 2 — Partnership ingest (tier:"ingest"), reads OUR store, never a 3rd-party app
class PartnershipIngestAdapter implements ProviderAdapter {
  providerId="partner:<name>"; sector="food"; tier="ingest"; enabled=true;
  discover(q): ProductRef[]  // query partner_menus by dish/restaurant
  fetch(ref): RawPage        // read partner_menus row (NO external fetch)
  extract(raw): NormalizedOffer[]  // map partner schema → NormalizedOffer; source:"partner"
}
```

**New schema (minimal):**
- `partner_menus(partner_id, restaurant_name, item_name, price_fils, old_price_fils?, category, image_url?, available, ingested_at)` + a `partners(id, name, api_key_hash, tos_reviewed, enabled)` row. RLS: partner writes only own rows; reads server-side. Reuses `provider_url_cache` for Talabat slug→vendorId.

**Slices:**
- **Slice F-1 (FIRST):** `TalabatAdapter` end-to-end, replace Food mock for Talabat in `resolveOffers`; `provider_url_cache` for vendorId; food TTL 5 min; `allSettled` partial results; truthfulness via verbatim JSON copy. **DoD:** a real query returns live Talabat dish prices + promo flags matching the live menu API (QA assert against the JSON), repeat query hits cache, adapter kill-switch works.
- **Slice F-2 (parallel):** `PartnershipIngestAdapter` + `partner_menus`/`partners` + admin upload (Next.js) + `POST /ingest/menu` (api-key). **DoD:** a partner CSV upload surfaces those restaurants' dishes in `resolveOffers`, labeled `source:"partner"`, kill-switchable per partner.
- **Slice F-3 / F-4:** Deliveroo render / Jahez residential — behind `providers.tos_reviewed` + feature flag, NOT in the Food-beta build.

**Truthfulness rule (team-wide, marked):** every Food price/promo on a card comes verbatim from (a) the Talabat JSON payload or (b) the partner-supplied feed; null if absent; code drops any price not present in source. Claude only ranks/explains — never invents a price or discount. `source` + `fetched_at` shown on every card.

---

## Consequences

- (+) **Food ships a real beta with ZERO scraping of any walled app:** Talabat JSON API (verified) + partnership ingest. Lowest-risk path to the owner's goal.
- (+) Talabat carries native promo data (`opr` old-price) → directly powers "best offer" without inference.
- (+) Partnership lane is the cleanest legal posture and doubles as the B2B data asset (backlog thesis).
- (+) Spine, orchestrator, ranking unchanged — Food = two adapters + one tier value + one small table.
- (−) Talabat's menu API is undocumented/internal → can change or add anti-bot anytime → guarded by health auto-mute + kill-switch; selector/schema monitoring needed.
- (−) Jahez/Carriage real-app coverage depends on **signing restaurants** (BD effort), not code — engineering can't conjure it.
- (−) Lane 3 (Deliveroo render, Jahez residential) is costly/fragile/ToS-hostile and deliberately deferred.

## Legal / ToS flags (owner directing — NOT blocking, but counsel-flagged)

- **Talabat JSON API:** publicly reachable, no auth/challenge, robots allows the sitemap paths — **lower risk than the Cloudflare-walled apps**, but it is an *internal* endpoint; reading + republishing menu/price/image at query time still likely runs against Talabat ToS and raises IP/database-right questions. **Route to counsel.** Behind `providers.tos_reviewed` + kill-switch before public release.
- **Jahez (403) / Carriage (526):** the walls are **intentional non-consent signals.** Scraping them via residential proxy is the clearest ToS violation and is **deferred**; prefer the partnership lane. Tier-3 needs explicit counsel + PO go + a residential-egress budget (paid, recurring).
- **Partnership lane = cleanest:** data owner consents → no ToS/anti-bot conflict. Recommended as the primary path for the walled-app restaurants.
- **Deliveroo:** `Disallow: /api/` in robots + continuity risk → de-prioritize.

---

## Handoff

**To bo-dev-lead (first buildable Food slice):**
- **Done:** ADR-005 — verified live spike; 3-lane Food strategy behind the unchanged `ProviderAdapter`/`resolveOffers` spine; per-provider verdicts; `TalabatAdapter` (Tier-1 JSON) + `PartnershipIngestAdapter` (new `tier:"ingest"`) interfaces; `partner_menus`/`partners` schema; phased plan; truthfulness + legal flags.
- **Next (Slice F-1):** Build **`TalabatAdapter`** end-to-end (discover slug→vendorId, fetch `/nextMenuApi/v2/branches/{vendorId}/menu`, deterministic extract `nm`/`pr`/`opr`, promo flag), replace the Food mock for Talabat in `resolveOffers`. Then **Slice F-2** `PartnershipIngestAdapter` + admin upload in parallel. No Claude, no proxy in either.
- **Owner:** bo-dev-lead (build), bo-tech-architect (interface authority), bo-qa-backend (price-verbatim + promo + partial-results + kill-switch asserts against the real Talabat JSON).
- **Blockers/risks:** Talabat menu API is undocumented → schema-drift/anti-bot risk (mitigate: health auto-mute + monitoring); dish-grouping false positives (trust-critical, keep threshold conservative).

**To PO (decisions / risks):**
- **Per-provider verdict:** Talabat = **BUILDABLE-NOW** (verified plain JSON price API, 130 items + promos); Deliveroo = **NEEDS-RENDER** (postcode-gated, continuity risk); Jahez = **NEEDS-PROXY** (Cloudflare 403) — prefer partnership; Carriage = **PARTNERSHIP-ONLY** (Cloudflare 526, unreachable).
- **Decision:** Food beta ships on **Talabat API + partnership ingest — no scraping of any blocked app.** Jahez/Carriage real-app scraping is deferred and not on the launch path.
- **You/BD action:** to cover Jahez/Carriage-only restaurants, **sign a curated restaurant set** for the partnership lane (engineering can't substitute this). 
- **Cost/legal:** Talabat lane adds ~no infra cost (Tier-1). Tier-3 (Jahez residential) = paid recurring proxy + fragility — **recommend NOT building.** Route the live-read/republish ToS+IP question (Talabat especially) to **counsel**; not blocking per your direction, but clear `tos_reviewed` before public release.
