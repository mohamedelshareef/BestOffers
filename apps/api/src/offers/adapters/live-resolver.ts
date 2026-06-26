import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';
import {
  DEFAULT_HTTP_CTX,
  NormalizedOffer,
  ProviderAdapter,
  ProductRef,
} from './provider-adapter.interface';
import { ELECTRONICS_TTL_MS, OfferCache } from './offer-cache';

/** Per-tier hard timeout (ADR-003 §4): Tier-1 http ≈ 1.5s, Tier-2 render ≈ 5s, both ≤ 6s budget. */
const TIER_TIMEOUT_MS: Record<string, number> = {
  http: 1500,
  render: 5000,
  render_residential: 8000,
};

/**
 * LiveOfferResolver (ADR-003 §1/§4, S2.6-3): fan adapters out per provider IN PARALLEL with
 * `Promise.allSettled`, a hard per-site timeout (~1.5s), a short-TTL cache, and graceful partial
 * results — one adapter failing/timing-out NEVER fails the query. Output: live Offer[] mapped onto
 * the candidate canonical SKUs, ready to merge with mock offers for providers that have no adapter.
 *
 * Discovery key = the intent's category/brand/model terms; we also pass candidate skuIds so the
 * known-URL adapters (X-cite) can resolve directly.
 */
export class LiveOfferResolver {
  constructor(
    private readonly adapters: ProviderAdapter[],
    private readonly cache: OfferCache,
  ) {}

  /**
   * @param intent  normalized intent (for the discovery query text)
   * @param skus    candidate canonical SKUs (live offers are attached to these)
   * @returns live Offer[] (only for providers with an adapter), partial on failure/timeout.
   */
  async resolve(intent: IntentNormalized, skus: Sku[]): Promise<Offer[]> {
    if (skus.length === 0) return [];
    const queryText = this.queryText(intent, skus);
    const skuIds = skus.map((s) => s.id);

    const settled = await Promise.allSettled(
      this.adapters
        .filter((a) => a.enabled)
        .map((a) => this.resolveOneProvider(a, queryText, skuIds, skus)),
    );

    const offers: Offer[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') offers.push(...r.value);
      // rejected provider → omit (partial results); query still returns others (ADR-003 §4/§5).
    }
    return offers;
  }

  private async resolveOneProvider(
    adapter: ProviderAdapter,
    queryText: string,
    skuIds: string[],
    skus: Sku[],
  ): Promise<Offer[]> {
    const ctx = { ...DEFAULT_HTTP_CTX, timeoutMs: TIER_TIMEOUT_MS[adapter.tier] ?? DEFAULT_HTTP_CTX.timeoutMs };
    const cacheKey = `${adapter.providerId}:${queryText}`;

    // CACHE: TTL-fresh hit → serve labeled source:"cache", no fetch.
    const cached = await this.cache.get(cacheKey);
    if (cached) return this.toOffers(adapter, cached, skus, 'cache');

    try {
      const refs = await adapter.discover({ text: queryText, skuIds, limit: 5 }, ctx);
      if (refs.length === 0) {
        adapter.health(); // nothing discovered; healthy, empty
        return [];
      }

      // fetch + extract each ref in parallel, individually isolated.
      const perRef = await Promise.allSettled(
        refs.map((ref) => this.fetchExtract(adapter, ref, ctx)),
      );
      const normalized: NormalizedOffer[] = [];
      for (const r of perRef) {
        if (r.status === 'fulfilled') normalized.push(...r.value);
      }

      if (normalized.length === 0) {
        (adapter as any).markFail?.();
        return [];
      }

      (adapter as any).markOk?.();
      await this.cache.set(cacheKey, normalized, ELECTRONICS_TTL_MS);
      return this.toOffers(adapter, normalized, skus, 'live');
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
    const offers = await adapter.extract(raw);
    // carry the discovery's skuId hint onto extracted offers for mapping.
    return offers.map((o) => ({ ...o, skuId: o.skuId ?? ref.skuId }));
  }

  /** Map NormalizedOffer[] → Offer[] against candidate SKUs (skuId hint first, then fuzzy title). */
  private toOffers(
    adapter: ProviderAdapter,
    normalized: NormalizedOffer[],
    skus: Sku[],
    source: 'live' | 'cache',
  ): Offer[] {
    const out: Offer[] = [];
    for (const n of normalized) {
      const sku = this.matchSku(n, skus);
      if (!sku) continue; // live product doesn't map to a candidate SKU → skip (truthful grouping)
      out.push({
        id: `off_${adapter.providerId}_${sku.id}_${n.providerSkuRef}`,
        skuId: sku.id,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        priceFils: n.priceFils,
        inStock: n.inStock,
        deeplinkUrl: n.deeplink,
        source,
        fetchedAt: n.fetchedAt,
      });
    }
    return out;
  }

  private matchSku(n: NormalizedOffer, skus: Sku[]): Sku | undefined {
    if (n.skuId) {
      const direct = skus.find((s) => s.id === n.skuId);
      if (direct) return direct;
    }
    // fuzzy: brand/model tokens present in the live title; storage from title OR extracted attrs.
    const title = n.title.toLowerCase();
    const offerStorage = (n.attrs.storage ?? '').toLowerCase().replace(/\s+/g, '');
    return skus.find((s) => {
      const model = s.model.toLowerCase();
      const storage = (s.attributes.storage ?? '').toLowerCase();
      const modelOk = model.split(/\s+/).every((t) => title.includes(t));
      // storage matches if absent on the SKU, OR present in the title, OR present in the offer attrs.
      const storageOk = !storage || title.includes(storage) || offerStorage === storage;
      return modelOk && storageOk;
    });
  }

  private queryText(intent: IntentNormalized, skus: Sku[]): string {
    if (intent.model) return `${intent.brand ?? ''} ${intent.model}`.trim().toLowerCase();
    if (intent.brand) return intent.brand.toLowerCase();
    // fall back to the first candidate SKU's model (e.g. "iphone 16").
    return (skus[0]?.model ?? '').toLowerCase();
  }
}
