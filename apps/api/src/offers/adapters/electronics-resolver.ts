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
import { normalizeProviderQuery, relaxQueryVariants } from './query-normalize';

/**
 * Per-tier hard timeout (ADR-003 §4).
 *
 * OWNER BUG 2026-06-27 (HIGH — catalog terms → 0 cards/timeout): the old http=1500ms / render=5000ms was
 * too tight for live discovery. Each provider does a discover() THEN a fetch()+extract() per product
 * (sequential round-trips), and Eureka's Algolia index under load regularly exceeds 5s — so a real
 * provider would abort mid-chain and the whole lane returned []. Bumped to a robust band that still
 * stays within the overall query budget because providers run in PARALLEL (allSettled): the slow
 * provider only delays itself, the others return on time and we serve PARTIAL results.
 *   http   (Blink suggest.json / X-cite)  : 3500ms  (suggest.json + a PDP fetch, ×1 retry inside httpGet)
 *   render (Eureka Algolia)               : 7000ms  (Algolia query can spike; this is the appliance source)
 */
const TIER_TIMEOUT_MS: Record<string, number> = {
  http: 3500,
  render: 7000,
  render_residential: 8000,
};

/** Overall cap for a single provider's full discover→fetch chain, so one provider never blocks the lane. */
const PER_PROVIDER_DEADLINE_MS = 9000;

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
    return (await this.resolveWithCoverage(intent)).offers;
  }

  /**
   * Resolve electronics offers AND report coverage (ADR-007 Q5 / GR4): when the result is empty we must
   * distinguish a PROVIDER FAILURE/TIMEOUT (some provider threw or timed out → the empty is suspect and
   * must be flagged) from a GENUINE no-match (every provider answered cleanly, none stocks the term).
   */
  async resolveWithCoverage(intent: IntentNormalized): Promise<ElectronicsResolveResult> {
    const queryText = this.queryText(intent);
    if (!queryText) return { offers: [], providersTried: 0, providersFailed: 0 };

    // RELAX-AND-RETRY discovery ladder (most-specific first). An over-specific multi-word query
    // ("Google Pixel 9", "vacuum cleaner Dyson", "headphones under 50 KWD") over-constrains the
    // provider search → 0 refs; each successive rung drops the most-specific trailing modifier so a
    // genuinely-stocked product is still found. Relevance scoring below uses the ORIGINAL queryText,
    // so the dropped tokens still rank/filter the RESULTS — they just can't zero out discovery.
    const discoveryLadder = relaxQueryVariants(queryText);

    const providers = this.adapters.filter((a) => a.enabled && a.sector === 'electronics');
    const settled = await Promise.allSettled(
      providers.map((a) =>
        this.withDeadline(this.resolveOneProvider(a, queryText, discoveryLadder), PER_PROVIDER_DEADLINE_MS),
      ),
    );

    // Collect every provider's synthesized (title-carrying) hits, then group same-product across them.
    // A provider counts as FAILED if it rejected (timeout/threw at the deadline level) OR its own
    // chain caught an error (failed=true). A clean empty (provider answered, nothing relevant) is NOT
    // a failure — that is a genuine no-match (ADR-007 Q5 coverage distinction).
    const hits: ProviderHit[] = [];
    let providersFailed = 0;
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        hits.push(...r.value.hits);
        if (r.value.failed) providersFailed++;
      } else {
        providersFailed++; // rejected/timed-out provider → partial results (ADR-003 §4/§5); flagged.
      }
    }

    const offers = hits.length === 0 ? [] : this.groupAndSynthesize(hits, queryText);
    return { offers, providersTried: providers.length, providersFailed };
  }

  /** Race a provider's full chain against an overall deadline so one hung provider can't stall the lane. */
  private withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_resolve, reject) => {
        const t = setTimeout(() => reject(new Error('provider deadline exceeded')), ms);
        if (typeof t.unref === 'function') t.unref();
      }),
    ]);
  }

  private async resolveOneProvider(
    adapter: ProviderAdapter,
    queryText: string,
    discoveryLadder: string[] = [queryText],
  ): Promise<ProviderResult> {
    const ctx = {
      ...DEFAULT_HTTP_CTX,
      timeoutMs: TIER_TIMEOUT_MS[adapter.tier] ?? DEFAULT_HTTP_CTX.timeoutMs,
    };
    // Cache by the FULL specific query so two specific queries that relax to the same core still keep
    // their own (differently-filtered) result sets.
    const cacheKey = `elec:${adapter.providerId}:${queryText}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return { hits: this.toHits(adapter, cached, 'cache', queryText), failed: false };

    try {
      // RELAX-AND-RETRY: walk the ladder most-specific FIRST; for each rung discover→fetch→filter, and
      // stop at the first rung that yields a non-empty RELEVANT set. Crucially we re-check relevance per
      // rung — an over-specific rung can DISCOVER (its core substring hits) yet then be over-constrained
      // by its own extra token at the FILTER step (e.g. "vacuum cleaner DYSON" finds vacuums but the
      // "dyson" AND-token drops the non-Dyson ones). Relaxing the FLOOR to the matched rung keeps them.
      // The full original queryText still RANKS every rung's results (the specific match floats first).
      let relevant: NormalizedOffer[] = [];
      let anyDiscovered = false;
      for (const term of discoveryLadder) {
        const refs = await adapter.discover({ text: term, limit: PER_PROVIDER_LIMIT }, ctx);
        if (refs.length === 0) continue;
        anyDiscovered = true;

        const perRef = await Promise.allSettled(refs.map((ref) => this.fetchExtract(adapter, ref, ctx)));
        const normalized: NormalizedOffer[] = [];
        for (const r of perRef) if (r.status === 'fulfilled') normalized.push(...r.value);

        // RELEVANCE floor = THIS rung's term (the AND-filter); RANK by the full specific queryText so a
        // closer specific match floats first without dropping the rest. Provider category path is an
        // extra signal so brand/model-named devices still match.
        relevant = filterProductsByQuery(
          normalized.map((n) => Object.assign(n, { category: n.attrs.category })),
          term,
          queryText,
        );
        if (relevant.length > 0) break; // first rung with real, relevant hits wins.
      }

      if (relevant.length === 0) {
        // Either no rung discovered anything, or what was found wasn't relevant → genuine miss (not a
        // provider failure: the provider answered cleanly).
        if (anyDiscovered) (adapter as any).markOk?.();
        else adapter.health();
        return { hits: [], failed: false };
      }

      (adapter as any).markOk?.();
      await this.cache.set(cacheKey, relevant, ELECTRONICS_TTL_MS);
      return { hits: this.toHits(adapter, relevant, 'live', queryText), failed: false };
    } catch {
      (adapter as any).markFail?.();
      return { hits: [], failed: true }; // graceful partial result, but FLAGGED as a provider failure.
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
    // C1 fix: AR→EN + typo normalization so the provider search receives an indexable EN term
    // (غسالة صحون→dishwasher, ايفون→iphone, refrigirator→refrigerator) BEFORE phrase-canonicalization.
    const normalized = normalizeProviderQuery(raw, 'electronics');
    return canonicalizeElectronicsPhrase(normalized);
  }
}

interface ProviderHit {
  adapter: ProviderAdapter;
  n: NormalizedOffer;
  source: 'live' | 'cache';
  score: number;
}

/** Per-provider outcome: the synthesized hits + whether the provider FAILED (threw) vs cleanly empty. */
interface ProviderResult {
  hits: ProviderHit[];
  failed: boolean;
}

/** Result of electronics discovery + coverage telemetry (ADR-007 Q5). */
export interface ElectronicsResolveResult {
  offers: ResolvedOffer[];
  /** How many electronics providers were enabled/tried this run. */
  providersTried: number;
  /** How many of those threw or exceeded their deadline (a suspect empty when offers is []). */
  providersFailed: number;
}
