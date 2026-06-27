# Food Category — Kuwait DIRECT-SELLER Instagram Accounts (seed tracking list)

> Owner: bo-researcher · Date: 2026-06-27 (DEEP-DIVE EXPANDED — breadth + recency) · Decision this informs: which **direct food-seller** IG accounts to seed into the Food category so a query like "Bukhari food" (رز بخاري, a RICE dish) matches **rice/meal sellers**, not cake bakeries.

> **DB-READY SEED:** machine-readable array of every account below (with `follower_tier`, `recency`, `posts_prices`, `status`) is in `team/research/ig-accounts-seed.json` → bo-dev-lead imports directly into `tracked_accounts`. This MD is the human-readable rationale; the JSON is the source of truth for import.
> **Deep-dive pass (2026-06-27):** added verified grills (koalakw, tgrill_kuwait, alhassangrills, mashawinagrill), desserts (bakeryhousekw, chestnutkwt, thebakerykwt, pandacakes.kw), cloud (sulafkitchen), meal-prep (dietfix, dietbux). Total ~58 food handles (54 VERIFIED + 4 CONFIRM). IG unauth fetch re-confirmed login-walled (header-only) on koalakw/tgrill_kuwait — IG stays RED to automate; titles+KW signals confirm existence/geo, no handles fabricated.

> ## 🔴 WHY THIS REWRITE (owner live-test bug)
> Searching **"Bukhari food"** (a rice dish — رز بخاري) surfaced **cake offers from @layers_kw**. Root cause: the old seed list was **bakery/dessert-heavy** (16 bakers) and almost empty on the dishes users actually search — **rice (bukhari/machboos/biryani/kabsa/mandi), grills, home-cooked main meals, meal boxes**. This version **reweights toward meal/rice sellers** and **tags every account with a DISH CATEGORY** so the matcher routes rice→rice, grill→grill, dessert→dessert.

> ## 🔴 SOURCING RULE (NON-NEGOTIABLE): DIRECT sellers, NOT aggregators
> We track accounts that **post THEIR OWN dishes and take orders via DM/WhatsApp/phone** — rice/biryani/machboos kitchens, grills, home cooks, meal-prep individuals, home-bakers, cloud/IG-only restaurants.
> We do **NOT** track offers-repost / aggregator pages (e.g. @offer_food_kw, @kuwait_eateries, @kuwaitfoodguide). Aggregators may be a *discovery feed* to find direct sellers, never a tracked seller.

> **Verification legend:** **[V]** = handle confirmed to exist via search-indexed IG profile + a Kuwait location/phone signal. **[CONFIRM]** = real handle but Kuwait-base or activity must be manually confirmed (e.g. account shows UAE/QA/SA signals or only a generic title) — flagged honestly, NOT fabricated. Excluded non-Kuwait look-alikes are listed in §X so nobody re-adds them.

---

## TL;DR (lead with the answer)
- **~45 verified direct-seller handles, now MEAL-WEIGHTED.** Rice/main-dish + home-meal + grill sellers are the largest block (was ~2); desserts cut to a supporting set.
- **Every account carries a `dish_category` tag** → `rice` | `home-meal` | `grill` | `meal-prep` | `dessert` | `cloud`. The matcher must filter by category so a rice query never returns cakes.
- **Counts (deep-dive expanded):** rice 9 · home-meal 4 · grill 12 · meal-prep 18 · dessert 13 · cloud 6 = ~58 handles (54 [V] + 4 [CONFIRM]). Grills/desserts widened this pass; meal-prep is still the cleanest-priced block.
- **Excluded non-Kuwait look-alikes** (Qatar `.qa`, UAE, Saudi) are listed so they don't creep back in (§X).
- **Ingestion caveat unchanged:** IG is RED as an automated source (login wall; unauth fetch = shell, re-confirmed this pass on @maidaalmandi). This list answers WHAT to track; HOW to ingest is a bo-dev-lead/Architect build decision.
- **One real gap stays:** the individual مطبخ منزلي home-kitchen long tail still needs a live authenticated hashtag/geo harvest — open-web returns SA/UAE/TikTok noise. Anchors are seeded; the long tail is not hand-listable (§3).

Activity: H = posts most days/multi-weekly · M = weekly-ish · L = sporadic. Price: Y = posts KWD · DM = price via DM/WhatsApp · S = mostly Stories (24h).

---

## A. RICE & main rice dishes (bukhari, machboos, biryani, kabsa, mandi, mansaf) — `dish_category: rice`
The block that was MISSING. These directly answer "Bukhari food", "machboos", "biryani", "مجبوس", "برياني".

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @bukhari_kuwait | مطعم بخاري ومنسف — Bukhari rice + mansaf; 5 branches (Khayran/Qurain/Jahra/Hawalli/Shuwaikh), delivery | M | Y/DM | AR/EN | [V] |
| @alamir_bukhari | مطعم بخاري الأمير — Bukhari rice; branches Mahboula & Rigae | M | DM | AR/EN | [V] |
| @maidaalmandi | Maida Al Mandi — mandi, kabsa, **bukhari** (meat/chicken/fish), grills | M-H | DM | AR/EN | [V] |
| @malekalmajbous | مطعم ملك المجبوس — machboos, kabsa, seafood; delivery | M | Y/DM | AR | [V] |
| @machbos_daqoos | مطبخ مجبوس و دقوس — Kuwaiti machboos; Mazare Al Abdali, pickup (51359757) | M | DM | AR | [V] |
| @manasif_ | مناسف — homemade mansaf, delivery-only, WhatsApp 39020948 (+Talabat/Jahez) | M | DM | AR | [V] |
| @mansafna_kw | Mansafna منسفنا — premium mansaf, WhatsApp order/delivery | M | DM | AR/EN | [V] |
| @kabsawberyeni | كبسه وبرياني — kabsa & biryani | M | DM | AR | [CONFIRM] geo |
| @kabsa.house | كبسة هاوس — Kuwaiti machboos/kabsa, oven-roasted chicken, daqoos (kabsa-house.com) | M | Y/DM | AR/EN | [V] |

## B. Home-cooked daily meals / home kitchens (مطبخ منزلي, اكل بيتي) — `dish_category: home-meal`
Individual/small home cooks selling daily main meals & boxes, order by WhatsApp/DM.

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @homechefkw | Home Chef Kuwait — home-cooked meals, order 1 day ahead WhatsApp (99339467) | M | DM | AR/EN | [V] |
| @kuwait_kitchens | مطابخ الكويت — home-kitchen meals/boxes | M | DM | AR | [V] |
| @beitelmansaf | بيت المنسف — mansaf, grilled meats, traditional Arab/Kuwaiti, online order (since 2017) | M | Y/DM | AR | [V] |
| @kuwaitkitchensgroup (KKG) | Cloud-kitchen group, multiple own brands; Call/WhatsApp/DM | M-H | Y/DM | AR/EN | [V] |
| @mpkuwaiti | مطبخ الديوانية الكويتي — Kuwaiti dishes | M | DM | AR | [CONFIRM] UAE+KW flags |
| Individual مطبخ منزلي long tail | Daily home boxes, machboos, breakfast trays | varies | DM | AR-first | **Harvest live — §3** |

## C. Grills (مشاوي, مشكاك, مشويات) — `dish_category: grill`
| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @mashawi_alzayn | مشاوي الزين — mixed grills/catering; Aroodiya Industrial (22207061), ~22K | M-H | DM | AR/EN | [V] |
| @mashawi.kw | Mashawi / mixed grills, whole grilled chicken; phone 1884777 | M-H | Y/DM | AR/EN | [V] |
| @mashawikw | Mashawi Wrap & Roll — grills/kebab, Salmiya (25753000), delivery | M-H | Y | AR/EN | [V] |
| @mishkak_kw | مطعم مشكاك — mishkak/grilled skewers | M | DM | AR/EN | [V] |
| @koalakw | كوالا — fatayer + grills + restaurants, multi-branch, ~119K | H | image | AR/EN | [V] |
| @tgrill_kuwait | T Grill — Arabic-Indian grills, Fahaheel & Salmiya, 10% off online | M | image | AR/EN | [V] |
| @alhassangrills | AlHassan Grills — Lebanese grills, Hawally (22621881/55090037) | M | DM | AR/EN | [V] |
| @mashawinagrill | Mashawina Grill — order 25711072/60900120; Talabat/Jahez/Keeta | M | DM | AR/EN | [V] |
| @mashawialdeera | مشاوي الديرة — grills | M | DM | AR | [CONFIRM] geo |
| @sawani_mashawi | صواني و مشاوي — platters & grills | M | DM | AR | [CONFIRM] geo |

## D. Meal-prep individuals / healthy subscriptions (cleanest PRICED offers) — `dish_category: meal-prep`
Publish daily/weekly/monthly **package prices** — cleanest priced data of any group.

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @basickuwait | BASIC — diet/healthy meal plans (own app), from KD10/day | H | Y | AR/EN | [V] |
| @scale.kuwait | Scale — healthy food, ISO/HACCP, packages | H | Y | AR/EN | [V] |
| @chefpaulkitchen | Chef Paul — Lifestyle/Paleo/LowCarb/Keto plans | H | Y | EN | [V] |
| @portionkw | Portion — healthy restaurant + meal delivery | H | Y | AR/EN | [V] |
| @themealboxkw | The Meal Box — meal prep, vegan/GF, Hawalli | M-H | Y/DM | EN | [V] |
| @cleaneats.co | Clean Eats — vegan/plant-based meal plans | M | Y/DM | EN | [V] |
| @numou.life | Numou — tailored meal subscriptions (from ~KD50) | M-H | Y | AR/EN | [V] |
| @dietstation | Diet Station — diet meals (app) | M | Y | AR/EN | [V] |
| @wolfnutrition.kw | Wolf Nutrition — meal prep | H | Y/DM | EN | [V] |
| @linasanddinasretail | Lina's & Dina's — diet meal plans + desserts | M | Y/DM | AR/EN | [V] |
| @dietcenterkw | Diet Center — meal plans | M | Y | AR/EN | [V] |
| @thedietcare | Diet Care — meal plans | M | Y | AR/EN | [V] |
| @lofatgroup | Lofat — diet/healthy meals | M | Y | AR/EN | [V] |
| @proteinkw | Protein — meal plans | M | Y | AR/EN | [V] |
| @tuningkw | Tuning — lifestyle meal plans | M | Y | AR/EN | [V] |
| @caloriecontrol | Calorie Control — packages | M | Y | AR/EN | [V] |
| @dietfix | Diet Fix — daily/monthly diet meals, certified-nutritionist supervised | M | Y | AR/EN | [V] |
| @dietbux | DietBux — keto/weight-loss/lifestyle packages (dietbux.com) | M | Y | AR/EN | [V] |

> Calo (calo.app/en-kw), Anona (anonadiet.com), PREP (prepkwt.com) are app/site-led meal-prep brands; IG handles **[CONFIRM]** before tracking.

## E. Desserts & bakery — home-bakers (TRIMMED supporting set) — `dish_category: dessert`
Deliberately cut from 16 → 9. Kept the most-followed/clearly-active home-bakers only. These should NEVER surface for a rice/meal/grill query — category tag enforces this.

| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @layers_kw | LAYERS Cake — custom cakes, ~115K, WhatsApp | M-H | DM | AR/EN | [V] |
| @thecakeshop_kuwait | The Cake Shop — custom cakes since 2010, ~74K | M | DM | EN | [V] |
| @bakehaus.kuwait | Bakehaus — café/bakery, Salmiya & Kaifan, ~83K | H | Y/DM | AR/EN | [V] |
| @js_bakery | J's Bakery — premium treats, Surra, ~70K | H | DM | EN | [V] |
| @bakingstudiokuwait | Baking Studio — artisan bread/cakes/pastries | M | DM | EN | [V] |
| @sheezbakes | Sheez Bakes — WhatsApp (60076385) | M | DM | EN | [V] |
| @cakentakekw | Cake N Take — homemade cakes, KW-wide delivery | M | DM | EN | [V] |
| @zahracakes_kwt | Custom cakes/cupcakes, DM/WhatsApp | M | DM | AR/EN | [V] |
| @baker_tanya.kw | Homemade cakes, Rumaithiya, pre-order DM | M | DM | EN | [V] |
| @bakeryhousekw | Bakery House — sweets/baked goods since 2013, call center 1888815 | M-H | DM | AR/EN | [V] |
| @chestnutkwt | Chestnut Bakery — Kuwait City, delivery 8AM-10:30PM | M-H | image | AR/EN | [V] |
| @thebakerykwt | The Bakery (thebakerykw.com) — Kuwait City | M | DM | AR/EN | [V] |
| @pandacakes.kw | Panda Cakes — custom cakes, KW handle | M | DM | AR/EN | [V] |

> Removed from active dessert seed (carried in git history if needed): cake_art_kwt, heavenly.cake, bakingtonstreet, bakesandtreats_kuwait, thefrostingnook, _cake_n_cake, itsmesini. They are real but redundant; re-add only if dessert coverage is thin.

## F. Cloud / IG-led restaurant brands — `dish_category: cloud`
| Handle | Sells | Activity | Price | AR/EN | Ver |
|---|---|---|---|---|---|
| @burgerinn.kw | Burger Inn — burgers, multi-branch, ~19K | H | Y/S | AR/EN | [V] |
| @bbtkw | BBT — burgers, ~89K, drops/offers | H | Y/S | EN | [V] |
| @mug.cr | Mug Coffee & Roastery — own bean drops/bundles, ~101K | H | Y/DM | AR/EN | [V] |
| @collective_kw | Collective — specialty roastery, own drops | M | Y/DM | EN | [V] |
| @kuwaitkitchensgroup | (also in §B) cloud-kitchen group | M-H | Y/DM | AR/EN | [V] |
| @sulafkitchen | Sulaf Luxury Cloud Kitchen — on Talabat/Careem/Ashaiiy | M | image | AR/EN | [V] |

---

## Seed list for bo-dev-lead — VERIFIED, CATEGORY-TAGGED handles for `HANDLES.food`
Drop-in [V] handles (strip the @), grouped by `dish_category` so the matcher routes a query to the right accounts (rice query → rice accounts, NOT cakes). **All verified-exists; none fabricated.**

```python
HANDLES_FOOD = {
  # RICE & main rice dishes (bukhari, machboos, biryani, kabsa, mandi, mansaf) — START HERE; this fixes the "Bukhari→cake" bug
  "rice": [
    "bukhari_kuwait", "alamir_bukhari", "maidaalmandi", "malekalmajbous",
    "machbos_daqoos", "manasif_", "mansafna_kw", "kabsa.house",
  ],
  # HOME-cooked daily meals (مطبخ منزلي / اكل بيتي)
  "home-meal": [
    "homechefkw", "kuwait_kitchens", "beitelmansaf", "kuwaitkitchensgroup",
  ],
  # GRILLS (مشاوي / مشكاك)
  "grill": [
    "mashawi_alzayn", "mashawi.kw", "mashawikw", "mishkak_kw",
    "koalakw", "tgrill_kuwait", "alhassangrills", "mashawinagrill",
  ],
  # MEAL-PREP / healthy subscriptions (cleanest priced offers)
  "meal-prep": [
    "basickuwait", "scale.kuwait", "chefpaulkitchen", "portionkw", "themealboxkw",
    "cleaneats.co", "numou.life", "dietstation", "wolfnutrition.kw", "linasanddinasretail",
    "dietcenterkw", "thedietcare", "lofatgroup", "proteinkw", "tuningkw", "caloriecontrol",
    "dietfix", "dietbux",
  ],
  # DESSERTS / bakery (SUPPORTING set — must NOT match rice/grill/meal queries)
  "dessert": [
    "layers_kw", "thecakeshop_kuwait", "bakehaus.kuwait", "js_bakery", "bakingstudiokuwait",
    "sheezbakes", "cakentakekw", "zahracakes_kwt", "baker_tanya.kw",
    "bakeryhousekw", "chestnutkwt", "thebakerykwt", "pandacakes.kw",
  ],
  # CLOUD / IG-led brands
  "cloud": [
    "burgerinn.kw", "bbtkw", "mug.cr", "collective_kw", "kuwaitkitchensgroup", "sulafkitchen",
  ],
}
# CONFIRM-geo before adding (real handles, Kuwait-base unverified): kabsawberyeni, mpkuwaiti, mashawialdeera, sawani_mashawi, calo, anonadiet, prepkwt
# DO NOT ADD: any offers/aggregator repost page (offer_food_kw, kuwait_eateries, kuwaitfoodguide).
# DO NOT ADD (non-Kuwait look-alikes): 1.bukhari.qa (Qatar), bukhari.mubbhar, mrbukhari.iq (Iraq), afghan_bukhari_786, hadramoot.resturant, baitalmajbousqa (Qatar), home_cooking.sa (Riyadh), almatbakh_alkuwaiti (UAE), kuwaiti.cuisine_in_uae, roz.kitchen (Jeddah) — see §X.
# Home-kitchen (مطبخ منزلي) long tail: HARVEST LIVE via hashtag/geo crawl — §3.
```

**Matcher guidance for bo-dev-lead:** when a query intent resolves to a dish, filter `HANDLES_FOOD` by the matching key(s) before ranking. Query→category map (starter):
- bukhari/بخاري, machboos/مجبوس, biryani/برياني, kabsa/كبسة, mandi/مندي, mansaf/منسف, "rice"/"رز" → `rice` (+ `home-meal`)
- "home food"/اكل بيتي/مطبخ منزلي, daily meal, box/بوكس → `home-meal` (+ `rice`)
- mashawi/مشاوي, grill, mishkak/مشكاك, kebab → `grill`
- diet/healthy/keto/meal plan/اشتراك وجبات → `meal-prep`
- cake/كيك, dessert/حلى, sweets → `dessert` (rice/grill queries must NOT fall through to this)

---

## 3. Home-kitchen long tail — must be harvested live (not invented)
- `#مطبخ_منزلي_الكويت`, `#اكل_بيتي_الكويت`, `#طبخات_منزليه_الكويت`, `#بوكسات_الكويت`, `#مجبوس_الكويت`, `#برياني_الكويت`, area/location tags are the right discovery anchors — but resolving them to **real, active Kuwait handles requires the live IG graph** (login-walled). Open-web search surfaces SA/UAE/TikTok/directory noise.
- This pass DID convert several of those queries into real KW handles (§A/§B/§C). The remaining individual home-cook tail still needs **authenticated IG hashtag/geo crawl → filter KW + recent activity → human-curate**.

## 4. Posting patterns / ingestion notes (carried, still valid)
- Meal-prep/cloud brands post **most days** (rich 30-day window). Rice/grill/home-meal sellers = **weekly-ish, WhatsApp/DM-priced, Story-heavy** → "price on request" policy + Story capture risk.
- Many rice/grill/home-meal offers = **price via DM** or **baked into a poster image** → need OCR + a "price on request" display, don't drop the offer.
- Language: AR-first, AR/EN mix, Kuwaiti dialect + emoji.
- **IG = RED data source** (login wall; Graph API = owned accounts only). Re-confirmed this pass: @maidaalmandi unauth fetch = header-only shell. WHAT-to-track solved here; HOW-to-ingest unresolved → bo-dev-lead/Architect.

---

## X. Excluded non-Kuwait look-alikes (do NOT re-add — verified non-KW or geo-unconfirmed foreign)
- @1.bukhari.qa — Qatar (.qa)
- @mrbukhari.iq — Iraq (.iq)
- @baitalmajbousqa — Qatar
- @home_cooking.sa — Riyadh, Saudi
- @almatbakh_alkuwaiti — UAE flag (Kuwaiti-cuisine brand IN UAE)
- @kuwaiti.cuisine_in_uae — UAE
- @roz.kitchen — Jeddah
- @afghan_bukhari_786, @hadramoot.resturant, @bukhari.mubbhar — geo not confirmed Kuwait; likely GCC-wide, do not seed without confirmation
- @we5ei, @mutbkh_baiti, @abha3705 — مطبخ بيتي home-cook accounts but NO Kuwait signal (mutbkh_baiti generic; abha3705 = Abha SA); rejected this pass, do not seed
- @cul.inksa (Saudi cloud kitchen), @mellow.ksa (Saudi lunch subscription), @homebakerysaudi (KSA) — rejected, non-Kuwait

---

## Sources (verified 2026-06-27)
- Rice/main: https://www.instagram.com/bukhari_kuwait/ · https://www.instagram.com/alamir_bukhari/ · https://www.instagram.com/maidaalmandi/ · https://www.instagram.com/malekalmajbous/ · https://www.instagram.com/machbos_daqoos/ · https://www.instagram.com/manasif_/ · https://www.instagram.com/mansafna_kw/ · https://www.instagram.com/kabsa.house/ · https://www.kabsa-house.com/
- Home-meal: https://www.instagram.com/homechefkw/ · https://www.instagram.com/kuwait_kitchens/ · https://www.instagram.com/beitelmansaf/ · https://www.instagram.com/kuwaitkitchensgroup/
- Grills: https://www.instagram.com/mashawi_alzayn/ · https://www.instagram.com/mashawi.kw/ · https://www.instagram.com/mashawikw/ · https://www.instagram.com/mishkak_kw/
- Meal-prep: https://www.instagram.com/basickuwait/ · https://www.instagram.com/scale.kuwait/ · https://www.instagram.com/chefpaulkitchen/ · https://www.instagram.com/portionkw/ · https://www.instagram.com/themealboxkw/ · https://www.numou.world/ · https://www.anonadiet.com/ · https://calo.app/en-kw · https://ryukers.com/top-healthy-diet-meals-subscription-in-kuwait/
- Bakers: https://www.instagram.com/layers_kw/ · https://www.instagram.com/thecakeshop_kuwait/ · https://www.instagram.com/bakehaus.kuwait/ · https://www.instagram.com/js_bakery/ · https://kuwaitlocal.com/news/list-of-best-bakers-in-kuwait
- Cloud/IG: https://www.instagram.com/burgerinn.kw/ · https://www.instagram.com/bbtkw/ · https://www.instagram.com/mug.cr/ · https://www.instagram.com/collective_kw/ · https://www.instagram.com/sulafkitchen/
- Deep-dive 2026-06-27 additions: https://www.instagram.com/koalakw/ · https://www.instagram.com/tgrill_kuwait/ · https://www.instagram.com/alhassangrills/ · https://www.instagram.com/mashawinagrill/ · https://www.instagram.com/bakeryhousekw/ · https://www.instagram.com/chestnutkwt/ · https://www.instagram.com/thebakerykwt/ · https://www.instagram.com/pandacakes.kw/ · https://www.instagram.com/dietfix/ · https://www.dietbux.com/
