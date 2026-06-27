/**
 * Provider-query NORMALIZATION (ADR-007 C1+C2 fix — AR / typo / appliance catalog-0).
 *
 * THE PROBLEM (300-case run): provider search (Blink/Eureka electronics, Talabat food) indexes
 * EN-canonical terms. An Arabic query (غسالة صحون / تشيز كيك), a transliteration (ayfon / shwarma) or a
 * typo (refrigirator / biryni) was passed VERBATIM to the provider search → 0 hits despite real stock.
 * 58 of 80 fails shared this ONE root cause across both sectors.
 *
 * THE FIX (GENERALIZING, not a per-query hand-table): before hitting the providers' search, map the
 * query to the EN canonical term the catalogs actually index. Two deterministic passes:
 *
 *   1. GAZETTEER — a normalized AR/transliteration → EN-canonical lookup, keyed by the SAME diacritic-
 *      folded normal form used everywhere. One row covers a whole class (every spelling of غسالة maps to
 *      "washing machine"). This is a domain GAZETTEER (a finite product vocabulary), NOT a per-query
 *      synonym patch — adding "fridge" makes ثلاجة / refrigerator / refrigirator all resolve.
 *
 *   2. FUZZY (typo) — for an unmapped Latin token, snap it to the nearest canonical vocabulary word
 *      within a length-scaled Damerau-Levenshtein bound (refrigirator→refrigerator, biryni→biryani,
 *      shwarma→shawarma). Edit-distance generalizes to ANY single-typo of a known term, not a hand list.
 *
 * Truthful by construction: this only rewrites the SEARCH TERM we send to a real provider; every card
 * still comes from real provider data. A term we can't confidently map is left UNCHANGED (so a genuine
 * off-catalog term still flows through and can honest-empty, never fabricates).
 */

/** Shared diacritic/letter fold (matches normalizeFoodText / normalizeElectronicsText). */
export function foldText(s: string): string {
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
 * GAZETTEER: normalized AR / transliteration / loose-spelling phrase → EN canonical search term.
 * Keys are stored FOLDED (foldText) so lookups are spelling-robust. Each value is the term the provider
 * catalog indexes. Multi-word AR phrases are listed so "غسالة صحون" beats the single-word "غسالة".
 */
const ELECTRONICS_GAZETTEER: Record<string, string> = {
  // phones / tablets / wearables
  'ايفون': 'iphone', 'موبايل ايفون': 'iphone',
  'ايفون رخيص': 'iphone', 'ارخص ايفون': 'iphone', 'ايفون 17 برو': 'iphone 17 pro',
  'ايفون 16': 'iphone 16', 'ايفون 17': 'iphone 17', 'ايفون 15': 'iphone 15',
  'جالكسي': 'galaxy', 'سامسونج جالكسي': 'samsung galaxy',
  'ايباد': 'ipad', 'ايباد اير': 'ipad air', 'تابلت': 'tablet', 'تابليت': 'tablet',
  'ساعه ذكيه': 'smartwatch', 'ساعه ابل': 'apple watch', 'ساعه ايفون': 'apple watch',
  'ابل واتش': 'apple watch',
  // computers
  'لابتوب': 'laptop', 'لاب توب': 'laptop', 'لابتوب ابل': 'macbook', 'لابتوب جيمنج': 'gaming laptop',
  'لابتوب العاب': 'gaming laptop', 'ماك بوك': 'macbook', 'كمبيوتر': 'computer', 'شاشه كمبيوتر': 'monitor',
  // audio
  'سماعه': 'headphones', 'سماعات': 'headphones', 'سماعات ايربودز': 'airpods', 'ايربودز': 'airpods',
  'سماعه بلوتوث': 'bluetooth headphones', 'سماعات بلوتوث': 'bluetooth headphones',
  // tv / display
  'تلفزيون': 'tv', 'تلفاز': 'tv', 'شاشه': 'tv', 'شاشه تلفزيون': 'tv',
  'تلفزيون 65 بوصه': 'tv 65 inch', 'شاشه سامسونج 75 بوصه': 'samsung tv 75 inch',
  'شاشه سامسونج 75': 'samsung tv 75 inch', 'شاشه سامسونج': 'samsung tv',
  // large appliances
  'غساله': 'washing machine', 'غساله ملابس': 'washing machine', 'غساله صحون': 'dishwasher',
  'جلايه': 'dishwasher', 'جلايه صحون': 'dishwasher',
  // Eureka indexes "refrigerator" better than "fridge" WITH a brand (live: "lg fridge"→0, "lg
  // refrigerator"→2). Use the provider-preferred canonical; the relevance filter treats fridge≡refrigerator.
  'ثلاجه': 'refrigerator', 'ثلاجه ال جي': 'lg refrigerator', 'براد': 'refrigerator',
  'مكيف': 'air conditioner', 'مكيف سبليت': 'split air conditioner', 'تكييف': 'air conditioner',
  'ميكروويف': 'microwave', 'مايكروويف': 'microwave',
  'مكنسه': 'vacuum cleaner', 'مكنسه كهربائيه': 'vacuum cleaner',
  'فرن': 'oven', 'مجفف': 'dryer', 'نشافه': 'dryer',
  // gaming / brands
  'بلايستيشن': 'playstation', 'بلايستيشن 5': 'playstation 5', 'بلاي ستيشن': 'playstation',
  'اكس بوكس': 'xbox', 'سامسونج': 'samsung', 'ال جي': 'lg', 'ابل': 'apple',
};

const FOOD_GAZETTEER: Record<string, string> = {
  // mains
  'برياني': 'biryani', 'بريانى': 'biryani', 'مجبوس': 'machboos', 'مكبوس': 'machboos',
  'كبسه': 'kabsa', 'مندي': 'mandi', 'بخاري': 'biryani', 'منسف': 'mansaf', 'رز': 'rice', 'ارز': 'rice',
  'برجر': 'burger', 'برغر': 'burger', 'همبرجر': 'burger', 'بيتزا': 'pizza', 'بيزا': 'pizza',
  'دجاج': 'chicken', 'دجاج مقلي': 'fried chicken', 'فراخ': 'chicken', 'بروست': 'broasted chicken',
  'شاورما': 'shawarma', 'شورما': 'shawarma', 'كباب': 'kabab', 'مشاوي': 'grill', 'مشكاك': 'grill',
  'سمك': 'fish', 'سمك مشوي': 'grilled fish', 'روبيان': 'shrimp', 'جمبري': 'shrimp',
  'باستا': 'pasta', 'مكرونه': 'pasta', 'ساندويتش': 'sandwich', 'سلطه': 'salad',
  // desserts / sweets
  'حلى': 'dessert', 'حلويات': 'dessert', 'كيك': 'cake', 'كيكه': 'cake', 'كيكه شوكولاته': 'chocolate cake',
  'تشيز كيك': 'cheesecake', 'تشيزكيك': 'cheesecake', 'ايس كريم': 'ice cream', 'بوظه': 'ice cream',
  'كنافه': 'kunafa', 'كنافه نابلسيه': 'kunafa', 'دونات': 'donuts', 'كرواسون': 'croissant',
  // drinks
  'قهوه': 'coffee', 'قهوه مختصه': 'specialty coffee', 'كوفي': 'coffee', 'لاتيه': 'latte',
  'كابتشينو': 'cappuccino', 'كرك': 'karak tea', 'شاي': 'tea', 'عصير': 'juice',
  // meals / vendors
  'فطور': 'breakfast', 'فطور صباحي': 'breakfast', 'افطار': 'breakfast', 'وجبات دايت': 'diet meal',
  'ماكدونالدز': 'mcdonalds', 'ماك': 'mcdonalds',
};

/** Canonical EN vocabulary (gazetteer VALUES + extra EN catalog terms) for fuzzy typo-correction. */
const ELECTRONICS_VOCAB = uniqueWords([
  ...Object.values(ELECTRONICS_GAZETTEER),
  'iphone', 'ipad', 'macbook', 'laptop', 'tablet', 'samsung', 'galaxy', 'pixel', 'dell', 'hp', 'lenovo',
  'television', 'monitor', 'refrigerator', 'fridge', 'dishwasher', 'washing', 'machine', 'washer',
  'microwave', 'oven', 'dryer', 'vacuum', 'cleaner', 'dyson', 'airpods', 'headphones', 'earbuds',
  'bluetooth', 'speaker', 'playstation', 'xbox', 'nintendo', 'apple', 'watch', 'conditioner',
]);

const FOOD_VOCAB = uniqueWords([
  ...Object.values(FOOD_GAZETTEER),
  'biryani', 'machboos', 'kabsa', 'mandi', 'mansaf', 'rice', 'burger', 'pizza', 'chicken', 'shawarma',
  'kabab', 'kebab', 'grill', 'grilled', 'fish', 'shrimp', 'pasta', 'sandwich', 'salad', 'fried',
  'cake', 'cheesecake', 'tiramisu', 'kunafa', 'donuts', 'croissant', 'cream', 'pancakes', 'waffle',
  'coffee', 'latte', 'cappuccino', 'espresso', 'karak', 'breakfast', 'mcdonalds', 'pizza', 'hut',
  'pepperoni', 'broasted', 'bucket',
]);

function uniqueWords(phrases: string[]): string[] {
  const set = new Set<string>();
  for (const p of phrases) for (const w of p.split(/\s+/)) if (w.length >= 3) set.add(w);
  return [...set];
}

/**
 * Words we must NEVER fuzzy-correct: common connectors/qualifiers that are 1 edit from a catalog word
 * (e.g. "chilled"→"grilled", "with"→"fish"). Correcting these CHANGES the meaning. They carry no catalog
 * signal anyway, so leaving them untouched is always safe — the relevance filter ignores them.
 */
const NO_CORRECT = new Set<string>([
  'with', 'and', 'the', 'for', 'plus', 'combo', 'meal', 'set', 'box', 'large', 'small', 'medium',
  'regular', 'spicy', 'chilled', 'grilled', 'fried', 'hot', 'cold', 'fresh', 'special', 'classic',
  'original', 'value', 'best', 'new', 'cheap', 'good', 'top', 'kuwait', 'offer', 'deal', 'under',
  'want', 'need', 'looking', 'split', 'unit', 'inch', 'side', 'load', 'front', 'series', 'pro', 'max',
  'air', 'mini', 'plus', 'best', 'with', 'healthy', 'white', 'lamb',
]);

/** Damerau-Levenshtein (handles the common transposition typo, e.g. samesung↔samsung). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** Length-scaled bound: short words 1 edit, longer words up to 2. Avoids over-eager snaps. */
function fuzzyBound(len: number): number {
  return len <= 4 ? 1 : 2;
}

/** Snap one Latin token to the nearest vocabulary word within the bound, else return it unchanged. */
function correctToken(tok: string, vocab: string[]): string {
  if (tok.length < 4 || /[؀-ۿ]/.test(tok)) return tok; // skip short + Arabic
  if (NO_CORRECT.has(tok)) return tok; // never re-spell a connector/qualifier (chilled≠grilled)
  if (vocab.includes(tok)) return tok;
  let best = tok;
  let bestDist = fuzzyBound(tok.length) + 1;
  for (const w of vocab) {
    if (Math.abs(w.length - tok.length) > 2) continue;
    const dist = editDistance(tok, w);
    if (dist < bestDist || (dist === bestDist && w.length === tok.length)) {
      if (dist <= fuzzyBound(tok.length)) {
        bestDist = dist;
        best = w;
      }
    }
  }
  return best;
}

/** Longest-phrase gazetteer match: try the whole folded query, then shrink — so a 2-word AR phrase wins. */
function gazetteerLookup(folded: string, gz: Record<string, string>): string | null {
  if (gz[folded]) return gz[folded];
  const words = folded.split(' ');
  for (let len = words.length; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (gz[phrase]) {
        // Replace the matched span with its canonical term; keep any surrounding tokens (e.g. brand).
        const rest = [...words.slice(0, i), ...words.slice(i + len)].join(' ').trim();
        return rest ? `${gz[phrase]} ${rest}`.trim() : gz[phrase];
      }
    }
  }
  return null;
}

export type NormalizeSector = 'electronics' | 'food';

/**
 * RELAX-AND-RETRY discovery (ADR-007 cluster: over-specific multi-word electronics → 0).
 *
 * THE PROBLEM (300-case run, one coherent cluster): an over-specific query carries extra
 * model-suffix / size / form-factor / price-constraint tokens that OVER-CONSTRAIN the provider's
 * DISCOVERY search, so it returns 0 refs even though the product exists. Verified pairs:
 *   "air conditioner split unit"→0  but "split air conditioner"→6
 *   "vacuum cleaner Dyson"→0        but "vacuum cleaner"→8
 *   "Google Pixel 9"→0             but "Google Pixel"→5
 *   "AirPods Pro 2"→0              but "AirPods"→1
 *   "Apple Watch Series 10"→0      but "Apple Watch"→4
 *   "LG OLED 65 TV"→0             but "OLED TV"→8
 *   "Samsung side by side fridge"→0 but "Samsung refrigerator"→3
 *   "front load washing machine LG"→0 but "washing machine"→6
 *   "Xiaomi phone"→0             but "Xiaomi"→10
 *   "headphones under 50 KWD"→0    but "headphones"→3
 *
 * THE FIX (GENERALIZING, not a per-query table): build the DISCOVERY term as a ladder of
 * progressively-relaxed core queries — the full term first, then drop the most-specific trailing
 * modifier, repeat. The resolver searches each rung in order and stops at the first that returns hits.
 * Relevance filtering still runs on the RESULTS with the ORIGINAL specific query, so the dropped
 * tokens still rank/filter — they just can't zero out discovery. Genuinely-absent products (every rung
 * empty) still honest-empty; nothing is fabricated.
 *
 * What counts as an over-specific "trailing modifier" (a CLASS, not a hand list):
 *   - a price-constraint phrase ("under 50 kwd", "below 30 dinar") — belongs to RANKING, not discovery;
 *   - a pure model-number / size suffix ("9", "65", "series 10", "pro 2");
 *   - a form-factor modifier ("split unit", "side by side", "front load", "top load");
 *   - a generic category suffix AFTER a brand ("xiaomi PHONE", "lg FRIDGE") — the brand alone discovers;
 *   - a trailing brand AFTER the product type ("vacuum cleaner DYSON", "washing machine LG").
 * Each relaxation step removes ONE such trailing element; we never strip below a single meaningful core.
 */

/** Phrases that constrain PRICE/BUDGET — never belong in a discovery query (ranking handles them). */
const PRICE_CONSTRAINT_RE =
  /\b(under|below|over|above|less\s+than|cheaper\s+than|up\s+to|max|maximum|min|minimum)\s+\d+\s*(kwd|kd|dinar|dinars|fils)?\b|\b\d+\s*(kwd|kd|dinar|dinars|fils)\b/gi;

/** Pure model-number / size suffix tokens (a bare number, optionally with a unit like inch/"). */
const NUMERIC_SUFFIX_RE = /^\d+(\.\d+)?$/;

/** Sub-brand / tier words that, with a trailing number, form a model suffix ("series 10", "pro 2"). */
const MODEL_TIER_WORDS = new Set(['series', 'gen', 'generation', 'pro', 'max', 'plus', 'ultra', 'mini', 'air', 'se', 'lite']);

/** Multi-word form-factor modifiers (over-constrain discovery; relevance still ranks them on results). */
const FORM_FACTOR_PHRASES = [
  'side by side', 'french door', 'front load', 'top load', 'split unit', 'window unit',
  'built in', 'free standing', 'freestanding', 'over the range', 'counter depth',
];

/** Single-token form-factor / spec modifiers safe to drop from discovery when they over-constrain. */
const FORM_FACTOR_WORDS = new Set(['split', 'inverter', 'portable', 'wireless', 'wired', 'foldable', 'curved', 'cordless']);

/** Generic product-type words; when they TRAIL a brand they over-constrain ("xiaomi phone" → "xiaomi"). */
const GENERIC_TYPE_WORDS = new Set([
  'phone', 'smartphone', 'mobile', 'tablet', 'laptop', 'computer', 'tv', 'television',
  'fridge', 'refrigerator', 'watch', 'speaker', 'headphones', 'earbuds', 'monitor', 'console',
]);

/** Known electronics brand tokens — used to detect "type … BRAND" (trailing brand) and "BRAND type". */
const ELECTRONICS_BRANDS = new Set([
  'apple', 'samsung', 'lg', 'sony', 'dyson', 'xiaomi', 'huawei', 'google', 'pixel', 'dell', 'hp',
  'lenovo', 'asus', 'acer', 'msi', 'bosch', 'ariston', 'hitachi', 'panasonic', 'toshiba', 'nintendo',
  'microsoft', 'oneplus', 'oppo', 'realme', 'nokia', 'motorola', 'bose', 'jbl', 'anker', 'philips',
]);

/**
 * Build a relax-and-retry ladder of discovery terms for an electronics query, most-specific FIRST.
 * Each successive entry drops ONE over-specific trailing element. De-duped, never empty (the last rung
 * is always at least one meaningful token). The resolver searches each in order, first-with-hits wins.
 */
export function relaxQueryVariants(normalized: string): string[] {
  const ladder: string[] = [];
  const push = (term: string) => {
    const cleaned = term.replace(/\s+/g, ' ').trim();
    if (cleaned && !ladder.includes(cleaned)) ladder.push(cleaned);
  };

  // RUNG 0: the full normalized term as-is (most specific). Try it first - many specific queries DO
  // discover fine, and we never want to drop precision when it is not actually needed.
  push(normalized);

  // RUNG 1: strip price-constraint phrases (ranking, never discovery) + multi-word form-factor phrases
  // ("side by side", "front load"). Fixes the price/form-factor cases on its own.
  let base = normalized.replace(PRICE_CONSTRAINT_RE, ' ');
  for (const ph of FORM_FACTOR_PHRASES) {
    base = base.replace(new RegExp(`\\b${ph.replace(/\s+/g, '\\s+')}\\b`, 'gi'), ' ');
  }
  base = base.replace(/\s+/g, ' ').trim();
  push(base);

  const tokens = base.split(' ').filter(Boolean);
  const lower = tokens.map((t) => t.toLowerCase());

  // A token is OVER-SPECIFIC if it is a bare number/size, a model-tier word ("series"/"pro"), or a
  // single-token form-factor/spec modifier ("split"/"inverter"). Everything else is a CORE token.
  // These can sit ANYWHERE (e.g. "lg oled 65 tv") so we drop them by class, not just from the tail.
  const isOverSpecific = (w: string): boolean =>
    NUMERIC_SUFFIX_RE.test(w) || MODEL_TIER_WORDS.has(w) || FORM_FACTOR_WORDS.has(w);

  // RUNG 2: drop ALL over-specific tokens wherever they sit - "lg oled 65 tv" -> "lg oled tv", "apple
  // watch series 10" -> "apple watch", "google pixel 9" -> "google pixel". Brand + product family
  // survive and discover; dropped tokens still RANK (resolver passes the full query as rankQuery).
  const core = tokens.filter((_, i) => !isOverSpecific(lower[i]));
  push(core.join(' '));

  // RUNG 3: drop a trailing BRAND after a product type ("vacuum cleaner DYSON", "washing machine LG")
  // OR a generic type suffix after a brand ("xiaomi PHONE", "lg FRIDGE") - the survivor discovers alone.
  const coreLower = core.map((t) => t.toLowerCase());
  if (core.length >= 2) {
    const last = coreLower[core.length - 1];
    const prev = coreLower[core.length - 2];
    if (ELECTRONICS_BRANDS.has(last) && !ELECTRONICS_BRANDS.has(prev)) {
      push(core.slice(0, -1).join(' ')); // "washing machine lg" -> "washing machine"
    } else if (GENERIC_TYPE_WORDS.has(last) && ELECTRONICS_BRANDS.has(prev)) {
      push(core.slice(0, -1).join(' ')); // "xiaomi phone" -> "xiaomi"
    }
  }

  // RUNG 4 (last resort): a single strongest core token - a known brand, else a product-type word - so
  // an over-specific query ("front load washing machine LG") still bottoms out at a discoverable term.
  if (core.length > 1) {
    const brand = core.find((t) => ELECTRONICS_BRANDS.has(t.toLowerCase()));
    const typeWord = core.find((t) => GENERIC_TYPE_WORDS.has(t.toLowerCase()));
    if (brand) push(brand);
    else if (typeWord) push(typeWord);
  }

  return ladder.length ? ladder : [normalized];
}

/**
 * Normalize a raw user query to the EN-canonical search term the providers index.
 *  1. fold diacritics/letters
 *  2. gazetteer (AR / transliteration phrase → EN canonical), longest-phrase wins
 *  3. for any still-Latin token, fuzzy-correct typos against the sector vocabulary
 * Returns the (possibly rewritten) term. If nothing maps, returns the folded original UNCHANGED
 * (a genuine off-catalog term still flows through → can honest-empty, never fabricates).
 */
export function normalizeProviderQuery(raw: string, sector: NormalizeSector): string {
  const folded = foldText(raw);
  if (!folded) return folded;
  const gz = sector === 'electronics' ? ELECTRONICS_GAZETTEER : FOOD_GAZETTEER;
  const vocab = sector === 'electronics' ? ELECTRONICS_VOCAB : FOOD_VOCAB;

  const mapped = gazetteerLookup(folded, gz) ?? folded;

  // Fuzzy-correct each Latin word that the gazetteer didn't already canonicalize.
  const corrected = mapped
    .split(' ')
    .map((w) => correctToken(w, vocab))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return corrected;
}
