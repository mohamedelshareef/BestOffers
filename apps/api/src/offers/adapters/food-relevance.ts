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
  // rice / biryani / machboos / bukhari / mansaf family (the Kuwaiti main-rice block).
  // OWNER BUG (2026-06-27): "Bukhari food" (رز بخاري) must hit this group so it routes to rice sellers and
  // its relevance filter drops cakes. Added bukhari/بخاري, mansaf/منسف and the EN spellings of biryani.
  ['rice', 'biryani', 'biriyani', 'briyani', 'mandi', 'machboos', 'majboos', 'machbous', 'makboos',
    'kabsa', 'kabseh', 'maqluba', 'bukhari', 'bukhary', 'boukhari', 'mansaf',
    'رز', 'ارز', 'برياني', 'بريانى', 'مجبوس', 'مكبوس', 'كبسه', 'مندي', 'مقلوبه', 'رزه', 'بخاري', 'منسف'],
  // grills (mashawi / mishkak / tikka / shish) — a grill query routes to the grill block.
  ['grill', 'grilled', 'mashawi', 'mashwi', 'mishkak', 'tikka', 'tikkah', 'shish', 'skewer', 'bbq',
    'مشاوي', 'مشوي', 'مشكاك', 'تكه', 'شواء', 'مشويات', 'مشكك'],
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

/**
 * Stop-words that carry NO food signal (English connectors + Arabic equivalents). They must never be
 * treated as a dish token — otherwise "Chilled WITH rice" lets "with"/"chilled" leak into matching and
 * a free-form phrase wrongly looks unrecognized. They are dropped before expansion/scoring.
 */
const STOP_WORDS = new Set<string>([
  'with', 'and', 'the', 'for', 'plus', 'combo', 'meal', 'set', 'box', 'large', 'small', 'medium',
  'regular', 'spicy', 'chilled', 'hot', 'cold', 'fresh', 'special', 'classic', 'original', 'value',
  'مع', 'و', 'في', 'من', 'على', 'بدون', 'حار', 'بارد', 'وجبه', 'كومبو', 'كبير', 'صغير', 'وسط',
]);

/** Tokenize a query into food-signal tokens (drops stop-words + <2-char fragments). */
export function foodTokens(query: string): string[] {
  return normalizeFoodText(query)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Does a single token belong to a recognized food/dish synonym group?
 * Used to decide whether a slug match is a genuine RESTAURANT name vs a coincidental dish-term match.
 */
export function isRecognizedFoodToken(token: string): boolean {
  const t = normalizeFoodText(token);
  return SYNONYM_GROUPS.some((g) => g.map(normalizeFoodText).includes(t));
}

/** Build the set of relevant tokens for a query: each query token + its synonym-group siblings. */
export function expandFoodQuery(query: string): { terms: Set<string>; matchedGroup: boolean } {
  const tokens = foodTokens(query);
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
 * TEST / SEED restaurant guard. Live Talabat data occasionally contains internal test vendors
 * (e.g. "Test Burger King", "Demo Restaurant", "QA Kitchen"). These must NEVER reach live results.
 * Matches a leading/standalone test-marker word in the restaurant name OR slug.
 */
const TEST_MARKERS = [
  'test', 'demo', 'sample', 'dummy', 'staging', 'sandbox', 'qa', 'mock', 'placeholder', 'example',
  'تجريبي', 'تجريبيه', 'تجربه', 'اختبار',
];
const TEST_RE = new RegExp(`(^|\\s|[-_])(${TEST_MARKERS.join('|')})(\\s|[-_]|$)`, 'i');

/** True if a restaurant name/slug looks like a non-production test/seed vendor. */
export function isTestRestaurant(nameOrSlug?: string): boolean {
  if (!nameOrSlug) return false;
  return TEST_RE.test(nameOrSlug);
}

/**
 * CONDIMENT / ADD-ON guard. Sauces, dips and extras are real menu items but must NOT dominate a
 * real-dish query (a "rice" search returning "Garlic Mayo" / "BBQ Sauce" is the bug). We rank them
 * BELOW real dishes; if a dish-term query matches ONLY condiments we treat that as no real match.
 */
const CONDIMENT_RE =
  /\b(sauce|mayo|mayonnaise|ketchup|mustard|dip|dressing|syrup|extra|add[- ]?on|topping|condiment)\b|صوص|مايونيز|كاتشب|كاتشاب|اضافه|اضافات|اضافي|تتبيله|دبس/i;

/** True if a dish looks like a condiment/sauce/add-on rather than a real dish. */
export function isCondiment(dish: DishCandidate): boolean {
  const hay = `${dish.title || ''} ${dish.category || ''}`;
  return CONDIMENT_RE.test(hay);
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
/** Hard cap so a no-food-signal query can never dump hundreds of unrelated items. */
export const FREEFORM_RESULT_CAP = 24;

/**
 * Helper for the resolver: a dish's title may carry the "— Restaurant" suffix. Extract the restaurant
 * part (after the em dash) so the test-restaurant guard can inspect it.
 */
function restaurantOf(dish: DishCandidate): string {
  const parts = (dish.title || '').split('—');
  return parts.length > 1 ? parts.slice(1).join('—') : '';
}

export function filterDishesByQuery<T extends DishCandidate>(
  items: T[],
  query: string,
  restaurantQuery: boolean,
): T[] {
  // STEP 0 — ALWAYS drop test/seed vendors from live results (both restaurant and dish queries).
  const live = items.filter(
    (it) => !isTestRestaurant(restaurantOf(it)) && !isTestRestaurant((it as any).restaurant),
  );

  // A genuine restaurant query (the user named a real restaurant) keeps the whole menu — but still
  // demote condiments so a menu isn't fronted by sauces, and still cap nothing (whole menu is wanted).
  if (restaurantQuery) {
    return [...live].sort((a, b) => condimentRank(a) - condimentRank(b));
  }

  const { terms, matchedGroup } = expandFoodQuery(query);
  if (terms.size === 0) {
    // No food signal at all (e.g. an empty/garbage query): keep provider order but CAP — never dump hundreds.
    return [...live].sort((a, b) => condimentRank(a) - condimentRank(b)).slice(0, FREEFORM_RESULT_CAP);
  }

  const scored = live
    .map((item) => ({ item, score: scoreDish(item, terms), condiment: isCondiment(item) }))
    .filter((s) => s.score > 0);

  // Did any REAL dish (non-condiment) match? A dish-term query that matches only sauces is NOT a real hit.
  const realHits = scored.filter((s) => !s.condiment);

  if (realHits.length === 0) {
    // No real dish matched the term:
    //  - RECOGNIZED dish term (e.g. "rice"/"burger"): return empty — the term constrains; an empty,
    //    "broaden your search" state beats dumping random food OR a pile of sauces.
    //  - UNRECOGNIZED free-form query (e.g. "meal prep grill"): keep provider order but CAPPED, so we
    //    never dump hundreds of unrelated items (the live "Chilled with rice" → 274 items bug).
    if (matchedGroup) return [];
    return [...live].sort((a, b) => condimentRank(a) - condimentRank(b)).slice(0, FREEFORM_RESULT_CAP);
  }

  // Real dishes matched: rank real dishes ABOVE condiments, then by relevance score desc.
  scored.sort((a, b) => {
    if (a.condiment !== b.condiment) return a.condiment ? 1 : -1; // real dishes first
    return b.score - a.score;
  });
  return scored.map((s) => s.item);
}

/** Condiments/add-ons sort after real dishes (0 = real dish, 1 = condiment). */
function condimentRank(dish: DishCandidate): number {
  return isCondiment(dish) ? 1 : 0;
}
