import {
  DishCandidate,
  expandFoodQuery,
  filterDishesByQuery,
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
});
