import { IntentNormalized } from '@bestoffers/shared';
import { ElectronicsOfferResolver } from './electronics-resolver';
import { InMemoryOfferCache } from './offer-cache';
import {
  DiscoveryQuery,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
  RawPage,
} from './provider-adapter.interface';

/**
 * Fake electronics adapter — returns a fixed set of NormalizedOffers regardless of fetch, so we can
 * prove the CATALOG-FREE resolver synthesizes SKUs/offers from arbitrary provider hits (no MOCK_SKUS).
 */
class FakeAdapter implements ProviderAdapter {
  readonly sector = 'electronics' as const;
  readonly tier = 'http' as const;
  enabled = true;
  constructor(
    readonly providerId: string,
    readonly providerName: string,
    private readonly offers: NormalizedOffer[],
  ) {}
  async discover(_q: DiscoveryQuery): Promise<ProductRef[]> {
    return this.offers.map((o, i) => ({ url: `u${i}`, providerSkuRef: o.providerSkuRef }));
  }
  async fetch(ref: ProductRef): Promise<RawPage> {
    return { url: ref.url, json: {}, fetchedAt: '2026-06-27T00:00:00.000Z' };
  }
  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const i = Number(raw.url.replace('u', ''));
    return [this.offers[i]];
  }
  health() {
    return { lastOkAt: null, consecutiveFailures: 0 };
  }
}

function offer(ref: string, title: string, priceFils: number): NormalizedOffer {
  return {
    providerSkuRef: ref,
    title,
    priceFils,
    attrs: { currency: 'KWD' },
    deeplink: `https://x/${ref}`,
    inStock: true,
    source: 'http',
    fetchedAt: '2026-06-27T00:00:00.000Z',
  };
}

const intent = (model: string): IntentNormalized => ({ category: 'appliance', model, constraints: {} });

/**
 * A QUERY-AWARE fake provider: its catalog only matches a relaxed CORE search term, so the FULL
 * over-specific query returns 0 refs and only a relaxed rung discovers — exactly the bug class. Records
 * every discovery term it was asked, so we can assert the resolver relaxed-and-retried.
 */
class SearchAwareAdapter implements ProviderAdapter {
  readonly sector = 'electronics' as const;
  readonly tier = 'http' as const;
  enabled = true;
  readonly queriesSeen: string[] = [];
  constructor(
    readonly providerId: string,
    readonly providerName: string,
    /** core search term the catalog actually indexes (e.g. "vacuum cleaner") */
    private readonly indexedTerm: string,
    private readonly stock: NormalizedOffer[],
  ) {}
  async discover(q: DiscoveryQuery): Promise<ProductRef[]> {
    this.queriesSeen.push(q.text);
    // only a search term that CONTAINS the indexed core returns refs (over-specific term → 0).
    return q.text.toLowerCase().includes(this.indexedTerm)
      ? this.stock.map((o, i) => ({ url: `u${i}`, providerSkuRef: o.providerSkuRef }))
      : [];
  }
  async fetch(ref: ProductRef): Promise<RawPage> {
    return { url: ref.url, json: {}, fetchedAt: '2026-06-27T00:00:00.000Z' };
  }
  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    return [this.stock[Number(raw.url.replace('u', ''))]];
  }
  health() {
    return { lastOkAt: null, consecutiveFailures: 0 };
  }
}

describe('ElectronicsOfferResolver — catalog-free discovery (ADR-007 Q1)', () => {
  it('synthesizes SKUs/offers for an OFF-CATALOG query ("Dish washing Machine") with no MOCK_SKUS', async () => {
    const blink = new FakeAdapter('prov_blink', 'Blink', [
      offer('b1', 'Bosch Free-Standing Dishwasher 60cm', 159000),
      offer('b2', 'Samsung Microwave Oven 28L', 39000), // off-query → must be filtered out
    ]);
    const resolver = new ElectronicsOfferResolver([blink], new InMemoryOfferCache());

    const out = await resolver.resolve(intent('Dish washing Machine'));
    expect(out.length).toBe(1); // only the dishwasher; the microwave is relevance-dropped
    expect(out[0].sku.canonicalName).toContain('Dishwasher');
    expect(out[0].sku.category).toBe('electronics'); // synthesized, NOT a mock catalog category
    expect(out[0].offer.priceFils).toBe(159000); // price verbatim from the hit (truthful)
    expect(out[0].offer.providerName).toBe('Blink');
  });

  it('MERGES the same product across providers into ONE SKU carrying both offers', async () => {
    const xcite = new FakeAdapter('prov_xcite', 'X-cite', [
      offer('x1', 'Samsung 55 inch Crystal UHD 4K Smart TV', 119000),
    ]);
    const blink = new FakeAdapter('prov_blink', 'Blink', [
      offer('b1', 'Samsung 55" Crystal UHD 4K Smart TV', 115000),
    ]);
    const resolver = new ElectronicsOfferResolver([xcite, blink], new InMemoryOfferCache());

    const out = await resolver.resolve(intent('Samsung TV'));
    const skuIds = new Set(out.map((o) => o.sku.id));
    expect(skuIds.size).toBe(1); // grouped into one product
    const providers = out.map((o) => o.offer.providerId).sort();
    expect(providers).toEqual(['prov_blink', 'prov_xcite']); // both providers' offers attached
  });

  it('keeps DIFFERENT products as separate SKUs (conservative grouping, no false merge)', async () => {
    const blink = new FakeAdapter('prov_blink', 'Blink', [
      offer('b1', 'Samsung 55 inch Crystal UHD 4K Smart TV', 119000),
      offer('b2', 'LG 65 inch OLED evo C4 Smart TV', 245000),
    ]);
    const resolver = new ElectronicsOfferResolver([blink], new InMemoryOfferCache());
    const out = await resolver.resolve(intent('Smart TV'));
    expect(new Set(out.map((o) => o.sku.id)).size).toBe(2);
  });

  it('one provider failing NEVER fails the query (partial results)', async () => {
    const good = new FakeAdapter('prov_blink', 'Blink', [offer('b1', 'Bosch Dishwasher', 159000)]);
    const bad = new FakeAdapter('prov_eureka', 'Eureka', []);
    bad.discover = async () => {
      throw new Error('Eureka down');
    };
    const resolver = new ElectronicsOfferResolver([good, bad], new InMemoryOfferCache());
    const out = await resolver.resolve(intent('dishwasher'));
    expect(out.length).toBe(1);
    expect(out[0].offer.providerName).toBe('Blink');
  });

  it('returns [] (honest empty) when the providers have nothing relevant — never invents', async () => {
    const blink = new FakeAdapter('prov_blink', 'Blink', [offer('b1', 'Samsung Microwave 28L', 39000)]);
    const resolver = new ElectronicsOfferResolver([blink], new InMemoryOfferCache());
    const out = await resolver.resolve(intent('dishwasher'));
    expect(out).toEqual([]);
  });

  /**
   * RELAX-AND-RETRY (over-specific multi-word electronics → 0). The 10 verified failing→working pairs:
   * the full term over-constrains discovery (0 refs), a relaxed core finds the real product, and the
   * specific tokens still RANK the results (the matching one floats first) without dropping the rest.
   */
  describe('relax-and-retry discovery on over-specific multi-word queries', () => {
    const cases: Array<{ q: string; core: string; title: string }> = [
      { q: 'air conditioner split unit', core: 'air conditioner', title: 'Gree Split Air Conditioner 1.5 Ton' },
      // BRAND-named queries must return the SAME brand (owner bug: a brand query must not leak another brand).
      { q: 'vacuum cleaner Dyson', core: 'vacuum cleaner', title: 'Dyson V15 Detect Cordless Vacuum Cleaner' },
      { q: 'Google Pixel 9', core: 'google pixel', title: 'Google Pixel 8 Pro 256GB' },
      { q: 'AirPods Pro 2', core: 'airpods', title: 'Apple AirPods 3rd Generation' },
      { q: 'Apple Watch Series 10', core: 'apple watch', title: 'Apple Watch SE 44mm' },
      { q: 'LG OLED 65 TV', core: 'lg oled tv', title: 'LG OLED 55 inch evo C4 Smart TV' },
      { q: 'Samsung side by side fridge', core: 'samsung fridge', title: 'Samsung Refrigerator 600L Twin Cooling' },
      { q: 'front load washing machine LG', core: 'washing machine', title: 'LG Washing Machine 8kg 1400rpm' },
      { q: 'Xiaomi phone', core: 'xiaomi', title: 'Xiaomi Redmi Note 13 Pro 256GB' },
      { q: 'headphones under 50 KWD', core: 'headphones', title: 'Sony WH-CH520 Wireless Headphones' },
    ];

    it.each(cases)('$q → 0 on the full term but real cards on the relaxed core', async ({ q, core, title }) => {
      const adapter = new SearchAwareAdapter('prov_eureka', 'Eureka', core, [offer('e1', title, 99000)]);
      const resolver = new ElectronicsOfferResolver([adapter], new InMemoryOfferCache());
      const out = await resolver.resolve(intent(q));
      // BEFORE this fix the resolver passed only the full over-specific term → 0 cards. Now: real card.
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out[0].sku.canonicalName).toBe(title);
      expect(out[0].offer.priceFils).toBe(99000); // verbatim, truthful
      // it must have TRIED the full term first (precision-preserving) before relaxing.
      expect(adapter.queriesSeen[0].toLowerCase()).not.toBe(core);
      expect(adapter.queriesSeen.some((t) => t.toLowerCase().includes(core))).toBe(true);
    });

    it('RANKS the specific match first without dropping the rest of the relaxed core results', async () => {
      // "Google Pixel 9" relaxes to "google pixel"; both Pixel 9 and Pixel 8 are real → keep BOTH,
      // with the closer specific match (Pixel 9) ranked first. The extra "9" refines, never zeroes.
      const adapter = new SearchAwareAdapter('prov_blink', 'Blink', 'google pixel', [
        offer('b1', 'Google Pixel 8 Pro 256GB', 159000),
        offer('b2', 'Google Pixel 9 128GB', 189000),
      ]);
      const resolver = new ElectronicsOfferResolver([adapter], new InMemoryOfferCache());
      const out = await resolver.resolve(intent('Google Pixel 9'));
      expect(out.length).toBe(2); // both kept — relaxed discovery never drops the real core results
      expect(out[0].sku.canonicalName).toContain('Pixel 9'); // the specific "9" match ranks first
    });

    it('a GENUINELY-absent product still honest-empties (no rung discovers → never fabricates)', async () => {
      // catalog indexes only "dishwasher"; an off-catalog "Foobar 9000 gadget" relaxes but never hits.
      const adapter = new SearchAwareAdapter('prov_eureka', 'Eureka', 'dishwasher', [
        offer('e1', 'Bosch Dishwasher 60cm', 159000),
      ]);
      const resolver = new ElectronicsOfferResolver([adapter], new InMemoryOfferCache());
      const out = await resolver.resolve(intent('Foobar 9000 gadget'));
      expect(out).toEqual([]);
    });

    // OWNER bug: "Samsung phone" returned Adonit STYLUSES. Even after relaxing discovery to a bare brand,
    // the relevance filter must enforce brand AND type so unrelated-brand / wrong-type items never pass.
    it('REGRESSION "Samsung phone": relaxed discovery returns ONLY Samsung phones, NEVER a stylus', async () => {
      // The relaxed floor "samsung" discovers Samsung devices PLUS the provider's fuzzy noise (Adonit
      // styluses, a Samsung tablet, a case). Only Samsung PHONES may survive.
      const adapter = new SearchAwareAdapter('prov_blink', 'Blink', 'samsung', [
        offer('s1', 'Samsung Galaxy A55 5G 256GB Smartphone', 99000),
        offer('s2', 'Adonit Jot Pro Fine Point Stylus', 7500), // the live bug item — must be DROPPED
        offer('s3', 'Adonit Mini 4 Stylus', 8000), // the live bug item — must be DROPPED
        offer('s4', 'Samsung Galaxy Tab S9 Tablet', 159000), // wrong type — DROPPED
      ]);
      const resolver = new ElectronicsOfferResolver([adapter], new InMemoryOfferCache());
      const out = await resolver.resolve(intent('Samsung phone'));
      expect(out.length).toBe(1);
      expect(out[0].sku.canonicalName).toBe('Samsung Galaxy A55 5G 256GB Smartphone');
      expect(out.some((o) => /adonit|stylus|tablet/i.test(o.sku.canonicalName))).toBe(false);
    });

    it('REGRESSION brand-mismatch: "vacuum cleaner Dyson" with ONLY a Philips vacuum → honest-empty', async () => {
      // A brand-named query must not leak another brand. If the catalog has no Dyson vacuum, the honest
      // answer is empty — NOT a Philips vacuum.
      const adapter = new SearchAwareAdapter('prov_eureka', 'Eureka', 'vacuum cleaner', [
        offer('e1', 'Philips Vacuum Cleaner 2000W', 39000),
      ]);
      const resolver = new ElectronicsOfferResolver([adapter], new InMemoryOfferCache());
      const out = await resolver.resolve(intent('vacuum cleaner Dyson'));
      expect(out).toEqual([]);
    });
  });

  // ADR-007 Q5 / GR4 — coverage telemetry: a failing provider on an empty result is FLAGGED, not silent.
  describe('coverage (provider-failure vs genuine no-match)', () => {
    it('flags providersFailed when a provider throws and the result is empty', async () => {
      const bad = new FakeAdapter('prov_eureka', 'Eureka', []);
      bad.discover = async () => {
        throw new Error('Eureka timeout');
      };
      const resolver = new ElectronicsOfferResolver([bad], new InMemoryOfferCache());
      const r = await resolver.resolveWithCoverage(intent('dishwasher'));
      expect(r.offers).toEqual([]);
      expect(r.providersTried).toBe(1);
      expect(r.providersFailed).toBe(1); // a SUSPECT empty — must be flagged upstream as provider_failure
    });

    it('reports a clean (failure-free) coverage when a provider answers but has no match', async () => {
      const clean = new FakeAdapter('prov_blink', 'Blink', [offer('b1', 'Samsung Microwave 28L', 39000)]);
      const resolver = new ElectronicsOfferResolver([clean], new InMemoryOfferCache());
      const r = await resolver.resolveWithCoverage(intent('dishwasher'));
      expect(r.offers).toEqual([]);
      expect(r.providersFailed).toBe(0); // genuine no-match: the provider answered, nothing relevant
    });

    it('a slow provider that exceeds its deadline counts as failed but never blocks the others', async () => {
      const good = new FakeAdapter('prov_blink', 'Blink', [offer('b1', 'Bosch Dishwasher 60cm', 159000)]);
      const slow = new FakeAdapter('prov_eureka', 'Eureka', [offer('e1', 'Bosch Dishwasher 60cm', 162000)]);
      slow.discover = () => new Promise(() => {}); // never resolves → hits the per-provider deadline
      const resolver = new ElectronicsOfferResolver([good, slow], new InMemoryOfferCache());
      const r = await resolver.resolveWithCoverage(intent('dishwasher'));
      expect(r.offers.length).toBe(1); // good provider's partial result still returned
      expect(r.providersFailed).toBe(1); // the hung provider is flagged
    }, 12000);
  });
});
