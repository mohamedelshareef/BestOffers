import { Injectable } from '@nestjs/common';
import { IntentNormalized } from '@bestoffers/shared';
import {
  ClarifierInput,
  ClarifierQuestionDraft,
  ClarifierResult,
  ClarifierSetInput,
  ClaudeClient,
  RankExplanation,
  RankInput,
} from './claude-client.interface';

/**
 * Deterministic, offline stand-in for Claude. No network, no API key.
 * Mimics ADR-002's structured outputs closely enough to exercise the full orchestration:
 *  - clarify(): keyword intent extraction + ONE missing-dimension question at a time.
 *  - explainRanking(): explanations grounded in a REAL supplied attribute (truthfulness).
 *
 * The order in which it probes missing dimensions: storage → color → budget (S1-1 §2.2 D).
 */
@Injectable()
export class MockClaudeClient implements ClaudeClient {
  private readonly dimensionOrder = ['storage', 'color', 'budget'];

  async clarify(input: ClarifierInput): Promise<ClarifierResult> {
    const intent = this.extractIntent(input.intentRaw);

    // Discovery sectors (food, realestate) and any food/realestate intent have NO pre-defined SKU
    // dimensions (storage/color) — the value is in the discovered results, so we go straight to search
    // without storage/color clarifiers (those questions are electronics-shaped).
    if (input.sector === 'food' || input.sector === 'realestate' || intent.category === 'food' || intent.category === 'realestate') {
      return { intentNormalized: intent, needClarification: false };
    }

    const nextDimension = this.dimensionOrder.find(
      (d) => !input.askedDimensions.includes(d) && !this.hasDimension(intent, d),
    );

    if (!nextDimension) {
      return { intentNormalized: intent, needClarification: false };
    }

    return {
      intentNormalized: intent,
      needClarification: true,
      question: this.questionFor(nextDimension),
    };
  }

  /**
   * Deterministic stand-in for the SMART per-query clarifier set. Returns a CANNED but genuinely
   * query-appropriate set so offline/tests prove tailoring works: a laptop query asks use-case/RAM/
   * screen (NOT phone storage/color); an iPhone query asks storage/color/AppleCare; "rice" asks
   * which-rice-dish/protein/spice. Returns [] for an unrecognized item → the orchestrator falls back
   * to the deterministic config set (so behaviour is identical to a real Claude generation failure).
   */
  async clarifierSet(input: ClarifierSetInput): Promise<ClarifierQuestionDraft[]> {
    const t = input.intentRaw.toLowerCase();
    const resolved = new Set(input.alreadyResolved.map((d) => d.toLowerCase()));

    let set: ClarifierQuestionDraft[] | undefined;
    if (/laptop|لابتوب|لاب توب|macbook|ماك بوك|notebook/.test(t)) set = MOCK_SETS.laptop;
    else if (/iphone|آيفون|ايفون/.test(t)) set = MOCK_SETS.iphone;
    else if (/rice|رز|أرز|برياني|biryani|مجبوس|machboos/.test(t)) set = MOCK_SETS.rice;
    else if (/شقة|شقه|flat|apartment|للايجار|للإيجار/.test(t)) set = MOCK_SETS.flat;

    if (!set) return []; // unrecognized → caller uses the deterministic config fallback
    // RULE-7: never re-ask a dimension the intent already resolved.
    return set.filter((q) => !resolved.has(q.dimension));
  }

  async explainRanking(input: RankInput): Promise<RankExplanation[]> {
    const { constraints } = input.intentNormalized;
    return input.rankedOffers.map(({ offer, sku }, idx) => {
      // Ground the explanation in a REAL attribute the user constrained, else fall back to price.
      // We NEVER invent — we read sku.attributes / offer fields only.
      let key = 'price';
      let valueAr = '';
      let valueEn = '';

      const matchedConstraint = ['storage', 'color'].find(
        (k) => constraints[k] && sku.attributes[k]?.toLowerCase() === String(constraints[k]).toLowerCase(),
      );

      if (idx === 0) {
        key = 'price';
        valueEn = 'lowest price';
        valueAr = 'الأرخص';
      } else if (matchedConstraint) {
        key = matchedConstraint;
        valueEn = `${matchedConstraint} ${sku.attributes[matchedConstraint]}`;
        valueAr = `${this.dimAr(matchedConstraint)} ${sku.attributes[matchedConstraint]}`;
      } else if (sku.attributes.storage) {
        key = 'storage';
        valueEn = `${sku.attributes.storage} storage`;
        valueAr = `سعة ${sku.attributes.storage}`;
      } else {
        key = 'price';
        valueEn = 'good price';
        valueAr = 'سعر جيد';
      }

      return {
        offerId: offer.id,
        citedAttributeKey: key,
        whyEn: idx === 0 ? `Cheapest match — ${valueEn}` : `Strong match — ${valueEn}`,
        whyAr: idx === 0 ? `أفضل سعر — ${valueAr}` : `مطابقة قوية — ${valueAr}`,
      };
    });
  }

  // ---- helpers (pure, deterministic) ----

  private extractIntent(raw: string): IntentNormalized {
    const t = raw.toLowerCase();
    const intent: IntentNormalized = { constraints: {} };

    if (/iphone|آيفون|ايفون/.test(t)) {
      intent.category = 'smartphone';
      intent.brand = 'Apple';
      const m = t.match(/iphone\s*(\d{2})\s*(pro max|pro|plus)?/);
      if (m) intent.model = `iPhone ${m[1]}${m[2] ? ' ' + this.titleCase(m[2]) : ''}`.trim();
      if (/pro max|برو ماكس/.test(t)) intent.model = intent.model?.includes('Pro Max') ? intent.model : 'iPhone 17 Pro Max';
    } else if (/macbook|ماك بوك|ماكبوك/.test(t)) {
      intent.category = 'laptop';
      intent.brand = 'Apple';
      if (/air/.test(t)) intent.model = 'MacBook Air';
      else if (/pro/.test(t)) intent.model = 'MacBook Pro';
    } else if (/galaxy|samsung|سامسونج|جالاكسي|قالاكسي/.test(t)) {
      intent.category = 'smartphone';
      intent.brand = 'Samsung';
      if (/s\s*25\s*ultra|ultra/.test(t)) intent.model = 'Galaxy S25 Ultra';
      else if (/s\s*25/.test(t)) intent.model = 'Galaxy S25';
    } else if (/dell|ديل|xps/.test(t)) {
      intent.category = 'laptop';
      intent.brand = 'Dell';
      if (/xps/.test(t)) intent.model = 'XPS 13';
    } else if (/laptop|لابتوب|لاب توب/.test(t)) {
      intent.category = 'laptop';
    } else if (/tv|تلفزيون|تلفاز/.test(t)) {
      intent.category = 'tv';
    } else if (
      /\b(flat|apartment|studio|rent|bedroom|villa|property|realestate|real estate)\b|شقة|شقه|للايجار|للإيجار|غرفة|غرفتين|استوديو|عقار|سكن|مفروشة/.test(
        t,
      )
    ) {
      // REAL ESTATE sector (ADR-006). The whole query is the area/rooms intent the social lane matches.
      intent.category = 'realestate';
      intent.model = raw.trim();
    } else if (
      /\b(food|restaurant|meal|chicken|burger|pizza|kfc|shawarma|kebab|tikka|kababji|hardees|sushi|wrap|grill|meal prep|dessert|cake|coffee)\b|طعام|مطعم|دجاج|برجر|بيتزا|شاورما|كباب|حلى|كيك|قهوة|وجبات/.test(
        t,
      )
    ) {
      // FOOD sector (ADR-005/006). The whole query is the dish/restaurant term discovery searches on.
      intent.category = 'food';
      intent.model = raw.trim();
    }

    const storage = t.match(/(\d{2,4})\s*(gb|tb|جيجا|تيرا)/);
    if (storage) intent.constraints.storage = `${storage[1]}${/tb|تيرا/.test(storage[2]) ? 'TB' : 'GB'}`;

    if (/black|أسود|اسود/.test(t)) intent.constraints.color = 'black';
    else if (/blue|أزرق|ازرق/.test(t)) intent.constraints.color = 'blue';
    else if (/white|أبيض|ابيض/.test(t)) intent.constraints.color = 'white';

    const budget = t.match(/(\d{2,5})\s*(kwd|kd|دينار|د\.ك)/);
    if (budget) intent.constraints.budgetFils = parseInt(budget[1], 10) * 1000;

    return intent;
  }

  private hasDimension(intent: IntentNormalized, dim: string): boolean {
    if (dim === 'budget') return intent.constraints.budgetFils != null;
    return intent.constraints[dim] != null;
  }

  private questionFor(dim: string) {
    const map: Record<string, { textAr: string; textEn: string; chips: { value: string; labelAr: string; labelEn: string }[] }> = {
      storage: {
        textAr: 'ما السعة التخزينية التي تريدها؟',
        textEn: 'Which storage size do you want?',
        chips: [
          { value: '128GB', labelAr: '128 جيجا', labelEn: '128GB' },
          { value: '256GB', labelAr: '256 جيجا', labelEn: '256GB' },
          { value: '512GB', labelAr: '512 جيجا', labelEn: '512GB' },
        ],
      },
      color: {
        textAr: 'ما اللون المفضّل؟',
        textEn: 'Preferred color?',
        chips: [
          { value: 'black', labelAr: 'أسود', labelEn: 'Black' },
          { value: 'blue', labelAr: 'أزرق', labelEn: 'Blue' },
          { value: 'white', labelAr: 'أبيض', labelEn: 'White' },
        ],
      },
      budget: {
        textAr: 'ما ميزانيتك التقريبية بالدينار؟',
        textEn: 'What is your approximate budget in KWD?',
        chips: [
          { value: '300', labelAr: 'حتى 300', labelEn: 'Up to 300' },
          { value: '400', labelAr: 'حتى 400', labelEn: 'Up to 400' },
          { value: '500', labelAr: 'حتى 500', labelEn: 'Up to 500' },
        ],
      },
    };
    return { dimension: dim, ...map[dim] };
  }

  private dimAr(dim: string): string {
    return dim === 'storage' ? 'سعة' : dim === 'color' ? 'لون' : dim;
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

const ANY = { value: '__skip__', labelAr: 'لا يهم', labelEn: 'Any' };

/**
 * Canned SMART per-query clarifier sets — deterministic stand-in for Claude's tailored generation.
 * The KEY proof: a laptop asks use_case/ram/screen (NOT phone storage/color); rice asks rice_dish/
 * protein/spice. Each set has ≥5 query-specific dimensions. Used offline + by tests/screenshots.
 */
const MOCK_SETS: Record<string, ClarifierQuestionDraft[]> = {
  laptop: [
    {
      dimension: 'use_case',
      textAr: 'لأي استخدام؟',
      textEn: 'What will you use it for?',
      chips: [
        { value: 'gaming', labelAr: 'ألعاب', labelEn: 'Gaming' },
        { value: 'work', labelAr: 'عمل', labelEn: 'Work' },
        { value: 'study', labelAr: 'دراسة', labelEn: 'Study' },
        ANY,
      ],
    },
    {
      dimension: 'ram',
      textAr: 'كم الذاكرة (RAM)؟',
      textEn: 'How much RAM?',
      chips: [
        { value: '8GB', labelAr: '8 جيجابايت', labelEn: '8 GB' },
        { value: '16GB', labelAr: '16 جيجابايت', labelEn: '16 GB' },
        { value: '32GB', labelAr: '32 جيجابايت', labelEn: '32 GB' },
        ANY,
      ],
    },
    {
      dimension: 'screen_size',
      textAr: 'كم حجم الشاشة؟',
      textEn: 'Which screen size?',
      chips: [
        { value: '13', labelAr: '13 بوصة', labelEn: '13"' },
        { value: '15', labelAr: '15 بوصة', labelEn: '15"' },
        { value: '17', labelAr: '17 بوصة', labelEn: '17"' },
        ANY,
      ],
    },
    {
      dimension: 'budget',
      textAr: 'كم ميزانيتك؟ (بالدينار)',
      textEn: 'What is your budget? (KWD)',
      chips: [
        { value: '200', labelAr: 'أقل من 200', labelEn: '< 200 KWD' },
        { value: '350', labelAr: '200–350', labelEn: '200–350 KWD' },
        { value: '999', labelAr: '350+', labelEn: '350+ KWD' },
      ],
    },
    {
      dimension: 'brand',
      textAr: 'أي ماركة تفضل؟',
      textEn: 'Preferred brand?',
      chips: [
        { value: 'Apple', labelAr: 'Apple', labelEn: 'Apple' },
        { value: 'Dell', labelAr: 'Dell', labelEn: 'Dell' },
        { value: 'HP', labelAr: 'HP', labelEn: 'HP' },
        ANY,
      ],
    },
  ],
  iphone: [
    {
      dimension: 'storage',
      textAr: 'كم سعة التخزين؟',
      textEn: 'How much storage?',
      chips: [
        { value: '128GB', labelAr: '128 جيجابايت', labelEn: '128 GB' },
        { value: '256GB', labelAr: '256 جيجابايت', labelEn: '256 GB' },
        { value: '512GB', labelAr: '512 جيجابايت', labelEn: '512 GB' },
        ANY,
      ],
    },
    {
      dimension: 'color',
      textAr: 'أي لون؟',
      textEn: 'Which color?',
      chips: [
        { value: 'black', labelAr: 'أسود', labelEn: 'Black' },
        { value: 'white', labelAr: 'أبيض', labelEn: 'White' },
        { value: 'natural', labelAr: 'طبيعي', labelEn: 'Natural' },
        ANY,
      ],
    },
    {
      dimension: 'budget',
      textAr: 'كم ميزانيتك؟ (بالدينار)',
      textEn: 'What is your budget? (KWD)',
      chips: [
        { value: '200', labelAr: 'أقل من 200', labelEn: '< 200 KWD' },
        { value: '350', labelAr: '200–350', labelEn: '200–350 KWD' },
        { value: '999', labelAr: '350+', labelEn: '350+ KWD' },
      ],
    },
    {
      dimension: 'condition',
      textAr: 'جديد أو مستعمل؟',
      textEn: 'New or used?',
      chips: [
        { value: 'new', labelAr: 'جديد', labelEn: 'New' },
        { value: 'used', labelAr: 'مستعمل', labelEn: 'Used' },
        ANY,
      ],
    },
    {
      dimension: 'applecare',
      textAr: 'تريد ضمان AppleCare؟',
      textEn: 'Want AppleCare?',
      chips: [
        { value: 'yes', labelAr: 'نعم', labelEn: 'Yes' },
        { value: 'no', labelAr: 'لا', labelEn: 'No' },
        ANY,
      ],
    },
  ],
  rice: [
    {
      dimension: 'rice_dish',
      textAr: 'أي طبق أرز؟',
      textEn: 'Which rice dish?',
      chips: [
        { value: 'biryani', labelAr: 'برياني', labelEn: 'Biryani' },
        { value: 'machboos', labelAr: 'مجبوس', labelEn: 'Machboos' },
        { value: 'rice bowl', labelAr: 'رايس بول', labelEn: 'Rice bowl' },
        ANY,
      ],
    },
    {
      dimension: 'protein',
      textAr: 'أي بروتين؟',
      textEn: 'Which protein?',
      chips: [
        { value: 'chicken', labelAr: 'دجاج', labelEn: 'Chicken' },
        { value: 'meat', labelAr: 'لحم', labelEn: 'Meat' },
        { value: 'fish', labelAr: 'سمك', labelEn: 'Fish' },
        ANY,
      ],
    },
    {
      dimension: 'spice',
      textAr: 'درجة البهارات؟',
      textEn: 'Spice level?',
      chips: [
        { value: 'mild', labelAr: 'خفيف', labelEn: 'Mild' },
        { value: 'medium', labelAr: 'وسط', labelEn: 'Medium' },
        { value: 'hot', labelAr: 'حار', labelEn: 'Hot' },
        ANY,
      ],
    },
    {
      dimension: 'portion',
      textAr: 'لكم شخص؟',
      textEn: 'For how many people?',
      chips: [
        { value: '1', labelAr: '1', labelEn: '1' },
        { value: '2', labelAr: '2', labelEn: '2' },
        { value: '3-4', labelAr: '3–4', labelEn: '3–4' },
        { value: '5+', labelAr: '5+', labelEn: '5+' },
      ],
    },
    {
      dimension: 'budget',
      textAr: 'كم ميزانية الطلب؟ (بالدينار)',
      textEn: 'Budget for the order? (KWD)',
      chips: [
        { value: '5', labelAr: 'أقل من 5', labelEn: '< 5 KWD' },
        { value: '10', labelAr: '5–10', labelEn: '5–10 KWD' },
        { value: '999', labelAr: '10+', labelEn: '10+ KWD' },
      ],
    },
  ],
  flat: [
    {
      dimension: 'tenure',
      textAr: 'إيجار أو تمليك؟',
      textEn: 'Rent or buy?',
      chips: [
        { value: 'rent', labelAr: 'إيجار', labelEn: 'Rent' },
        { value: 'buy', labelAr: 'تمليك', labelEn: 'Buy' },
      ],
    },
    {
      dimension: 'bedrooms',
      textAr: 'كم غرفة نوم؟',
      textEn: 'How many bedrooms?',
      chips: [
        { value: 'studio', labelAr: 'استوديو', labelEn: 'Studio' },
        { value: '1', labelAr: '1', labelEn: '1' },
        { value: '2', labelAr: '2', labelEn: '2' },
        { value: '3+', labelAr: '3+', labelEn: '3+' },
      ],
    },
    {
      dimension: 'budget',
      textAr: 'كم الميزانية الشهرية؟ (بالدينار)',
      textEn: 'Monthly budget? (KWD)',
      chips: [
        { value: '250', labelAr: 'أقل من 250', labelEn: '< 250 KWD' },
        { value: '400', labelAr: '250–400', labelEn: '250–400 KWD' },
        { value: '999', labelAr: '400+', labelEn: '400+ KWD' },
      ],
    },
    {
      dimension: 'furnished',
      textAr: 'مفروشة أو غير مفروشة؟',
      textEn: 'Furnished or unfurnished?',
      chips: [
        { value: 'furnished', labelAr: 'مفروشة', labelEn: 'Furnished' },
        { value: 'unfurnished', labelAr: 'غير مفروشة', labelEn: 'Unfurnished' },
        ANY,
      ],
    },
    {
      dimension: 'amenities',
      textAr: 'متطلبات: موقف، مصعد، مسبح؟',
      textEn: 'Parking / elevator / pool?',
      chips: [
        { value: 'parking', labelAr: 'موقف', labelEn: 'Parking' },
        { value: 'elevator', labelAr: 'مصعد', labelEn: 'Elevator' },
        { value: 'pool', labelAr: 'مسبح', labelEn: 'Pool' },
        ANY,
      ],
    },
  ],
};
