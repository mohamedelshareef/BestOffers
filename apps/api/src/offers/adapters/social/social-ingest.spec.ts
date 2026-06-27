import { SocialIngestAdapter, priceLiterallyInCaption } from './social-ingest.adapter';
import { MockSocialProvider, __SEED_POSTS_FOR_TEST } from './mock-social-provider';
import { MockSocialExtractor, parseKwdPrice, parseKwdNumber, parseTenure } from './mock-social-extractor';
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

/** A provider returning a fixed set of posts (caption/handle controlled), order-preserved. */
function postsProvider(posts: RawPost[]): SocialProvider {
  return { name: 'test', async fetchPosts(_q: SocialQuery) { return posts; } };
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
        return {
          vertical: 'realestate',
          isOffer: true,
          tenure: 'rent',
          area: 'Salwa',
          rooms: 2,
          priceFils: 999000,
          priceUnit: 'month',
          rentFils: 999000,
          furnished: null,
        };
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
  it('parses a GROUPED-THOUSANDS sale price (300,000 د.ك = three hundred thousand, NOT 300)', () => {
    // the OWNER BUG: "300,000" was truncated to 300.000 → 300 KWD and looked like a sane rent.
    expect(parseKwdPrice('السعر 300,000 د.ك')).toBe(300_000_000);
    expect(parseKwdPrice('300,000 KWD')).toBe(300_000_000);
    expect(parseKwdPrice('1,250,000 دينار')).toBe(1_250_000_000);
  });
});

describe('parseKwdNumber (KWD decimal vs grouped-thousands disambiguation)', () => {
  it('decimal KWD amounts', () => {
    expect(parseKwdNumber('12.500')).toBe(12.5);
    expect(parseKwdNumber('420')).toBe(420);
  });
  it('grouped thousands', () => {
    expect(parseKwdNumber('300,000')).toBe(300000);
    expect(parseKwdNumber('1,250,000')).toBe(1250000);
    expect(parseKwdNumber('1.250.000')).toBe(1250000);
  });
});

describe('parseTenure (mock extractor)', () => {
  it('detects sale (للبيع / تمليك / for sale) — wins over rent markers', () => {
    expect(parseTenure('للبيع شقة تمليك 300,000 د.ك')).toBe('sale');
    expect(parseTenure('For sale, 4BR house — 450,000 KWD')).toBe('sale');
  });
  it('detects rent (للايجار / for rent / شهري)', () => {
    expect(parseTenure('شقة للايجار 420 د.ك شهرياً')).toBe('rent');
    expect(parseTenure('flat for rent, 400 KWD/month')).toBe('rent');
  });
  it('null when unstated', () => {
    expect(parseTenure('شقة غرفتين في السالمية')).toBeNull();
  });
});

describe('RE tenure + price-sanity through the adapter (OWNER 300,000 KD rent bug)', () => {
  const SALE_300K: RawPost = {
    id: 'SALE1', ownerHandle: 'salmiya.rentals', vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/SALE_1/',
    imageUrl: 'https://img/s.jpg', timestamp: '2026-06-24T10:00:00.000Z',
    caption: 'للبيع شقة تمليك في السالمية، ثلاث غرف. السعر 300,000 د.ك.',
  };

  it('a 300,000 د.ك SALE post is extracted as a SALE with the real 300,000 KWD price (not 300)', async () => {
    const a = new SocialIngestAdapter('realestate', oneProvider(SALE_300K), new MockSocialExtractor());
    const refs = await a.discover({ text: 'salmiya' }, CTX);
    const offers = await a.extract(await a.fetch(refs[0], CTX));
    expect(offers[0].attrs.tenure).toBe('sale');
    expect(offers[0].priceFils).toBe(300_000_000); // 300,000 KWD, the REAL sale price
    expect(offers[0].title).toMatch(/For sale/i);
  });

  it('an extractor that labels a 300,000 figure as RENT is sanitized: NO absurd rent number is surfaced', async () => {
    // simulate a parse error: rent tenure + sale-magnitude price → reclassified, price dropped to "DM".
    const lying: SocialExtractor = {
      name: 'lying',
      async extract(): Promise<SocialExtract> {
        return {
          vertical: 'realestate', isOffer: true, tenure: 'rent', area: 'Salmiya', rooms: 3,
          priceFils: 300_000_000, priceUnit: 'month', rentFils: 300_000_000, furnished: null,
        };
      },
    };
    const a = new SocialIngestAdapter('realestate', oneProvider(SALE_300K), lying);
    const refs = await a.discover({ text: 'salmiya' }, CTX);
    const offers = await a.extract(await a.fetch(refs[0], CTX));
    expect(offers[0].priceFils).not.toBe(300_000_000); // never an absurd rent
    expect(offers[0].priceFils).toBe(0); // → price on request
    expect(offers[0].attrs.priceOnRequest).toBe('true');
    expect(offers[0].attrs.tenure).toBe('sale'); // reclassified as a sale
  });

  it('RESOLVER: a rent query for السالمية EXCLUDES the 300,000 د.ك Salmiya SALE listing', async () => {
    const adapter = new SocialIngestAdapter('realestate', new MockSocialProvider(), new MockSocialExtractor());
    const resolver = new SocialOfferResolver([adapter], new InMemoryOfferCache());
    const res = await resolver.resolve(
      { category: 'realestate', model: 'شقة للايجار السالمية', constraints: { tenure: 'rent' } },
      'realestate',
    );
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      // every returned flat is a rent flat with a SANE monthly price (or price-on-request 0)
      expect(r.sku.attributes.tenure === 'sale').toBe(false);
      expect(r.offer.priceFils).not.toBe(300_000_000);
      if (r.offer.priceFils > 0) expect(r.offer.priceFils).toBeLessThanOrEqual(3_000_000);
    }
    // the seeded 300,000 KWD Salmiya SALE post is gone
    expect(res.some((r) => r.offer.priceFils === 300_000_000)).toBe(false);
  });

  it('RESOLVER: a sale query (للبيع) returns the SALE listings, not the rent ones', async () => {
    const adapter = new SocialIngestAdapter('realestate', new MockSocialProvider(), new MockSocialExtractor());
    const resolver = new SocialOfferResolver([adapter], new InMemoryOfferCache());
    const res = await resolver.resolve(
      { category: 'realestate', model: 'شقة للبيع', constraints: { tenure: 'buy' } },
      'realestate',
    );
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) expect(r.sku.attributes.tenure).toBe('sale');
    expect(res.some((r) => r.offer.priceFils >= 300_000_000)).toBe(true); // a real sale price shows
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

  // ── OWNER BUG (2026-06-27): "Bukhari food" (رز بخاري) returned @layers_kw CAKE offers. The IG social
  // offers were NOT relevance-filtered to the dish query. This locks the fix: a rice query drops the cake. ──
  it('OWNER BUG: a rice query ("Bukhari food") EXCLUDES dessert IG offers and keeps the rice one', async () => {
    const bukhari: RawPost = {
      id: 'RICE1', ownerHandle: 'bukhari_kuwait', vertical: 'food',
      permalink: 'https://www.instagram.com/p/BUKHARI/', imageUrl: 'https://img/r.jpg',
      timestamp: '2026-06-22T10:00:00.000Z',
      caption: 'رز بخاري باللحم. عرض 3.500 د.ك.',
    };
    const cake: RawPost = {
      id: 'CAKE1', ownerHandle: 'layers_kw', vertical: 'food',
      permalink: 'https://www.instagram.com/p/CAKE/', imageUrl: 'https://img/c.jpg',
      timestamp: '2026-06-23T10:00:00.000Z',
      caption: 'كيكة شوكولاتة مخصصة. عرض 12.000 د.ك.',
    };
    const adapter = new SocialIngestAdapter('food', postsProvider([cake, bukhari]), new MockSocialExtractor());
    const resolver = new SocialOfferResolver([adapter], new InMemoryOfferCache());

    const res = await resolver.resolve({ category: 'food', model: 'Bukhari food', constraints: {} }, 'food');
    const handles = res.map((r) => r.offer.providerName);
    expect(handles).toContain('@bukhari_kuwait'); // the rice offer is kept
    expect(handles).not.toContain('@layers_kw'); // the bakery/cake offer is DROPPED for a rice query
  });

  it('a cake query keeps the dessert IG offer (filter is symmetric, not rice-only)', async () => {
    const cake: RawPost = {
      id: 'CAKE2', ownerHandle: 'layers_kw', vertical: 'food',
      permalink: 'https://www.instagram.com/p/CAKE2/', imageUrl: 'https://img/c.jpg',
      timestamp: '2026-06-23T10:00:00.000Z',
      caption: 'كيكة شوكولاتة مخصصة. عرض 12.000 د.ك.',
    };
    const bukhari: RawPost = {
      id: 'RICE2', ownerHandle: 'bukhari_kuwait', vertical: 'food',
      permalink: 'https://www.instagram.com/p/BUKHARI2/', imageUrl: 'https://img/r.jpg',
      timestamp: '2026-06-22T10:00:00.000Z',
      caption: 'رز بخاري باللحم. عرض 3.500 د.ك.',
    };
    const adapter = new SocialIngestAdapter('food', postsProvider([bukhari, cake]), new MockSocialExtractor());
    const resolver = new SocialOfferResolver([adapter], new InMemoryOfferCache());

    const res = await resolver.resolve({ category: 'food', model: 'cake', constraints: {} }, 'food');
    const handles = res.map((r) => r.offer.providerName);
    expect(handles).toContain('@layers_kw'); // a cake query keeps the dessert offer
    expect(handles).not.toContain('@bukhari_kuwait'); // and drops the unrelated rice offer
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
