# ADR-006 — Instagram-as-a-Data-Source Ingestion (Food + Real Estate, social tier)

> Owner: bo-tech-architect · Status: **accepted with conditions** (owner-directed: IG-sourced offers are in scope; legal sign-off pending) · 2026-06-26
> Builds on **ADR-003** (live AI-fetch pipeline, `ProviderAdapter` spine) and **ADR-005** (Food strategy, partnership-ingest pattern). Reuses the unchanged spine: `ProviderAdapter` → `normalize` → group → `offers`/`offer_history`, `resolveOffers(...) → Offer[]`, TTL cache, kill-switch, `providers.tos_reviewed`. Adds **one new adapter tier `social`** + a small ingestion pipeline.
> Inputs: `real-estate-providers-feasibility.md` (IG direct fetch = **RED**, verified 2026-06-26). Owner vision: track curated IG accounts that sell only on IG (KW restaurants / home-kitchens / RE agents) → Claude reads each post → structured offer → result card whose CTA is the **IG permalink** (opens the exact post on the phone). We never republish the post — short snippet + link only.
> Legend: ✅ verified by live check today · 🟡 inferred from vendor docs/pricing pages · 🔸 directional.

---

## TL;DR (lead with the answer)

- **Is it buildable? YES — but only through a commercial IG data provider, never by us fetching IG directly.** The prior research (IG = RED) was about *our own* direct fetch: IG serves an unauthenticated client only the profile header — no posts, captions, or prices. That conclusion stands. The owner's model is different: a **3rd-party IG data API** (Apify / Bright Data / etc.) does the acquisition; we consume structured JSON (caption, media URL, **permalink**, timestamp), then **Claude extracts** the offer. That is buildable today.
- **Recommended provider: Apify "Instagram Scraper" (`apify/instagram-scraper`)** as the lead, **Bright Data Instagram Scraper API** as the fallback/scale option. Both verified today to (a) take an **account/profile URL as input**, (b) filter **posts newer than a date** (`onlyPostsNewerThan` — exactly our "last 20–30 days"), and (c) return **caption, timestamp, post `url`/permalink, media URLs**. ✅
- **Rough monthly cost for the owner's target (50 food + 20 RE accounts, refreshed daily):** **~$30–$60/month** of IG-data spend on Apify's Starter/Scale plan, **plus ~$10–$30/month of Claude (Haiku) extraction** = **~$45–$90/month all-in.** Cheap. The cost lever is *refresh cadence × accounts × posts-per-account*, all of which we control. (Math in §3.)
- **The real risk is NOT cost — it is legal/ToS and breakage.** The provider scrapes IG against Meta's ToS on our behalf; we are the directing party. Meta can block the provider (data gaps), and the legal posture (Meta ToS + image/caption IP) is **stronger exposure than the portal/Talabat cases** and **must go to counsel before public launch.** Owner is directing, not blocking — we build behind `tos_reviewed` + a kill-switch and ship to a curated allow-list first.
- **Truthfulness rule is load-bearing here:** IG captions are free-form; prices live in image text or are absent. Claude copies a price **only if it literally appears** in caption/image; otherwise the card shows **"price on request — see post"** and the permalink. We never invent a price, and we never republish the post body — short snippet + link.

---

## Context — why this ADR exists and what changed

The owner wants a category where **the data source is Instagram accounts**, because in Kuwait many restaurants / home-kitchens and many RE agents sell **only on IG** — that inventory is invisible to Talabat (ADR-005) and the property portals (RE research). So IG is not a duplicate source; it is **net-new supply** the other lanes can't reach.

The blocker from prior research: **`instagram.com/<account>/` to an unauthenticated client returns header-only — no posts/captions/prices** (✅ re-confirmed; IG gates content behind login + anti-bot). So *we* cannot read IG. ADR-006 resolves this by **moving the acquisition off our infrastructure onto a commercial IG data API** and keeping our system as a *consumer of structured post JSON*. This is the same architectural move as ADR-005's partnership-ingest lane: the risky fetch happens outside our box; we ingest a clean record.

---

## 1. Acquisition feasibility — the crux (verified today)

### 1a. Commercial IG data APIs (the only realistic path at scale)

| Provider | By-account + last-N-days? | Returns permalink / caption / media / timestamp? | Cost model (verified ✅ unless noted) | ToS/legal posture | Verdict |
|---|---|---|---|---|---|
| **Apify `apify/instagram-scraper`** | ✅ **Yes.** Input = profile URL/username (`directUrls`), `resultsType=posts`, **`onlyPostsNewerThan`** date filter + `resultsLimit` per URL. ✅ | ✅ **Yes** — dataset rows carry `caption`, `timestamp`, post **`url`** (= permalink), `displayUrl`/video URLs, carousel children, owner, hashtags, `price_range` when present. ✅ | **Pay-per-result.** Free trial credit, then **Starter $30/mo → $2.30/1k results (~16.9k/mo)**; **Scale → $1.90/1k**; **Business → $1.50/1k**; pay-as-you-go base $2.70/1k. ✅ | Apify is a generic scraping platform; *we* direct it at IG → liability flows to us. Operates under the *hiQ/Bright Data* public-data line **but logged-in/anti-bot scraping is NOT clearly blessed**. | **LEAD — buildable now** |
| **Bright Data Instagram Scraper API** | ✅ Yes — discover/collect by profile URL; dataset API. 🟡 date-window via params/post-filter | ✅ Yes — structured records incl. URL, caption, timestamp, media, owner. 🟡 | **Pay-per-record.** PAYG **~$1.5/1k**, no-commit **$0.001/record = $1/1k**, growth plans **$499→$1.3/1k**, etc. "No specific usage limits." ✅ | Largest scraping vendor; markets "compliance" but same fundamental Meta-ToS tension. | **FALLBACK / scale** |
| **ScrapingBee / Scrapfly / etc.** | 🔸 Generic HTML/JS render — you build the IG parsing yourself; fragile vs Apify's maintained actor | partial — you extract fields | request-based (~$0.x/req) | same | **NOT recommended** (we'd own the breakage Apify maintains for us) |
| **Phyllo / Insense / creator-data APIs** | ❌ **No for our use case.** These return data for **creators who CONNECT/authorize their own account** (OAuth) — not arbitrary public accounts we choose. | n/a | subscription | **Clean ToS** (consented) | **N/A** for "track any account"; *could* power an opt-in partner program later |

**Official Meta options — and why they don't solve this:**
- **Instagram Graph API** — only exposes media for **Business/Creator accounts you own or that explicitly grant your app access** (App Review + token). It **cannot** pull an arbitrary restaurant's or agent's feed. ✅ (Same finding as RE research.) Useful only if we run an **opt-in partner program** where accounts authorize us (see §3 Phase 3).
- **oEmbed** — single-post embed by URL; **no by-account listing, no caption text for arbitrary posts**; needs an app token. Not a discovery mechanism. ✅ (`/instagram-platform/oembed` reachable; 400 without token — expected.)
- **Net:** there is **no official API to read arbitrary public accounts.** Either a commercial scraper (Apify/Bright Data) **or** an opt-in partner OAuth program. For the owner's "we pick the accounts to track" model, it's the commercial scraper.

### 1b. Verdict on acquisition

> **Buildable: YES**, via Apify (lead) / Bright Data (fallback). They do exactly what the vision needs — **by-account, last-20–30-days, with permalink + caption + media + timestamp** — at trivial cost. The constraints are **legal (Meta ToS / IP)** and **continuity (provider can be blocked by IG)**, not technical capability or price.

---

## 2. Pipeline design (one pipeline, both verticals, behind the unchanged spine)

```
 tracked_accounts (curated allow-list, admin-managed)
        │  per account: handle, vertical(food|realestate), enabled, last_pull_at
        ▼
 [Scheduler]  BullMQ repeatable job (cadence per §3) — one job per account
        │  builds Apify run: directUrls=[profile], resultsType=posts,
        │  onlyPostsNewerThan = now-30d, resultsLimit = 30
        ▼
 [SocialIngestAdapter]  tier:'social'  (NEW, behind ProviderAdapter)
        │  discover()  → calls Apify actor, polls run, pulls dataset rows (raw posts)
        │  fetch()     → returns RawPost[] {caption, mediaUrls[], permalink(url), timestamp, ownerHandle}
        │  extract()   → Claude (Haiku) reads caption + image → NormalizedOffer | null
        ▼
 [Claude extraction]  per post, Haiku 4.5, structured-output schema (§2a)
        │  TRUTHFULNESS: copy only what's literally present; price=null if absent; never invent
        │  classifier: is this an OFFER? (skip memes/reposts/"we're hiring") → drop non-offers
        ▼
 [Cache + store]  social_offers (TTL ~6–12h; longer than food's 5min — IG posts are static)
        │  dedup key per vertical (§2b)
        ▼
 [resolveOffers(...)]  social offers merge into the SAME Offer[] as other tiers (unchanged)
        ▼
 [Result card]  snippet + price-if-known + "📷 View on Instagram" → CTA = permalink deep-link
                (instagram://media?id=... on device, https://instagram.com/p/<shortcode>/ fallback)
```

**Why behind `ProviderAdapter` (tier:`social`):** the orchestrator still only calls `resolveOffers` (ADR-003). Tier routing is internal. Adding IG = adding adapters + a scheduled feeder, **zero change to search/intent/ranking**. The only spine extension is a new `tier` value and a new store table — exactly like ADR-005 added `tier:'ingest'`.

### 2a. Extraction schemas (Claude structured output)

**Food** (per post):
```jsonc
{
  "is_offer": true,                 // classifier; false → dropped
  "item": "Mixed grill platter",    // verbatim/normalized from caption|image
  "desc": "serves 2, includes drink",
  "price_fils": 2500,               // ONLY if a price literally appears; else null
  "price_basis": "caption|image_text|null",  // provenance of the price (auditable)
  "restaurant": "@handle or named brand",
  "area": "Salmiya",                // if stated; else null
  "permalink": "https://www.instagram.com/p/CxYz.../",
  "posted_at": "2026-06-20T18:00:00Z",
  "confidence": 0.0-1.0
}
```
**Real estate** (per post):
```jsonc
{
  "is_offer": true,
  "deal_type": "rent|sale",
  "area": "Mahboula",
  "block": null,
  "rooms": 2,                       // bedrooms; null if unstated
  "rent_kwd_fils": 350000,          // rent: monthly in fils; null if "call for price"
  "sale_price_fils": null,
  "furnished": "furnished|semi|unfurnished|null",
  "permalink": "https://www.instagram.com/p/.../",
  "posted_at": "...",
  "confidence": 0.0-1.0
}
```
**Rules (enforced in code, not just prompt):**
- Price/numeric fields **null unless the token is present** in caption or image text; a post-extraction guard drops any price string not found in the source row (same guard as ADR-003 T2).
- `permalink` and `posted_at` come **straight from the Apify row**, never from Claude — non-hallucinatable.
- `is_offer=false` or `confidence < threshold` → not surfaced.
- Image read: pass the post image to Haiku (vision) **only when the caption lacks a price** and the vertical needs one — keeps token cost down (most food promos put the price in the image, most RE in the caption).

### 2b. Dedup & freshness
- **Food dedup key:** `restaurant_handle + normalized(item) + price_fils` (conservative; same dish reposted weekly shouldn't show 4×).
- **RE dedup key:** `area + rooms + rent/sale price + (phone if in caption)` — reuse the RE de-dup approach from the RE research; an agent posts the same flat repeatedly.
- **Freshness:** surface `posted_at`; label posts > N days as "posted X days ago." IG offers are static once posted, so cache TTL is longer than live-fetch tiers (6–12h), which also caps Apify spend.

---

## 3. Phasing & cost control

### Cost math (verified rates)
- Owner target: **50 food + 20 RE = 70 accounts**, ~**30 posts each**, **daily** refresh.
- But with `onlyPostsNewerThan`, after the first backfill we only pull **NEW** posts/day. Realistically ≤ a few new posts/account/day. Two honest scenarios:

| Scenario | Results/month | Apify cost (@ $2.30/1k Starter → $1.90 Scale) | Claude extract (Haiku, ~70k posts/mo worst case, trimmed slice + occasional vision) | All-in |
|---|---|---|---|---|
| **Naive** (re-pull all 30 posts/account daily) | 70 × 30 × 30 = **63,000** | **~$120–145/mo** | ~$20–40/mo | **~$140–185/mo** |
| **Smart** (`onlyPostsNewerThan`: backfill once, then deltas; ~3 new posts/acct/day) | 70×30 (backfill) + 70×3×30 ≈ **8,400/mo** | **~$20–30/mo** (fits Starter $30 plan) | ~$8–15/mo | **~$30–45/mo** |

> **Recommended: the smart path → ~$30–60/month all-in.** Daily delta pulls + 6–12h cache + curated 70-account list keep it well inside Starter/Scale plans. **Cost is a non-issue; this is the cheapest data lane we have.**

### Phasing
- **Phase 1 (build first — curated, food-first):** `SocialIngestAdapter` (Apify) + `tracked_accounts` admin CRUD + Haiku extraction + `social_offers` store + permalink CTA. Start with **~10 hand-picked food accounts** (home-kitchens / IG-only restaurants). Behind `providers.enabled` + `tos_reviewed=false` (internal-only until counsel clears). Proves the loop end-to-end cheaply.
- **Phase 2:** add **RE accounts** (~10 agents) using the same adapter, RE schema. Add Bright Data as failover provider behind a `SocialProvider` sub-interface (mock | apify | brightdata) so we're not single-vendor-locked.
- **Phase 3 (optional, cleanest legal path):** **opt-in partner program** — restaurants/agents authorize us via IG Graph API OAuth; those accounts move from scraped to consented (no ToS risk, fresher). Doesn't block Phases 1–2.

### Cost-control & kill-switch
- `onlyPostsNewerThan` + per-account `last_pull_at` → only deltas. `resultsLimit=30` hard cap per account.
- Cache TTL 6–12h; no per-query IG fetch (search reads `social_offers`, never triggers Apify live — decouples user traffic from data spend).
- **Monthly Apify credit cap** + alert; **per-account and global kill-switch** (`providers.enabled`); auto-mute an account after N empty/failed pulls (deleted/private account → degrade, app survives).
- Curated allow-list only — **no open "track any account" feature at MVP** (caps cost and legal surface).

---

## 4. Legal / ToS — flags for counsel (owner directing, NOT us blocking)

Route these to counsel **before any public (non-internal) launch** of the IG lane:
1. **Meta/Instagram ToS:** using a 3rd-party scraper to collect public IG posts at scale is against Meta's Terms; **we are the directing party** even though Apify runs the fetch. Higher exposure than the SEO-public portals (RE) or Talabat's same-origin API (ADR-005). This is the **single biggest legal flag in the project so far.**
2. **Copyright / IP of captions + images:** we must **not republish** the post. Design already enforces *short snippet + link only*; confirm with counsel that snippet length + thumbnail use (if any) is fair/defensible, or show **text-only + permalink** (safest).
3. **Personal data:** RE/home-kitchen captions often contain a **phone number / personal name**. Treat as PII — store minimally, don't surface beyond what's needed to contact, align with the privacy wall (ADR-001/004). Possible PDPL/GDPR-style considerations.
4. **Provider indemnity:** check Apify/Bright Data ToS for who bears liability if Meta acts; prefer the vendor that contractually covers data collection.
5. **Mitigation already in design:** curated allow-list (not mass scrape), `tos_reviewed` gate, kill-switch, no wholesale republish, opt-in Phase-3 path as the clean long-term answer.

> Posture (consistent with ADR-003/005): **owner is directing us to build it; we build it gated** (`tos_reviewed=false`, internal-only) and **do not flip it public until counsel signs off.** We surface the risk loudly; we don't unilaterally block the owner's product call.

---

## Decision (summary)

1. **Adopt Apify `instagram-scraper` (lead) + Bright Data (fallback)** as the acquisition layer; we never fetch IG ourselves.
2. **New `tier:'social'` `SocialIngestAdapter`** behind the unchanged `ProviderAdapter`/`resolveOffers` spine; new `SocialProvider` sub-iface (mock|apify|brightdata).
3. **Claude (Haiku) extraction** to the food/RE schemas in §2a with hard truthfulness guards; permalink + posted_at taken verbatim from the provider row.
4. **Permalink CTA** = `instagram://` deep-link (https fallback) opening the exact post.
5. **Curated allow-list, daily delta pulls, 6–12h cache, kill-switch** → ~$30–60/mo all-in.
6. **Gated `tos_reviewed=false` / internal-only** until counsel clears; **mock provider default** so dev needs no Apify key.

### New schema
- `tracked_accounts`(id, handle, vertical, enabled, last_pull_at, added_by, notes)
- `social_offers`(id, vertical, restaurant_or_agent, item/area fields per §2a, price_fils?, permalink, posted_at, source_provider, confidence, fetched_at, ttl) — append-history optional (lower value than price-time-series; defer).
- `providers` row per social provider with `tos_reviewed`, `enabled`.
- `.env.example`: `SOCIAL_PROVIDER=mock|apify|brightdata`, `APIFY_TOKEN`, `APIFY_IG_ACTOR=apify/instagram-scraper`, `SOCIAL_MONTHLY_RESULT_CAP`.

---

## Handoff
- **Done:** ADR-006 written (`team/architecture/ADR-006-instagram-ingestion.md`). Honest feasibility + pipeline design + cost + legal flags. Provider capabilities/pricing **verified by live check 2026-06-26** (Apify `onlyPostsNewerThan` by-account, returns url/caption/timestamp/media, $2.30→$1.50/1k; Bright Data ~$1–1.5/1k pay-per-record). Memory updated.
- **Verdict:** **BUILDABLE — YES**, via a commercial IG data API (we never fetch IG directly; the prior IG=RED finding was about *our* direct fetch and still holds). **Best provider: Apify `instagram-scraper`** (Bright Data fallback). **Rough cost for 50 food + 20 RE daily: ~$30–60/month all-in** (smart delta-pull path) — cost is a non-issue. **Real risk = Meta ToS/IP (highest legal flag in the project) + provider-can-be-blocked continuity**, not money.
- **Phase-1 build for Dev Lead:** `SocialIngestAdapter` (tier:`social`, behind `ProviderAdapter`/`resolveOffers` — no change to search/intent/ranking) + `tracked_accounts` admin CRUD + scheduled BullMQ delta-pull (Apify, `onlyPostsNewerThan=30d`, `resultsLimit=30`) + Haiku extraction to §2a schemas with truthfulness guards (price null unless literal; permalink/posted_at verbatim) + `social_offers` store (TTL 6–12h) + permalink deep-link CTA. **Food-first, ~10 curated accounts, `SOCIAL_PROVIDER=mock` default** (no key needed for dev). Gated `tos_reviewed=false`, kill-switch, monthly result cap.
- **Next:** PO approves (decisions below) → BA writes AC for the IG-offer card + clarifier slots (reuse RE/food slots) → UX designs the "View on Instagram" card → Dev Lead slices Phase 1.
- **Owner / PO must approve:**
  1. **Open an Apify account** — Starter plan **$30/mo** (or PAYG). Doesn't block dev (mock default).
  2. **Legal sign-off on the IG ToS/IP/PII flags (§4) before public launch** — biggest legal flag in the project; recommend text-snippet + permalink only (no thumbnail republish) pending counsel.
  3. **Confirm curated allow-list scope** (no open "track any account" at MVP) and **provide the initial ~10 food + ~10 RE handles** to seed `tracked_accounts`.
  4. **Refresh cadence = daily delta** (recommended; keeps cost ~$30–60/mo) vs more frequent — confirm.
- **Blockers/risks:** (1) **Meta ToS/IP** — gated until counsel. (2) **Continuity** — Apify/Bright Data can be blocked by IG → data gaps; dual-provider failover + kill-switch mitigate, but IG-only inventory has no fallback source by definition. (3) **Caption price-absence** — many posts have no price → card must degrade to "price on request — see post"; truthfulness guard prevents invented prices. (4) **PII in captions** (phone/name) — handle per privacy wall.
