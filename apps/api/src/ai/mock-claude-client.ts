import { Injectable } from '@nestjs/common';
import { IntentNormalized } from '@bestoffers/shared';
import {
  ClarifierInput,
  ClarifierResult,
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
