import {
  detectOfferArea,
  detectOfferTenure,
  detectQueryAreas,
  detectQueryTenure,
  filterFlatsByQuery,
  filterFlatsByTenure,
  inferTenureFromPrice,
  isSaneMonthlyRent,
  SANE_RENT_MAX_FILS,
  SANE_RENT_MIN_FILS,
} from './realestate-relevance';
import { SocialIngestAdapter } from './social/social-ingest.adapter';
import { MockSocialExtractor } from './social/mock-social-extractor';
import { MockSocialProvider } from './social/mock-social-provider';
import { SocialOfferResolver } from './social/social-resolver';
import { InMemoryOfferCache } from './offer-cache';
import { IntentNormalized } from '@bestoffers/shared';

/**
 * REAL-ESTATE relevance (OWNER DIRECTIVE — precision per category): a specific-area query must return
 * ONLY flats in that area (AR+EN aliases), never random off-area flats. Mirrors food-relevance.spec.
 */
describe('realestate-relevance — strict area matching (AR + EN aliases)', () => {
  describe('detectQueryAreas', () => {
    it('detects EN area names', () => {
      expect([...detectQueryAreas('flat in Salmiya 2 bedroom')]).toEqual(['salmiya']);
      expect([...detectQueryAreas('apartment Jabriya')]).toEqual(['jabriya']);
    });
    it('detects AR area names even when glued to a particle (بالسالمية / في الجابرية)', () => {
      expect([...detectQueryAreas('شقة بالسالمية غرفتين')]).toEqual(['salmiya']);
      expect([...detectQueryAreas('شقة في الجابرية للايجار')]).toEqual(['jabriya']);
      expect([...detectQueryAreas('شقة في السالوة')]).toEqual(['salwa']);
    });
    it('returns EMPTY when no recognizable area is named (free-form RE query)', () => {
      expect(detectQueryAreas('شقة للايجار غرفتين مفروشة').size).toBe(0);
      expect(detectQueryAreas('cheap apartment for rent').size).toBe(0);
    });
  });

  describe('detectOfferArea', () => {
    it('reads the extracted area attr (EN or AR)', () => {
      expect(detectOfferArea('Salmiya')).toBe('salmiya');
      expect(detectOfferArea('السالمية')).toBe('salmiya');
      expect(detectOfferArea('Mahboula')).toBe('mahboula');
    });
  });

  describe('filterFlatsByQuery', () => {
    const flats = [
      { area: 'Salmiya', text: '1BR · Salmiya · semi' },
      { area: 'Salwa', text: '2BR · Salwa · furnished' },
      { area: 'Mahboula', text: '3BR · Mahboula · furnished' },
      { area: 'Jabriya', text: '2BR · Jabriya · semi' },
    ];

    it('keeps ONLY the asked area, DROPS every other area', () => {
      const out = filterFlatsByQuery(flats, 'flat in Salmiya');
      expect(out.map((f) => f.area)).toEqual(['Salmiya']);
      // explicit exclusion assertions:
      expect(out.some((f) => f.area === 'Salwa')).toBe(false);
      expect(out.some((f) => f.area === 'Mahboula')).toBe(false);
      expect(out.some((f) => f.area === 'Jabriya')).toBe(false);
    });

    it('AR query (بالجابرية) keeps only Jabriya', () => {
      const out = filterFlatsByQuery(flats, 'شقة بالجابرية');
      expect(out.map((f) => f.area)).toEqual(['Jabriya']);
    });

    it('returns EMPTY (honest) when the asked area has no flats — never random off-area', () => {
      const out = filterFlatsByQuery(flats, 'flat in Fintas');
      expect(out).toEqual([]);
    });

    it('keeps a flat in a DIFFERENT area only when it is explicitly tagged near the asked area', () => {
      const withNearby = [
        ...flats,
        { area: 'Rumaithiya', text: '2BR near Salmiya, nearby Salem Mubarak St' },
      ];
      const out = filterFlatsByQuery(withNearby, 'flat in Salmiya');
      const areas = out.map((f) => f.area);
      expect(areas).toContain('Salmiya'); // exact-area first
      expect(areas).toContain('Rumaithiya'); // nearby-tagged kept
      expect(areas).not.toContain('Mahboula'); // unrelated still dropped
    });

    it('no recognizable area → keeps provider order (does NOT nuke a free-form query)', () => {
      const out = filterFlatsByQuery(flats, 'cheap furnished apartment');
      expect(out.map((f) => f.area)).toEqual(['Salmiya', 'Salwa', 'Mahboula', 'Jabriya']);
    });
  });
});

/**
 * OWNER BUG: a RENT flat showed 300,000 KD (a SALE price). Tenure detection + monthly-rent sanity must
 * (1) detect rent vs sale, (2) keep a rent query free of sale listings (and vice versa), (3) never let an
 * absurd rent figure (e.g. 300,000) through.
 */
describe('realestate-relevance — tenure (rent vs sale) + price sanity', () => {
  describe('detectQueryTenure', () => {
    it('sale markers (للبيع / تمليك / for sale)', () => {
      expect(detectQueryTenure('شقة للبيع في السالمية')).toBe('sale');
      expect(detectQueryTenure('apartment for sale Salwa')).toBe('sale');
      expect(detectQueryTenure('شقة تمليك')).toBe('sale');
    });
    it('rent markers (للايجار / للإيجار / for rent / monthly)', () => {
      expect(detectQueryTenure('شقة للايجار السالمية')).toBe('rent');
      expect(detectQueryTenure('flat for rent')).toBe('rent');
      expect(detectQueryTenure('apartment 400 KWD monthly')).toBe('rent');
    });
    it('null when tenure unspecified', () => {
      expect(detectQueryTenure('شقة في السالمية غرفتين')).toBeNull();
    });
  });

  describe('detectOfferTenure', () => {
    it('prefers the explicit tenure attr', () => {
      expect(detectOfferTenure('sale', 'للايجار 400 د.ك')).toBe('sale');
      expect(detectOfferTenure('rent')).toBe('rent');
    });
    it('falls back to caption markers when no attr', () => {
      expect(detectOfferTenure(undefined, 'للبيع شقة تمليك 300,000 د.ك')).toBe('sale');
      expect(detectOfferTenure(undefined, 'للايجار 420 د.ك شهرياً')).toBe('rent');
    });
  });

  describe('isSaneMonthlyRent / inferTenureFromPrice', () => {
    it('accepts a realistic monthly rent, rejects an absurd one', () => {
      expect(isSaneMonthlyRent(420_000)).toBe(true); // 420 KWD/month
      expect(isSaneMonthlyRent(SANE_RENT_MIN_FILS)).toBe(true);
      expect(isSaneMonthlyRent(SANE_RENT_MAX_FILS)).toBe(true);
      expect(isSaneMonthlyRent(30_000)).toBe(false); // 30 KWD — too low
      expect(isSaneMonthlyRent(300_000_000)).toBe(false); // 300,000 KWD — a SALE price
    });
    it('price-on-request (0) is allowed (never an absurd number)', () => {
      expect(isSaneMonthlyRent(0)).toBe(true);
    });
    it('infers SALE from a price at/above the sale floor', () => {
      expect(inferTenureFromPrice(300_000_000)).toBe('sale'); // 300,000 KWD
      expect(inferTenureFromPrice(420_000)).toBeNull(); // 420 KWD — could be rent
    });
  });

  describe('filterFlatsByTenure', () => {
    const flats = [
      { area: 'Salmiya', text: '1BR · Salmiya · For rent', tenure: 'rent', priceFils: 300_000 },
      { area: 'Salmiya', text: '3BR · Salmiya · For sale', tenure: 'sale', priceFils: 300_000_000 },
      { area: 'Salwa', text: '4BR · Salwa · For sale', tenure: 'sale', priceFils: 450_000_000 },
    ];

    it('a RENT query keeps only rent flats — DROPS the sale listings', () => {
      const out = filterFlatsByTenure(flats, 'rent');
      expect(out.map((f) => f.tenure)).toEqual(['rent']);
      expect(out.some((f) => f.priceFils >= 300_000_000)).toBe(false); // no 300k/450k sale price
    });

    it('a SALE query keeps only sale flats — DROPS the rent listing', () => {
      const out = filterFlatsByTenure(flats, 'sale');
      expect(out.every((f) => f.tenure === 'sale')).toBe(true);
      expect(out.length).toBe(2);
    });

    it('a RENT-treated flat with an absurd rent figure is DROPPED (never shows 300,000 KD/month)', () => {
      const bad = [{ area: 'Salmiya', text: 'rent', tenure: 'rent', priceFils: 300_000_000 }];
      expect(filterFlatsByTenure(bad, 'rent')).toEqual([]);
    });

    it('a flat with no tenure + a sale-magnitude price is inferred SALE and excluded from a rent query', () => {
      const unknown = [{ area: 'Salmiya', text: 'شقة 300,000', priceFils: 300_000_000 }];
      expect(filterFlatsByTenure(unknown, 'rent')).toEqual([]);
    });
  });

  describe('filterFlatsByQuery end-to-end (area + tenure + sanity together)', () => {
    const flats = [
      { area: 'Salmiya', text: '1BR · Salmiya · For rent', tenure: 'rent', priceFils: 300_000 },
      { area: 'Salmiya', text: '3BR · Salmiya · For sale', tenure: 'sale', priceFils: 300_000_000 },
    ];
    it('rent query for Salmiya excludes the 300,000 KWD Salmiya SALE flat', () => {
      const out = filterFlatsByQuery(flats, 'شقة للايجار السالمية', { tenure: 'rent' });
      expect(out.map((f) => f.tenure)).toEqual(['rent']);
      expect(out.some((f) => f.priceFils === 300_000_000)).toBe(false);
    });
    it('sale query for Salmiya keeps the SALE flat, drops the rent flat', () => {
      const out = filterFlatsByQuery(flats, 'شقة للبيع السالمية', { tenure: 'sale' });
      expect(out.map((f) => f.tenure)).toEqual(['sale']);
    });
  });
});

/**
 * END-TO-END through the SocialOfferResolver over the REAL seeded mock posts: a Salmiya query must
 * surface ONLY Salmiya flats; a Jabriya query ONLY Jabriya — proving the off-area flats are excluded
 * by the resolver, not just the pure filter. Uses the deterministic MockSocialExtractor (offline).
 */
describe('SocialOfferResolver RE strict-area (over real seeded posts)', () => {
  function resolver() {
    const adapters = [
      new SocialIngestAdapter('realestate', new MockSocialProvider(), new MockSocialExtractor()),
    ];
    return new SocialOfferResolver(adapters, new InMemoryOfferCache());
  }
  const intent = (model: string): IntentNormalized => ({
    category: 'realestate',
    constraints: {},
    model,
  });

  it('"السالمية" returns ONLY Salmiya flats (no Salwa/Mahboula/Jabriya/Mangaf/Hawally)', async () => {
    const out = await resolver().resolve(intent('شقة في السالمية'), 'realestate');
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) {
      expect((o.sku.attributes.area || '').toLowerCase()).toContain('salmiya');
    }
    // explicit exclusion: no flat whose area is a DIFFERENT seeded area
    const otherAreas = ['salwa', 'mahboula', 'hawally', 'jabriya', 'mangaf'];
    for (const o of out) {
      const a = (o.sku.attributes.area || '').toLowerCase();
      for (const bad of otherAreas) expect(a).not.toContain(bad);
    }
  });

  it('"الجابرية" returns ONLY Jabriya flats', async () => {
    const out = await resolver().resolve(intent('شقة بالجابرية غرفتين'), 'realestate');
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) {
      expect((o.sku.attributes.area || '').toLowerCase()).toContain('jabriya');
    }
  });

  it('a free-form RE query (no area) is NOT nuked — still returns flats', async () => {
    const out = await resolver().resolve(intent('شقة مفروشة للايجار'), 'realestate');
    expect(out.length).toBeGreaterThan(0);
  });
});
