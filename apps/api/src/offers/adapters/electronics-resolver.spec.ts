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
});
