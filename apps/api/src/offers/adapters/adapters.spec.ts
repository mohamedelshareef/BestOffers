import { XciteAdapter } from './xcite.adapter';
import { BlinkAdapter } from './blink.adapter';
import { EurekaAdapter } from './eureka.adapter';
import { TalabatAdapter } from './talabat.adapter';
import { priceTokenInSource } from './source-validation';
import { RawPage } from './provider-adapter.interface';

/**
 * Offline adapter tests (S2.6-4): extraction + truthfulness validated against captured-shape
 * fixtures. NO network — the live sites are exercised only by scripts/live-offers-spike.ts.
 */

// Minimal real-shape X-cite __NEXT_DATA__ (the product node carries price/sku/status/name).
const XCITE_HTML = `<!doctype html><html><head><title>x</title></head><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      content: {
        product: {
          name: 'Apple iPhone 16 6.1-inch 128GB Black.',
          sku: '659220',
          status: 'InStock',
          price: { currency: 'KWD', value: 219.9, formattedPrice: '219.900 KD' },
        },
      },
    },
  },
})}</script></body></html>`;

const XCITE_SOFT_404 = `<!doctype html><html><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { content: { _meta: { name: 'Fallback PDP' } } } },
})}</script></body></html>`;

const BLINK_JSON = {
  product: {
    title: 'Apple iPhone 16 Pro Max',
    handle: 'apple-iphone-16-pro-max',
    vendor: 'Apple',
    images: [{ src: 'https://cdn.shopify.com/x.jpg' }],
    variants: [
      { id: 1, sku: 'IP16PM-256', price: '364.900', available: true, option1: '256GB' },
    ],
  },
};

describe('XciteAdapter.extract (S2.6-1)', () => {
  const a = new XciteAdapter();

  it('parses price (KWD→fils), sku, stock, title from __NEXT_DATA__', async () => {
    const raw: RawPage = { url: 'https://www.xcite.com/x/p', html: XCITE_HTML, fetchedAt: 'T' };
    const [o] = await a.extract(raw);
    expect(o.priceFils).toBe(219900);
    expect(o.providerSkuRef).toBe('659220');
    expect(o.inStock).toBe(true);
    expect(o.title).toBe('Apple iPhone 16 6.1-inch 128GB Black');
    expect(o.source).toBe('http');
    expect(o.imageUrl).toContain('659220');
  });

  it('returns 0 offers for a soft-404 shell (no product node) — stays healthy', async () => {
    const raw: RawPage = { url: 'u', html: XCITE_SOFT_404, fetchedAt: 'T' };
    expect(await a.extract(raw)).toHaveLength(0);
  });

  it('TRUTHFULNESS: drops the offer when the parsed price is absent from the source bytes', async () => {
    // Product node carries value 777.7777 → priceFils rounds to 777778 → KWD tokens "777.778"/
    // "777.7777" do NOT appear verbatim in the bytes (which hold "777.7777"). The guard must reject,
    // proving the adapter is truthful by construction — a price the page doesn't state is never shown.
    const node = { name: 'X 128GB', sku: '1', status: 'InStock', price: { currency: 'KWD', value: 777.7777 } };
    const json = JSON.stringify({ props: { pageProps: { content: { product: node } } } });
    expect(json.includes('777.778')).toBe(false); // the rounded token is absent from the bytes
    const raw: RawPage = {
      url: 'u',
      html: `<script id="__NEXT_DATA__" type="application/json">${json}</script>`,
      fetchedAt: 'T',
    };
    expect(await a.extract(raw)).toHaveLength(0);
  });

  it('discover maps query "iphone 16" to known X-cite product URLs', async () => {
    const refs = await a.discover({ text: 'iphone 16' });
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].url).toMatch(/\/apple-iphone-16-.+\/p$/);
  });
});

describe('BlinkAdapter.extract (S2.6-2)', () => {
  const a = new BlinkAdapter();

  it('parses price/sku/availability/image from Shopify product JSON', async () => {
    const raw: RawPage = { url: 'u', json: BLINK_JSON, fetchedAt: 'T' };
    const [o] = await a.extract(raw);
    expect(o.priceFils).toBe(364900);
    expect(o.providerSkuRef).toBe('IP16PM-256');
    expect(o.inStock).toBe(true);
    expect(o.deeplink).toContain('/products/apple-iphone-16-pro-max');
    expect(o.imageUrl).toContain('cdn.shopify.com');
  });

  it('TRUTHFULNESS: drops a price not present verbatim in the JSON', async () => {
    // variant.price parses to 364.9777 → priceFils 364978 → token "364.978" absent from the bytes.
    const bad = JSON.parse(JSON.stringify(BLINK_JSON));
    bad.product.variants[0].price = '364.9777';
    const raw: RawPage = { url: 'u', json: bad, fetchedAt: 'T' };
    expect(JSON.stringify(bad).includes('364.978')).toBe(false);
    expect(await a.extract(raw)).toHaveLength(0);
  });
});

// Real-shape Eureka Algolia hit (captured live 2026-06-26, network mocked offline). The XHR JSON IS
// the fetched source: extract()/the truthfulness guard run against these exact bytes.
const EUREKA_HIT = {
  id: 252147,
  objectID: '252147',
  bn: 'apple',
  cn: 'Computers & Tablets > Laptops > Note Books',
  itmn: 'Apple MacBook Air M4 2025 15.3 inch 512GB SSD MC6L4AB/A',
  ipic: 'apple-air-15-m4-24-512-mn-d6nh8.webp?v=332',
  lprc: 524.9,
  clprcv: 499.9,
  clprc: 499.9,
  avaqt: 1,
};

describe('EurekaAdapter.extract (ADR-003 Slice B, Tier-2 XHR sniff)', () => {
  const a = new EurekaAdapter();

  it('parses current price (KWD→fils), id, stock, title, brand from the Algolia hit', async () => {
    const raw: RawPage = {
      url: 'https://www.eureka.com.kw/products/details/252147?name=Apple_MacBook_Air',
      json: EUREKA_HIT,
      fetchedAt: 'T',
    };
    const [o] = await a.extract(raw);
    expect(o.priceFils).toBe(499900);
    expect(o.providerSkuRef).toBe('252147');
    expect(o.inStock).toBe(true); // avaqt 1 > 0
    expect(o.title).toBe('Apple MacBook Air M4 2025 15.3 inch 512GB SSD MC6L4AB/A');
    expect(o.attrs.storage).toBe('512GB');
    expect(o.attrs.brand).toBe('apple');
    expect(o.source).toBe('render');
    expect(o.deeplink).toContain('/products/details/252147');
  });

  it('marks out-of-stock when avaqt is 0', async () => {
    const raw: RawPage = { url: 'u', json: { ...EUREKA_HIT, avaqt: 0 }, fetchedAt: 'T' };
    const [o] = await a.extract(raw);
    expect(o.inStock).toBe(false);
  });

  it('TRUTHFULNESS: drops the offer when the parsed price is absent from the source bytes', async () => {
    // clprc 499.9777 → priceFils 499978 → token "499.978" is NOT present verbatim in the JSON bytes.
    const bad = { ...EUREKA_HIT, clprc: 499.9777 };
    const raw: RawPage = { url: 'u', json: bad, fetchedAt: 'T' };
    expect(JSON.stringify(bad).includes('499.978')).toBe(false);
    expect(await a.extract(raw)).toHaveLength(0);
  });

  it('returns 0 offers for a hit with no current price (healthy, empty)', async () => {
    const raw: RawPage = { url: 'u', json: { ...EUREKA_HIT, clprc: undefined }, fetchedAt: 'T' };
    expect(await a.extract(raw)).toHaveLength(0);
  });
});

// Real-shape Talabat menu JSON (captured live from KFC vendorId 5804 + Chicken Tikka, 2026-06-26;
// network mocked offline). The menu API JSON IS the fetched source — extract()/the truthfulness guard
// run against these exact bytes. fetch() carries the restaurant slug onto raw.url as `#slug=…`.
const TALABAT_MENU = {
  result: {
    menu: {
      menuSection: [
        {
          nm: 'Offers',
          itm: [
            // real promo: opr (3) > pr (2) → is_promo, -33%
            { id: 3251398033, nm: 'Supreme Cruncher Meal', pr: 2, opr: 3, imgurl: 'https://images.deliveryhero.io/image/talabat/MenuItems/X.jpg', isf: false },
            // no promo: opr -1 (sentinel)
            { id: 99, nm: 'World Cup Classic Half Chicken', pr: 2.85, opr: -1, isf: false },
          ],
        },
      ],
    },
  },
};

describe('TalabatAdapter.extract (ADR-005 Slice F-1, Tier-1 food JSON)', () => {
  const a = new TalabatAdapter();
  const raw = (): RawPage => ({
    url: 'https://www.talabat.com/nextMenuApi/v2/branches/5804/menu#slug=kfc',
    json: JSON.parse(JSON.stringify(TALABAT_MENU)),
    fetchedAt: 'T',
  });

  it('parses dish name (KWD→fils), id, section, restaurant, image from the menu JSON', async () => {
    const offers = await a.extract(raw());
    expect(offers).toHaveLength(2);
    const m = offers.find((o) => o.providerSkuRef === '3251398033')!;
    expect(m.priceFils).toBe(2000); // 2 KWD → 2000 fils
    expect(m.title).toBe('Supreme Cruncher Meal — Kfc');
    expect(m.attrs.category).toBe('Offers');
    expect(m.attrs.restaurant).toBe('Kfc');
    expect(m.inStock).toBe(true); // isf:false ⇒ available
    expect(m.imageUrl).toContain('images.deliveryhero.io');
    expect(m.deeplink).toBe('https://www.talabat.com/kuwait/kfc');
    expect(m.source).toBe('http');
  });

  it('flags a real promo when opr > pr (old-price + discount %); no promo when opr is the -1 sentinel', async () => {
    const offers = await a.extract(raw());
    const promo = offers.find((o) => o.providerSkuRef === '3251398033')!;
    expect(promo.attrs.isPromo).toBe('true');
    expect(promo.attrs.oldPriceFils).toBe('3000'); // 3 KWD
    expect(promo.attrs.discountPct).toBe('33'); // (3-2)/3 = 33%
    const plain = offers.find((o) => o.providerSkuRef === '99')!;
    expect(plain.priceFils).toBe(2850);
    expect(plain.attrs.isPromo).toBeUndefined(); // opr -1 → NOT a promo
  });

  it('TRUTHFULNESS: drops a dish with a missing/invalid price (never invents one)', async () => {
    // No `pr` at all → no offer (the price can only come from the fetched JSON).
    const noPrice: RawPage = {
      url: 'https://www.talabat.com/nextMenuApi/v2/branches/5804/menu#slug=kfc',
      json: { result: { menu: { menuSection: [{ nm: 'S', itm: [{ id: 1, nm: 'X', opr: -1 }] }] } } },
      fetchedAt: 'T',
    };
    expect(await a.extract(noPrice)).toHaveLength(0);
    // Non-positive price → dropped.
    const zero: RawPage = {
      url: 'https://www.talabat.com/nextMenuApi/v2/branches/5804/menu#slug=kfc',
      json: { result: { menu: { menuSection: [{ nm: 'S', itm: [{ id: 1, nm: 'X', pr: 0, opr: -1 }] }] } } },
      fetchedAt: 'T',
    };
    expect(await a.extract(zero)).toHaveLength(0);
  });

  it('returns 0 offers for an empty/malformed menu (healthy, empty)', async () => {
    expect(await a.extract({ url: 'u', json: {}, fetchedAt: 'T' })).toHaveLength(0);
    expect(await a.extract({ url: 'u', json: { result: { menu: {} } }, fetchedAt: 'T' })).toHaveLength(0);
  });
});

describe('priceTokenInSource (truthfulness invariant)', () => {
  it('accepts 3-dp, trimmed-decimal, and comma forms; rejects absent', () => {
    const raw: RawPage = { url: 'u', html: 'price is 219.900 KD here', fetchedAt: 'T' };
    expect(priceTokenInSource(219900, raw)).toBe(true);
    expect(priceTokenInSource(219900, { url: 'u', json: { v: '219.9' }, fetchedAt: 'T' })).toBe(true);
    expect(priceTokenInSource(500000, raw)).toBe(false);
  });
});
