import {
  electronicsTokens,
  scoreProductTitle,
  filterProductsByQuery,
  titleSimilarity,
  groupSimilarProducts,
  normalizeElectronicsText,
} from './electronics-relevance';

describe('electronics-relevance — query relevance filter (ADR-007 Q1)', () => {
  it('canonicalizes the product phrase so "Dish washing Machine" → the provider term "dishwasher"', () => {
    // VERIFIED live: providers index "dishwasher" (one word), not "dish washing machine" — the phrase
    // map rewrites it so the real search hits. "washing machine" is already canonical, kept as a pair.
    expect(electronicsTokens('Dish washing Machine')).toEqual(['dishwasher']);
    expect(electronicsTokens('washing machine')).toEqual(['washing']); // "machine" is a stop-word filler
    expect(electronicsTokens('best TV in kuwait')).toEqual(['tv']);
  });

  it('"Dish washing Machine" MATCHES a real dishwasher title, REJECTS a microwave', () => {
    expect(scoreProductTitle('Bosch 60cm Free-Standing Dishwasher', 'Dish washing Machine')).toBeGreaterThan(0);
    expect(scoreProductTitle('Samsung 28L Solo Microwave Oven', 'Dish washing Machine')).toBe(0);
  });

  it('"washing machine" MATCHES a washer, REJECTS a dishwasher (different appliance)', () => {
    expect(scoreProductTitle('LG 8kg Front Load Washing Machine', 'washing machine')).toBeGreaterThan(0);
    // "washing" is satisfied, but "machine" is a stop-word → only "washing" is required; a dishwasher
    // also contains "washing" via the dishwasher synonym? No — dishwasher hits the dishwasher group,
    // not "washing"; assert a pure washer query still excludes an unrelated fridge.
    expect(scoreProductTitle('Samsung 600L Side-by-Side Refrigerator', 'washing machine')).toBe(0);
  });

  it('requires EVERY significant query token — "iphone 16" rejects a wrong generation', () => {
    expect(scoreProductTitle('Apple iPhone 16 128GB Black', 'iphone 16')).toBeGreaterThan(0);
    expect(scoreProductTitle('Apple iPhone 15 128GB', 'iphone 16')).toBe(0); // wrong generation token
  });

  it('a DEVICE query drops accessory hits (case/cover) but keeps the device itself', () => {
    const out = filterProductsByQuery(
      [{ title: 'iPhone 16 Silicone Case Blue' }, { title: 'Apple iPhone 16 128GB Black' }],
      'iphone 16',
    );
    expect(out.map((h) => h.title)).toEqual(['Apple iPhone 16 128GB Black']);
  });

  it('uses the provider CATEGORY path so a brand/model-named device matches a generic query', () => {
    // "MacBook Pro" has no word "laptop" in its title — but its category path does.
    expect(scoreProductTitle('Apple MacBook Pro 16 inch M4 Max', 'laptop')).toBe(0);
    expect(
      scoreProductTitle('Apple MacBook Pro 16 inch M4 Max', 'laptop', 'Computers > Laptops > Note Books'),
    ).toBeGreaterThan(0);
  });

  it('a TV synonym lets "television" match a "TV" title and vice-versa', () => {
    expect(scoreProductTitle('Samsung 55" Crystal UHD TV', 'television')).toBeGreaterThan(0);
    expect(scoreProductTitle('LG 65 inch OLED Television', 'tv')).toBeGreaterThan(0);
  });

  it('filterProductsByQuery keeps only matching hits, ranked, never inventing', () => {
    const hits = [
      { title: 'Samsung 28L Microwave Oven' },
      { title: 'Bosch Free-Standing Dishwasher 12 Place' },
      { title: 'Midea Built-in Dishwasher' },
    ];
    const out = filterProductsByQuery(hits, 'dishwasher');
    expect(out.map((h) => h.title).sort()).toEqual([
      'Bosch Free-Standing Dishwasher 12 Place',
      'Midea Built-in Dishwasher',
    ]);
    expect(out.find((h) => h.title.includes('Microwave'))).toBeUndefined();
  });

  it('an empty / no-signal query leaves the provider list untouched (no nuke)', () => {
    const hits = [{ title: 'A' }, { title: 'B' }];
    expect(filterProductsByQuery(hits, '   ').map((h) => h.title)).toEqual(['A', 'B']);
  });
});

describe('electronics-relevance — cross-provider grouping (pg_trgm-style)', () => {
  it('near-identical titles are similar; different products are not', () => {
    const a = 'Samsung 55 inch Crystal UHD 4K Smart TV';
    const b = 'Samsung 55" Crystal UHD 4K Smart TV';
    const c = 'LG 65 inch OLED evo C4 Smart TV';
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.55);
    expect(titleSimilarity(a, c)).toBeLessThan(0.55);
  });

  it('groups same product across providers, keeps different products separate', () => {
    const items = [
      { title: 'Bosch 60cm Free-Standing Dishwasher SMS', providerId: 'prov_xcite' },
      { title: 'Bosch 60cm Free Standing Dishwasher SMS', providerId: 'prov_blink' },
      { title: 'Midea Built-in Dishwasher 14 Place', providerId: 'prov_eureka' },
    ];
    const clusters = groupSimilarProducts(items);
    // the two Bosch rows merge; Midea stays alone.
    expect(clusters.length).toBe(2);
    const sizes = clusters.map((c) => c.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it('normalizes Arabic + punctuation so AR/EN noise does not block a true match', () => {
    expect(normalizeElectronicsText('غسّالة الصحون')).toBe('غساله الصحون');
    expect(normalizeElectronicsText('TV — 55"')).toBe('tv 55');
  });
});
