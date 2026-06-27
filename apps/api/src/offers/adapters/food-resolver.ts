import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';
import { ResolvedOffer } from '../offers.service';
import {
  DEFAULT_HTTP_CTX,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
} from './provider-adapter.interface';
import { FOOD_TTL_MS, OfferCache } from './offer-cache';
import {
  filterDishesByQuery,
  isRecognizedFoodToken,
  isTestRestaurant,
  normalizeFoodText,
} from './food-relevance';
import { normalizeProviderQuery } from './query-normalize';

/** Per-tier timeout (ADR-003 §4); food rides the http tier but allows a touch more for the menu API. */
const FOOD_TIER_TIMEOUT_MS: Record<string, number> = {
  http: 4000,
  render: 6000,
  render_residential: 8000,
};

/**
 * FoodOfferResolver (ADR-005 Slice F-1): runs the food adapters (Talabat) IN PARALLEL with
 * `Promise.allSettled`, a per-site timeout, a short-TTL (~5 min) cache, and graceful partial results.
 *
 * Food has no pre-defined canonical SKUs (unlike electronics) — a dish IS discovered live. So each
 * real Talabat dish is turned into a SYNTHESIZED dish-`Sku` + `Offer` straight from the fetched data
 * (name/price verbatim). This keeps the unchanged ResolvedOffer → ranker → fallback → card spine and
 * stays truthful by construction (the adapter already dropped any price not present in the JSON bytes).
 */
export class FoodOfferResolver {
  constructor(
    private readonly adapters: ProviderAdapter[],
    private readonly cache: OfferCache,
  ) {}

  async resolve(intent: IntentNormalized): Promise<ResolvedOffer[]> {
    const raw = (intent.model ?? intent.category ?? '').trim().toLowerCase();
    if (!raw) return [];
    // C2 fix: AR→EN + typo normalization so Talabat slug discovery + the relevance filter both key on the
    // EN-canonical dish/vendor term (تشيز كيك→cheesecake, ماكدونالدز→mcdonalds, biryni→biryani).
    const queryText = normalizeProviderQuery(raw, 'food');

    const settled = await Promise.allSettled(
      this.adapters
        .filter((a) => a.enabled && a.sector === 'food')
        .map((a) => this.resolveOneProvider(a, queryText)),
    );

    const out: ResolvedOffer[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') out.push(...r.value);
      // rejected provider → omit (partial results); the query still returns the others.
    }
    return out;
  }

  private async resolveOneProvider(adapter: ProviderAdapter, queryText: string): Promise<ResolvedOffer[]> {
    const ctx = {
      ...DEFAULT_HTTP_CTX,
      timeoutMs: FOOD_TIER_TIMEOUT_MS[adapter.tier] ?? DEFAULT_HTTP_CTX.timeoutMs,
    };
    const cacheKey = `${adapter.providerId}:${queryText}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return this.toResolved(adapter, cached, 'cache');

    try {
      // Discover a few candidate restaurants. We over-fetch (limit 6) for DISH queries (e.g. "rice")
      // because no single restaurant slug matches the term — we need a wider menu pool to filter the
      // matching dishes out of. For a RESTAURANT query (e.g. "kfc") the slug match is what we want.
      const discovered = await adapter.discover({ text: queryText, limit: 6 }, ctx);
      // Drop test/seed vendors at the source so "Test Burger King" never reaches live results.
      const refs = discovered.filter((ref) => !isTestRestaurant(ref.handle));
      if (refs.length === 0) return [];

      // Was this query a RESTAURANT name (a slug matched the term) or a DISH term (no slug matched)?
      // If any discovered restaurant slug contains a query token, the user asked for a restaurant →
      // keep its whole menu. Otherwise it's a dish term → filter the dishes to those that match.
      const restaurantQuery = this.queryMatchedRestaurant(queryText, refs);

      const perRef = await Promise.allSettled(refs.map((ref) => this.fetchExtract(adapter, ref, ctx)));
      const allDishes: NormalizedOffer[] = [];
      for (const r of perRef) if (r.status === 'fulfilled') allDishes.push(...r.value);

      // RELEVANCE FILTER (bug fix): keep ONLY dishes that match the query term (AR+EN synonyms), ranked
      // by relevance. "rice" → biryani/مجبوس/رز dishes; a burger no longer slips through. A restaurant
      // query keeps the whole menu unchanged. Truthful: we only filter/rank real fetched dishes.
      const normalized = filterDishesByQuery(
        allDishes.map((d) => ({ ...d, category: d.attrs.category })),
        queryText,
        restaurantQuery,
        { unmatchedEmpty: true }, // Talabat menu lane: an off-menu/gibberish term → honest-empty, never a dump (C4/C5)
      );

      if (normalized.length === 0) {
        (adapter as any).markFail?.();
        return [];
      }
      (adapter as any).markOk?.();
      await this.cache.set(cacheKey, normalized, FOOD_TTL_MS);
      return this.toResolved(adapter, normalized, 'live');
    } catch {
      (adapter as any).markFail?.();
      return []; // graceful partial result
    }
  }

  /**
   * Did the query name a RESTAURANT vs a DISH term?
   * "kfc" → KFC slug matched → restaurant query (whole menu). "rice"/"Chilled with rice" → dish query.
   *
   * BUG FIX (2026-06-27, "Chilled with rice" → 274 unrelated items): a slug match must use a token
   * that is NOT a recognized food/dish term. Otherwise a dish token ("rice"/"chicken") that happens to
   * appear in SOME discovered slug ("rice-house", "chicken-tikka") flipped the query to restaurant-mode
   * and DUMPED that restaurant's WHOLE unfiltered menu (sauces/condiments included). A restaurant query
   * requires a NON-food token to match a slug (e.g. "kfc", "kababji", "hardees" — proper-noun brands).
   */
  private queryMatchedRestaurant(queryText: string, refs: ProductRef[]): boolean {
    const tokens = normalizeFoodText(queryText)
      .split(' ')
      .filter((t) => t.length >= 2 && !isRecognizedFoodToken(t));
    if (tokens.length === 0) return false;
    return refs.some((ref) => {
      const slug = normalizeFoodText((ref.handle ?? '').replace(/-/g, ' '));
      // Whole-token slug match (not a loose substring) so "tikka" doesn't match "chicken".
      const slugTokens = slug.split(' ');
      return tokens.some((t) => slugTokens.includes(t));
    });
  }

  private async fetchExtract(
    adapter: ProviderAdapter,
    ref: ProductRef,
    ctx: { timeoutMs: number; userAgent: string; acceptLanguage: string },
  ): Promise<NormalizedOffer[]> {
    const raw = await adapter.fetch(ref, ctx);
    return adapter.extract(raw);
  }

  /** Turn each real dish NormalizedOffer into a synthesized dish-Sku + Offer (ResolvedOffer). */
  private toResolved(
    adapter: ProviderAdapter,
    normalized: NormalizedOffer[],
    source: 'live' | 'cache',
  ): ResolvedOffer[] {
    return normalized.map((n) => {
      const skuId = `dish_${adapter.providerId}_${n.providerSkuRef}`;
      const sku: Sku = {
        id: skuId,
        category: 'food',
        canonicalName: n.title,
        brand: n.attrs.restaurant ?? adapter.providerName,
        model: n.title,
        attributes: n.attrs,
        imageUrl: n.imageUrl,
      };
      const offer: Offer = {
        id: `off_${adapter.providerId}_${n.providerSkuRef}`,
        skuId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        priceFils: n.priceFils,
        inStock: n.inStock,
        deeplinkUrl: n.deeplink,
        source,
        fetchedAt: n.fetchedAt,
      };
      return { offer, sku };
    });
  }
}
