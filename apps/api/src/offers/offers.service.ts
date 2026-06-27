import { Injectable } from '@nestjs/common';
import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';
import { MOCK_OFFERS, MOCK_SKUS } from './mock-offers.dataset';
import { ProviderAdapter } from './adapters/provider-adapter.interface';
import { InMemoryOfferCache, OfferCache } from './adapters/offer-cache';
import { XciteAdapter } from './adapters/xcite.adapter';
import { BlinkAdapter } from './adapters/blink.adapter';
import { EurekaAdapter } from './adapters/eureka.adapter';
import { TalabatAdapter } from './adapters/talabat.adapter';
import { LiveOfferResolver } from './adapters/live-resolver';
import { ElectronicsOfferResolver } from './adapters/electronics-resolver';
import { FoodOfferResolver } from './adapters/food-resolver';
import { SocialIngestAdapter } from './adapters/social/social-ingest.adapter';
import { SocialOfferResolver } from './adapters/social/social-resolver';

export interface ResolvedOffer {
  offer: Offer;
  sku: Sku;
}

/**
 * Provider ids that have a LIVE adapter. Their mock offers are dropped when LIVE_FETCH is on.
 * S2.6 Slice A: X-cite + Blink (Tier-1). ADR-003 Slice B: Eureka (Tier-2, Algolia XHR sniff).
 */
const LIVE_PROVIDER_IDS = new Set(['prov_xcite', 'prov_blink', 'prov_eureka']);

/**
 * Provider-data layer (ADR-003). resolveOffers(intent) → ResolvedOffer[] keyed by matching SKUs.
 *
 * S2.6 (Slice A): X-cite + Blink return LIVE offers via Tier-1 adapters (deterministic parse, no
 * browser, no Claude). The MOCK dataset is kept ONLY for providers without an adapter yet
 * (Eureka, Best Al-Yousifi) — clearly labeled. Live fetch is per-site-timeout-bounded, parallel
 * (allSettled), short-TTL cached, and degrades gracefully (partial results) on any provider failure.
 *
 * Truthfulness is enforced structurally inside the adapters (price must be present verbatim in the
 * fetched source, else dropped). Set LIVE_FETCH=off to run fully offline on the mock dataset (tests).
 */
@Injectable()
export class OffersService {
  private readonly liveEnabled = process.env.LIVE_FETCH !== 'off';
  private adapters: ProviderAdapter[] = [
    new XciteAdapter(),
    new BlinkAdapter(),
    new EurekaAdapter(),
  ];
  private foodAdapters: ProviderAdapter[] = [new TalabatAdapter()];
  // Social (Instagram) lane — ADR-006. MOCK-FIRST: runs with NO Apify key / NO live IG / $0 spend,
  // so it is NOT gated by LIVE_FETCH (the mock provider is offline by design). One adapter per vertical.
  private socialAdapters: ProviderAdapter[] = [
    new SocialIngestAdapter('food'),
    new SocialIngestAdapter('realestate'),
  ];
  private cache: OfferCache = new InMemoryOfferCache();
  private resolver = new LiveOfferResolver(this.adapters, this.cache);
  // ADR-007 Q1: catalog-free electronics discovery (real provider search → synthesized SKUs).
  // Used when LIVE_FETCH=on; the MOCK_SKUS path below is the offline/test fallback (LIVE_FETCH=off).
  private electronicsResolver = new ElectronicsOfferResolver(this.adapters, this.cache);
  private foodResolver = new FoodOfferResolver(this.foodAdapters, this.cache);
  private socialResolver = new SocialOfferResolver(this.socialAdapters, this.cache);

  /**
   * Nest injects this with NO constructor args (defaults above wire X-cite + Blink + in-memory
   * cache). Tests/scripts override the live layer with `withLiveLayer(...)` — keeps DI trivial.
   */
  withLiveLayer(cache: OfferCache, adapters: ProviderAdapter[]): this {
    this.cache = cache;
    this.adapters = adapters;
    this.resolver = new LiveOfferResolver(adapters, cache);
    this.electronicsResolver = new ElectronicsOfferResolver(adapters, cache);
    return this;
  }

  /** Override the FOOD live layer (Talabat) — tests inject a network-mocked adapter (ADR-005). */
  withFoodLayer(cache: OfferCache, foodAdapters: ProviderAdapter[]): this {
    this.cache = cache;
    this.foodAdapters = foodAdapters;
    this.foodResolver = new FoodOfferResolver(foodAdapters, cache);
    return this;
  }

  /** Override the SOCIAL (Instagram) layer — tests inject a mock-provider/extractor adapter (ADR-006). */
  withSocialLayer(cache: OfferCache, socialAdapters: ProviderAdapter[]): this {
    this.cache = cache;
    this.socialAdapters = socialAdapters;
    this.socialResolver = new SocialOfferResolver(socialAdapters, cache);
    return this;
  }

  async resolveOffers(intent: IntentNormalized): Promise<ResolvedOffer[]> {
    // REAL ESTATE sector (ADR-006): flats come ONLY from the social (Instagram) mock lane — no portal
    // adapter yet. Mock-first, so it runs offline/in tests (NOT gated by LIVE_FETCH). The AI matches
    // the seeded flat posts to the intent (area/rooms).
    if (intent.category === 'realestate') {
      return this.resolveSocial(intent, 'realestate');
    }

    // FOOD sector: Talabat (ADR-005, LIVE, gated by LIVE_FETCH) MERGED with the social IG mock lane
    // (ADR-006) so Food results include IG-only restaurant/meal-prep/dessert offers alongside Talabat.
    if (intent.category === 'food') {
      const [talabat, social] = await Promise.all([
        this.liveEnabled
          ? this.foodResolver.resolve(intent).catch(() => [] as ResolvedOffer[])
          : Promise.resolve([] as ResolvedOffer[]),
        this.resolveSocial(intent, 'food'),
      ]);
      return [...talabat, ...social];
    }

    // ELECTRONICS (everything else). ADR-007 Q1: when LIVE_FETCH=on, discovery is CATALOG-FREE —
    // call the providers' real search with the query text and synthesize a SKU/offer per live hit, so
    // ANY product the providers sell is searchable (the "Dish washing Machine" → 0 results bug). The
    // in-code MOCK_SKUS is only a fixture/offline fallback (LIVE_FETCH=off) or a safety net if the live
    // search returns nothing (e.g. a seeded model with no live hit this run).
    if (this.liveEnabled) {
      let live: ResolvedOffer[] = [];
      try {
        live = await this.electronicsResolver.resolve(intent);
      } catch {
        live = []; // never block the query on the live layer
      }
      if (live.length > 0) return live;
    }
    return this.resolveForSkus(intent, this.matchSkus(intent));
  }

  /** Resolve the social (Instagram) mock lane for a vertical; never blocks the query on failure. */
  private async resolveSocial(intent: IntentNormalized, sector: 'food' | 'realestate'): Promise<ResolvedOffer[]> {
    try {
      return await this.socialResolver.resolve(intent, sector);
    } catch {
      return [];
    }
  }

  /**
   * BROADENED pool for the no-match fallback (F-SR1). Same category (and same brand when a brand was
   * stated) but the MODEL filter is dropped, so adjacent models + near-budget neighbours are
   * available as REAL alternatives. The primary `resolveOffers` stays model-scoped (locked by
   * offers.service.spec — answering a bad storage must NOT change the model's offer set); the fallback
   * draws its `alternative`/`within_budget`/`related` classes from THIS wider, still-truthful set.
   * Returns the same exact-model offers too (superset of resolveOffers) so callers can rank once.
   */
  async resolveBroadened(intent: IntentNormalized): Promise<ResolvedOffer[]> {
    // Food + Real-estate have no model-adjacency notion (each dish/flat is its own item) → the
    // broadened pool == the primary set (cross-item grouping is a later slice, ADR-005/006).
    if (intent.category === 'food' || intent.category === 'realestate') return this.resolveOffers(intent);
    return this.resolveForSkus(intent, this.matchSkusBroadened(intent));
  }

  private async resolveForSkus(intent: IntentNormalized, skus: Sku[]): Promise<ResolvedOffer[]> {
    if (skus.length === 0) return [];
    const skuById = new Map(skus.map((s) => [s.id, s]));
    const skuIds = new Set(skus.map((s) => s.id));

    // 1) MOCK offers. When live fetch is ON, X-cite/Blink mock rows are dropped (replaced by live
    //    data below). When OFF (offline/tests), ALL mock rows are kept so the dataset is intact.
    const mockOffers = MOCK_OFFERS.filter(
      (o) => skuIds.has(o.skuId) && !(this.liveEnabled && LIVE_PROVIDER_IDS.has(o.providerId)),
    );

    // 2) LIVE offers for X-cite + Blink (replace their mock rows for the matched SKUs).
    let liveOffers: Offer[] = [];
    if (this.liveEnabled) {
      try {
        liveOffers = await this.resolver.resolve(intent, skus);
      } catch {
        liveOffers = []; // never block the query on the live layer
      }
    }

    const all = [...mockOffers, ...liveOffers];
    return all
      .filter((o) => skuById.has(o.skuId))
      .map((offer) => ({ offer, sku: skuById.get(offer.skuId)! }));
  }

  /**
   * Candidate SKUs are matched on PRODUCT IDENTITY ONLY (category/brand/model) — the answered
   * preferences (storage/color/budget) are NOT a hard filter here. They are a SOFT RANK signal
   * applied later in `rankOffers` (preference-matching offers float to the top, non-matching but
   * relevant offers still appear). This guarantees we never show the empty state while the model
   * has real offers (BUG fix): e.g. "iPhone 16" lives in 128GB/512GB only, so answering storage=256
   * must still return the real 128/512 offers ranked as "closest match" — not zero results.
   * Truly empty (no SKU for the model at all) is the ONLY case that yields the empty state.
   */
  private matchSkus(intent: IntentNormalized): Sku[] {
    return MOCK_SKUS.filter((sku) => {
      if (intent.category && sku.category !== intent.category) return false;
      if (intent.brand && sku.brand.toLowerCase() !== intent.brand.toLowerCase()) return false;
      if (intent.model && !sku.model.toLowerCase().includes(intent.model.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * Same as matchSkus but WITHOUT the model filter — same category, and same brand when one was
   * stated. Used only by `resolveBroadened` to give the fallback adjacent-model + near-budget
   * neighbours. (When no brand is stated, this == matchSkus on category, so the broadened pool only
   * grows the candidate set when a model — and not all same-brand/category models — was requested.)
   */
  private matchSkusBroadened(intent: IntentNormalized): Sku[] {
    return MOCK_SKUS.filter((sku) => {
      if (intent.category && sku.category !== intent.category) return false;
      if (intent.brand && sku.brand.toLowerCase() !== intent.brand.toLowerCase()) return false;
      return true;
    });
  }
}
