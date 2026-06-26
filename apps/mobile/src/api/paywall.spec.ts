import { PaywallRequired, SearchClient } from './searchClient';

/**
 * The mobile search client surfaces the backend 402 PAYWALL as a typed PaywallRequired carrying the
 * {used,limit} body, attaches the Bearer token when authed, and still returns ranked cards on 200.
 * fetch is faked — offline, no API process.
 */
describe('SearchClient paywall + auth', () => {
  it('throws PaywallRequired with the gate body on 402', async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 402,
      json: async () => ({ error: 'PAYWALL', used: 5, limit: 5 }),
    })) as unknown as typeof fetch;
    const client = new SearchClient('http://api', fetchImpl, () => 'tok');
    await expect(
      client.startIntent({ sector: 'electronics', locale: 'ar', intentRaw: 'x' }, 'p'),
    ).rejects.toBeInstanceOf(PaywallRequired);
  });

  it('attaches the Bearer token when a token is present', async () => {
    let seen: any = null;
    const fetchImpl = (async (_url: any, init: any) => {
      seen = init.headers;
      return { ok: true, status: 200, json: async () => ({ searchSessionId: 's', state: 'results', clarifierCount: 0, cards: [] }) };
    }) as unknown as typeof fetch;
    const client = new SearchClient('http://api', fetchImpl, () => 'tok-9');
    await client.startIntent({ sector: 'electronics', locale: 'en', intentRaw: 'x' }, 'p');
    expect(seen.authorization).toBe('Bearer tok-9');
  });

  it('omits the Bearer token for anonymous (no token) searches', async () => {
    let seen: any = null;
    const fetchImpl = (async (_url: any, init: any) => {
      seen = init.headers;
      return { ok: true, status: 200, json: async () => ({ searchSessionId: 's', state: 'empty', clarifierCount: 0 }) };
    }) as unknown as typeof fetch;
    const client = new SearchClient('http://api', fetchImpl, () => null);
    await client.startIntent({ sector: 'electronics', locale: 'en', intentRaw: 'x' }, 'p');
    expect(seen.authorization).toBeUndefined();
  });
});
