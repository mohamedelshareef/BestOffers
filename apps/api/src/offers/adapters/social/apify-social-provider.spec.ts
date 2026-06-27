import { ApifySocialProvider, dedupeByPermalink, mapRow, routeFoodHandles } from './apify-social-provider';
import { RawPost } from './social-provider';

/**
 * Apify mapping + cost-guard tests (ADR-006 go-live). The live network call is NOT exercised here
 * (that's proven by a real run in the dev-lead handoff); these lock the row→RawPost mapping, the
 * not_found/error skip, and the env/cache contract so a regression can't silently break the lane.
 */
describe('ApifySocialProvider — Apify dataset row mapping', () => {
  it('maps a real post row to RawPost (url=permalink, timestamp verbatim)', () => {
    const row = {
      id: '3367092574',
      shortCode: 'DZ2S4cCMAQd',
      caption: 'عرض يوم الثلاثاء بالمطعم #offer_food_kw',
      hashtags: ['offer_food_kw'],
      url: 'https://www.instagram.com/p/DZ2S4cCMAQd/',
      timestamp: '2026-06-21T12:44:14.000Z',
      displayUrl: 'https://img/ig.jpg',
      ownerUsername: 'offer_food_kw',
    };
    const post = mapRow(row, 'food');
    expect(post).not.toBeNull();
    expect(post!.permalink).toBe('https://www.instagram.com/p/DZ2S4cCMAQd/'); // verbatim url
    expect(post!.timestamp).toBe('2026-06-21T12:44:14.000Z'); // verbatim, never authored
    expect(post!.ownerHandle).toBe('offer_food_kw');
    expect(post!.caption).toContain('عرض يوم الثلاثاء');
    expect(post!.vertical).toBe('food');
  });

  it('skips a not_found / error row gracefully (returns null)', () => {
    expect(mapRow({ error: 'not_found', url: 'https://www.instagram.com/baddhandle/' }, 'food')).toBeNull();
    expect(mapRow({ error: 'something else' }, 'food')).toBeNull();
  });

  it('skips a row with no permalink and no shortCode', () => {
    expect(mapRow({ caption: 'hi', timestamp: '2026-06-21T00:00:00.000Z' }, 'food')).toBeNull();
  });

  it('derives a permalink from shortCode when url is absent', () => {
    const post = mapRow({ shortCode: 'ABC123', caption: 'meal box 12.500 KWD' }, 'food');
    expect(post!.permalink).toBe('https://www.instagram.com/p/ABC123/');
  });

  it('skips a caption-less row (nothing for Claude to extract)', () => {
    expect(mapRow({ url: 'https://www.instagram.com/p/X/', caption: '' }, 'food')).toBeNull();
  });
});

describe('ApifySocialProvider — cost guards / config', () => {
  const ORIG = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG };
  });

  it('throws a clear error when APIFY_TOKEN is missing (fail loud, not silent empty)', async () => {
    delete process.env.APIFY_TOKEN;
    const p = new ApifySocialProvider();
    await expect(p.fetchPosts({ vertical: 'food', text: 'offer' })).rejects.toThrow(/APIFY_TOKEN missing/);
  });

  it('realestate is now seeded with [V] direct flat-lister handles (not empty)', async () => {
    process.env.APIFY_TOKEN = 'token';
    const calls: Array<{ url: string; body: any }> = [];
    const fetchMock = jest.fn(async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return jsonResponse([]); // no posts back, we only assert the request shape
    });
    (global as any).fetch = fetchMock;

    const p = new ApifySocialProvider();
    await p.fetchPosts({ vertical: 'realestate', text: 'salwa' });

    expect(calls).toHaveLength(1); // ONE handle run (hashtag discovery off by default)
    const directUrls: string[] = calls[0].body.directUrls;
    // Seeded [V] RE direct listers; portals must NOT be present.
    expect(directUrls).toContain('https://www.instagram.com/majestic_kuwait/');
    expect(directUrls).toContain('https://www.instagram.com/amadell_for_rent/');
    expect(directUrls).toContain('https://www.instagram.com/q8_rent/');
    expect(directUrls).toContain('https://www.instagram.com/reokuwait/');
    expect(directUrls.join(',')).not.toMatch(/q84sale|boshamlan|bayut|opensooq/);
  });
});

describe('ApifySocialProvider — handle seeding (DIRECT sellers, no aggregators)', () => {
  const ORIG = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG };
    jest.restoreAllMocks();
  });

  it('food run targets the [V] DIRECT-seller handles and EXCLUDES aggregator pages', async () => {
    process.env.APIFY_TOKEN = 'token';
    let body: any;
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      body = JSON.parse(init.body);
      return jsonResponse([]);
    });

    const p = new ApifySocialProvider();
    await p.fetchPosts({ vertical: 'food', text: 'meal prep' });

    const directUrls: string[] = body.directUrls;
    // Meal-prep, baker, grill, cloud direct sellers present.
    expect(directUrls).toContain('https://www.instagram.com/basickuwait/');
    expect(directUrls).toContain('https://www.instagram.com/themealboxkw/');
    expect(directUrls).toContain('https://www.instagram.com/layers_kw/');
    expect(directUrls).toContain('https://www.instagram.com/mashawi.kw/');
    expect(directUrls).toContain('https://www.instagram.com/mug.cr/');
    // Aggregator / offers-repost pages must NOT be tracked as sellers (DIRECT-seller rule).
    const joined = directUrls.join(',');
    expect(joined).not.toMatch(/offer_food_kw|kuwait_eateries|offers_in_kuwait|kuwaitoffer|kuw_offers/);
    // Cost guard: per-handle resultsLimit + 30-day window present on the run.
    expect(body.onlyPostsNewerThan).toBe('30 days');
    expect(typeof body.resultsLimit).toBe('number');
  });
});

describe('ApifySocialProvider — hashtag discovery (opt-in long-tail)', () => {
  const ORIG = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG };
    jest.restoreAllMocks();
  });

  function captioned(shortCode: string, caption: string, handle: string): any {
    return {
      shortCode,
      url: `https://www.instagram.com/p/${shortCode}/`,
      caption,
      ownerUsername: handle,
      timestamp: '2026-06-20T10:00:00.000Z',
    };
  }

  it('is OFF by default — only the handle run fires, no hashtag search', async () => {
    process.env.APIFY_TOKEN = 'token';
    delete process.env.SOCIAL_HASHTAG_DISCOVERY;
    const bodies: any[] = [];
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      bodies.push(JSON.parse(init.body));
      return jsonResponse([]);
    });

    const p = new ApifySocialProvider();
    await p.fetchPosts({ vertical: 'food', text: 'box' });

    expect(bodies).toHaveLength(1); // handle run only
    expect(bodies[0].directUrls).toBeDefined();
    expect(bodies.some((b) => b.hashtags)).toBe(false);
  });

  it('SOCIAL_HASHTAG_DISCOVERY=on adds ONE curated hashtag run (dedicated actor) and maps its posts', async () => {
    process.env.APIFY_TOKEN = 'token';
    process.env.SOCIAL_HASHTAG_DISCOVERY = 'on';
    const calls: Array<{ url: string; body: any }> = [];
    (global as any).fetch = jest.fn(async (url: string, init: any) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      if (body.directUrls) return jsonResponse([captioned('H1', 'وجبة دايت ١٢ دينار', 'basickuwait')]);
      // the hashtag-scraper actor returns long-tail home-kitchen posts for the curated tags
      return jsonResponse([captioned('T1', 'مجبوس دجاج بيتي ٣ دنانير #مطبخ_منزلي_الكويت', 'um_q8_kitchen')]);
    });

    const p = new ApifySocialProvider();
    const posts = await p.fetchPosts({ vertical: 'food', text: 'box' });

    // handle run + ONE hashtag-scraper run (all curated tags in a single call) = 2 Apify calls.
    expect(calls).toHaveLength(2);
    const tagCall = calls.find((c) => c.body.hashtags);
    expect(tagCall).toBeDefined();
    expect(tagCall!.url).toContain('instagram-hashtag-scraper'); // dedicated actor, not the post scraper
    expect(tagCall!.body.hashtags).toEqual(['foodkuwait', 'مطبخ_منزلي_الكويت']);
    expect(tagCall!.body.onlyPostsNewerThan).toBe('30 days');
    // The long-tail post (only reachable via hashtag) is mapped and flows on.
    const handles = posts.map((p) => p.ownerHandle);
    expect(handles).toContain('um_q8_kitchen'); // home-kitchen seller NOT in the hand list
    expect(handles).toContain('basickuwait');
  });

  it('dedupes a hashtag post that repeats a handle post (by permalink)', async () => {
    process.env.APIFY_TOKEN = 'token';
    process.env.SOCIAL_HASHTAG_DISCOVERY = 'on';
    const dup = captioned('DUP', 'عرض بوكس دايت ١٠ دنانير #مطبخ_منزلي_الكويت', 'basickuwait');
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      // The SAME post comes back from both the handle run and every hashtag search.
      return jsonResponse([dup]);
    });

    const p = new ApifySocialProvider();
    const posts = await p.fetchPosts({ vertical: 'food', text: 'box' });
    expect(posts.filter((x) => x.permalink === 'https://www.instagram.com/p/DUP/')).toHaveLength(1);
  });

  it('respects the monthly cap across BOTH modes (cap=1 → only the first run executes)', async () => {
    process.env.APIFY_TOKEN = 'token';
    process.env.SOCIAL_HASHTAG_DISCOVERY = 'on';
    process.env.SOCIAL_MONTHLY_RESULT_CAP = '1';
    process.env.SOCIAL_TTL_MS = '1'; // expire instantly so cache never serves
    let runCount = 0;
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      runCount += 1;
      const body = JSON.parse(init.body);
      return jsonResponse([captioned('R' + runCount, 'cap test', body.directUrls ? 'h' : 'tag')]);
    });

    const p = new ApifySocialProvider();
    await p.fetchPosts({ vertical: 'food', text: 'box' });
    // Handle run consumed the single allowed call; hashtag runs are blocked by the cap.
    expect(runCount).toBe(1);
  });
});

describe('routeFoodHandles — category routing (OWNER bug: "Bukhari food" → cakes)', () => {
  const RICE = ['bukhari_kuwait', 'alamir_bukhari', 'maidaalmandi', 'malekalmajbous'];
  const DESSERT = ['layers_kw', 'thecakeshop_kuwait', 'js_bakery'];

  it('a RICE query (bukhari) LEADS with rice/home-meal sellers, NOT bakeries', () => {
    const ordered = routeFoodHandles('Bukhari food');
    // every rice seller appears before every dessert/bakery seller
    const firstDessert = Math.min(...DESSERT.map((h) => ordered.indexOf(h)));
    for (const r of RICE) {
      expect(ordered.indexOf(r)).toBeGreaterThanOrEqual(0);
      expect(ordered.indexOf(r)).toBeLessThan(firstDessert);
    }
    // @layers_kw (the bakery that wrongly surfaced) must NOT lead a rice query
    expect(ordered.indexOf('layers_kw')).toBeGreaterThan(ordered.indexOf('bukhari_kuwait'));
  });

  it('AR machboos (مجبوس) and biryani route to the rice block first', () => {
    for (const q of ['مجبوس', 'machboos', 'biryani', 'برياني', 'مندي', 'منسف']) {
      const ordered = routeFoodHandles(q);
      expect(ordered[0]).toBe('bukhari_kuwait'); // rice block leads
    }
  });

  it('a CAKE query leads with dessert sellers (and still includes every seed)', () => {
    const ordered = routeFoodHandles('cake');
    expect(ordered[0]).toBe('layers_kw'); // dessert leads for a dessert query
    // full union still reachable (no seller dropped — only re-ordered)
    expect(ordered).toContain('bukhari_kuwait');
    expect(ordered).toContain('basickuwait');
  });

  it('a grill query leads with grill sellers', () => {
    const ordered = routeFoodHandles('mashawi');
    expect(ordered[0]).toBe('mashawi_alzayn');
  });

  it('always returns the full deduped seed union regardless of query', () => {
    const a = routeFoodHandles('bukhari');
    const b = routeFoodHandles('cake');
    expect(a.length).toBe(b.length); // same set, different order
    expect(new Set(a).size).toBe(a.length); // deduped
  });
});

describe('dedupeByPermalink', () => {
  it('keeps first occurrence, drops permalink repeats', () => {
    const mk = (code: string): RawPost => ({
      id: code,
      ownerHandle: 'x',
      caption: 'c',
      imageUrl: '',
      permalink: `https://www.instagram.com/p/${code}/`,
      timestamp: '2026-06-20T00:00:00.000Z',
      vertical: 'food',
    });
    const out = dedupeByPermalink([mk('A'), mk('B'), mk('A'), mk('C'), mk('B')]);
    expect(out.map((p) => p.id)).toEqual(['A', 'B', 'C']);
  });
});

function jsonResponse(rows: unknown): any {
  return {
    ok: true,
    status: 200,
    json: async () => rows,
    text: async () => JSON.stringify(rows),
  };
}
