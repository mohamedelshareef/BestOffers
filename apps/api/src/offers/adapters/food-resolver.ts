import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';
import { ResolvedOffer } from '../offers.service';
import {
  DEFAULT_HTTP_CTX,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
} from './provider-adapter.interface';
import { FOOD_TTL_MS, OfferCache } from './offer-cache';

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
    const queryText = (intent.model ?? intent.category ?? '').trim().toLowerCase();
    if (!queryText) return [];

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
      const refs = await adapter.discover({ text: queryText, limit: 3 }, ctx);
      if (refs.length === 0) return [];

      const perRef = await Promise.allSettled(refs.map((ref) => this.fetchExtract(adapter, ref, ctx)));
      const normalized: NormalizedOffer[] = [];
      for (const r of perRef) if (r.status === 'fulfilled') normalized.push(...r.value);

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
