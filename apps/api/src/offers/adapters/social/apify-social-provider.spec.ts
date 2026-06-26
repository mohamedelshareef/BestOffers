import { ApifySocialProvider, mapRow } from './apify-social-provider';

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

  it('returns [] for a vertical with no curated handles (realestate not seeded for the live lane yet)', async () => {
    process.env.APIFY_TOKEN = 'token';
    const p = new ApifySocialProvider();
    await expect(p.fetchPosts({ vertical: 'realestate', text: 'salwa' })).resolves.toEqual([]);
  });
});
