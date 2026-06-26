import { Offer, Sku } from '@bestoffers/shared';

/**
 * MOCK Kuwait-Electronics catalog (S2.5-1) — stands in for the provider-data layer (Slice 2)
 * until the affiliate/scrape pipeline lands. NO scraping (legal gate). Prices are integer fils
 * (1 KWD = 1000 fils, e.g. 425000 = 425.000 KWD). Deterministic fixture so ranking is reproducible
 * and QA can assert against known data.
 *
 * Coverage: smartphones (iPhone 17 / Samsung S25) + laptops (MacBook / Dell) across the real Kuwait
 * retailers as MOCK providers — X-cite, Best Al-Yousifi, Eureka, Blink. Multiple providers price the
 * SAME sku → the cross-provider comparison primitive. Prices are realistic Kuwait street ranges but
 * INVENTED (not scraped). Image URLs are placeholders (UI renders a graceful placeholder if missing).
 */

// ---------- Providers (real KW retailers, used here as MOCK feeds) ----------
export interface MockProvider {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
}

export const MOCK_PROVIDERS: MockProvider[] = [
  { id: 'prov_xcite', name: 'X-cite', slug: 'xcite', baseUrl: 'https://www.xcite.com' },
  { id: 'prov_alyousifi', name: 'Best Al-Yousifi', slug: 'alyousifi', baseUrl: 'https://www.best.com.kw' },
  { id: 'prov_eureka', name: 'Eureka', slug: 'eureka', baseUrl: 'https://www.eureka.com.kw' },
  { id: 'prov_blink', name: 'Blink', slug: 'blink', baseUrl: 'https://www.blink.com.kw' },
];

// ---------- Canonical SKUs ----------
export const MOCK_SKUS: Sku[] = [
  // ===== LIVE-BACKED SKUs (S2.6) — these map to REAL X-cite/Blink products fetched live. =====
  // iPhone 16 family is in X-cite's live catalog (verified) and discoverable on Blink.
  {
    id: 'sku_ip16_128_black',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 16 6.1-inch 128GB Black',
    brand: 'Apple',
    model: 'iPhone 16',
    attributes: { storage: '128GB', color: 'black', screen: '6.1"', chip: 'A18' },
    imageUrl: 'https://cdn.media.amplience.net/i/xcite/659220-01',
  },
  {
    id: 'sku_ip16_128_white',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 16 6.1-inch 128GB White',
    brand: 'Apple',
    model: 'iPhone 16',
    attributes: { storage: '128GB', color: 'white', screen: '6.1"', chip: 'A18' },
    imageUrl: 'https://cdn.media.amplience.net/i/xcite/659224-01',
  },
  {
    id: 'sku_ip16_128_ultramarine',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 16 6.1-inch 128GB Ultramarine',
    brand: 'Apple',
    model: 'iPhone 16',
    attributes: { storage: '128GB', color: 'ultramarine', screen: '6.1"', chip: 'A18' },
    imageUrl: 'https://cdn.media.amplience.net/i/xcite/659221-01',
  },
  {
    id: 'sku_ip16_512_black',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 16 6.1-inch 512GB Black',
    brand: 'Apple',
    model: 'iPhone 16',
    attributes: { storage: '512GB', color: 'black', screen: '6.1"', chip: 'A18' },
    imageUrl: 'https://cdn.media.amplience.net/i/xcite/659230-01',
  },
  {
    // Blink-backed (live) — Blink stocks the Pro Max (verified 364.900 KWD live).
    id: 'sku_ip16pm_256',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 16 Pro Max 256GB',
    brand: 'Apple',
    model: 'iPhone 16 Pro Max',
    attributes: { storage: '256GB', color: 'black', screen: '6.9"', chip: 'A18 Pro' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/ip16pm-black.png',
  },
  // iPhone 17 Pro Max
  {
    id: 'sku_ip17pm_256_black',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 17 Pro Max 256GB Black Titanium',
    brand: 'Apple',
    model: 'iPhone 17 Pro Max',
    attributes: { storage: '256GB', color: 'black', screen: '6.9"', chip: 'A19 Pro' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/ip17pm-black.png',
  },
  {
    id: 'sku_ip17pm_256_blue',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 17 Pro Max 256GB Blue Titanium',
    brand: 'Apple',
    model: 'iPhone 17 Pro Max',
    attributes: { storage: '256GB', color: 'blue', screen: '6.9"', chip: 'A19 Pro' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/ip17pm-blue.png',
  },
  {
    id: 'sku_ip17pm_512_black',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 17 Pro Max 512GB Black Titanium',
    brand: 'Apple',
    model: 'iPhone 17 Pro Max',
    attributes: { storage: '512GB', color: 'black', screen: '6.9"', chip: 'A19 Pro' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/ip17pm-512-black.png',
  },
  // iPhone 17 Pro
  {
    id: 'sku_ip17p_256_white',
    category: 'smartphone',
    canonicalName: 'Apple iPhone 17 Pro 256GB White Titanium',
    brand: 'Apple',
    model: 'iPhone 17 Pro',
    attributes: { storage: '256GB', color: 'white', screen: '6.3"', chip: 'A19 Pro' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/ip17p-white.png',
  },
  // Samsung Galaxy S25 Ultra
  {
    id: 'sku_s25u_256_black',
    category: 'smartphone',
    canonicalName: 'Samsung Galaxy S25 Ultra 256GB Titanium Black',
    brand: 'Samsung',
    model: 'Galaxy S25 Ultra',
    attributes: { storage: '256GB', color: 'black', screen: '6.9"', chip: 'Snapdragon 8 Elite' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/s25u-black.png',
  },
  {
    id: 'sku_s25u_512_gray',
    category: 'smartphone',
    canonicalName: 'Samsung Galaxy S25 Ultra 512GB Titanium Gray',
    brand: 'Samsung',
    model: 'Galaxy S25 Ultra',
    attributes: { storage: '512GB', color: 'gray', screen: '6.9"', chip: 'Snapdragon 8 Elite' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/s25u-gray.png',
  },
  // Samsung Galaxy S25
  {
    id: 'sku_s25_128_blue',
    category: 'smartphone',
    canonicalName: 'Samsung Galaxy S25 128GB Navy Blue',
    brand: 'Samsung',
    model: 'Galaxy S25',
    attributes: { storage: '128GB', color: 'blue', screen: '6.2"', chip: 'Snapdragon 8 Elite' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/s25-blue.png',
  },
  // MacBook Air M4
  {
    id: 'sku_mba_m4_256_midnight',
    category: 'laptop',
    canonicalName: 'Apple MacBook Air 13" M4 256GB Midnight',
    brand: 'Apple',
    model: 'MacBook Air M4',
    attributes: { storage: '256GB', color: 'midnight', screen: '13.6"', chip: 'M4', ram: '16GB' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/mba-m4-midnight.png',
  },
  {
    id: 'sku_mba_m4_512_silver',
    category: 'laptop',
    canonicalName: 'Apple MacBook Air 13" M4 512GB Silver',
    brand: 'Apple',
    model: 'MacBook Air M4',
    attributes: { storage: '512GB', color: 'silver', screen: '13.6"', chip: 'M4', ram: '16GB' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/mba-m4-silver.png',
  },
  // Dell XPS 13
  {
    id: 'sku_dell_xps13_512_silver',
    category: 'laptop',
    canonicalName: 'Dell XPS 13 9350 Core Ultra 7 512GB Silver',
    brand: 'Dell',
    model: 'XPS 13',
    attributes: { storage: '512GB', color: 'silver', screen: '13.4"', chip: 'Core Ultra 7', ram: '16GB' },
    imageUrl: 'https://cdn.bestoffers.kw/skus/dell-xps13-silver.png',
  },
];

/** Build a provider deeplink for a SKU (mock). */
function deeplink(slug: string, skuId: string): string {
  const p = MOCK_PROVIDERS.find((x) => x.slug === slug)!;
  return `${p.baseUrl}/p/${skuId.replace(/^sku_/, '')}`;
}

/**
 * Offers per SKU across mock providers. Multiple providers price the same SKU — the
 * cross-provider comparison primitive. ~24 offers; prices in fils. `cache`/`live` mix exercises
 * the freshness label. Some out-of-stock to exercise in-stock ranking + graceful UI.
 */
type OfferSeed = {
  skuId: string;
  provider: string; // slug
  priceFils: number;
  inStock?: boolean | null;
  source?: 'live' | 'cache';
};

const OFFER_SEEDS: OfferSeed[] = [
  // iPhone 17 Pro Max 256GB Black — 4 providers
  { skuId: 'sku_ip17pm_256_black', provider: 'xcite', priceFils: 425000, source: 'live' },
  { skuId: 'sku_ip17pm_256_black', provider: 'eureka', priceFils: 419500 },
  { skuId: 'sku_ip17pm_256_black', provider: 'alyousifi', priceFils: 429000, source: 'live' },
  { skuId: 'sku_ip17pm_256_black', provider: 'blink', priceFils: 432000, inStock: false },
  // iPhone 17 Pro Max 256GB Blue — 2
  { skuId: 'sku_ip17pm_256_blue', provider: 'xcite', priceFils: 427000, source: 'live' },
  { skuId: 'sku_ip17pm_256_blue', provider: 'eureka', priceFils: 424000 },
  // iPhone 17 Pro Max 512GB Black — 3
  { skuId: 'sku_ip17pm_512_black', provider: 'xcite', priceFils: 489000, source: 'live' },
  { skuId: 'sku_ip17pm_512_black', provider: 'alyousifi', priceFils: 485000 },
  { skuId: 'sku_ip17pm_512_black', provider: 'blink', priceFils: 492000 },
  // iPhone 17 Pro 256GB White — 2
  { skuId: 'sku_ip17p_256_white', provider: 'xcite', priceFils: 379000, source: 'live' },
  { skuId: 'sku_ip17p_256_white', provider: 'eureka', priceFils: 375500 },
  // Galaxy S25 Ultra 256GB Black — 3
  { skuId: 'sku_s25u_256_black', provider: 'xcite', priceFils: 369000, source: 'live' },
  { skuId: 'sku_s25u_256_black', provider: 'alyousifi', priceFils: 365000 },
  { skuId: 'sku_s25u_256_black', provider: 'eureka', priceFils: 372000, inStock: false },
  // Galaxy S25 Ultra 512GB Gray — 2
  { skuId: 'sku_s25u_512_gray', provider: 'xcite', priceFils: 419000, source: 'live' },
  { skuId: 'sku_s25u_512_gray', provider: 'blink', priceFils: 415000 },
  // Galaxy S25 128GB Blue — 2
  { skuId: 'sku_s25_128_blue', provider: 'xcite', priceFils: 239000, source: 'live' },
  { skuId: 'sku_s25_128_blue', provider: 'eureka', priceFils: 235000 },
  // MacBook Air M4 256GB Midnight — 3
  { skuId: 'sku_mba_m4_256_midnight', provider: 'xcite', priceFils: 339000, source: 'live' },
  { skuId: 'sku_mba_m4_256_midnight', provider: 'alyousifi', priceFils: 335000 },
  { skuId: 'sku_mba_m4_256_midnight', provider: 'blink', priceFils: 345000 },
  // MacBook Air M4 512GB Silver — 2
  { skuId: 'sku_mba_m4_512_silver', provider: 'xcite', priceFils: 399000, source: 'live' },
  { skuId: 'sku_mba_m4_512_silver', provider: 'eureka', priceFils: 395000 },
  // Dell XPS 13 512GB Silver — 2
  { skuId: 'sku_dell_xps13_512_silver', provider: 'xcite', priceFils: 329000, source: 'live' },
  { skuId: 'sku_dell_xps13_512_silver', provider: 'alyousifi', priceFils: 332000 },
];

export const MOCK_OFFERS: Offer[] = OFFER_SEEDS.map((s, i) => {
  const p = MOCK_PROVIDERS.find((x) => x.slug === s.provider)!;
  const source = s.source ?? 'cache';
  return {
    id: `off_${s.provider}_${s.skuId.replace(/^sku_/, '')}`,
    skuId: s.skuId,
    providerId: p.id,
    providerName: p.name,
    priceFils: s.priceFils,
    inStock: s.inStock ?? true,
    deeplinkUrl: deeplink(s.provider, s.skuId),
    source,
    // Deterministic timestamps (offset by index minutes) so cache/live fixtures are reproducible.
    fetchedAt: new Date(Date.UTC(2026, 5, 25, 9, 0, 0) + i * 60_000).toISOString(),
  };
});
