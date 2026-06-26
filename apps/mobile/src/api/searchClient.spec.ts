import type { SearchResponse } from '@bestoffers/shared';
import { SearchClient } from './searchClient';

/**
 * Mobile smoke test (offline): the search client speaks the Slice 3 contract correctly.
 * fetch is mocked — no API process, no network, no Expo runtime needed.
 */
describe('SearchClient', () => {
  const cards: SearchResponse = {
    searchSessionId: 's1',
    state: 'results',
    clarifierCount: 0,
    cards: [
      {
        skuId: 'sku1',
        offerId: 'off1',
        productName: 'Apple iPhone 17 Pro Max 256GB Black',
        providerId: 'prov_eureka',
        providerName: 'Eureka',
        priceFils: 419500,
        priceLabel: '419.500 KWD',
        whyAr: 'الأرخص',
        whyEn: 'Cheapest',
        whyCitedAttribute: { key: 'price', value: '419500' },
        deeplinkUrl: 'https://eureka.com.kw/p/x',
        source: 'cache',
      },
    ],
  };

  it('posts the intent contract and parses ranked cards', async () => {
    const calls: { url: string; body: any }[] = [];
    const fakeFetch = (async (url: any, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => cards } as any;
    }) as unknown as typeof fetch;

    const client = new SearchClient('http://api', fakeFetch);
    const res = await client.startIntent(
      { sector: 'electronics', locale: 'ar', intentRaw: 'آيفون 17 برو ماكس' },
      'pseudo-1',
    );

    expect(calls[0].url).toBe('http://api/search/intent');
    expect(calls[0].body.pseudoId).toBe('pseudo-1');
    expect(res.state).toBe('results');
    expect(res.cards![0].priceLabel).toBe('419.500 KWD');
    expect(res.cards![0].whyCitedAttribute.value).not.toBe('');
  });

  it('throws on a non-ok response', async () => {
    const fakeFetch = (async () => ({ ok: false, status: 500 } as any)) as unknown as typeof fetch;
    const client = new SearchClient('http://api', fakeFetch);
    await expect(
      client.startIntent({ sector: 'electronics', locale: 'en', intentRaw: 'x' }, 'p'),
    ).rejects.toThrow(/500/);
  });
});
