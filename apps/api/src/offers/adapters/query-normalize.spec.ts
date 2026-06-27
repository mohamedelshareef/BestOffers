import {
  normalizeProviderQuery,
  editDistance,
  foldText,
} from './query-normalize';
import {
  filterDishesByQuery,
  isBeverage,
  isTestRestaurant,
  isDessertRice,
  isSavoryRiceQuery,
  DishCandidate,
} from './food-relevance';

/**
 * ADR-007 C1+C2+C4+C5 regression suite — the 300-case run's dominant fail clusters.
 *  C1/C2: AR / typo / appliance queries normalize to the EN canonical the providers index.
 *  C4:    test-vendor (Tes P Hut) excluded; beverages never front-rank a dish.
 *  C5:    food gibberish → honest-empty (Talabat lane), never a card dump.
 */

describe('query-normalize (C1+C2: AR → EN + typo correction before provider search)', () => {
  describe('editDistance (Damerau-Levenshtein, handles transposition)', () => {
    it('counts a single substitution / insertion / transposition as 1', () => {
      expect(editDistance('refrigirator', 'refrigerator')).toBe(1); // substitution
      expect(editDistance('biryni', 'biryani')).toBe(1); // insertion
      expect(editDistance('samesung', 'samsung')).toBe(1); // deletion
      expect(editDistance('shwarma', 'shawarma')).toBe(1);
    });
  });

  describe('electronics AR routing (C1)', () => {
    const cases: [string, string][] = [
      ['غسالة صحون', 'dishwasher'],
      ['غسالة ملابس', 'washing machine'],
      ['ثلاجة', 'refrigerator'],
      ['تلفزيون', 'tv'],
      ['مكيف سبليت', 'split air conditioner'],
      ['ميكروويف', 'microwave'],
      ['مكنسة كهربائية', 'vacuum cleaner'],
      ['سماعات ايربودز', 'airpods'],
      ['ساعة ابل', 'apple watch'],
      ['لابتوب ابل', 'macbook'],
      ['تابلت', 'tablet'],
      ['بلايستيشن 5', 'playstation 5'],
    ];
    it.each(cases)('AR %s → EN canonical (%s)', (ar, en) => {
      expect(normalizeProviderQuery(ar, 'electronics')).toContain(en.split(' ')[0]);
      expect(normalizeProviderQuery(ar, 'electronics')).toBe(en);
    });
  });

  describe('electronics typo correction (C1)', () => {
    it('snaps a fuzzy Latin term to the catalog vocabulary', () => {
      expect(normalizeProviderQuery('refrigirator', 'electronics')).toContain('refrigerator');
      expect(normalizeProviderQuery('labtop dell', 'electronics')).toContain('laptop');
      expect(normalizeProviderQuery('telvison samsung', 'electronics')).toContain('television');
      expect(normalizeProviderQuery('samesung galaxy', 'electronics')).toContain('samsung');
    });
  });

  describe('food AR routing (C2)', () => {
    const cases: [string, string][] = [
      ['تشيز كيك', 'cheesecake'],
      ['آيس كريم', 'ice cream'],
      ['كنافة نابلسية', 'kunafa'],
      ['كرك', 'karak tea'],
      ['سلطة', 'salad'],
      ['ماكدونالدز', 'mcdonalds'],
      ['دجاج مقلي', 'fried chicken'],
      ['كيكه شوكولاته', 'chocolate cake'],
      ['فطور صباحي', 'breakfast'],
      ['قهوة مختصة', 'specialty coffee'],
    ];
    it.each(cases)('AR %s → EN canonical (%s)', (ar, en) => {
      expect(normalizeProviderQuery(ar, 'food')).toBe(en);
    });
  });

  describe('food typo correction (C2)', () => {
    it('snaps food typos to the canonical dish term', () => {
      expect(normalizeProviderQuery('biryni', 'food')).toContain('biryani');
      expect(normalizeProviderQuery('burgr', 'food')).toContain('burger');
      expect(normalizeProviderQuery('shwarma', 'food')).toContain('shawarma');
    });
  });

  describe('does NOT over-correct (truthfulness — off-catalog stays off-catalog)', () => {
    it('leaves a genuinely unknown term unchanged (so it can honest-empty, never fabricate)', () => {
      expect(normalizeProviderQuery('xyzqwfood', 'food')).toBe('xyzqwfood');
      expect(normalizeProviderQuery('zzzplasmatron', 'electronics')).toBe('zzzplasmatron');
    });
    it('never re-spells a connector/qualifier (chilled stays chilled, not grilled)', () => {
      expect(normalizeProviderQuery('chilled with rice', 'food')).toBe('chilled with rice');
    });
  });

  describe('foldText', () => {
    it('folds Arabic diacritics + alef/ya/ta-marbuta', () => {
      expect(foldText('آيْفُون')).toBe('ايفون');
    });
  });
});

describe('food C4 — test-vendor exclusion + beverage down-rank', () => {
  it('excludes the live "Tes P Hut" test seed (and other obfuscated markers)', () => {
    expect(isTestRestaurant('Tes P Hut')).toBe(true);
    expect(isTestRestaurant('tes-p-hut')).toBe(true);
    expect(isTestRestaurant('UAT Kitchen')).toBe(true);
    expect(isTestRestaurant('Fake Burgers')).toBe(true);
    // real vendors stay
    expect(isTestRestaurant('Pizza Hut')).toBe(false);
    expect(isTestRestaurant('Contest Grill')).toBe(false);
    expect(isTestRestaurant('Tested Recipes')).toBe(false);
  });

  it('detects beverages (and does NOT misflag chocolate as cola)', () => {
    expect(isBeverage({ title: '7 Up' })).toBe(true);
    expect(isBeverage({ title: 'Mirinda Can' })).toBe(true);
    expect(isBeverage({ title: 'Water Bottle' })).toBe(true);
    expect(isBeverage({ title: 'كيكة شوكولاتة' })).toBe(false); // شوكولاتة contains "كولا" but is chocolate
    expect(isBeverage({ title: 'Chocolate Cake' })).toBe(false);
  });

  it('a dessert query ranks the cake ABOVE beverages and drops the test vendor', () => {
    const menu: DishCandidate[] = [
      { title: '7 Up — Tes P Hut', category: 'Beverages' },
      { title: 'Mirinda — Tes P Hut', category: 'Beverages' },
      { title: 'Chocolate Cake — Sweet Tooth', category: 'Cakes' },
      { title: 'Water — Tes P Hut', category: 'Beverages' },
    ];
    const out = filterDishesByQuery(menu, 'cake', false, { unmatchedEmpty: true });
    // test vendor gone entirely; the real cake is FIRST (no beverage front-rank)
    expect(out.some((d) => /Tes P Hut/i.test(d.title))).toBe(false);
    expect(out[0].title).toMatch(/Chocolate Cake/);
  });
});

describe('food C5 — gibberish / off-menu → honest-empty on the Talabat lane', () => {
  const menu: DishCandidate[] = [
    { title: 'Whopper — Burger King', category: 'Burgers' },
    { title: '7 Up — Tes P Hut', category: 'Beverages' },
    { title: 'Fries — Burger King', category: 'Sides' },
  ];
  it('gibberish returns EMPTY (no card dump) when unmatchedEmpty is set', () => {
    expect(filterDishesByQuery(menu, 'xyzqwfood', false, { unmatchedEmpty: true })).toEqual([]);
  });
  it('an off-menu dish (ramen) returns EMPTY, not a test-vendor dump', () => {
    expect(filterDishesByQuery(menu, 'ramen', false, { unmatchedEmpty: true })).toEqual([]);
  });
  it('the curated IG lane (no unmatchedEmpty) keeps handle-routed posts capped', () => {
    const igPosts: DishCandidate[] = [{ title: 'Meal Prep Box — @basickuwait', category: 'Meal Prep' }];
    expect(filterDishesByQuery(igPosts, 'meal prep', false).length).toBeGreaterThan(0);
  });
});

describe('food C3 — rice-pudding never leaks into a savory-rice query', () => {
  it('isSavoryRiceQuery is true for rice mains, false for desserts', () => {
    expect(isSavoryRiceQuery('rice')).toBe(true);
    expect(isSavoryRiceQuery('بخاري')).toBe(true);
    expect(isSavoryRiceQuery('mandi')).toBe(true);
    expect(isSavoryRiceQuery('rice pudding')).toBe(false); // dessert intent
    expect(isSavoryRiceQuery('cake')).toBe(false);
  });
  it('isDessertRice flags pudding/kheer rice items', () => {
    expect(isDessertRice({ title: 'Rice Pudding (Vanilla)' })).toBe(true);
    expect(isDessertRice({ title: 'Chicken Biryani' })).toBe(false);
  });
  it('a savory-rice query drops the Rice Pudding card', () => {
    const menu: DishCandidate[] = [
      { title: 'Chicken Biryani — Chicken Tikka', category: 'Biryani' },
      { title: 'Rice Pudding Vanilla — Chicken Tikka', category: 'Desserts' },
    ];
    const out = filterDishesByQuery(menu, 'rice', false, { unmatchedEmpty: true });
    expect(out.some((d) => /Rice Pudding/i.test(d.title))).toBe(false);
    expect(out.some((d) => /Biryani/i.test(d.title))).toBe(true);
  });
});
