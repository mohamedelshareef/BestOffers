import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';
import { ResolvedOffer } from '../offers.service';
import {
  DEFAULT_HTTP_CTX,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
} from './provider-adapter.interface';
import { ELECTRONICS_TTL_MS, OfferCache } from './offer-cache';
import {
  canonicalizeElectronicsPhrase,
  filterProductsByQuery,
  groupSimilarProducts,
  scoreProductTitle,
} from './electronics-relevance';

/** Per-tier hard timeout (ADR-003 §4): Tier-1 http ≈ 1.5s, Tier-2 render ≈ 5s, both ≤ 6s budget. */
const TIER_TIMEOUT_MS: Record<string, number> = {
  http: 1500,
  render: 5000,
  render_residential: 8000,
};

/** How many discovered products to keep per provider (over-fetch a little, then relevance-trim). */
const PER_PROVIDER_LIMIT = 8;

/**
 * ElectronicsOfferResolver (ADR-007 Q1 — CATALOG-FREE discovery).
 *
 * THE FIX: electronics is no longer bound to the 16-item in-code `MOCK_SKUS`. For ANY query (e.g.
 * "Dish washing Machine", "TV", "washing machine") this resolver calls each provider's REAL search
 * directly with the query text — Blink `/search/suggest.json`, Eureka Algolia `instant_records`, and
 * X-cite's known-URL path — and SYNTHESIZES a `Sku` + `Offer` straight from each live hit (title,
 * price→fils, image, url, stock). It does NOT require the hit to match a pre-existing candidate SKU.
 *
 * Mirrors `FoodOfferResolver`: allSettled fan-out, per-site timeout, short-TTL cache, partial results.
 * Two deterministic guards keep the raw provider feed truthful + clean:
 *   - relevance filter (electronics-relevance) drops wildly off-query hits (provider fuzzy search noise);
 *   - cross-provider grouping merges near-duplicate hits of the SAME product so X-cite/Blink/Eureka
 *     selling the same TV collapse into one comparable product (conservative trigram threshold).
 *
 * Truthful by construction: each adapter already drops any price not present verbatim in the fetched
 * bytes; this resolver only synthesizes from what the adapters returned, never inventing a price.
 */
export class ElectronicsOfferResolver {
  constructor(
    private readonly adapters: ProviderAdapter[],
    private readonly cache: OfferCache,
  ) {}

  async resolve(intent: IntentNormalized): Promise<ResolvedOffer[]> {
    const queryText = this.queryText(intent);
    if (!queryText) return [];

    const settled = await Promise.allSettled(
      this.adapters
        .filter((a) => a.enabled && a.sector === 'electronics')
        .map((a) => this.resolveOneProvider(a, queryText)),
    );

    // Collect every provider's synthesized (title-carrying) hits, then group same-product across them.
    const hits: ProviderHit[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') hits.push(...r.value);
      // rejected provider → omit (partial results); the query still returns the others (ADR-003 §4/§5).
    }
    if (hits.length === 0) return [];

    return this.groupAndSynthesize(hits, queryText);
  }

  private async resolveOneProvider(adapter: ProviderAdapter, queryText: string): Promise<ProviderHit[]> {
    const ctx = {
      ...DEFAULT_HTTP_CTX,
      timeoutMs: TIER_TIMEOUT_MS[adapter.tier] ?? DEFAULT_HTTP_CTX.timeoutMs,
    };
    const cacheKey = `elec:${adapter.providerId}:${queryText}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return this.toHits(adapter, cached, 'cache', queryText);

    try {
      // Pass the raw query text + a hint skuId for the X-cite known-URL path. Over-fetch then trim.
      const refs = await adapter.discover({ text: queryText, limit: PER_PROVIDER_LIMIT }, ctx);
      if (refs.length === 0) {
        adapter.health(); // healthy, just empty
        return [];
      }

      const perRef = await Promise.allSettled(refs.map((ref) => this.fetchExtract(adapter, ref, ctx)));
      const normalized: NormalizedOffer[] = [];
      for (const r of perRef) if (r.status === 'fulfilled') normalized.push(...r.value);

      // RELEVANCE: drop hits that don't actually match the query (provider fuzzy-search noise). Pass the
      // provider category path (attrs.category) as an extra signal so brand/model-named devices (a
      // MacBook under a "laptop" query) still match.
      const relevant = filterProductsByQuery(
        normalized.map((n) => Object.assign(n, { category: n.attrs.category })),
        queryText,
      );
      if (relevant.length === 0) {
        (adapter as any).markFail?.();
        return [];
      }

      (adapter as any).markOk?.();
      await this.cache.set(cacheKey, relevant, ELECTRONICS_TTL_MS);
      return this.toHits(adapter, relevant, 'live', queryText);
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

  private toHits(
    adapter: ProviderAdapter,
    normalized: NormalizedOffer[],
    source: 'live' | 'cache',
    queryText: string,
  ): ProviderHit[] {
    return normalized.map((n) => ({
      adapter,
      n,
      source,
      score: scoreProductTitle(n.title, queryText, n.attrs.category ?? ''),
    }));
  }

  /**
   * Group near-duplicate hits of the same product (across + within providers) so the same TV from
   * X-cite/Blink/Eureka collapses to ONE synthesized SKU carrying every provider's offer. Below the
   * conservative similarity threshold = separate cards (never a wrong price compare).
   */
  private groupAndSynthesize(hits: ProviderHit[], queryText: string): ResolvedOffer[] {
    const clusters = groupSimilarProducts(
      hits.map((h) => ({ title: h.n.title, providerId: h.adapter.providerId })),
    );

    const out: ResolvedOffer[] = [];
    for (const cluster of clusters) {
      const members = cluster.map((i) => hits[i]);
      // Canonical = the highest-scoring (most query-relevant) member's title/image.
      const canonical = members.slice().sort((a, b) => b.score - a.score)[0];
      const skuId = `elec_${this.slug(canonical.n.title)}`;
      const sku: Sku = {
        id: skuId,
        category: 'electronics',
        canonicalName: canonical.n.title,
        brand: canonical.n.attrs.brand ?? canonical.adapter.providerName,
        model: canonical.n.title,
        attributes: canonical.n.attrs,
        imageUrl: canonical.n.imageUrl,
      };
      // De-dupe per provider within the cluster (keep the first/cheapest hit per provider).
      const seenProvider = new Set<string>();
      for (const m of members) {
        const offerKey = `${m.adapter.providerId}`;
        if (seenProvider.has(offerKey)) {
          // same product from same provider twice → keep the cheaper.
          const existing = out.find((o) => o.sku.id === skuId && o.offer.providerId === m.adapter.providerId);
          if (existing && m.n.priceFils < existing.offer.priceFils) {
            existing.offer.priceFils = m.n.priceFils;
            existing.offer.deeplinkUrl = m.n.deeplink;
          }
          continue;
        }
        seenProvider.add(offerKey);
        const offer: Offer = {
          id: `off_${m.adapter.providerId}_${m.n.providerSkuRef}`,
          skuId,
          providerId: m.adapter.providerId,
          providerName: m.adapter.providerName,
          priceFils: m.n.priceFils,
          inStock: m.n.inStock,
          deeplinkUrl: m.n.deeplink,
          source: m.source,
          fetchedAt: m.n.fetchedAt,
        };
        out.push({ offer, sku });
      }
    }
    return out;
  }

  /** Short, stable id fragment from a title (synthesized SKU id). */
  private slug(title: string): string {
    return (title || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'item';
  }

  /**
   * Discovery query text: prefer brand+model, else model, else brand — then CANONICALIZE product
   * phrases so the provider search receives the term it actually indexes (VERIFIED: "dish washing
   * machine" → 0 hits, "dishwasher" → real dishwashers on Eureka).
   */
  private queryText(intent: IntentNormalized): string {
    const parts = [intent.brand, intent.model].filter(Boolean).join(' ').trim();
    const raw = parts || (intent.model ?? intent.brand ?? '').trim();
    return canonicalizeElectronicsPhrase(raw);
  }
}

interface ProviderHit {
  adapter: ProviderAdapter;
  n: NormalizedOffer;
  source: 'live' | 'cache';
  score: number;
}
