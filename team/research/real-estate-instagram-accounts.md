# Real Estate Category — Kuwait DIRECT flat-previewing Instagram Accounts (seed tracking list)

> Owner: bo-researcher · Date: 2026-06-26 · Decision this informs: which **direct** real-estate IG accounts (individual brokers/agents/landlords who PREVIEW actual units with details) to seed into the Real Estate category.

> ## 🔴 SOURCING RULE (NON-NEGOTIABLE): DIRECT listers, NOT aggregators
> We track accounts that **preview actual flats with full details (area, rooms, rent, photos/videos)** and take enquiries via DM/WhatsApp — individual brokers/agents/furnished-apartment operators/landlords posting their OWN units.
> We do **NOT** track aggregator portals or repost pages as IG "accounts" here (q84sale, Boshamlan, Bayut, OpenSooq) — those are handled separately as the **portal data layer** in `real-estate-providers-feasibility.md`. This file is the IG **direct-lister** complement.

> **Verification legend:** **[V]** = handle independently confirmed (search-indexed IG profile / directory) with description of what it lists. **[CONFIRM]** = real candidate, confirm handle/activity before tracking. No handles fabricated.

---

## TL;DR (lead with the answer)
- **The most reliable, currently-active DIRECT flat-listers on Kuwait IG are the furnished-apartment operators** (daily/weekly/monthly rentals) — they post their OWN units with photos, area, rooms and contact numbers in nearly every post. These are the strongest verified seeds (§A).
- **~5 verified direct-lister handles** below + a "from-owner" (من المالك) long tail that, like food home-kitchens, must be **harvested live** (login-walled) rather than invented.
- **Important honesty flag (consistent with prior recon):** IG is **RED as an automated data source** — unauth fetch returns a login-walled header only (no posts/captions/prices). Even verified direct-lister accounts can't be scraped cheaply/legally at scale. **For Real Estate the PORTALS (q84sale + Boshamlan) remain the GREEN primary data source.** These IG accounts are best used as (a) a **discovery signal** for active direct landlords and (b) a *possible* future ingestion source only if an authenticated IG path is built. WHAT-to-track is below; HOW-to-ingest = bo-dev-lead/Architect.

Activity: H = posts most days · M = weekly-ish · L = sporadic. Price: Y = posts rent KWD in caption · DM = price via DM/phone.

---

## A. Furnished-apartment operators (daily/weekly/monthly) — DIRECT listers, post own units
Strongest verified segment: they preview their own furnished units with photos + area + contact in-caption.

| Handle | Lists | Area focus | Activity | Price/details in caption | AR/EN | Ver |
|---|---|---|---|---|---|---|
| @majestic_kuwait | Furnished apartments, daily/weekly/monthly, hotel-style; branches | Salmiya (65668010), Hawalli (66912020) | M-H | Y (photos + rooms + phone) | AR/EN | [V] |
| @amadell_for_rent | Luxury furnished apartments, daily rent | Mangaf & Mahboula (65661834 / 65661517) | M-H | Y (photos + phone) | AR/EN | [V] |
| @q8_rent | Apartments & floors for rent across Kuwait, ~177K | KW-wide | H | Y/DM (photos + details) | AR/EN | [V] |

## B. Broker / agent / from-owner (من المالك) direct listers
Individual brokers/landlords posting actual rental units with details. Verifiable anchors below; the broader من المالك long tail must be live-harvested (§3).

| Handle | Lists | Activity | Price/details | AR/EN | Ver |
|---|---|---|---|---|---|
| @rent_kuwait | "من المالك مباشر" — flats for rent, various floors, with details/reels | M-H | Y/DM | AR | [CONFIRM] confirm handle+activity (reel verified, profile confirm) |
| @reokuwait | Real Estate Online Kuwait — flats, esp. Salmiya (~470 followers, small) | L-M | DM | AR/EN | [V] (small/low-activity) |
| Individual broker/landlord (من المالك) long tail | Own units, area+rent+photos | varies | DM dominant | AR-first | **Harvest live — see §3** |

> Agencies with priced web inventory (Hilite Homes, Best Homes, Q8 Realtor) also run IG, but their **website is the better, server-rendered source** — track via portals/website, not IG (see feasibility doc).

---

## Seed list for bo-dev-lead — VERIFIED handles for Apify `HANDLES.realestate`
Drop-in [V] handles (strip @). **Note:** for Real Estate, portals (q84sale + Boshamlan) are the GREEN primary; these IG handles are a secondary/discovery layer pending an authenticated IG ingestion decision.

```
HANDLES.realestate = [
  # Furnished-apartment operators (strongest direct listers)
  "majestic_kuwait", "amadell_for_rent", "q8_rent",
  # Direct broker / from-owner
  "reokuwait",
]
# CONFIRM-before-adding: rent_kuwait (verify profile handle + activity)
# DO NOT ADD as IG "accounts": q84sale / boshamlan / bayut / opensooq — those are PORTAL sources (see real-estate-providers-feasibility.md).
# من المالك (from-owner) long tail: HARVEST LIVE via hashtag/geo crawl — see §3.
# PRIMARY DATA PATH for Real Estate remains q84sale + Boshamlan portals (GREEN, server-rendered).
```

---

## 3. From-owner long tail — harvest live (not invented)
- Anchors: `#شقق_للايجار_الكويت`, `#من_المالك`, `#عقار_الكويت`, area tags (السالمية، حولي، المهبولة، المنقف، الجابرية). Resolving these to real active KW handles needs the **live IG graph** (login-walled). I did not invent من المالك handles.
- **Recommended:** authenticated hashtag/geo crawl → KW + recent-activity filter → human-curate → append. But weigh against the fact that **portals already aggregate this same supply in a GREEN, server-rendered, scrapable form** — IG harvest is lower ROI here than for food.

## 4. Ingestion / data notes
- IG = RED data source (login wall; Graph API = owned accounts only). Verified again on @reokuwait in prior recon (header-only, no posts/prices).
- Direct-lister captions: furnished operators usually post **area + rooms + phone + photos**; rent price sometimes Y, often **DM/phone**. Need price-on-request handling.
- AR-first, AR/EN mix; area names need the AR↔EN alias map already specified in the feasibility doc.
- **Net recommendation:** keep Real Estate's primary ingestion on **portals (q84sale + Boshamlan, GREEN)**; treat these IG direct-listers as discovery + optional secondary, not the backbone.

---

## Sources (verified 2026-06-26)
- https://www.instagram.com/majestic_kuwait/ (furnished apts, Salmiya/Hawalli, daily/weekly/monthly)
- https://www.instagram.com/amadell_for_rent/ (luxury furnished daily, Mangaf/Mahboula)
- https://www.instagram.com/q8_rent/ (apartments & floors for rent KW-wide, ~177K)
- https://www.instagram.com/reokuwait/ (Real Estate Online Kuwait — flats, Salmiya; small/low-activity; login-walled to fetch — verified prior recon)
- https://www.instagram.com/rent_kuwait/ (من المالك مباشر, flats for rent — reel verified; confirm profile/activity)
- Portal data layer (NOT IG, the GREEN primary): see `team/research/real-estate-providers-feasibility.md` (q84sale, Boshamlan)
