/**
 * Food relevance filter (BUG FIX 2026-06-26 — "rice returns random food").
 *
 * ROOT CAUSE: a generic dish query (e.g. "rice") matches NO Talabat restaurant slug, so discovery fell
 * back to the first few restaurants and the resolver returned their WHOLE menu unfiltered — "rice" dumped
 * KFC/Burger-King's entire menu (burgers, fries…), never ranked by the query term.
 *
 * FIX: a deterministic relevance scorer. Given the user's term and a candidate dish (name + category),
 * decide whether the dish genuinely MATCHES the term and how strongly. We expand the term to AR+EN
 * synonyms (rice → biryani/مجبوس/برياني/رز/أرز…) so Kuwaiti dishes match an English query and vice-versa.
 *
 * Truthful by construction: we only FILTER/RANK real dishes the adapter already fetched — we never invent
 * a dish. A restaurant-name query (e.g. "kfc", "burger king") is NOT a dish term, so it keeps the whole
 * menu (the user asked for the restaurant, not a dish).
 */

/** Normalize for matching: lowercase, strip Arabic diacritics/tatweel, unify alef/ya/ta-marbuta. */
export function normalizeFoodText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // harakat + tatweel
    .replace(/[آأإٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ى/g, 'ي') // alef maqsura ى → ي
    .replace(/ة/g, 'ه') // ta marbuta ة → ه
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dish-term synonym groups (AR + EN). A query token that hits a group expands to ALL its members, so a
 * dish whose name/category contains ANY member is a relevant match. Curated for the Kuwaiti food domain.
 */
const SYNONYM_GROUPS: string[][] = [
  // rice / biryani / machboos family
  ['rice', 'biryani', 'biriyani', 'briyani', 'mandi', 'machboos', 'majboos', 'kabsa', 'maqluba',
    'رز', 'ارز', 'برياني', 'بريانى', 'مجبوس', 'مكبوس', 'كبسه', 'مندي', 'مقلوبه', 'رزه'],
  ['burger', 'برجر', 'برغر', 'همبرجر', 'هامبرجر'],
  ['pizza', 'بيتزا', 'بيزا'],
  ['chicken', 'دجاج', 'جاج', 'فراخ', 'broasted', 'بروست', 'بروستد'],
  ['shawarma', 'shawerma', 'شاورما', 'شورما'],
  ['kebab', 'kabab', 'كباب', 'كباب'],
  ['fish', 'سمك', 'seafood', 'مأكولات بحريه', 'بحريات'],
  ['pasta', 'باستا', 'مكرونه', 'معكرونه', 'spaghetti', 'سباغيتي'],
  ['sandwich', 'ساندويتش', 'سندويتش', 'wrap', 'راب'],
  ['salad', 'سلطه', 'سلطة'],
  ['coffee', 'قهوه', 'كوفي', 'latte', 'لاتيه', 'كابتشينو', 'cappuccino', 'espresso'],
  ['dessert', 'حلى', 'حلو', 'حلويات', 'cake', 'كيك', 'كيكه', 'sweet'],
  ['breakfast', 'فطور', 'ريوق', 'افطار'],
  ['shrimp', 'روبيان', 'جمبري', 'قريدس'],
  ['fries', 'بطاطس', 'بطاطا', 'potato'],
];

/** Build the set of relevant tokens for a query: each query token + its synonym-group siblings. */
export function expandFoodQuery(query: string): { terms: Set<string>; matchedGroup: boolean } {
  const tokens = normalizeFoodText(query).split(' ').filter((t) => t.length >= 2);
  const terms = new Set<string>();
  let matchedGroup = false;
  for (const tok of tokens) {
    terms.add(tok);
    for (const group of SYNONYM_GROUPS) {
      const norm = group.map(normalizeFoodText);
      if (norm.includes(tok)) {
        matchedGroup = true;
        for (const m of norm) terms.add(m);
      }
    }
  }
  return { terms, matchedGroup };
}

export interface DishCandidate {
  /** Dish display name (may be "Dish — Restaurant"; the restaurant suffix is ignored for matching). */
  title: string;
  /** Menu section/category (e.g. "Biryani", "Burgers") — a strong relevance signal. */
  category?: string;
  /** Optional description text. */
  description?: string;
}

/**
 * Relevance score of a dish to the expanded query terms (0 = no match → DROP). Higher = better.
 *  - a term hit in the dish NAME is the strongest signal
 *  - a term hit in the CATEGORY (menu section) is strong (whole "Biryani" section matches "rice")
 *  - whole-word hits beat substring hits
 */
export function scoreDish(dish: DishCandidate, terms: Set<string>): number {
  if (terms.size === 0) return 0;
  // Drop the "— Restaurant" suffix so a restaurant called e.g. "Rice House" doesn't match a burger.
  const name = normalizeFoodText((dish.title || '').split('—')[0]);
  const category = normalizeFoodText(dish.category || '');
  const desc = normalizeFoodText(dish.description || '');

  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    const word = new RegExp(`(^|\\s)${escapeRe(term)}($|\\s)`, 'u');
    if (word.test(name)) score += 100;
    else if (name.includes(term)) score += 60;
    if (word.test(category)) score += 50;
    else if (category.includes(term)) score += 30;
    if (desc.includes(term)) score += 15;
  }
  return score;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Filter + rank candidate dishes by relevance to the query.
 *  - `restaurantQuery=true` (the query matched a restaurant slug): the user asked for the restaurant →
 *    keep the WHOLE menu (no dish-term filtering), preserving the original order.
 *  - otherwise (a dish term like "rice"): keep ONLY dishes that match, ranked by relevance desc.
 * Returns the input items reordered/filtered; never invents.
 */
export function filterDishesByQuery<T extends DishCandidate>(
  items: T[],
  query: string,
  restaurantQuery: boolean,
): T[] {
  if (restaurantQuery) return items;
  const { terms, matchedGroup } = expandFoodQuery(query);
  if (terms.size === 0) return items;

  const scored = items
    .map((item) => ({ item, score: scoreDish(item, terms) }))
    .filter((s) => s.score > 0);

  // GRACEFUL FALLBACK: if NOTHING matches the term:
  //  - a RECOGNIZED dish term (matchedGroup, e.g. "rice"/"burger") that finds 0 matches → genuinely
  //    empty (the term constrains the result set; better an empty/helpful state than random food).
  //  - an UNRECOGNIZED free-form query (e.g. "meal prep grill") that finds 0 literal hits → we cannot
  //    safely constrain it, so keep the provider's ordering rather than nuke every result.
  if (scored.length === 0) return matchedGroup ? [] : items;

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
