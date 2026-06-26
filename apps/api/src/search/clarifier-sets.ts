import { ClarifierQuestion, Sector } from '@bestoffers/shared';

/**
 * Per-sector clarifier question sets (config-driven, NOT hardcoded in the loop).
 *
 * OWNER DIRECTIVE (2026-06-26, PO-ratified): irrespective of sector, the AI asks AT LEAST 5
 * clarifying questions before any provider search is dispatched. This SUPERSEDES the prior ≤3 cap
 * and the "food/real-estate = no clarifiers (discovery)" rule.
 *
 * Source: team/analysis/clarifier-question-sets.md §1–4 (BA spec). Each sector lists its dimensions
 * ordered BROAD→NARROW; the first MANDATORY_MIN are the mandatory floor, the rest are an optional
 * extension the gate may use to reach the floor when intent pre-resolves some of the mandatory ones.
 *
 * Adding a new sector = add a `Sector` key here with ≥5 dimensions filled from the §4 template
 * (WHAT / KEY-VARIANT / BUDGET / CONSTRAINT / PREFERENCE). No code change to the loop.
 */

/** Hard floor: every sector presents AT LEAST this many distinct dimensions before search (RULE-1). */
export const MIN_CLARIFIER_QUESTIONS = 5;

/** A configured dimension: the question text/chips + which intent fields pre-resolve it (RULE-7). */
export interface ClarifierDimension extends ClarifierQuestion {
  /**
   * Returns true when the user's intent already states this dimension unambiguously, so it counts
   * toward the ≥5 WITHOUT being re-asked (RULE-7). Reads the structured constraints + raw query text.
   */
  preResolved: (ctx: PreResolveContext) => boolean;
}

export interface PreResolveContext {
  /** lowercased raw intent text */
  raw: string;
  /** structured constraints already extracted (storage/color/budgetFils/area/…) */
  constraints: Record<string, string | number | undefined | null>;
  /** the resolved model string, if any */
  model?: string;
}

const hasConstraint = (key: string) => (c: PreResolveContext) =>
  c.constraints[key] != null && String(c.constraints[key]).trim() !== '';

const never = () => false;

/**
 * ELECTRONICS — spec §1. Mandatory 5: model, storage, color, budget, condition. Q6–Q8 optional.
 */
const ELECTRONICS: ClarifierDimension[] = [
  {
    dimension: 'model',
    textAr: 'أي موديل أو فئة تحديدًا تبحث عنه؟',
    textEn: 'Which exact model or variant are you after?',
    chips: [
      { value: 'iPhone 17 Pro Max', labelAr: 'آيفون 17 برو ماكس', labelEn: 'iPhone 17 Pro Max' },
      { value: 'iPhone 17', labelAr: 'آيفون 17', labelEn: 'iPhone 17' },
      { value: 'Galaxy S25', labelAr: 'جالاكسي S25', labelEn: 'Samsung S25' },
      { value: '__skip__', labelAr: 'أي موديل', labelEn: 'Any' },
    ],
    preResolved: (c) => !!(c.model && c.model.trim()),
  },
  {
    dimension: 'storage',
    textAr: 'كم سعة التخزين؟',
    textEn: 'How much storage?',
    chips: [
      { value: '128GB', labelAr: '128 جيجابايت', labelEn: '128 GB' },
      { value: '256GB', labelAr: '256 جيجابايت', labelEn: '256 GB' },
      { value: '512GB', labelAr: '512 جيجابايت', labelEn: '512 GB' },
      { value: '1TB', labelAr: '1 تيرابايت', labelEn: '1 TB' },
      { value: '__skip__', labelAr: 'غير مهم', labelEn: 'Any' },
    ],
    preResolved: hasConstraint('storage'),
  },
  {
    dimension: 'color',
    textAr: 'أي لون تفضل؟',
    textEn: 'Which color?',
    chips: [
      { value: 'black', labelAr: 'أسود', labelEn: 'Black' },
      { value: 'white', labelAr: 'أبيض', labelEn: 'White' },
      { value: 'blue', labelAr: 'أزرق', labelEn: 'Blue' },
      { value: 'natural', labelAr: 'طبيعي', labelEn: 'Natural' },
      { value: '__skip__', labelAr: 'أي لون', labelEn: 'Any' },
    ],
    preResolved: hasConstraint('color'),
  },
  {
    dimension: 'budget',
    textAr: 'كم ميزانيتك؟ (بالدينار)',
    textEn: 'What is your budget? (KWD)',
    chips: [
      { value: '100', labelAr: 'أقل من 100', labelEn: '< 100 KWD' },
      { value: '150', labelAr: '100–150', labelEn: '100–150 KWD' },
      { value: '250', labelAr: '150–250', labelEn: '150–250 KWD' },
      { value: '999', labelAr: '250+', labelEn: '250+ KWD' },
    ],
    preResolved: hasConstraint('budgetFils'),
  },
  {
    dimension: 'condition',
    textAr: 'جديد أو مستعمل؟',
    textEn: 'New or used?',
    chips: [
      { value: 'new', labelAr: 'جديد', labelEn: 'New' },
      { value: 'used', labelAr: 'مستعمل', labelEn: 'Used' },
      { value: 'refurbished', labelAr: 'مجدّد', labelEn: 'Refurbished' },
      { value: '__skip__', labelAr: 'لا يهم', labelEn: 'Either' },
    ],
    preResolved: hasConstraint('condition'),
  },
  // optional extension (Q6–Q8) — only used to top up to the floor when intent pre-resolves some of the 5
  {
    dimension: 'brand',
    textAr: 'هل لديك ماركة مفضلة؟',
    textEn: 'Any preferred brand?',
    chips: [
      { value: 'Apple', labelAr: 'Apple', labelEn: 'Apple' },
      { value: 'Samsung', labelAr: 'Samsung', labelEn: 'Samsung' },
      { value: 'Xiaomi', labelAr: 'Xiaomi', labelEn: 'Xiaomi' },
      { value: '__skip__', labelAr: 'أي ماركة', labelEn: 'Any' },
    ],
    preResolved: hasConstraint('brand'),
  },
  {
    dimension: 'mustHave',
    textAr: 'أي مواصفة لا غنى عنها؟',
    textEn: 'Any must-have spec?',
    chips: [
      { value: 'camera', labelAr: 'كاميرا', labelEn: 'Camera' },
      { value: 'battery', labelAr: 'بطارية', labelEn: 'Battery' },
      { value: '5g', labelAr: '5G', labelEn: '5G' },
      { value: 'big-screen', labelAr: 'شاشة كبيرة', labelEn: 'Big screen' },
      { value: '__skip__', labelAr: 'لا شيء', labelEn: 'None' },
    ],
    preResolved: never,
  },
];

/**
 * FOOD — spec §2. Mandatory 5: dish, people, budget, delivery+area, dietary.
 */
const FOOD: ClarifierDimension[] = [
  {
    dimension: 'dish',
    textAr: 'أي طبق أو مطبخ تريد؟',
    textEn: 'Which dish or cuisine?',
    chips: [
      { value: 'grilled chicken', labelAr: 'دجاج مشوي', labelEn: 'Grilled chicken' },
      { value: 'burger', labelAr: 'برجر', labelEn: 'Burger' },
      { value: 'pizza', labelAr: 'بيتزا', labelEn: 'Pizza' },
      { value: 'mandi', labelAr: 'مندي', labelEn: 'Mandi' },
      { value: '__skip__', labelAr: 'أي طبق', labelEn: 'Any' },
    ],
    // the raw query IS the dish term for food (the discovery term) → pre-resolved when non-empty
    preResolved: (c) => !!(c.raw && c.raw.trim()),
  },
  {
    dimension: 'people',
    textAr: 'لكم شخص؟',
    textEn: 'For how many people?',
    chips: [
      { value: '1', labelAr: '1', labelEn: '1' },
      { value: '2', labelAr: '2', labelEn: '2' },
      { value: '3-4', labelAr: '3–4', labelEn: '3–4' },
      { value: '5+', labelAr: '5+', labelEn: '5+' },
    ],
    preResolved: hasConstraint('people'),
  },
  {
    dimension: 'budget',
    textAr: 'كم ميزانية الطلب؟ (بالدينار)',
    textEn: 'Budget for the order? (KWD)',
    chips: [
      { value: '5', labelAr: 'أقل من 5', labelEn: '< 5 KWD' },
      { value: '10', labelAr: '5–10', labelEn: '5–10 KWD' },
      { value: '20', labelAr: '10–20', labelEn: '10–20 KWD' },
      { value: '999', labelAr: '20+', labelEn: '20+ KWD' },
    ],
    preResolved: hasConstraint('budgetFils'),
  },
  {
    dimension: 'delivery',
    textAr: 'توصيل أو استلام؟ ومن أي منطقة؟',
    textEn: 'Delivery or pickup? Which area?',
    chips: [
      { value: 'delivery', labelAr: 'توصيل', labelEn: 'Delivery' },
      { value: 'pickup', labelAr: 'استلام', labelEn: 'Pickup' },
      { value: '__skip__', labelAr: 'لا يهم', labelEn: 'Any' },
    ],
    preResolved: hasConstraint('delivery'),
  },
  {
    dimension: 'dietary',
    textAr: 'أي قيود غذائية؟',
    textEn: 'Any dietary restrictions?',
    chips: [
      { value: 'halal', labelAr: 'حلال', labelEn: 'Halal' },
      { value: 'vegetarian', labelAr: 'نباتي', labelEn: 'Vegetarian' },
      { value: 'nut-free', labelAr: 'بدون مكسرات', labelEn: 'Nut-free' },
      { value: '__skip__', labelAr: 'لا يوجد', labelEn: 'None' },
    ],
    preResolved: hasConstraint('dietary'),
  },
  // optional extension
  {
    dimension: 'spice',
    textAr: 'درجة البهارات؟',
    textEn: 'Spice level?',
    chips: [
      { value: 'mild', labelAr: 'خفيف', labelEn: 'Mild' },
      { value: 'medium', labelAr: 'وسط', labelEn: 'Medium' },
      { value: 'hot', labelAr: 'حار', labelEn: 'Hot' },
      { value: '__skip__', labelAr: 'لا يهم', labelEn: 'Any' },
    ],
    preResolved: never,
  },
  {
    dimension: 'sides',
    textAr: 'تريد أطباق جانبية؟',
    textEn: 'Want sides or extras?',
    chips: [
      { value: 'fries', labelAr: 'بطاطس', labelEn: 'Fries' },
      { value: 'rice', labelAr: 'أرز', labelEn: 'Rice' },
      { value: 'salad', labelAr: 'سلطة', labelEn: 'Salad' },
      { value: 'drink', labelAr: 'مشروب', labelEn: 'Drink' },
      { value: '__skip__', labelAr: 'بدون', labelEn: 'None' },
    ],
    preResolved: never,
  },
];

/**
 * REAL ESTATE (FLATS) — spec §3. Mandatory 5: rent/buy, area, bedrooms, budget, furnished.
 */
const REALESTATE: ClarifierDimension[] = [
  {
    dimension: 'tenure',
    textAr: 'إيجار أو تمليك؟',
    textEn: 'Rent or buy?',
    chips: [
      { value: 'rent', labelAr: 'إيجار', labelEn: 'Rent' },
      { value: 'buy', labelAr: 'تمليك', labelEn: 'Buy' },
    ],
    preResolved: hasConstraint('tenure'),
  },
  {
    dimension: 'area',
    textAr: 'أي منطقة أو مناطق؟',
    textEn: 'Which area(s)?',
    chips: [
      { value: 'salmiya', labelAr: 'السالمية', labelEn: 'Salmiya' },
      { value: 'hawally', labelAr: 'حولي', labelEn: 'Hawally' },
      { value: 'jabriya', labelAr: 'الجابرية', labelEn: 'Jabriya' },
      { value: 'mahboula', labelAr: 'المهبولة', labelEn: 'Mahboula' },
      { value: '__skip__', labelAr: 'أي منطقة', labelEn: 'Any' },
    ],
    // the raw query carries the area/rooms intent for the RE social lane → pre-resolved when non-empty
    preResolved: (c) => !!(c.raw && c.raw.trim()),
  },
  {
    dimension: 'bedrooms',
    textAr: 'كم غرفة نوم؟',
    textEn: 'How many bedrooms?',
    chips: [
      { value: 'studio', labelAr: 'استوديو', labelEn: 'Studio' },
      { value: '1', labelAr: '1', labelEn: '1' },
      { value: '2', labelAr: '2', labelEn: '2' },
      { value: '3', labelAr: '3', labelEn: '3' },
      { value: '4+', labelAr: '4+', labelEn: '4+' },
    ],
    preResolved: hasConstraint('bedrooms'),
  },
  {
    dimension: 'budget',
    textAr: 'كم الميزانية؟ (شهري للإيجار، بالدينار)',
    textEn: 'Budget range? (monthly for rent, KWD)',
    chips: [
      { value: '250', labelAr: 'أقل من 250', labelEn: '< 250 KWD' },
      { value: '400', labelAr: '250–400', labelEn: '250–400 KWD' },
      { value: '600', labelAr: '400–600', labelEn: '400–600 KWD' },
      { value: '999', labelAr: '600+', labelEn: '600+ KWD' },
    ],
    preResolved: hasConstraint('budgetFils'),
  },
  {
    dimension: 'furnished',
    textAr: 'مفروشة أو غير مفروشة؟',
    textEn: 'Furnished or unfurnished?',
    chips: [
      { value: 'furnished', labelAr: 'مفروشة', labelEn: 'Furnished' },
      { value: 'unfurnished', labelAr: 'غير مفروشة', labelEn: 'Unfurnished' },
      { value: 'semi', labelAr: 'شبه مفروشة', labelEn: 'Semi' },
      { value: '__skip__', labelAr: 'لا يهم', labelEn: 'Any' },
    ],
    preResolved: hasConstraint('furnished'),
  },
  // optional extension
  {
    dimension: 'amenities',
    textAr: 'متطلبات: موقف، مصعد، مسبح؟',
    textEn: 'Floor / parking / amenities?',
    chips: [
      { value: 'parking', labelAr: 'موقف', labelEn: 'Parking' },
      { value: 'elevator', labelAr: 'مصعد', labelEn: 'Elevator' },
      { value: 'pool', labelAr: 'مسبح', labelEn: 'Pool' },
      { value: 'balcony', labelAr: 'بلكونة', labelEn: 'Balcony' },
      { value: '__skip__', labelAr: 'لا شيء', labelEn: 'None' },
    ],
    preResolved: never,
  },
  {
    dimension: 'tenant',
    textAr: 'للعائلة أو للعزّاب؟',
    textEn: 'Family or bachelor?',
    chips: [
      { value: 'family', labelAr: 'عائلة', labelEn: 'Family' },
      { value: 'bachelor', labelAr: 'عزّاب', labelEn: 'Bachelor' },
      { value: '__skip__', labelAr: 'لا يهم', labelEn: 'Any' },
    ],
    preResolved: never,
  },
];

/** The registry. Adding a sector = add a key with ≥5 dimensions (§4 template). */
export const CLARIFIER_SETS: Record<Sector, ClarifierDimension[]> = {
  electronics: ELECTRONICS,
  food: FOOD,
  realestate: REALESTATE,
};

/** Strip the `preResolved` predicate before sending a dimension to the client as a ClarifierQuestion. */
export function toQuestion(d: ClarifierDimension): ClarifierQuestion {
  return { dimension: d.dimension, textAr: d.textAr, textEn: d.textEn, chips: d.chips };
}
