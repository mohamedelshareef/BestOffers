import { IntentNormalized, Offer } from '@bestoffers/shared';
import { FoodOfferResolver } from './food-resolver';
import { InMemoryOfferCache } from './offer-cache';
import {
  AdapterHealth, DiscoveryQuery, FetchCtx, NormalizedOffer, ProductRef, ProviderAdapter, RawPage,
} from './provider-adapter.interface';

// Fake food adapter (no network) to assert resolver behaviour: synth dish SKUs, cache, partial results.
class FakeTalabat implements ProviderAdapter {
  providerId = 'prov_talabat'; providerName = 'Talabat'; sector = 'food' as const;
  tier = 'http' as const; enabled = true;
  discovers = 0; fetches = 0;
  constructor(private failFetch = false) {}
  async discover(_q: DiscoveryQuery, _c: FetchCtx): Promise<ProductRef[]> {
    this.discovers++; return [{ url: 'menu#slug=kfc', handle: 'kfc', providerSkuRef: '5804' }];
  }
  async fetch(_r: ProductRef, _c: FetchCtx): Promise<RawPage> {
    this.fetches++; if (this.failFetch) throw new Error('boom');
    return { url: 'menu#slug=kfc', json: {}, fetchedAt: 'T' };
  }
  async extract(_raw: RawPage): Promise<NormalizedOffer[]> {
    return [{
      providerSkuRef: '5804:Zinger', title: 'Zinger — Kfc', priceFils: 2000,
      attrs: { currency: 'KWD', restaurant: 'Kfc', isPromo: 'true', oldPriceFils: '3000' },
      deeplink: 'https://www.talabat.com/kuwait/kfc', inStock: true, source: 'http', fetchedAt: 'T',
    }];
  }
  health(): AdapterHealth { return { lastOkAt: null, consecutiveFailures: 0 }; }
}

const intent: IntentNormalized = { category: 'food', model: 'kfc', constraints: {} };

describe('FoodOfferResolver (ADR-005 Slice F-1)', () => {
  it('synthesizes a dish-Sku + Offer per real dish (truthful passthrough)', async () => {
    const a = new FakeTalabat(); const r = new FoodOfferResolver([a], new InMemoryOfferCache());
    const res = await r.resolve(intent);
    expect(res).toHaveLength(1);
    expect(res[0].sku.category).toBe('food');
    expect(res[0].sku.canonicalName).toBe('Zinger — Kfc');
    expect(res[0].offer.providerId).toBe('prov_talabat');
    expect(res[0].offer.priceFils).toBe(2000);
    expect(res[0].sku.attributes.isPromo).toBe('true');
  });

  it('serves the second identical query from cache (source=cache, no re-discover)', async () => {
    const a = new FakeTalabat(); const r = new FoodOfferResolver([a], new InMemoryOfferCache());
    const first = await r.resolve(intent);
    const second = await r.resolve(intent);
    expect(first[0].offer.source).toBe('live');
    expect(second[0].offer.source).toBe('cache');
    expect(a.discovers).toBe(1); // second call hit cache → no second discover
  });

  it('kill-switch (enabled=false) yields zero offers; a failing adapter degrades to partial []', async () => {
    const off = new FakeTalabat(); off.enabled = false;
    expect(await new FoodOfferResolver([off], new InMemoryOfferCache()).resolve(intent)).toHaveLength(0);
    const fail = new FakeTalabat(true);
    expect(await new FoodOfferResolver([fail], new InMemoryOfferCache()).resolve(intent)).toHaveLength(0);
  });
});
