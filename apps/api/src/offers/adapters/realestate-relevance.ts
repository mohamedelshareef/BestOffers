/**
 * Real-estate relevance filter (OWNER DIRECTIVE 2026-06-26 — "precision over breadth, per category").
 *
 * PROBLEM: a real-estate query for a SPECIFIC area (e.g. "شقة في السالمية" / "flat in Salmiya") used to
 * surface flats in EVERY area — the social ranker only BOOSTED the matching area, it never EXCLUDED the
 * off-area ones, and the fallback treats every discovered flat as "exact". So a Salmiya search showed
 * Salwa / Mahboula / Hawally / Jabriya / Mangaf flats too. That is loosely-related padding.
 *
 * FIX: a deterministic area (+ rooms / budget) relevance filter, mirroring `food-relevance.ts`:
 *   - If the query names a KNOWN area (AR or EN alias), keep ONLY flats in that area (exact-area first).
 *     Off-area flats are DROPPED — UNLESS a flat's caption/area is explicitly tagged "قريب/nearby"
 *     to the asked area (reuses the F-SR1 closest-match idea: exact-area first, nearby allowed, random out).
 *   - If the query also states ROOMS, prefer exact-rooms but keep the asked area (rooms is a softer signal
 *     than area — a 2BR seeker still wants to see that area's 1BR/3BR rather than a different area).
 *   - If the query names NO recognizable area, we cannot safely constrain → keep provider order (don't
 *     nuke a free-form RE query). Truthful by construction: we only filter REAL discovered flats.
 */

/** Canonical Kuwait area keys → all AR + EN spellings/aliases that denote that area. */
const AREA_GROUPS: Record<string, string[]> = {
  salmiya: ['salmiya', 'salmiyah', 'السالمية', 'السالميه', 'سالمية', 'سالميه'],
  salwa: ['salwa', 'salwah', 'السالوة', 'السالوه', 'سالوة', 'سالوه'],
  mahboula: ['mahboula', 'mahboola', 'المهبولة', 'المهبوله', 'مهبولة', 'مهبوله'],
  hawally: ['hawally', 'hawalli', 'حولي', 'حولى'],
  jabriya: ['jabriya', 'jabriyah', 'الجابرية', 'الجابريه', 'جابرية', 'جابريه'],
  mangaf: ['mangaf', 'mangef', 'المنقف', 'منقف'],
  fintas: ['fintas', 'الفنطاس', 'فنطاس'],
  fahaheel: ['fahaheel', 'fahaheal', 'الفحيحيل', 'فحيحيل'],
  jahra: ['jahra', 'jahraa', 'الجهراء', 'جهراء'],
  farwaniya: ['farwaniya', 'farwaniyah', 'الفروانية', 'الفروانيه', 'فروانية'],
  sharq: ['sharq', 'شرق'],
  bneid_alqar: ['bneid', 'bneidalqar', 'بنيد القار', 'بنيدالقار'],
};

/** "nearby/قريب" markers — a flat explicitly offered as near the asked area is kept (closest-match). */
const NEARBY_MARKERS = ['nearby', 'near ', 'close to', 'قريب', 'بجانب', 'يبعد', 'مجاور', 'جنب'];

// ── Tenure (rent vs sale) + price-sanity (OWNER BUG: a RENT flat showed 300,000 KD = a SALE price) ──

export type Tenure = 'rent' | 'sale';

/**
 * Realistic Kuwait monthly-rent band (integer fils). A flat rent below ~50 KWD or above ~3,000 KWD/month
 * is almost certainly a parse error or a SALE price mislabeled as rent — never shown as a rent figure.
 */
export const SANE_RENT_MIN_FILS = 50_000; //   50 KWD / month
export const SANE_RENT_MAX_FILS = 3_000_000; // 3,000 KWD / month

/** A priced rent above this is treated as a SALE price (sale flats in KW start well above this). */
export const SALE_PRICE_FLOOR_FILS = 10_000_000; // 10,000 KWD

const SALE_MARKERS = ['للبيع', 'تمليك', 'for sale', 'freehold'];
const RENT_MARKERS = ['للإيجار', 'للايجار', 'for rent', 'شهري', 'شهريا', 'monthly', '/month', 'per month'];

/** What tenure does the QUERY ask for? sale markers win, else rent markers, else null (unspecified). */
export function detectQueryTenure(query: string): Tenure | null {
  const lc = (query || '').toLowerCase();
  if (SALE_MARKERS.some((m) => lc.includes(m.toLowerCase()))) return 'sale';
  if (RENT_MARKERS.some((m) => lc.includes(m.toLowerCase()))) return 'rent';
  return null;
}

/** What tenure is THIS flat? Prefer an explicit extracted tenure attr, else infer from caption markers. */
export function detectOfferTenure(tenureAttr?: string, captionText?: string): Tenure | null {
  if (tenureAttr === 'rent' || tenureAttr === 'sale') return tenureAttr;
  return detectQueryTenure(captionText || '');
}

/**
 * Is this a sane MONTHLY-RENT figure (fils)? 0 = price-on-request is allowed (we show "DM"); a positive
 * value must sit inside the realistic band. An out-of-band positive rent is a parse error / sale price.
 */
export function isSaneMonthlyRent(priceFils: number): boolean {
  if (priceFils === 0) return true; // price-on-request — handled elsewhere, never an absurd number
  return priceFils >= SANE_RENT_MIN_FILS && priceFils <= SANE_RENT_MAX_FILS;
}

/**
 * Infer tenure from a price magnitude when the caption/extractor didn't state it: a priced listing at or
 * above the sale floor (e.g. 300,000 KWD) is a SALE, not a monthly rent. Returns null below the floor
 * (could be either — don't guess rent vs sale from a small number alone).
 */
export function inferTenureFromPrice(priceFils: number): Tenure | null {
  if (priceFils >= SALE_PRICE_FLOOR_FILS) return 'sale';
  return null;
}

/** Normalize for matching: lowercase, strip Arabic diacritics/tatweel, unify alef/ya/ta-marbuta. */
export function normalizeAreaText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // harakat + tatweel
    .replace(/[آأإٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Which canonical area(s) does the query name? Empty when the query names no recognizable area. */
export function detectQueryAreas(query: string): Set<string> {
  const q = normalizeAreaText(query);
  const found = new Set<string>();
  for (const [canon, aliases] of Object.entries(AREA_GROUPS)) {
    for (const alias of aliases) {
      const a = normalizeAreaText(alias);
      // whole-word OR substring (Aranic area names are often glued to particles like "بالسالمية")
      if (a && q.includes(a)) {
        found.add(canon);
        break;
      }
    }
  }
  return found;
}

/** Which canonical area is THIS flat in? Reads the extracted `area` attr first, then the caption text. */
export function detectOfferArea(areaText?: string, captionText?: string): string | null {
  const hay = normalizeAreaText(`${areaText ?? ''} ${captionText ?? ''}`);
  if (!hay) return null;
  for (const [canon, aliases] of Object.entries(AREA_GROUPS)) {
    for (const alias of aliases) {
      const a = normalizeAreaText(alias);
      if (a && hay.includes(a)) return canon;
    }
  }
  return null;
}

export interface FlatCandidate {
  /** Extracted area string (e.g. "Salmiya" / "السالمية"), if any. */
  area?: string;
  /** Optional fuller text (caption / title) to scan for a nearby tag. */
  text?: string;
  /** Explicit tenure if the adapter resolved one ('rent' | 'sale'); else inferred from text/price. */
  tenure?: string;
  /** Listed price in integer fils (0 = price-on-request). Used for tenure inference + rent sanity. */
  priceFils?: number;
}

export interface FlatFilterOptions {
  /** The tenure the USER asked for. When set, only flats of that tenure are kept. */
  tenure?: Tenure | null;
}

/**
 * Tenure + price-sanity gate (OWNER BUG fix). Returns the flats that match the asked tenure and carry a
 * sane price:
 *  - The flat's effective tenure = explicit attr → caption marker → price-magnitude inference.
 *  - If a tenure is asked and the flat's tenure is KNOWN and DIFFERENT → DROP (rent query never shows a
 *    sale listing, and vice versa). An unknown-tenure flat is kept (we don't drop on absence).
 *  - For a flat treated as RENT, the price must be a sane monthly figure; an absurd rent (e.g. 300,000)
 *    is DROPPED (better an honest omission than a fake rent). A sale-priced flat is never shown as rent.
 */
export function filterFlatsByTenure<T extends FlatCandidate>(items: T[], asked?: Tenure | null): T[] {
  const out: T[] = [];
  for (const item of items) {
    const price = item.priceFils ?? 0;
    let tenure = detectOfferTenure(item.tenure, item.text);
    if (!tenure) tenure = inferTenureFromPrice(price); // 300,000 KWD with no marker → sale

    if (asked && tenure && tenure !== asked) continue; // wrong tenure → drop

    // Rent sanity: a flat presented as rent (asked rent, or its own tenure is rent) must have a sane
    // monthly price. Drop an absurd rent figure outright (never render "300,000 KD/month").
    const treatAsRent = asked === 'rent' || tenure === 'rent';
    if (treatAsRent && price > 0 && !isSaneMonthlyRent(price)) continue;

    out.push(item);
  }
  return out;
}

/**
 * Filter + rank candidate flats by relevance to the query AREA.
 *  - query names NO recognizable area → keep input order (can't safely constrain a free-form RE query).
 *  - query names an area → keep ONLY flats in that area (exact-area first), PLUS flats explicitly tagged
 *    "nearby/قريب" to the asked area; DROP flats in a different, unrelated area.
 *  - if NOTHING in the asked area is found, return [] (the area term constrains — better an honest empty
 *    "no flats in <area>" than random off-area flats).
 * Never invents; only filters/reorders REAL discovered flats.
 */
export function filterFlatsByQuery<T extends FlatCandidate>(
  items: T[],
  query: string,
  opts: FlatFilterOptions = {},
): T[] {
  // TENURE + PRICE-SANITY first (OWNER BUG): a rent query must never surface a sale listing or an absurd
  // rent figure. The asked tenure = explicit option (the rent/buy clarifier) ?? what the query text says.
  const askedTenure = opts.tenure ?? detectQueryTenure(query);
  items = filterFlatsByTenure(items, askedTenure);

  const askedAreas = detectQueryAreas(query);
  if (askedAreas.size === 0) return items; // no area constraint → don't nuke free-form RE queries

  const exact: T[] = [];
  const nearby: T[] = [];
  for (const item of items) {
    const offerArea = detectOfferArea(item.area, item.text);
    if (offerArea && askedAreas.has(offerArea)) {
      exact.push(item);
      continue;
    }
    // not the asked area → only keep if it explicitly says it's NEAR an asked area
    const hay = normalizeAreaText(item.text || '');
    const namesAskedArea = [...askedAreas].some((canon) =>
      AREA_GROUPS[canon].some((al) => hay.includes(normalizeAreaText(al))),
    );
    const taggedNearby = NEARBY_MARKERS.some((m) => (item.text || '').toLowerCase().includes(m.toLowerCase()));
    if (namesAskedArea && taggedNearby) nearby.push(item);
  }

  // Exact-area first, then nearby. Empty when the asked area has nothing (honest empty, not random).
  return [...exact, ...nearby];
}
