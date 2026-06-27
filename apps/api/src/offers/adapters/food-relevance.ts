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
  // sushi / Japanese-roll family (OWNER over-dump bug 2026-06-27: "sushi" → 243 cards because it wasn't
  // a recognized dish term, so a "sushi"-named slug flipped the query to restaurant-mode and dumped the
  // whole menu of every sushi restaurant). With a group, "sushi" stays a DISH term → relevance-filtered.
  ['sushi', 'sashimi', 'maki', 'nigiri', 'roll', 'rolls', 'سوشي', 'سوشى', 'ساشيمي', 'ماكي', 'رول'],
  ['coffee', 'قهوه', 'كوفي', 'latte', 'لاتيه', 'كابتشينو', 'cappuccino', 'espresso', 'كافيه', 'كوفيه'],
  ['dessert', 'حلى', 'حلو', 'حلويات', 'cake', 'كيك', 'كيكه', 'sweet', 'cheesecake', 'tiramisu', 'mousse', 'cookie', 'brownie'],
  ['icecream', 'ice cream', 'gelato', 'sundae', 'بوظه', 'ايس كريم', 'ايسكريم', 'جيلاتي'],
  ['kunafa', 'kanafeh', 'knafeh', 'كنافه', 'كنافة'],
  ['donut', 'donuts', 'doughnut', 'دونات', 'دونتس'],
  ['breakfast', 'فطور', 'ريوق', 'افطار', 'pancakes', 'pancake', 'بانكيك', 'waffle', 'وافل', 'eggs', 'بيض'],
  ['shrimp', 'روبيان', 'جمبري', 'قريدس'],
  ['fries', 'بطاطس', 'بطاطا', 'potato'],
  // meal-prep / diet / healthy — the IG meal-prep sellers' core category (F031 "وجبات دايت" etc.). These
  // are recognized FREE-FORM food terms so a curated IG meal-prep query stays a real hit, not a dump.
  ['mealprep', 'meal', 'prep', 'diet', 'keto', 'healthy', 'fitness', 'calorie', 'وجبات', 'دايت', 'كيتو', 'صحي', 'رجيم', 'دايتي'],
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
  'test', 'tests', 'tes', 'tst', 'testing', 'demo', 'sample', 'dummy', 'staging', 'stage', 'sandbox',
  'qa', 'qat', 'uat', 'mock', 'placeholder', 'example', 'fake', 'internal', 'donotuse', 'xtest',
  'تجريبي', 'تجريبيه', 'تجربه', 'اختبار',
];
// Standalone test-marker WORD anywhere in the name/slug (between spaces / - / _). 'tes' as its own token
// (the live "Tes P Hut" obfuscated seed) flags; 'tes' inside "Contest"/"Tested" does NOT (no boundary).
const TEST_RE = new RegExp(`(^|[\\s\\-_])(${TEST_MARKERS.join('|')})([\\s\\-_]|$)`, 'i');

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
 * BEVERAGE / DRINK guard (C4). Soft drinks, water and juices are real items but must NOT front-rank a
 * DISH query (the "cake" search topped by "7 Up / Mirinda / Water" bug). We rank them below real dishes
 * and never count them as the "real dish" that justifies a non-empty dish-term result.
 */
const BEVERAGE_EN_RE =
  /\b(7\s*up|7up|mirinda|pepsi|cola|coca[- ]?cola|sprite|fanta|mountain\s*dew|soda|water|juice|soft\s*drink|mojito|lemonade)\b/i;
// AR beverage words must match as WHOLE tokens (between spaces/start/end) — "كولا" as a SUBSTRING of
// "شوكولاتة"(chocolate) is a dessert, NOT a cola. Boundary check prevents the chocolate-cake false drop.
const BEVERAGE_AR_RE =
  /(^|\s)(مشروب|مشروبات|عصير|ماء|مياه|بيبسي|كولا|كوكاكولا|سفن|ميرندا|مياة)(\s|$)/;

/** True if an item looks like a beverage/drink rather than a dish. */
export function isBeverage(dish: DishCandidate): boolean {
  const hay = normalizeFoodText(`${dish.title || ''} ${dish.category || ''}`);
  return BEVERAGE_EN_RE.test(hay) || BEVERAGE_AR_RE.test(hay);
}

/**
 * DESSERT-RICE exclusion (C3): "Rice Pudding"/"rice kheer"/"مهلبية رز" is a sweet pudding that leaks into
 * a SAVORY-rice query because the token "rice" matches. A rice query wants machboos/biryani/kabsa, not a
 * dessert. True if the item is a dessert-class rice item (so it can be dropped from a savory-rice result).
 */
const DESSERT_RICE_RE = /\b(rice\s*pudding|pudding|kheer|muhallabia|firni)\b|مهلبيه|رز\s*بحليب|ارز\s*بحليب/i;
export function isDessertRice(dish: DishCandidate): boolean {
  const hay = `${dish.title || ''} ${dish.category || ''}`;
  return DESSERT_RICE_RE.test(hay);
}

/** Rice-family (savory main) query tokens — the same block as SYNONYM_GROUPS[0], minus desserts. */
const RICE_QUERY_RE =
  /\b(rice|biryani|biriyani|briyani|mandi|machboos|majboos|machbous|makboos|kabsa|kabseh|maqluba|bukhari|mansaf)\b|رز|ارز|برياني|مجبوس|مكبوس|كبسه|مندي|مقلوبه|بخاري|منسف/i;
const DESSERT_QUERY_RE = /\b(dessert|sweet|cake|pudding|kheer|ice\s*cream)\b|حلى|حلويات|كيك|بوظه|ايس/i;

/** True if the query asks for SAVORY rice (rice-family token present, no dessert intent). */
export function isSavoryRiceQuery(query: string): boolean {
  const q = normalizeFoodText(query);
  return RICE_QUERY_RE.test(q) && !DESSERT_QUERY_RE.test(q);
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
    // SHORT tokens (≤3 chars, e.g. "ice") match ONLY as a whole word — otherwise "ice" matches "rice"
    // and an ice-cream query surfaces rice dishes (the F067 bug). Longer tokens may substring-match.
    const allowSubstring = term.length >= 4;
    if (word.test(name)) score += 100;
    else if (allowSubstring && name.includes(term)) score += 60;
    if (word.test(category)) score += 50;
    else if (allowSubstring && category.includes(term)) score += 30;
    if (allowSubstring && desc.includes(term)) score += 15;
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
 * Hard cap on a MATCHED dish-term result set (OWNER over-dump bug 2026-06-27: "sushi" → 243 cards).
 * Even when many real dishes legitimately match a popular term (sushi/pizza/coffee), we return only the
 * top-N by relevance — a sane, comparable, scannable set, not a provider's whole long-tail menu. The
 * scorer ranks the best matches first, so the cap keeps the most relevant dishes and drops the tail.
 */
export const MATCHED_RESULT_CAP = 40;

/**
 * Helper for the resolver: a dish's title may carry the "— Restaurant" suffix. Extract the restaurant
 * part (after the em dash) so the test-restaurant guard can inspect it.
 */
function restaurantOf(dish: DishCandidate): string {
  const parts = (dish.title || '').split('—');
  return parts.length > 1 ? parts.slice(1).join('—') : '';
}

export interface FilterDishesOptions {
  /**
   * When TRUE (the Talabat menu lane), an UNRECOGNIZED query with no real-dish match returns HONEST-EMPTY
   * — a whole-restaurant menu dump on a nonsense/off-menu term is fabrication-by-dump (C4/C5). When FALSE
   * (the curated IG/social lane, default), an unmatched query keeps the curated provider posts CAPPED —
   * those posts are already handle-routed to the user's category, so they aren't a dump.
   */
  unmatchedEmpty?: boolean;
}

export function filterDishesByQuery<T extends DishCandidate>(
  items: T[],
  query: string,
  restaurantQuery: boolean,
  opts: FilterDishesOptions = {},
): T[] {
  // STEP 0 — ALWAYS drop test/seed vendors from live results (both restaurant and dish queries).
  const live = items.filter(
    (it) => !isTestRestaurant(restaurantOf(it)) && !isTestRestaurant((it as any).restaurant),
  );

  // A genuine restaurant query (the user named a real restaurant) keeps the whole menu — but still
  // demote beverages/condiments so the menu isn't fronted by drinks/sauces (C4: McD fronted by "7 Up").
  if (restaurantQuery) {
    return [...live].sort((a, b) => nonDishRank(a) - nonDishRank(b));
  }

  const { terms, matchedGroup } = expandFoodQuery(query);
  if (terms.size === 0) {
    // No food signal at all (e.g. gibberish "xyzqwfood"). Talabat lane → HONEST-EMPTY (C5): a nonsense
    // query must never dump the first-N restaurant cards. Curated IG lane → keep handle-routed posts capped.
    if (opts.unmatchedEmpty) return [];
    return [...live].sort((a, b) => nonDishRank(a) - nonDishRank(b)).slice(0, FREEFORM_RESULT_CAP);
  }

  // C3: a SAVORY-rice query (rice/biryani/machboos…, NOT a dessert query) must NOT surface "Rice Pudding".
  const savoryRice = isSavoryRiceQuery(query);
  const considered = savoryRice ? live.filter((it) => !isDessertRice(it)) : live;

  const scored = considered
    .map((item) => ({ item, score: scoreDish(item, terms), condiment: isCondiment(item), beverage: isBeverage(item) }))
    .filter((s) => s.score > 0);

  // Did any REAL dish (non-condiment, non-beverage) match? A dish query that matches only sauces/drinks
  // is NOT a real hit (a "cake" search fronted by "7 Up" is the C4 bug).
  const realHits = scored.filter((s) => !s.condiment && !s.beverage);

  if (realHits.length === 0) {
    // No REAL dish (non-drink/non-sauce) matched the query token.
    //  - RECOGNIZED dish family ("rice"/"cake"): HONEST-EMPTY — the term constrains; better an empty +
    //    "broaden" state than a pile of sauces/drinks (C4).
    //  - UNRECOGNIZED off-menu/gibberish ("ramen"/"tacos"/"xyzqwfood"): Talabat lane → HONEST-EMPTY (C4/C5,
    //    no test-vendor dump); curated IG lane → keep handle-routed posts capped.
    if (matchedGroup || opts.unmatchedEmpty) return [];
    return [...live].sort((a, b) => nonDishRank(a) - nonDishRank(b)).slice(0, FREEFORM_RESULT_CAP);
  }

  // Real dishes matched: rank real dishes ABOVE beverages/condiments, then by relevance score desc.
  scored.sort((a, b) => {
    const ra = nonDishRank(a);
    const rb = nonDishRank(b);
    if (ra !== rb) return ra - rb; // real dishes first, then beverages, then condiments
    return b.score - a.score;
  });
  // CAP (over-dump fix): even a legitimately popular dish term returns only the top-N most relevant
  // dishes, never a provider's entire long-tail menu (the "sushi" → 243 cards bug).
  return scored.slice(0, MATCHED_RESULT_CAP).map((s) => s.item);
}

/**
 * Sort key for non-dish items: real dish (0) < beverage (1) < condiment (2). Drives the C4 down-rank so a
 * dish/restaurant menu is never fronted by drinks or sauces.
 */
function nonDishRank(item: { item?: DishCandidate; condiment?: boolean; beverage?: boolean } | DishCandidate): number {
  // Accept either a scored wrapper (with cached flags) or a raw DishCandidate.
  const dish = ('item' in item ? item.item : item) as DishCandidate;
  const isBev = 'beverage' in item && item.beverage !== undefined ? !!item.beverage : isBeverage(dish);
  const isCond = 'condiment' in item && item.condiment !== undefined ? !!item.condiment : isCondiment(dish);
  if (isCond) return 2;
  if (isBev) return 1;
  return 0;
}
