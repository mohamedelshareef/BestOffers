import { SocialIngestAdapter, priceLiterallyInCaption } from './social-ingest.adapter';
import { MockSocialProvider, __SEED_POSTS_FOR_TEST } from './mock-social-provider';
import { MockSocialExtractor, parseKwdPrice } from './mock-social-extractor';
import { SocialOfferResolver } from './social-resolver';
import { InMemoryOfferCache } from '../offer-cache';
import { RawPost, SocialProvider, SocialQuery } from './social-provider';
import { SocialExtract, SocialExtractor } from './social-extractor';
import { DEFAULT_HTTP_CTX } from '../provider-adapter.interface';
import { OffersService } from '../../offers.service';

const CTX = { ...DEFAULT_HTTP_CTX, timeoutMs: 8000 };

/** A provider with a single hand-crafted post, so we control the caption under test. */
function oneProvider(post: RawPost): SocialProvider {
  return { name: 'test', async fetchPosts(_q: SocialQuery) { return [post]; } };
}

const RE_WITH_RENT: RawPost = {
  id: 'P1', ownerHandle: 'salwa.homes.kw', vertical: 'realestate',
  permalink: 'https://www.instagram.com/p/REAL_PERMALINK_1/',
  imageUrl: 'https://img/1.jpg', timestamp: '2026-06-24T10:00:00.000Z',
  caption: 'شقة للإيجار في السالوة، غرفتين، مفروشة. الإيجار 420 د.ك شهرياً.',
};
const RE_DM: RawPost = {
  id: 'P2', ownerHandle: 'salwa.homes.kw', vertical: 'realestate',
  permalink: 'https://www.instagram.com/p/REAL_PERMALINK_2/',
  imageUrl: 'https://img/2.jpg', timestamp: '2026-06-20T10:00:00.000Z',
  caption: 'شقة بالسالوة غرفتين غير مفروشة. السعر بالخاص 📩 price on request.',
};

describe('SocialIngestAdapter (ADR-006 — mock-first IG ingestion)', () => {
  it('discover→fetch→extract yields a NormalizedOffer; permalink + posted_at are verbatim from the post', async () => {
    const a = new SocialIngestAdapter('realestate', oneProvider(RE_WITH_RENT), new MockSocialExtractor());
    const refs = await a.discover({ text: 'salwa flat' }, CTX);
    expect(refs).toHaveLength(1);
    const raw = await a.fetch(refs[0], CTX);
    const offers = await a.extract(raw);
    expect(offers).toHaveLength(1);
    const o = offers[0];
    // permalink + posted_at copied straight from the source row (non-hallucinatable).
    expect(o.deeplink).toBe('https://www.instagram.com/p/REAL_PERMALINK_1/');
    expect(o.attrs.permalink).toBe('https://www.instagram.com/p/REAL_PERMALINK_1/');
    expect(o.attrs.postedAt).toBe('2026-06-24T10:00:00.000Z');
    expect(o.fetchedAt).toBe('2026-06-24T10:00:00.000Z');
    // rent literally in caption → priced (420 KWD = 420000 fils).
    expect(o.priceFils).toBe(420000);
    expect(o.attrs.priceOnRequest).toBeUndefined();
    expect(o.attrs.area).toBe('Salwa');
    expect(o.attrs.rooms).toBe('2');
    expect(o.attrs.furnished).toBe('furnished');
  });

  it('TRUTHFULNESS: a "price on request" post is surfaced with NO price (priceFils=0, priceOnRequest flag) — never invented', async () => {
    const a = new SocialIngestAdapter('realestate', oneProvider(RE_DM), new MockSocialExtractor());
    const refs = await a.discover({ text: 'salwa' }, CTX);
    const offers = await a.extract(await a.fetch(refs[0], CTX));
    expect(offers).toHaveLength(1);
    expect(offers[0].priceFils).toBe(0);
    expect(offers[0].attrs.priceOnRequest).toBe('true');
    expect(offers[0].deeplink).toBe('https://www.instagram.com/p/REAL_PERMALINK_2/');
  });

  it('TRUTHFULNESS GUARD: an extractor that hallucinates a price NOT in the caption is dropped to price-on-request', async () => {
    // Extractor claims 999 KWD though the caption only says "السعر بالخاص".
    const lyingExtractor: SocialExtractor = {
      name: 'lying',
      async extract(_p): Promise<SocialExtract> {
        return { vertical: 'realestate', isOffer: true, area: 'Salwa', rooms: 2, rentFils: 999000, furnished: null };
      },
    };
    const a = new SocialIngestAdapter('realestate', oneProvider(RE_DM), lyingExtractor);
    const refs = await a.discover({ text: 'salwa' }, CTX);
    const offers = await a.extract(await a.fetch(refs[0], CTX));
    // 999000 fils never appears next to a KWD marker in the caption → guard zeroes it out.
    expect(offers[0].priceFils).toBe(0);
    expect(offers[0].attrs.priceOnRequest).toBe('true');
  });

  it('food post → priced offer with restaurant handle + permalink CTA', async () => {
    const post: RawPost = {
      id: 'F1', ownerHandle: 'themealboxkw', vertical: 'food',
      permalink: 'https://www.instagram.com/p/FOOD_1/', imageUrl: 'https://img/f.jpg',
      timestamp: '2026-06-22T10:00:00.000Z',
      caption: 'بوكس المشاوي للعائلة. عرض: 12.500 د.ك.',
    };
    const a = new SocialIngestAdapter('food', oneProvider(post), new MockSocialExtractor());
    const refs = await a.discover({ text: 'grill' }, CTX);
    const offers = await a.extract(await a.fetch(refs[0], CTX));
    expect(offers[0].priceFils).toBe(12500);
    expect(offers[0].deeplink).toBe('https://www.instagram.com/p/FOOD_1/');
    expect(offers[0].attrs.handle).toBe('themealboxkw');
  });
});

describe('priceLiterallyInCaption (caption truthfulness guard)', () => {
  it('accepts a price that appears next to a KWD/dinar marker', () => {
    expect(priceLiterallyInCaption(420000, 'الإيجار 420 د.ك')).toBe(true);
    expect(priceLiterallyInCaption(12500, 'عرض 12.500 KWD')).toBe(true);
    expect(priceLiterallyInCaption(230000, '230 دينار')).toBe(true);
  });
  it('rejects a price NOT present in the caption (no fabrication)', () => {
    expect(priceLiterallyInCaption(999000, 'السعر بالخاص، شقة في السالوة')).toBe(false);
    // a bare number with no currency marker is not a price.
    expect(priceLiterallyInCaption(2000, 'غرفتين 2 نوم في السالوة')).toBe(false);
  });
});

describe('parseKwdPrice (mock extractor)', () => {
  it('parses literal KWD prices to fils', () => {
    expect(parseKwdPrice('420 د.ك')).toBe(420000);
    expect(parseKwdPrice('12.500 د.ك')).toBe(12500);
    expect(parseKwdPrice('2.950 KWD')).toBe(2950);
  });
  it('returns null for DM / price-on-request captions', () => {
    expect(parseKwdPrice('السعر بالخاص')).toBeNull();
    expect(parseKwdPrice('price on request — DM us')).toBeNull();
  });
});

describe('MockSocialProvider (seed posts)', () => {
  it('seeds ~14 posts split across both verticals, each with a real permalink + recent timestamp', () => {
    const re = __SEED_POSTS_FOR_TEST.filter((p) => p.vertical === 'realestate');
    const food = __SEED_POSTS_FOR_TEST.filter((p) => p.vertical === 'food');
    expect(re.length).toBeGreaterThanOrEqual(6);
    expect(food.length).toBeGreaterThanOrEqual(6);
    const NOW = new Date('2026-06-26T12:00:00.000Z').getTime();
    for (const p of __SEED_POSTS_FOR_TEST) {
      expect(p.permalink).toMatch(/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_]+\/$/);
      const ageDays = (NOW - new Date(p.timestamp).getTime()) / (24 * 3600 * 1000);
      expect(ageDays).toBeGreaterThanOrEqual(0);
      expect(ageDays).toBeLessThanOrEqual(30);
    }
  });

  it('pre-ranks Salwa flats first for a "salwa" query (AI intent match anchor)', async () => {
    const posts = await new MockSocialProvider().fetchPosts({ vertical: 'realestate', text: 'flat in salwa 2br' });
    expect(posts[0].caption).toMatch(/السالوة|salwa/i);
  });
});

describe('SocialOfferResolver (synthesizes Sku + Offer per IG post)', () => {
  it('resolves real-estate offers from the seeded mock provider with permalink CTAs', async () => {
    const adapter = new SocialIngestAdapter('realestate', new MockSocialProvider(), new MockSocialExtractor());
    const resolver = new SocialOfferResolver([adapter], new InMemoryOfferCache());
    const res = await resolver.resolve({ category: 'realestate', model: 'flat for rent in salwa 2br', constraints: {} }, 'realestate');
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      expect(r.sku.category).toBe('realestate');
      expect(r.offer.deeplinkUrl).toMatch(/instagram\.com\/p\//);
      expect(r.offer.providerName).toMatch(/^@/); // the IG handle is the "provider"
    }
    // at least one Salwa flat with a real rent, and at least one price-on-request flat (priceFils 0).
    expect(res.some((r) => r.sku.attributes.area === 'Salwa' && r.offer.priceFils > 0)).toBe(true);
    expect(res.some((r) => r.offer.priceFils === 0 && r.sku.attributes.priceOnRequest === 'true')).toBe(true);
  });

  it('caches the second resolve (source=cache, no re-extract)', async () => {
    const cache = new InMemoryOfferCache();
    const adapter = new SocialIngestAdapter('food', new MockSocialProvider(), new MockSocialExtractor());
    const resolver = new SocialOfferResolver([adapter], cache);
    const intent = { category: 'food', model: 'meal prep', constraints: {} };
    await resolver.resolve(intent, 'food');
    const second = await resolver.resolve(intent, 'food');
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((r) => r.offer.source === 'cache')).toBe(true);
  });
});

describe('OffersService routing (ADR-006) — realestate via social, food merges social', () => {
  it('realestate category resolves flats from the social mock lane (offline, no key)', async () => {
    const svc = new OffersService(); // default wiring = MockSocialProvider + MockSocialExtractor
    const res = await svc.resolveOffers({ category: 'realestate', model: 'flat for rent in salwa', constraints: {} });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.sku.category === 'realestate')).toBe(true);
    expect(res.every((r) => r.offer.deeplinkUrl.includes('instagram.com/p/'))).toBe(true);
  });

  it('food category returns social IG offers even when LIVE_FETCH is off (mock lane is independent)', async () => {
    const svc = new OffersService();
    const res = await svc.resolveOffers({ category: 'food', model: 'meal prep grill', constraints: {} });
    // Talabat returns [] offline; the social lane still yields IG food offers.
    expect(res.some((r) => r.offer.providerId === 'prov_social_food')).toBe(true);
  });
});
