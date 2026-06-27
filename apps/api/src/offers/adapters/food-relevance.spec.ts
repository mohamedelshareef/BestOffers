import {
  DishCandidate,
  expandFoodQuery,
  filterDishesByQuery,
  isCondiment,
  isRecognizedFoodToken,
  isTestRestaurant,
  MATCHED_RESULT_CAP,
  normalizeFoodText,
  scoreDish,
} from './food-relevance';

describe('food-relevance (bug fix: "rice" returns random food)', () => {
  // A realistic mixed menu pulled from a couple of restaurants (rice dishes + unrelated items).
  const menu: (DishCandidate & { id: string })[] = [
    { id: 'biryani', title: 'Chicken Biryani — Chicken Tikka', category: 'Biryani' },
    { id: 'machboos', title: 'مجبوس دجاج — Mais Alghanim', category: 'الرز والمجبوس' },
    { id: 'rzbukhari', title: 'رز بخاري باللحم — Mais Alghanim', category: 'الأرز' },
    { id: 'whopper', title: 'Whopper — Burger King', category: 'Burgers' },
    { id: 'fries', title: 'French Fries — Burger King', category: 'Sides' },
    { id: 'zinger', title: 'Zinger Burger — KFC', category: 'Sandwiches' },
    { id: 'latte', title: 'Caramel Latte — Caribou', category: 'Coffee' },
  ];

  it('normalizes Arabic (alef/ya/ta-marbuta/diacritics)', () => {
    expect(normalizeFoodText('أرز')).toBe('ارز');
    expect(normalizeFoodText('برياني')).toBe('برياني');
    expect(normalizeFoodText('سلطة')).toBe('سلطه');
  });

  it('expands "rice" to its AR+EN synonym group (biryani/مجبوس/رز…)', () => {
    const { terms, matchedGroup } = expandFoodQuery('rice');
    expect(matchedGroup).toBe(true);
    expect(terms.has('biryani')).toBe(true);
    expect(terms.has('مجبوس')).toBe(true);
    expect(terms.has(normalizeFoodText('أرز'))).toBe(true); // 'ارز'
  });

  it('"rice" KEEPS rice/biryani/machboos dishes and DROPS the burger/fries/latte', () => {
    const result = filterDishesByQuery(menu, 'rice', false);
    const ids = result.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['biryani', 'machboos', 'rzbukhari']));
    // the query term must CONSTRAIN results — unrelated items are excluded
    expect(ids).not.toContain('whopper');
    expect(ids).not.toContain('fries');
    expect(ids).not.toContain('zinger');
    expect(ids).not.toContain('latte');
  });

  it('a burger is excluded from a "rice" search (explicit AC guard)', () => {
    const burger: DishCandidate = { title: 'Zinger Burger — KFC', category: 'Sandwiches' };
    expect(scoreDish(burger, expandFoodQuery('rice').terms)).toBe(0);
  });

  it('"برياني" (Arabic) returns the biryani + machboos rice dishes, not the burger', () => {
    const result = filterDishesByQuery(menu, 'برياني', false);
    const ids = result.map((d) => d.id);
    expect(ids).toContain('biryani');
    expect(ids).toContain('machboos');
    expect(ids).not.toContain('whopper');
  });

  it('"burger" returns only burgers, ranking a name hit above unrelated items', () => {
    const result = filterDishesByQuery(menu, 'burger', false);
    const ids = result.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['whopper', 'zinger']));
    expect(ids).not.toContain('biryani');
    expect(ids).not.toContain('latte');
  });

  it('a RESTAURANT query keeps the WHOLE menu (restaurantQuery=true → no dish filter)', () => {
    const result = filterDishesByQuery(menu, 'burger king', true);
    expect(result).toHaveLength(menu.length); // whole menu preserved when the user named a restaurant
  });

  it('ranks the category/name match higher (biryani section beats a desc-only hit)', () => {
    const terms = expandFoodQuery('rice').terms;
    const strong = scoreDish({ title: 'Chicken Biryani', category: 'Biryani' }, terms);
    const weak = scoreDish({ title: 'Mixed Grill', category: 'Grill', description: 'served with rice' }, terms);
    expect(strong).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThan(0); // a desc hit still counts as relevant
  });

  // ── OWNER BUG (2026-06-27): "Chilled with rice" returned 274 unrelated sauces from "Test Burger King" ──
  describe('multi-word free-form query (OWNER BUG: "Chilled with rice")', () => {
    // A real-shaped menu: condiments + a real rice dish + unrelated dishes, incl. a TEST vendor.
    const liveMenu: (DishCandidate & { id: string })[] = [
      { id: 'fierysauce', title: 'Fiery Sauce — Test Burger King', category: 'Sauces' },
      { id: 'garlicmayo', title: 'Garlic Mayo — Burger King', category: 'Sauces' },
      { id: 'bbqsauce', title: 'BBQ Sauce — Burger King', category: 'Sauces' },
      { id: 'ricebowl', title: 'Chicken Rice Bowl — Chicken Tikka', category: 'Rice' },
      { id: 'biryani2', title: 'Mutton Biryani — Mais Alghanim', category: 'Biryani' },
      { id: 'whopper2', title: 'Whopper — Burger King', category: 'Burgers' },
    ];

    it('"Chilled with rice" keeps ONLY rice dishes — drops sauces, burgers, and the Test vendor', () => {
      const ids = filterDishesByQuery(liveMenu, 'Chilled with rice', false).map((d) => d.id);
      expect(ids).toEqual(expect.arrayContaining(['ricebowl', 'biryani2']));
      expect(ids).not.toContain('fierysauce'); // Test vendor + condiment
      expect(ids).not.toContain('garlicmayo');
      expect(ids).not.toContain('bbqsauce');
      expect(ids).not.toContain('whopper2');
      expect(ids.length).toBeLessThanOrEqual(2); // never a 274-item dump
    });

    it('stop-words ("with"/"chilled") do not flip a dish query to a free-form pass-through', () => {
      // "rice" still recognized inside the phrase → matchedGroup, term constrains
      expect(expandFoodQuery('Chilled with rice').matchedGroup).toBe(true);
      expect(expandFoodQuery('Chilled with rice').terms.has('biryani')).toBe(true);
    });

    it('برياني inside an AR phrase ("ابغى برياني دجاج") still filters to biryani', () => {
      const result = filterDishesByQuery(liveMenu, 'ابغى برياني دجاج', false).map((d) => d.id);
      expect(result).toContain('biryani2');
      expect(result).toContain('ricebowl');
      expect(result).not.toContain('garlicmayo');
    });
  });

  describe('test/seed restaurant exclusion', () => {
    it('flags Test/Demo/QA vendors, not real ones', () => {
      expect(isTestRestaurant('Test Burger King')).toBe(true);
      expect(isTestRestaurant('test-burger-king')).toBe(true);
      expect(isTestRestaurant('Demo Restaurant')).toBe(true);
      expect(isTestRestaurant('QA Kitchen')).toBe(true);
      expect(isTestRestaurant('Burger King')).toBe(false);
      expect(isTestRestaurant('Chicken Tikka')).toBe(false);
      expect(isTestRestaurant('Contest Grill')).toBe(false); // 'test' inside a word ≠ test vendor
    });

    it('a restaurant query still excludes Test vendors from the whole-menu pass-through', () => {
      const menu2: (DishCandidate & { id: string })[] = [
        { id: 'a', title: 'Whopper — Test Burger King', category: 'Burgers' },
        { id: 'b', title: 'Whopper — Burger King', category: 'Burgers' },
      ];
      const ids = filterDishesByQuery(menu2, 'burger king', true).map((d) => d.id);
      expect(ids).toEqual(['b']); // the Test vendor dish is gone even in restaurant mode
    });
  });

  describe('condiments rank below real dishes', () => {
    it('isCondiment flags sauces/dips/add-ons', () => {
      expect(isCondiment({ title: 'Garlic Mayo', category: 'Sauces' })).toBe(true);
      expect(isCondiment({ title: 'BBQ Sauce' })).toBe(true);
      expect(isCondiment({ title: 'صوص ثوم' })).toBe(true);
      expect(isCondiment({ title: 'Chicken Biryani', category: 'Biryani' })).toBe(false);
    });

    it('a restaurant menu is fronted by real dishes, sauces sink to the bottom', () => {
      const menu3: (DishCandidate & { id: string })[] = [
        { id: 'sauce', title: 'BBQ Sauce — KFC', category: 'Sauces' },
        { id: 'meal', title: 'Zinger Meal — KFC', category: 'Meals' },
      ];
      const ids = filterDishesByQuery(menu3, 'kfc', true).map((d) => d.id);
      expect(ids[0]).toBe('meal'); // real dish first
      expect(ids[ids.length - 1]).toBe('sauce');
    });

    it('isRecognizedFoodToken: dish terms yes, brand/stop-words no', () => {
      expect(isRecognizedFoodToken('rice')).toBe(true);
      expect(isRecognizedFoodToken('chicken')).toBe(true);
      expect(isRecognizedFoodToken('برياني')).toBe(true);
      expect(isRecognizedFoodToken('kfc')).toBe(false);
      expect(isRecognizedFoodToken('king')).toBe(false);
    });
  });

  // ── OWNER OVER-DUMP BUG (2026-06-27): "sushi" → 243 cards (whole-menu dump). ──
  describe('over-dump cap (OWNER BUG: "sushi" → 243 cards)', () => {
    /** A huge menu of N matching dishes + some unrelated dishes, mimicking a provider's whole long-tail. */
    function bigMenu(term: string, matching: number, unrelated: number): (DishCandidate & { id: string })[] {
      const out: (DishCandidate & { id: string })[] = [];
      for (let i = 0; i < matching; i++) out.push({ id: `m${i}`, title: `${term} roll #${i}`, category: term });
      for (let i = 0; i < unrelated; i++) out.push({ id: `u${i}`, title: `Burger #${i}`, category: 'Burgers' });
      return out;
    }

    it('"sushi" is now a recognized DISH term (no longer flips to restaurant-mode whole-menu dump)', () => {
      expect(isRecognizedFoodToken('sushi')).toBe(true);
      expect(expandFoodQuery('sushi').matchedGroup).toBe(true);
    });

    it('"sushi" caps a 200-item matching menu to MATCHED_RESULT_CAP, drops the unrelated burgers', () => {
      const ids = filterDishesByQuery(bigMenu('Sushi', 200, 50), 'sushi', false).map((d) => d.id);
      expect(ids.length).toBe(MATCHED_RESULT_CAP); // capped — never a 243-card dump
      expect(ids.every((id) => id.startsWith('m'))).toBe(true); // only relevant sushi dishes
      expect(MATCHED_RESULT_CAP).toBeLessThan(60); // a sane, scannable set
    });

    it('"pizza" and "coffee" are likewise capped + relevance-filtered', () => {
      const pizza = filterDishesByQuery(bigMenu('Pizza', 120, 30), 'pizza', false);
      const coffee = filterDishesByQuery(bigMenu('Coffee', 120, 30), 'coffee', false);
      expect(pizza.length).toBe(MATCHED_RESULT_CAP);
      expect(coffee.length).toBe(MATCHED_RESULT_CAP);
      expect(pizza.every((d) => (d as any).id.startsWith('m'))).toBe(true);
      expect(coffee.every((d) => (d as any).id.startsWith('m'))).toBe(true);
    });

    it('a small matching set is returned in full (cap only bites the long tail)', () => {
      const ids = filterDishesByQuery(bigMenu('Sushi', 5, 10), 'sushi', false).map((d) => d.id);
      expect(ids.length).toBe(5);
    });
  });
});
