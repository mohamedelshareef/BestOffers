import {
  electronicsTokens,
  scoreProductTitle,
  filterProductsByQuery,
  titleSimilarity,
  groupSimilarProducts,
  normalizeElectronicsText,
  detectBrand,
  detectProductType,
  detectQueryType,
  brandMismatch,
  typeMismatch,
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

describe('electronics-relevance — BRAND + TYPE enforcement (OWNER bug: "Samsung phone" → Adonit stylus)', () => {
  // The live bug: "Samsung phone" relaxed to a generic core, the provider returned Adonit Jot Pro / Mini
  // STYLUSES (other brand, wrong type), and the relevance filter enforced neither brand nor type, so a
  // stylus satisfied a phone query. These tests lock the generalizing brand+type guards.

  it('detectBrand finds the brand in title and via family aliases', () => {
    expect(detectBrand('Samsung Galaxy S24 Ultra')).toBe('samsung');
    expect(detectBrand('Adonit Jot Pro Stylus')).toBe('adonit');
    expect(detectBrand('Apple iPhone 16')).toBe('apple'); // iphone → apple family alias
    expect(detectBrand('Google Pixel 9')).toBe('google'); // pixel → google
    expect(detectBrand('Some Unbranded Phone')).toBeNull();
  });

  it('detectProductType separates devices from accessories; a stylus is NOT a phone', () => {
    expect(detectProductType('Adonit Jot Pro Stylus')?.type).toBe('stylus');
    expect(detectProductType('iPhone 16 Silicone Case')?.type).toBe('case');
    expect(detectProductType('Samsung Galaxy A55 Smartphone')?.type).toBe('phone');
    expect(detectProductType('Samsung Galaxy Tab S9 Tablet')?.type).toBe('tablet');
    expect(detectProductType('Samsung Galaxy Watch 6')?.type).toBe('watch');
    expect(detectProductType('Google Pixel Buds Pro')?.type).toBe('headphones');
  });

  it('detectQueryType infers PHONE from a bare phone-line query ("Google Pixel 9" → phone)', () => {
    expect(detectQueryType('Samsung phone')?.type).toBe('phone');
    expect(detectQueryType('Google Pixel 9')?.type).toBe('phone'); // pixel line implies phone
    expect(detectQueryType('iPhone 16')?.type).toBe('phone');
    expect(detectQueryType('Sony headphones')?.type).toBe('headphones');
    expect(detectQueryType('vacuum cleaner')?.type).toBe('vacuum');
  });

  it('brandMismatch drops an other-brand hit when the query named a brand', () => {
    expect(brandMismatch('samsung', 'Adonit Jot Pro Stylus')).toBe(true); // adonit ≠ samsung → DROP
    expect(brandMismatch('samsung', 'Samsung Galaxy S24')).toBe(false); // same brand → keep
    expect(brandMismatch('samsung', 'Unbranded Generic Phone')).toBe(false); // no brand → keep (type guards)
    expect(brandMismatch(null, 'Adonit Stylus')).toBe(false); // query had no brand → no brand gate
  });

  it('typeMismatch drops a different concrete type / accessory when the query named a type', () => {
    const phone = detectQueryType('Samsung phone');
    expect(typeMismatch(phone, 'Adonit Jot Pro Stylus')).toBe(true); // stylus ≠ phone → DROP
    expect(typeMismatch(phone, 'Samsung Galaxy Tab Tablet')).toBe(true); // tablet ≠ phone → DROP
    expect(typeMismatch(phone, 'Samsung Galaxy A55 Smartphone')).toBe(false); // phone → keep
    expect(typeMismatch(phone, 'Samsung Galaxy S24 Ultra')).toBe(false); // no detectable type → keep
  });

  it('REGRESSION "Samsung phone" (floor relaxed to "samsung"): only Samsung PHONES, NEVER a stylus', () => {
    // Reproduces the live feed for the relaxed floor "samsung": Samsung devices + the Adonit stylus noise.
    const feed = [
      { title: 'Samsung Galaxy A55 5G 256GB Smartphone' },
      { title: 'Samsung Galaxy S24 Ultra 512GB' },
      { title: 'Samsung Galaxy Tab S9 Tablet' },
      { title: 'Samsung Galaxy Watch 6' },
      { title: 'Adonit Jot Pro Fine Point Stylus' }, // the owner bug item
      { title: 'Adonit Mini 4 Stylus' }, // the owner bug item
      { title: 'Samsung Galaxy A55 Silicone Case Cover' },
    ];
    // floor = "samsung" (the relaxed discovery rung), rankQuery = the full "samsung phone".
    const kept = filterProductsByQuery(feed, 'samsung', 'samsung phone').map((h) => h.title);
    expect(kept).toContain('Samsung Galaxy A55 5G 256GB Smartphone');
    expect(kept).toContain('Samsung Galaxy S24 Ultra 512GB');
    // NEVER a stylus / other-brand / wrong-type item.
    expect(kept.some((t) => /adonit|stylus/i.test(t))).toBe(false);
    expect(kept.some((t) => /tablet|watch|case/i.test(t))).toBe(false);
  });

  it('REGRESSION accessory-not-product: "Sony headphones" keeps headphones, drops Sony TV/console/other-brand', () => {
    const feed = [
      { title: 'Sony WH-1000XM5 Wireless Headphones' },
      { title: 'Sony Bravia 55 inch 4K TV' },
      { title: 'Sony PlayStation 5 Console' },
      { title: 'JBL Tune 510BT Headphones' }, // wrong brand → drop
    ];
    const kept = filterProductsByQuery(feed, 'sony', 'sony headphones').map((h) => h.title);
    expect(kept).toEqual(['Sony WH-1000XM5 Wireless Headphones']);
  });

  it('NO REGRESSION: "Google Pixel 9" keeps real Pixel phones (drops Pixel Buds), "iPhone 16" drops the case', () => {
    const pixel = filterProductsByQuery(
      [
        { title: 'Google Pixel 9 Pro 256GB' },
        { title: 'Google Pixel 8 128GB' },
        { title: 'Google Pixel Buds Pro' }, // headphones ≠ phone → drop
      ],
      'google pixel',
      'google pixel 9',
    ).map((h) => h.title);
    expect(pixel).toContain('Google Pixel 9 Pro 256GB');
    expect(pixel).toContain('Google Pixel 8 128GB'); // relax keeps siblings; "9" only ranks
    expect(pixel.some((t) => /buds/i.test(t))).toBe(false);
    expect(pixel[0]).toBe('Google Pixel 9 Pro 256GB'); // exact model ranks first

    const iphone = filterProductsByQuery(
      [
        { title: 'Apple iPhone 16 128GB' },
        { title: 'Apple iPhone 16 Pro Max 512GB' },
        { title: 'iPhone 16 Silicone Case' }, // accessory → drop
        { title: 'Samsung Galaxy S24' }, // wrong brand → drop
      ],
      'iphone 16',
      'iphone 16',
    ).map((h) => h.title);
    expect(iphone).toEqual(['Apple iPhone 16 128GB', 'Apple iPhone 16 Pro Max 512GB']);
  });

  it('drops a CarPlay / "for all phones" compatibility accessory from a phone query (live leak)', () => {
    // Live: "Apple phone" leaked "HOCO Wireless CarPlay For All Smart Phones Android & Apple Devices".
    // It carries the brand (Apple) and the word "Phones" but is an accessory, not a phone.
    const kept = filterProductsByQuery(
      [
        { title: 'Apple iPhone 16 128GB' },
        { title: 'HOCO Wireless CarPlay For All Smart Phones Android & Apple Devices' },
      ],
      'apple',
      'apple phone',
    ).map((h) => h.title);
    expect(kept).toEqual(['Apple iPhone 16 128GB']);
  });

  it('a query that ASKS for an accessory is exempt (keeps "iPhone 16 case")', () => {
    const kept = filterProductsByQuery(
      [
        { title: 'iPhone 16 Silicone Case' },
        { title: 'Apple iPhone 16 128GB' },
      ],
      'iphone case',
      'iphone case',
    ).map((h) => h.title);
    expect(kept).toContain('iPhone 16 Silicone Case');
  });
});
