# Real Estate Category — Kuwait DIRECT flat-previewing Instagram Accounts (seed tracking list)

> Owner: bo-researcher · Date: 2026-06-27 (DEEP-DIVE EXPANDED) · Decision this informs: which **direct** real-estate IG accounts (individual brokers/agents/landlords who PREVIEW actual units with details) to seed into the Real Estate category.

> **DB-READY SEED:** every account below is in `team/research/ig-accounts-seed.json` (sector=realestate) with `category` (rent/sale/agency), `follower_tier`, `recency`, `status` → bo-dev-lead imports directly into `tracked_accounts`.
> **Deep-dive pass (2026-06-27):** expanded from ~5 to **14 RE handles (11 VERIFIED + 3 CONFIRM)** — added high-activity rent listers (rent_aqar ~34K, q8house_rent ~11K, real_estate_rent_q8, q8kw2020) and rent+sale agencies (besthomesq8 ~12K, aljahra_realestate ~52K, q8aqarcom ~6K). IG unauth fetch re-confirmed login-walled — IG stays RED to automate; **portals (q84sale + Boshamlan) remain the GREEN primary RE source**, these IG accounts are discovery/secondary.

> ## 🔴 SOURCING RULE (NON-NEGOTIABLE): DIRECT listers, NOT aggregators
> We track accounts that **preview actual flats with full details (area, rooms, rent, photos/videos)** and take enquiries via DM/WhatsApp — individual brokers/agents/furnished-apartment operators/landlords posting their OWN units.
> We do **NOT** track aggregator portals or repost pages as IG "accounts" here (q84sale, Boshamlan, Bayut, OpenSooq) — those are handled separately as the **portal data layer** in `real-estate-providers-feasibility.md`. This file is the IG **direct-lister** complement.

> **Verification legend:** **[V]** = handle independently confirmed (search-indexed IG profile / directory) with description of what it lists. **[CONFIRM]** = real candidate, confirm handle/activity before tracking. No handles fabricated.

---

## TL;DR (lead with the answer)
- **The most reliable, currently-active DIRECT flat-listers on Kuwait IG are the furnished-apartment operators** (daily/weekly/monthly rentals) — they post their OWN units with photos, area, rooms and contact numbers in nearly every post. These are the strongest verified seeds (§A).
- **14 RE handles (11 VERIFIED + 3 CONFIRM)** below — furnished operators (§A), high-activity unfurnished rent listers (§A2), and rent+sale agencies (§C) — plus a "from-owner" (من المالك) long tail that, like food home-kitchens, must be **harvested live** (login-walled) rather than invented. Counts: rent 9 · agency 3 · CONFIRM 2 (rent_kuwait, aqar_kw0).
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

## A2. Unfurnished apartments/floors for rent — high-activity DIRECT rent listers (NEW, deep-dive)
Licensed KW rent-marketing accounts posting actual units (area + rooms + photos + phone). High posting cadence = rich window.

| Handle | Lists | Area focus | Activity | Price/details | AR/EN | Ver |
|---|---|---|---|---|---|---|
| @rent_aqar | للإيجار شقق وادوار — licensed KW co; ~34K, WhatsApp 60016232 | Jabriya/Salmiya/Bayan/Zahra etc | H | DM (photos + area + phone) | AR | [V] |
| @q8house_rent | Property for rent — apts & villas, ~11K, 60032224 | KW-wide | M-H | DM | AR/EN | [V] |
| @real_estate_rent_q8 | للايجار قسايم/فلل/ادوار/شقق | KW-wide | M | DM | AR | [V] |
| @q8kw2020 | شقق/ادوار/فلل للإيجار بالكويت | KW-wide | M | DM | AR/EN | [V] |

## B. Broker / agent / from-owner (من المالك) direct listers
Individual brokers/landlords posting actual rental units with details. Verifiable anchors below; the broader من المالك long tail must be live-harvested (§3).

| Handle | Lists | Activity | Price/details | AR/EN | Ver |
|---|---|---|---|---|---|
| @rent_kuwait | "من المالك مباشر" — flats for rent, various floors, with details/reels | M-H | Y/DM | AR | [CONFIRM] confirm handle+activity (reel verified, profile confirm) |
| @reokuwait | Real Estate Online Kuwait — flats, esp. Salmiya (~470 followers, small) | L-M | DM | AR/EN | [V] (small/low-activity) |
| Individual broker/landlord (من المالك) long tail | Own units, area+rent+photos | varies | DM dominant | AR-first | **Harvest live — see §3** |

> Agencies with priced web inventory (Hilite Homes, Best Homes, Q8 Realtor) also run IG, but their **website is the better, server-rendered source** — track via portals/website, not IG (see feasibility doc).

## C. Rent + SALE agencies (direct, post own listings) — NEW deep-dive
These agencies post their OWN priced/described listings for BOTH rent and sale; useful as the only verified path to the SALE category on IG (sale long tail is otherwise portal-led).

| Handle | Lists | Activity | Price/details | AR/EN | Ver |
|---|---|---|---|---|---|
| @besthomesq8 | Best Homes — apts/floors/villas RENT **and SALE** (besthomeskw.com), ~12K | H | DM | AR/EN | [V] |
| @aljahra_realestate | عقارات الجهراء — sale/buy/rent, Jahra-focused, ~52K | H | DM | AR | [V] |
| @q8aqarcom | عقارات الكويت — rent apts, houses for sale, exchange (q8aqar.com), ~6K | M | DM | AR | [V] |
| @aqar_kw0 | عقار الكويت بيع/شراء/ايجار | M | DM | AR | [CONFIRM] confirm activity/handle |

> SALE-only individual lister long tail (شقق/فلل للبيع من المالك) is **portal-dominated** — q84sale/Boshamlan/q8aqar aggregate it far better than scattered IG accounts. Do NOT invent SALE handles; harvest live only if SALE-on-IG proves a real gap.

---

## Seed list for bo-dev-lead — VERIFIED handles for Apify `HANDLES.realestate`
Drop-in [V] handles (strip @). **Note:** for Real Estate, portals (q84sale + Boshamlan) are the GREEN primary; these IG handles are a secondary/discovery layer pending an authenticated IG ingestion decision.

```python
HANDLES_REALESTATE = {
  # RENT — furnished operators (strongest direct listers, post own units)
  "rent": [
    "majestic_kuwait", "amadell_for_rent", "q8_rent",
    # unfurnished/floors rent listers (high cadence)
    "rent_aqar", "q8house_rent", "real_estate_rent_q8", "q8kw2020",
    "reokuwait",  # small/low-activity but verified direct
  ],
  # AGENCY — rent + sale (post own priced/described listings)
  "agency": [
    "besthomesq8", "aljahra_realestate", "q8aqarcom",
  ],
  # SALE — portal-dominated; no standalone verified IG SALE-only lister worth seeding yet
  "sale": [],
}
# CONFIRM-before-adding (real handles, activity/geo unverified): rent_kuwait (من المالك reel verified, confirm profile), aqar_kw0
# DO NOT ADD as IG "accounts": q84sale / boshamlan / bayut / opensooq — those are PORTAL sources (see real-estate-providers-feasibility.md).
# من المالك (from-owner) long tail: HARVEST LIVE via hashtag/geo crawl — see §3.
# PRIMARY DATA PATH for Real Estate remains q84sale + Boshamlan portals (GREEN, server-rendered). IG = discovery/secondary.
# Full machine-readable seed: team/research/ig-accounts-seed.json (sector=realestate).
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
- Deep-dive 2026-06-27 additions: https://www.instagram.com/rent_aqar/ (~34K, 60016232, Jabriya/Salmiya/Bayan) · https://www.instagram.com/q8house_rent/ (~11K, 60032224) · https://www.instagram.com/real_estate_rent_q8/ · https://www.instagram.com/q8kw2020/ · https://www.instagram.com/besthomesq8/ (rent+sale, ~12K) · https://www.instagram.com/aljahra_realestate/ (~52K, Jahra) · https://www.instagram.com/q8aqarcom/ (~6K) · https://www.instagram.com/aqar_kw0/ [CONFIRM]
- Portal data layer (NOT IG, the GREEN primary): see `team/research/real-estate-providers-feasibility.md` (q84sale, Boshamlan)
