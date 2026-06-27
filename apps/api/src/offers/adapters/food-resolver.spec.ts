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

// Multi-restaurant fake: discovery returns several restaurants whose FULL menus mix rice + non-rice
// dishes — the resolver must filter to the query term ("rice") and drop the burger.
class FakeMultiMenu implements ProviderAdapter {
  providerId = 'prov_talabat'; providerName = 'Talabat'; sector = 'food' as const;
  tier = 'http' as const; enabled = true;
  async discover(_q: DiscoveryQuery, _c: FetchCtx): Promise<ProductRef[]> {
    // none of these slugs contain "rice" → resolver treats it as a DISH query (filter dishes)
    return [
      { url: 'menu#slug=burger-king', handle: 'burger-king' },
      { url: 'menu#slug=chicken-tikka', handle: 'chicken-tikka' },
    ];
  }
  async fetch(ref: ProductRef, _c: FetchCtx): Promise<RawPage> {
    return { url: ref.url, json: { handle: ref.handle }, fetchedAt: 'T' };
  }
  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const slug = (raw.json as any).handle;
    if (slug === 'burger-king') {
      return [
        mk('Whopper — Burger King', 'Burgers', 2950),
        mk('French Fries — Burger King', 'Sides', 950),
      ];
    }
    return [
      mk('Chicken Biryani — Chicken Tikka', 'Biryani', 2750),
      mk('مجبوس دجاج — Chicken Tikka', 'الرز', 3000),
      mk('Grilled Chicken — Chicken Tikka', 'Grills', 2200),
    ];
  }
  health(): AdapterHealth { return { lastOkAt: null, consecutiveFailures: 0 }; }
}
function mk(title: string, category: string, priceFils: number): NormalizedOffer {
  return {
    providerSkuRef: title, title, priceFils,
    attrs: { currency: 'KWD', category }, deeplink: 'https://www.talabat.com/kuwait/x',
    inStock: true, source: 'http', fetchedAt: 'T',
  };
}

const intent: IntentNormalized = { category: 'food', model: 'kfc', constraints: {} };
const riceIntent: IntentNormalized = { category: 'food', model: 'rice', constraints: {} };

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

  it('a DISH query ("rice") returns ONLY rice/biryani/مجبوس dishes — the burger is excluded', async () => {
    const r = new FoodOfferResolver([new FakeMultiMenu()], new InMemoryOfferCache());
    const res = await r.resolve(riceIntent);
    const names = res.map((o) => o.sku.canonicalName);
    expect(names).toEqual(expect.arrayContaining([
      'Chicken Biryani — Chicken Tikka',
      'مجبوس دجاج — Chicken Tikka',
    ]));
    // the query term CONSTRAINS the result set — no burgers/fries/grills
    expect(names).not.toContain('Whopper — Burger King');
    expect(names).not.toContain('French Fries — Burger King');
    expect(names).not.toContain('Grilled Chicken — Chicken Tikka');
    expect(res.length).toBe(2);
  });

  it('a RESTAURANT query (slug matches the term) keeps the whole menu', async () => {
    // "burger-king" slug contains the token "burger" → restaurant query → no dish filter
    const r = new FoodOfferResolver([new FakeMultiMenu()], new InMemoryOfferCache());
    const res = await r.resolve({ category: 'food', model: 'burger king', constraints: {} });
    const names = res.map((o) => o.sku.canonicalName);
    expect(names).toContain('Whopper — Burger King');
    expect(names).toContain('French Fries — Burger King'); // whole menu kept, not just "burger"-named items
  });

  // ── OWNER BUG (2026-06-27): "Chilled with rice" → 274 unrelated sauces from "Test Burger King" ──
  // The killer: a DISH token ("rice") happens to appear in SOME discovered slug ("rice-house"), which
  // wrongly flipped the WHOLE query to restaurant-mode → the menu was dumped UNFILTERED. Plus a seeded
  // "Test Burger King" vendor + condiment-only sections leaked into live results.
  it('OWNER BUG: "Chilled with rice" returns ONLY rice dishes — no sauces, no Test vendor, no dump', async () => {
    class FakeBugMenu implements ProviderAdapter {
      providerId = 'prov_talabat'; providerName = 'Talabat'; sector = 'food' as const;
      tier = 'http' as const; enabled = true;
      async discover(_q: DiscoveryQuery, _c: FetchCtx): Promise<ProductRef[]> {
        // 'rice-house' contains the dish token "rice" (the trap); 'test-burger-king' is a seed vendor.
        return [
          { url: 'menu#slug=test-burger-king', handle: 'test-burger-king' },
          { url: 'menu#slug=burger-king', handle: 'burger-king' },
          { url: 'menu#slug=rice-house', handle: 'rice-house' },
        ];
      }
      async fetch(ref: ProductRef, _c: FetchCtx): Promise<RawPage> {
        return { url: ref.url, json: { handle: ref.handle }, fetchedAt: 'T' };
      }
      async extract(raw: RawPage): Promise<NormalizedOffer[]> {
        const slug = (raw.json as any).handle;
        if (slug === 'burger-king') {
          return [
            mk('Fiery Sauce — Burger King', 'Sauces', 250),
            mk('Garlic Mayo — Burger King', 'Sauces', 250),
            mk('BBQ Sauce — Burger King', 'Sauces', 250),
            mk('Whopper — Burger King', 'Burgers', 2950),
          ];
        }
        if (slug === 'rice-house') return [mk('Chicken Rice Bowl — Rice House', 'Rice', 1500)];
        return [mk('Should-Not-Appear — Test Burger King', 'Sauces', 250)]; // seed vendor (filtered at discovery)
      }
      health(): AdapterHealth { return { lastOkAt: null, consecutiveFailures: 0 }; }
    }
    const r = new FoodOfferResolver([new FakeBugMenu()], new InMemoryOfferCache());
    const res = await r.resolve({ category: 'food', model: 'Chilled with rice', constraints: {} });
    const names = res.map((o) => o.sku.canonicalName);
    expect(names).toContain('Chicken Rice Bowl — Rice House');
    expect(names).not.toContain('Fiery Sauce — Burger King'); // condiments dropped on a dish query
    expect(names).not.toContain('Garlic Mayo — Burger King');
    expect(names).not.toContain('BBQ Sauce — Burger King');
    expect(names).not.toContain('Whopper — Burger King'); // unrelated dish dropped
    expect(names.some((n) => /Test Burger King/i.test(n))).toBe(false); // seed vendor excluded
    expect(res.length).toBeLessThanOrEqual(3); // never a 274-item dump
  });

  // ── RC-1: McDonald's vendor routing. Real Talabat outlet slugs carry branch-id/area suffixes
  // ("mcdonalds1", "mcdonalds-1800059-bairaq-mall"); the query token "mcdonalds" must still flip the
  // query to RESTAURANT mode (whole menu) via the brand-prefix slug match. ──
  it('"mcdonalds" matches the real outlet slug "mcdonalds1" → whole-menu vendor mode (RC-1)', async () => {
    class FakeMcd implements ProviderAdapter {
      providerId = 'prov_talabat'; providerName = 'Talabat'; sector = 'food' as const;
      tier = 'http' as const; enabled = true;
      async discover(_q: DiscoveryQuery, _c: FetchCtx): Promise<ProductRef[]> {
        return [{ url: 'menu#slug=mcdonalds1', handle: 'mcdonalds1', providerSkuRef: '23302' }];
      }
      async fetch(ref: ProductRef): Promise<RawPage> { return { url: ref.url, json: {}, fetchedAt: 'T' }; }
      async extract(): Promise<NormalizedOffer[]> {
        return [
          mk('Big Mac — Mcdonalds', 'Burgers', 1500),
          mk('Golden McFlurry — Mcdonalds', 'Desserts', 1250),
          mk('Fries — Mcdonalds', 'Sides', 500),
        ];
      }
      health(): AdapterHealth { return { lastOkAt: null, consecutiveFailures: 0 }; }
    }
    const r = new FoodOfferResolver([new FakeMcd()], new InMemoryOfferCache());
    const res = await r.resolve({ category: 'food', model: 'mcdonalds', constraints: {} });
    const names = res.map((o) => o.sku.canonicalName);
    expect(names).toContain('Big Mac — Mcdonalds');
    expect(names).toContain('Golden McFlurry — Mcdonalds'); // whole menu kept (vendor query), not dish-filtered
    expect(res.length).toBe(3);
  });

  it('kill-switch (enabled=false) yields zero offers; a failing adapter degrades to partial []', async () => {
    const off = new FakeTalabat(); off.enabled = false;
    expect(await new FoodOfferResolver([off], new InMemoryOfferCache()).resolve(intent)).toHaveLength(0);
    const fail = new FakeTalabat(true);
    expect(await new FoodOfferResolver([fail], new InMemoryOfferCache()).resolve(intent)).toHaveLength(0);
  });
});
