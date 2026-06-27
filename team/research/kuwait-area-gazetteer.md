# Kuwait Residential Area Gazetteer (for RE area matching — ADR-007 Q3)

**Purpose:** complete, machine-readable Kuwait area gazetteer so real-estate area matching GENERALIZES
beyond the prior 12-area `AREA_GROUPS`. Any KW flat query (AR or EN, with spelling variants) should now
resolve to a canonical area + governorate.

**Deliverable:** `team/research/kuwait-area-gazetteer.json` — array of `{en, ar, aliases:[...], governorate}`,
DROP-IN ready for `apps/api/src/offers/adapters/realestate-relevance.ts` AREA_GROUPS.

**Count:** 84 areas across all 6 governorates (up from 12).

| Governorate | Areas | Notes |
|---|---|---|
| Capital (Al Asimah) | 25 | residential + mixed (Sharq, Shuwaikh incl. as people rent there) |
| Hawalli | 19 | the dense flat-rental heartland (Salmiya, Jabriya, Rumaithiya, Hawally, Mishref…) |
| Farwaniya | 17 | high-density rental zone (Farwaniya, Khaitan, Jleeb, Ardiya…) |
| Ahmadi | 18 | south coastal-belt rentals (Mahboula, Mangaf, Fintas, Fahaheel, Abu Halifa…) |
| Jahra | 12 | residential subset (excl. pure desert/agri: Kabd, Salmi, Abdali, Subiya farms) |
| Mubarak Al-Kabeer | 11 | newer SE residential (Sabah Al-Salem, Messila, Adan, Qurain…) |

## Scope decisions (VERIFIED vs deliberate exclusions)
- **VERIFIED** against EN Wikipedia "Areas of Kuwait" + AR ويكيبيديا "قائمة مناطق الكويت" (both fetched 2026-06-27).
  Canonical EN spelling + Arabic spelling taken from those lists.
- **Included:** every area where people realistically search for flats/apartments (شقة) — all residential +
  mixed-use districts.
- **Deliberately EXCLUDED** (not flat-rental areas — keeps the matcher precise, avoids false area hits):
  - Industrial / port: Shuaiba, Subhan, Ardiya Herafiya, Amghara, Shuwaikh Industrial, Mina Abdulla port.
  - Agricultural / desert / outlying: Wafra & Wafra farms, Abdali, Salmi, Kabd, Subiya, Bahra, Kazma,
    Bar Al-Ahmad/Bar Al-Jahra, Nuwaiseeb, Zoor, Julaia'a, Khiran open desert, Failaka Island.
  - New/under-development megaprojects with little current rental stock kept ONLY where rentals exist
    (Mutlaa, Saad Al-Abdullah, Sabah Al-Ahmad City, Nawaf Al-Ahmad City, Khairan City retained).
- **Alias design:** each area carries (a) canonical EN, (b) common EN transliteration variants, (c) Arabic
  with AND without the definite article ال, (d) ة/ه and ى/ي variants — matching the normalizer in
  `realestate-relevance.ts` (`normalizeAreaText` already strips ال is NOT done, so both forms are listed).
- **Disambiguation note for dev:** two distinct "Qairawan/Qaisariya" entries exist (Capital القيروان vs
  Jahra القيصرية) — kept separate canonical keys. "Salwa" Arabic appears as both سلوى and السالوة in the
  wild — both aliased. "Abdullah Al-Salem/Al-Mubarak/Al-Nasser" share the "Abdullah/Sabah" stem — aliases
  are specific enough to avoid cross-matching.

## Wiring note for bo-dev-lead
The JSON keys map 1:1 to AREA_GROUPS structure (`canonical -> string[]` of aliases). To wire:
1. Generate `AREA_GROUPS` from the JSON: key = slug of `en` (lowercase, `_`-joined), value = `aliases`.
2. Keep the existing `NEARBY_MARKERS`, tenure, and price-sanity logic untouched — only AREA_GROUPS grows.
3. `normalizeAreaText` already handles ال-prefixed substrings via `q.includes(a)` (substring match), so both
   `السالمية` and `سالمية` aliases will hit "بالسالمية" style glued queries.
4. Optional: expose `governorate` for future governorate-level fallback ("flats in Hawalli" → any Hawalli area).

## Sources (accessed 2026-06-27)
- EN: https://en.wikipedia.org/wiki/Areas_of_Kuwait
- AR: https://ar.wikipedia.org/wiki/قائمة_مناطق_الكويت
- Governorate structure: https://en.wikipedia.org/wiki/Governorates_of_Kuwait ;
  https://e.gov.kw/sites/kgoenglish/Pages/Visitors/AboutKuwait/KuwaitGovernorates.aspx

**Truthfulness:** every area traces to the two Wikipedia gazetteers above. No areas invented. Transliteration
variants are standard romanizations of the verified Arabic names (ASSUMED-standard, not sourced per-variant)
— flag any that fail in live matching back to research for correction.
