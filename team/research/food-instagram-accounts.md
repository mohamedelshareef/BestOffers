# Food Category — Kuwait DIRECT-SELLER Instagram Accounts (seed tracking list)

> Owner: bo-researcher · Date: 2026-06-26 (rewritten per OWNER CORRECTION) · Decision this informs: which **direct food-seller** IG accounts to seed into the Food category so we capture the Kuwait long tail that Talabat misses.

> ## 🔴 SOURCING RULE (NON-NEGOTIABLE): DIRECT sellers/listers, NOT aggregators
> We track the accounts that **post THEIR OWN dishes with prices/details and take orders via DM/WhatsApp** — home kitchens, individual home cooks, meal/rice/biryani sellers, grills, home-bakers, meal-prep individuals, cloud/IG-only restaurants.
> We do **NOT** track offers-repost / aggregator pages (e.g. @offer_food_kw, @offers_in_kuwait, @kuwaitoffer, @kuw_offers). Those re-post other people's deals and were the **wrong** approach in the prior version of this file. They are removed from the seed list. (An aggregator may still be used as a *discovery feed to find more direct sellers*, but it is never itself a tracked "seller".)

> **Verification legend:** **[V]** = handle independently confirmed to exist via search-indexed IG profile / a reputable KW directory listing it (URL in Sources). **[CONFIRM]** = strong candidate but the specific handle/Kuwait-base/activity must be confirmed manually before tracking — NOT fabricated, flagged honestly. Where I could not verify a real handle I say "harvest live" rather than inventing one.

---

## TL;DR (lead with the answer)
- **~35 verified direct-seller handles** below, grouped by type — replacing the old aggregator-led list. These are accounts selling their own food.
- **The biggest segment (individual مطبخ منزلي home-kitchens) cannot be hand-listed from the open web.** Web/search results for `#مطبخ_منزلي_الكويت` etc. return Saudi/UAE accounts, TikTok, or directories — **not verifiable, currently-active Kuwait IG handles**. These exist in the hundreds but are only discoverable via **live IG hashtag/geo crawl** (login-walled). I did NOT invent handles to pad this. See §D + §3.
- **Cleanest priced data = meal-prep individuals** (publish package KWD) and **commercial-ish home-bakers** (WhatsApp/DM price). **Home-kitchens = mostly "price via DM"** — needs a price-on-request policy.
- **Ingestion caveat unchanged:** IG is RED as an automated data source (login wall; unauth fetch = shell, no captions/prices). This list answers **WHAT to track**; **HOW to ingest** is a separate build decision for bo-dev-lead/Architect.

Activity: H = posts most days/multi-weekly · M = weekly-ish · L = sporadic. Price: Y = posts KWD in caption/poster · DM = "price via DM/WhatsApp" · S = mostly Stories (24h ephemeral).

---

## A. Home-kitchen / rice & main dishes (biryani, machboos, daily boxes) — DIRECT sellers
The core long tail. Individual/small home cooks selling their own daily dishes & boxes, order by DM/WhatsApp. Hardest to enumerate from open web (see §D + §3).

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @kuwaitkitchensgroup (KKG) | Cloud-kitchen group, multiple own brands; order Call/WhatsApp/DM | M-H | Y/DM | AR/EN | [V] |
| @biryanimamaq8 (Biryani Mama) | Home/small biryani–rubyan delivery (FB+IG presence) | M | DM | AR | [CONFIRM] IG handle (FB confirmed) |
| Individual home-kitchen long tail (مطبخ منزلي) | Daily home-cooked meals/boxes, machboos, breakfast trays | varies | DM dominant | AR-first | **Harvest live — not hand-listable (see §3)** |

> Honest note: I will not list invented individual home-kitchen handles. The verified anchor is KKG; the rest of this segment must be harvested via live hashtag/geo crawl and human-curated.

## B. Grills (مشاوي) — DIRECT sellers
| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @mashawi.kw | Mashawi / mixed grills, whole grilled chicken; order via phone (1884777) | M-H | Y/DM | AR/EN | [V] |
| @mashawikw | Mashawi Wrap & Roll — grills/kebab, delivery | M-H | Y | AR/EN | [V] |

> Grills overlap heavily with aggregators (most are also on Talabat). The IG-only home-grill long tail (weekend grill boxes) is, like home-kitchens, a **live-harvest** segment — anchors above are the verifiable starting points.

## C. Desserts & bakery — home-bakers (DM/WhatsApp priced) — DIRECT sellers
The classic IG-only, order-via-DM segment Talabat barely touches. Mostly verified via Kuwait Local's bakers directory.

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @layers_kw | LAYERS Cake — custom cakes (WhatsApp 98888049 etc.), ~115K | M-H | DM | AR/EN | [V] |
| @thecakeshop_kuwait | The Cake Shop — custom cakes since 2010, ~74K, order by phone/WA | M | DM | EN | [V] |
| @bakehaus.kuwait | Bakehaus — café/bakery, Salmiya & Kaifan, ~83K | H | Y/DM | AR/EN | [V] |
| @bakingstudiokuwait | Baking Studio — artisan bread/cakes/pastries, order phone (96748842) | M | DM | EN | [V] |
| @cake_art_kwt | Cake Art — home baker, order via DM | M | DM | AR/EN | [V] |
| @heavenly.cake | Home baker, order WhatsApp (66573667) | M | DM | EN | [V] |
| @bakingtonstreet | Bakington Street (Ashima) — home baker, DM | M | DM | EN | [V] |
| @sheezbakes | Sheez Bakes — order WhatsApp (60076385) | M | DM | EN | [V] |
| @bakesandtreats_kuwait | Bakes & Treats — home baker, WhatsApp (51388354) | M | DM | EN | [V] |
| @thefrostingnook | The Frosting Nook (Mary) — home baker, DM | M | DM | EN | [V] |
| @_cake_n_cake | Cake n Cake — home baker, DM | M | DM | AR/EN | [V] |
| @cakentakekw | Cake N Take — homemade cakes, KW-wide delivery, WA/phone | M | DM | EN | [V] |
| @itsmesini | Home baker, order via DM | M | DM | EN | [V] |
| @js_bakery | J's Bakery — premium treats, Surra, ~70K, WhatsApp order | H | DM | EN | [V] (carried) |
| @zahracakes_kwt | Custom cakes/cupcakes, DM/WhatsApp (4–5d notice) | M | DM | AR/EN | [V] (carried) |
| @baker_tanya.kw | Homemade cakes, Rumaithiya, pre-order DM | M | DM | EN | [V] (carried) |

## D. Meal-prep individuals / healthy subscriptions (cleanest PRICED offers) — DIRECT sellers
Publish daily/weekly/monthly **package prices** — the cleanest priced-offer data of any group. All sell their own meals.

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @basickuwait | BASIC — diet/healthy meal plans (own app) | H | Y (package KWD) | AR/EN | [V] |
| @scale.kuwait | Scale — healthy food, ISO/HACCP, packages (site scale-kuwait.com) | H | Y | AR/EN | [V] |
| @chefpaulkitchen | Chef Paul — Lifestyle/Paleo/LowCarb/Keto plans, ~43K | H | Y | EN | [V] |
| @portionkw | Portion — healthy restaurant + meal delivery, ~13K | H | Y | AR/EN | [V] |
| @themealboxkw | The Meal Box — meal prep, vegan/GF, Hawalli | M-H | Y/DM | EN | [V] |
| @cleaneats.co | Clean Eats — vegan/plant-based meal plans KW | M | Y/DM | EN | [V] |
| @numou.life | Numou — tailored meal subscriptions (from ~KD50) | M-H | Y | AR/EN | [V] |
| @dietstation | Diet Station — diet meals (app) | M | Y | AR/EN | [V] |
| @wolfnutrition.kw | Wolf Nutrition — meal prep, highly social | H | Y/DM | EN | [V] |
| @linasanddinasretail | Lina's & Dina's — diet meal plans + desserts | M | Y/DM | AR/EN | [V] |
| @dietcenterkw | Diet Center — meal plans | M | Y | AR/EN | [V] |
| @thedietcare | Diet Care — meal plans | M | Y | AR/EN | [V] |
| @lofatgroup | Lofat — diet/healthy meals | M | Y | AR/EN | [V] |
| @proteinkw | Protein — meal plans (Ramadan offers) | M | Y | AR/EN | [V] |
| @tuningkw | Tuning — lifestyle meal plans | M | Y | AR/EN | [V] |
| @caloriecontrol | Calorie Control — packages "from 56 KD" | M | Y | AR/EN | [V] |

> Calo (calo.app/en-kw) and PREP (prepkwt.com) are app/site-led meal-prep brands; IG handles **[CONFIRM]** before tracking — do not assume.

## E. Cloud / IG-led restaurant brands (their own dishes/offers) — DIRECT sellers
| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @burgerinn.kw | Burger Inn — burgers, multi-branch, ~19K | H | Y/S | AR/EN | [V] (carried) |
| @bbtkw | BBT — "Best Burgers in Town", ~89K, drops/offers | H | Y/S | EN | [V] (carried) |
| @mug.cr | Mug Coffee & Roastery — own bean drops/bundles, ~101K | H | Y/DM | AR/EN | [V] (carried) |
| @collective_kw | Collective — specialty roastery, own drops | M | Y/DM | EN | [V] (carried) |

---

## Seed list for bo-dev-lead — VERIFIED handles ready for Apify `HANDLES.food`
Drop-in [V] handles (strip the @). Grouped so Dev can phase ingestion. **All verified-exists; none fabricated.**

```
HANDLES.food = [
  # Meal-prep individuals (cleanest priced offers — START HERE)
  "basickuwait", "scale.kuwait", "chefpaulkitchen", "portionkw", "themealboxkw",
  "cleaneats.co", "numou.life", "dietstation", "wolfnutrition.kw", "linasanddinasretail",
  "dietcenterkw", "thedietcare", "lofatgroup", "proteinkw", "tuningkw", "caloriecontrol",
  # Home-bakers / desserts (DM-priced)
  "layers_kw", "thecakeshop_kuwait", "bakehaus.kuwait", "bakingstudiokuwait",
  "cake_art_kwt", "heavenly.cake", "bakingtonstreet", "sheezbakes", "bakesandtreats_kuwait",
  "thefrostingnook", "_cake_n_cake", "cakentakekw", "itsmesini",
  "js_bakery", "zahracakes_kwt", "baker_tanya.kw",
  # Grills
  "mashawi.kw", "mashawikw",
  # Cloud / IG-led brands
  "kuwaitkitchensgroup", "burgerinn.kw", "bbtkw", "mug.cr", "collective_kw",
]
# CONFIRM-before-adding: biryanimamaq8 (IG), calo, prepkwt (IG handles)
# DO NOT ADD as sellers: any *offers/aggregator* repost page.
# Home-kitchen (مطبخ منزلي) long tail: HARVEST LIVE via hashtag/geo crawl — see §3, cannot hand-list.
```

---

## 3. Home-kitchen long tail — must be harvested live (not invented)
- `#مطبخ_منزلي_الكويت`, `#اكل_بيتي_الكويت`, `#طبخات_منزليه_الكويت`, `#بوكسات_الكويت`, `#مشاريع_الكويت`, area/location tags are the right discovery anchors — but resolving them to **real, active Kuwait handles requires the live IG graph** (login-walled to plain fetch). Open-web search surfaces Saudi/UAE/TikTok/directory noise, not curatable KW IG handles.
- **Recommended:** authenticated IG hashtag/geo crawl → filter to KW + recent activity → human-curate first batch of home-kitchen sellers → append to `HANDLES.food`. This is the only honest way to populate this segment.

## 4. Posting patterns / ingestion notes (carried, still valid)
- Meal-prep/cloud brands post **most days** (rich 30-day window). Home-bakers/home-kitchens **sporadic + Story-heavy** (24h expiry = miss risk for 30-day history).
- **Price visibility:** meal-prep = priced KWD (good). Home-bakers/home-kitchens = **"price via DM"** (no price in post) → need a **"price on request"** policy, don't drop the offer.
- Many offers = **price baked into the poster image** → may need **OCR**, not just caption NLP. Flag for Architect.
- Language: AR-first, AR/EN mix, Kuwaiti dialect + emoji.
- **IG = RED data source** (login wall; Graph API = owned accounts only). WHAT-to-track is solved here; HOW-to-ingest is unresolved → bo-dev-lead/Architect.

---

## Sources (verified 2026-06-26)
- Kuwait Local — Best Bakers in Kuwait (home bakers + handles): https://kuwaitlocal.com/news/list-of-best-bakers-in-kuwait
- Ryukers — Top Healthy/Diet Meal Subscriptions Kuwait (meal-prep handles): https://ryukers.com/top-healthy-diet-meals-subscription-in-kuwait/
- Meal-prep: https://www.instagram.com/basickuwait/ · https://www.instagram.com/scale.kuwait/ · https://www.instagram.com/chefpaulkitchen/ · https://www.instagram.com/portionkw/ · https://www.instagram.com/themealboxkw/ · https://www.instagram.com/cleaneats.co/ · https://www.numou.world/ · https://calo.app/en-kw · https://www.prepkwt.com/
- Bakers: https://www.instagram.com/layers_kw/ · https://www.instagram.com/thecakeshop_kuwait/ · https://www.instagram.com/bakehaus.kuwait/ · https://www.instagram.com/bakingstudiokuwait/ · https://www.instagram.com/js_bakery/ · https://www.instagram.com/zahracakes_kwt/ · https://www.instagram.com/baker_tanya.kw/
- Grills: https://www.instagram.com/mashawi.kw/ · https://www.instagram.com/mashawikw/
- Cloud/IG: https://www.instagram.com/kuwaitkitchensgroup/ · https://www.instagram.com/burgerinn.kw/ · https://www.instagram.com/bbtkw/ · https://www.instagram.com/mug.cr/ · https://www.instagram.com/collective_kw/
- Biryani Mama (FB, IG confirm): https://www.facebook.com/biryanimamaq8/
- Home-kitchen hashtag noise (why live-harvest needed): https://www.tiktok.com/@kuwait.kitchens (TikTok, not IG) · directory/Saudi/UAE results returned instead of KW IG handles
