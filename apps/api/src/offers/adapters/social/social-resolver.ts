import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';
import { ResolvedOffer } from '../../offers.service';
import {
  DEFAULT_HTTP_CTX,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
} from '../provider-adapter.interface';
import { OfferCache, SOCIAL_TTL_MS } from '../offer-cache';

/**
 * SocialOfferResolver (ADR-006 Phase-1) — runs the social-tier adapters (Instagram, per vertical) and
 * synthesizes a `Sku` + `Offer` per extracted IG offer, mirroring FoodOfferResolver. Social inventory
 * has no pre-defined SKUs (each post is discovered live), so every extracted offer becomes one
 * synthesized card straight from verbatim post data (handle, permalink, posted_at) + the Claude
 * extraction (item/area/rooms; price already truthfulness-guarded inside the adapter).
 *
 * Search never triggers IG directly: the mock/Apify provider sits behind the adapter, results are
 * cached 6h (ADR-006 §2b), and partial failures degrade gracefully (allSettled).
 */
export class SocialOfferResolver {
  constructor(
    private readonly adapters: ProviderAdapter[],
    private readonly cache: OfferCache,
  ) {}

  /** Resolve social offers for a vertical (sector). Empty when no social adapter matches the sector. */
  async resolve(intent: IntentNormalized, sector: 'food' | 'realestate'): Promise<ResolvedOffer[]> {
    const queryText = (intent.model ?? intent.category ?? '').trim().toLowerCase();

    const settled = await Promise.allSettled(
      this.adapters
        .filter((a) => a.enabled && a.tier === 'social' && a.sector === sector)
        .map((a) => this.resolveOne(a, queryText)),
    );

    const out: ResolvedOffer[] = [];
    for (const r of settled) if (r.status === 'fulfilled') out.push(...r.value);
    return out;
  }

  private async resolveOne(adapter: ProviderAdapter, queryText: string): Promise<ResolvedOffer[]> {
    const ctx = { ...DEFAULT_HTTP_CTX, timeoutMs: 8000 };
    const cacheKey = `${adapter.providerId}:${queryText || '_all'}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return this.toResolved(adapter, cached, 'cache');

    try {
      const refs = await adapter.discover({ text: queryText, limit: 16 }, ctx);
      if (refs.length === 0) return [];
      const perRef = await Promise.allSettled(refs.map((ref) => this.fetchExtract(adapter, ref, ctx)));
      const normalized: NormalizedOffer[] = [];
      for (const r of perRef) if (r.status === 'fulfilled') normalized.push(...r.value);
      if (normalized.length === 0) return [];
      await this.cache.set(cacheKey, normalized, SOCIAL_TTL_MS);
      return this.toResolved(adapter, normalized, 'live');
    } catch {
      return []; // graceful partial result
    }
  }

  private async fetchExtract(adapter: ProviderAdapter, ref: ProductRef, ctx: any): Promise<NormalizedOffer[]> {
    const raw = await adapter.fetch(ref, ctx);
    return adapter.extract(raw);
  }

  private toResolved(adapter: ProviderAdapter, normalized: NormalizedOffer[], source: 'live' | 'cache'): ResolvedOffer[] {
    return normalized.map((n) => {
      const skuId = `social_${adapter.providerId}_${n.providerSkuRef}`;
      const sku: Sku = {
        id: skuId,
        category: adapter.sector, // 'food' | 'realestate'
        canonicalName: n.title,
        brand: n.attrs.restaurant ?? n.attrs.area ?? `@${n.attrs.handle}`,
        model: n.title,
        attributes: n.attrs,
        imageUrl: n.imageUrl,
      };
      const offer: Offer = {
        id: `off_${adapter.providerId}_${n.providerSkuRef}`,
        skuId,
        providerId: adapter.providerId,
        providerName: `@${n.attrs.handle}`, // the IG handle is the "provider" shown on the card
        priceFils: n.priceFils, // 0 = price on request (attrs.priceOnRequest='true')
        inStock: n.inStock,
        deeplinkUrl: n.deeplink, // CTA = the exact IG post permalink
        source,
        fetchedAt: n.fetchedAt,
      };
      return { offer, sku };
    });
  }
}
