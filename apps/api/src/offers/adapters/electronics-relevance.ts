/**
 * Electronics relevance + cross-provider grouping (ADR-007 Q1 — catalog-free discovery).
 *
 * Context: the electronics lane no longer filters a 16-item in-code `MOCK_SKUS`. For ANY query it
 * calls the providers' real search (Blink suggest.json, Eureka Algolia) and SYNTHESIZES a SKU/offer
 * from each live hit. Two deterministic, truthful-by-construction passes guard that raw provider feed:
 *
 *   1. RELEVANCE (`scoreProductTitle` / `filterProductsByQuery`): drop hits that are wildly off-query.
 *      A provider's fuzzy search can return loosely-related rows (e.g. an accessory for the searched
 *      device, or a different product line). We keep a hit only if EVERY significant query token (after
 *      dropping stop-words) appears in the hit title — so "washing machine" can't surface a microwave,
 *      and "iPhone 16" can't surface an iPhone case. This never invents data; it only filters real hits.
 *
 *   2. GROUPING (`groupSimilarProducts`): merge near-duplicate hits of the SAME product across (and
 *      within) providers via a normalized-title trigram (pg_trgm-style) similarity, so X-cite + Blink
 *      + Eureka selling the same TV collapse into ONE comparable product. Below the threshold = left
 *      ungrouped (separate cards) — conservative, never a wrong price-compare (ADR-007 §2.1 trade-off).
 */

/** Normalize a title/query for matching: lowercase, strip diacritics, unify Arabic letters, collapse. */
export function normalizeElectronicsText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // harakat + tatweel
    .replace(/[آأإٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ى/g, 'ي') // alef maqsura
    .replace(/ة/g, 'ه') // ta marbuta
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PHRASE CANONICALIZATION: natural-language multi-word product names → the term the providers actually
 * index. VERIFIED against live Eureka/Blink: "dish washing machine"/"dish washer" return 0, but
 * "dishwasher" returns the real Bosch/Samsung/Ariston dishwashers. We rewrite the DISCOVERY query (and
 * normalize titles the same way) so the provider search hits and the relevance tokens line up. Tiny,
 * high-frequency only — the durable generalization is Q4 embeddings.
 */
const PHRASE_CANON: Array<[RegExp, string]> = [
  [/\bdish\s*wash(?:ing|er)?\s*(machine)?\b/g, 'dishwasher'],
  [/\bwashing\s*machine\b/g, 'washing machine'], // already canonical; keep the pair intact
  [/\bclothes?\s*dryer\b/g, 'dryer'],
  [/\bair\s*condition(?:er|ing)?\b/g, 'air conditioner'],
  [/\bmicro\s*wave\b/g, 'microwave'],
];

/** Canonicalize a query/title's product PHRASES (applied after diacritic normalization). */
export function canonicalizeElectronicsPhrase(s: string): string {
  let out = normalizeElectronicsText(s);
  for (const [re, repl] of PHRASE_CANON) out = out.replace(re, repl);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Tokens that carry NO product signal (English + Arabic connectors/size words). Dropped before the
 * relevance check so "dish washing MACHINE" matches a "Dishwasher" by its strong tokens, and a generic
 * filler like "the"/"best"/"new" never forces a miss.
 */
const STOP_WORDS = new Set<string>([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'of', 'in', 'best', 'new', 'buy', 'price', 'cheap',
  'good', 'top', 'kuwait', 'offer', 'offers', 'deal', 'deals', 'me', 'i', 'want', 'need', 'looking',
  'machine', 'device', 'set',
  // generic filler that over-constrains a multi-word query: "air conditioner split UNIT" must not require
  // the word "unit" in every title (no real AC title says "unit"). These carry no product identity.
  'unit', 'units', 'cheapest', 'latest', 'brand', 'model', 'official', 'genuine', 'original',
  'و', 'في', 'من', 'على', 'مع', 'افضل', 'جديد', 'سعر', 'رخيص', 'الكويت', 'عرض', 'جهاز', 'اريد', 'ابي', 'ارخص',
]);

/**
 * A handful of common DOMAIN SYNONYMS so a natural-language electronics query still hits provider
 * catalog naming. Deliberately TINY (high-frequency only) — the durable generalization is Q4
 * embeddings; this is just enough so the reported "Dish washing Machine" class works today. A query
 * token expands to its group; a hit matching ANY member of the group satisfies that token.
 */
const SYNONYM_GROUPS: string[][] = [
  ['dishwasher', 'dishwashing', 'dishwash', 'غساله صحون', 'جلايه'],
  ['washer', 'washing', 'غساله', 'غسالة'],
  ['fridge', 'refrigerator', 'ثلاجه', 'ثلاجة'],
  ['tv', 'television', 'تلفزيون', 'تلفاز', 'شاشه'],
  ['laptop', 'notebook', 'لابتوب'],
  ['phone', 'smartphone', 'mobile', 'موبايل', 'جوال', 'هاتف'],
  ['earbuds', 'earphones', 'headphones', 'سماعه', 'سماعات'],
  ['microwave', 'مايكروويف', 'ميكروويف'],
  ['ac', 'airconditioner', 'مكيف', 'تكييف'],
];

/** Expand one normalized token to itself + its synonym-group siblings (normalized). */
function expandToken(tok: string): string[] {
  const out = [tok];
  for (const group of SYNONYM_GROUPS) {
    const norm = group.map(normalizeElectronicsText);
    if (norm.includes(tok)) out.push(...norm);
  }
  return out;
}

/** Significant query tokens (canonicalize phrases, then drop stop-words + <2-char fragments). */
export function electronicsTokens(query: string): string[] {
  return canonicalizeElectronicsPhrase(query)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * ACCESSORY / COMPANION guard. A provider's search for "TV"/"laptop"/"iphone 16" returns the device
 * AND its accessories (case, cover, stand, bag, mount, screen protector, charger…). For an electronics
 * DEVICE query we want the device, not its companions — so a hit whose title looks like an accessory is
 * dropped UNLESS the query itself asked for that accessory. Mirrors Eureka's `isLikelyProduct`, applied
 * at the resolver level so it covers every provider. Truthful: only filters real hits, never invents.
 */
const ACCESSORY_RE =
  /\b(case|cover|protector|screen\s*guard|tempered\s*glass|charger|cable|adapter|stand|mount|holder|bag|sleeve|pouch|strap|skin|grip|lens\s*protector|keyboard|mouse|mouse\s*pad|hub|dock|streaming\s*(device|stick)|tv\s*stick|remote)\b|حافظه|غطاء|جراب|كفر|شاحن|كيبل|حامل|حقيبه|واقي\s*شاشه/i;

/** True if a title looks like an accessory/companion rather than the device itself. */
export function isAccessoryTitle(title: string): boolean {
  return ACCESSORY_RE.test(normalizeElectronicsText(title));
}

/** True if the QUERY itself asked for that accessory type (then we should NOT drop it). */
export function queryWantsAccessory(query: string): boolean {
  return ACCESSORY_RE.test(canonicalizeElectronicsPhrase(query));
}

/**
 * Relevance score of a product TITLE to the query (0 = no match → DROP, higher = better).
 * A hit must satisfy EVERY significant query token (each token OR one of its synonyms present in the
 * title). This is the guard that stops a provider's fuzzy search from surfacing off-query rows.
 */
export function scoreProductTitle(title: string, query: string, category = ''): number {
  const tokens = electronicsTokens(query);
  if (tokens.length === 0) return 1; // no constraining signal → don't filter (provider order kept)
  const name = canonicalizeElectronicsPhrase(title);
  // The provider's CATEGORY PATH (e.g. "… > Laptops > Note Books", "Dishwashers") is a strong signal:
  // a "laptop" query whose hit titles are brand/model named (MacBook, ROG, Omen — no word "laptop")
  // still matches via its category. Canonicalize it the same way so phrase tokens line up.
  const cat = canonicalizeElectronicsPhrase(category);
  let score = 0;
  for (const tok of tokens) {
    const variants = expandToken(tok);
    const inName = variants.some((v) => name.includes(v));
    const inCat = variants.some((v) => cat.includes(v));
    if (!inName && !inCat) return 0; // a required token (or any synonym) is missing in BOTH → not a match
    // whole-word hit in the NAME scores highest; a category-only hit is weaker but still a match.
    const whole = variants.some((v) => new RegExp(`(^|\\s)${escapeRe(v)}($|\\s)`, 'u').test(name));
    score += inName ? (whole ? 10 : 5) : 3;
  }
  return score;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ProductCandidate {
  title: string;
  /** Optional provider category path (e.g. Eureka `cn`, Blink `product_type`) — a relevance signal. */
  category?: string;
}

/**
 * Filter + rank discovered products by relevance to the query. Keeps only hits that match every
 * significant query token; ranks stronger (whole-word) matches first. A query with no significant
 * tokens leaves the list as-is (provider order). Never invents — only filters/orders real hits.
 */
export function filterProductsByQuery<T extends ProductCandidate>(
  items: T[],
  query: string,
  rankQuery?: string,
): T[] {
  // RELAX-AND-RETRY relevance: `query` is the term discovery actually MATCHED (the AND-filter floor —
  // hits must satisfy every token of it). `rankQuery`, when given, is the fuller ORIGINAL specific
  // query used only to RANK (a hit matching the extra specific tokens floats higher), never to DROP.
  // So "vacuum cleaner Dyson" relaxed to discover "vacuum cleaner" keeps all real vacuums, with any
  // Dyson ones ranked first — the specific term refines, it doesn't zero out.
  const tokens = electronicsTokens(query);
  if (tokens.length === 0) return [...items];
  const wantsAccessory = queryWantsAccessory(query) || (!!rankQuery && queryWantsAccessory(rankQuery));
  return items
    .map((item) => {
      const floor = scoreProductTitle(item.title, query, item.category ?? '');
      // additive rank bonus from the specific query's discriminators (model number, brand) over the
      // AND-floor — never gates, only orders. Computed against the FULLER of the two queries so a
      // model-number discriminator ("Pixel 9" vs "Pixel 8") floats the exact match even when the matched
      // discovery rung equals the query text (the "9" is sub-token and not in the AND-floor either way).
      const refine = refinementBonus(item.title, rankQuery ?? query, query, item.category ?? '');
      return { item, score: floor, total: floor + refine };
    })
    .filter((s) => s.score > 0)
    // drop accessories/companions for a DEVICE query (unless the query asked for that accessory).
    .filter((s) => wantsAccessory || !isAccessoryTitle(s.item.title))
    .sort((a, b) => b.total - a.total)
    .map((s) => s.item);
}

/**
 * Additive RANK-only bonus: how many of the specific query's EXTRA tokens (those not in the matched
 * discovery floor) appear in the title/category. Pure ordering signal — it NEVER drops a hit, so a
 * relaxed discovery still keeps every real product while the specific matches float to the top.
 */
function refinementBonus(title: string, rankQuery: string, floorQuery: string, category = ''): number {
  // The AND-floor's SIGNIFICANT tokens (electronicsTokens drops single-char/stop-word fragments). A
  // model-number discriminator like the "9" in "Pixel 9" is NOT a floor token, so it stays as EXTRA and
  // can refine the ranking — distinguishing Pixel 9 from Pixel 8.
  const floor = new Set(electronicsTokens(floorQuery));
  const extra = canonicalizeElectronicsPhrase(rankQuery)
    .split(' ')
    .filter((t) => t && !floor.has(t) && !STOP_WORDS.has(t));
  if (extra.length === 0) return 0;
  const name = canonicalizeElectronicsPhrase(title);
  const cat = canonicalizeElectronicsPhrase(category);
  let bonus = 0;
  for (const tok of extra) {
    const variants = tok.length >= 2 ? expandToken(tok) : [tok];
    // a numeric discriminator must match as a WHOLE token (so "9" floats Pixel 9 but not "...59...").
    const whole = new RegExp(`(^|\\s)${escapeRe(tok)}($|\\s)`, 'u');
    if (variants.some((v) => name.includes(v)) || whole.test(name)) bonus += 8;
    else if (variants.some((v) => cat.includes(v)) || whole.test(cat)) bonus += 4;
  }
  return bonus;
}

// ───────────────────────── cross-provider grouping (pg_trgm-style) ─────────────────────────

/** Trigram set of a normalized string (pg_trgm semantics: pad, 3-char sliding windows). */
export function trigrams(s: string): Set<string> {
  const norm = `  ${normalizeElectronicsText(s).replace(/\s+/g, ' ')} `;
  const grams = new Set<string>();
  for (let i = 0; i < norm.length - 2; i++) grams.add(norm.slice(i, i + 3));
  return grams;
}

/** Jaccard similarity of two strings' trigram sets (0..1) — the pg_trgm `similarity()` analog. */
export function titleSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const g of ta) if (tb.has(g)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/**
 * Conservative same-product threshold. pg_trgm default is 0.3; we run HIGHER (0.55) so only genuinely
 * near-identical titles merge — a false merge would mean a WRONG cross-provider price comparison, which
 * is trust-critical (ADR-007 §2.1). Below threshold = ungrouped = separate cards.
 */
export const GROUP_SIMILARITY_THRESHOLD = 0.55;

export interface GroupableProduct {
  title: string;
  providerId: string;
}

/**
 * Group near-duplicate products (same product across/within providers). Greedy single-link clustering
 * on title similarity ≥ threshold. Returns clusters (arrays of indices into the input) so the caller
 * can pick a canonical SKU per cluster and attach every provider's offer to it. Order-stable.
 */
export function groupSimilarProducts(
  items: GroupableProduct[],
  threshold = GROUP_SIMILARITY_THRESHOLD,
): number[][] {
  const clusters: number[][] = [];
  const assigned = new Array(items.length).fill(false);
  for (let i = 0; i < items.length; i++) {
    if (assigned[i]) continue;
    const cluster = [i];
    assigned[i] = true;
    for (let j = i + 1; j < items.length; j++) {
      if (assigned[j]) continue;
      if (titleSimilarity(items[i].title, items[j].title) >= threshold) {
        cluster.push(j);
        assigned[j] = true;
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}
