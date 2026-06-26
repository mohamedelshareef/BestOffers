import {
  detectOfferArea,
  detectQueryAreas,
  filterFlatsByQuery,
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
