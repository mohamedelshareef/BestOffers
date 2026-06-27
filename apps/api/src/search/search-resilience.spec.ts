import { SearchService } from './search.service';
import { SessionStore } from './session.store';
import { EventsService } from '../events/events.service';
import { ClaudeClient } from '../ai/claude-client.interface';
import { OffersService, ResolvedOffer } from '../offers/offers.service';
import { QuotaService } from '../quota/quota.service';
import { skipToTerminal } from './clarifier-test-util';
import { IntentNormalized, Offer, Sku } from '@bestoffers/shared';

/**
 * Regression tests for the v2 device-QA HIGH defects (qa-v2-device-report):
 *   - D-V2-1: a food search must NOT 500 / return 0 cards when the model's explainRanking call fails
 *     (max_tokens / refusal). The "why" text is the only model-authored field; a failure must degrade
 *     to a data-only why, never abort the search.
 *   - D-V2-1 (#2): food/realestate are DISCOVERY sectors → never ask electronics clarifiers.
 *   - D-V2-2: a genuine empty result must carry ≥1 `broadenSuggestions` (F-SR1 AC-14) — never a bare 0.
 */

function intent(over: Partial<IntentNormalized> = {}): IntentNormalized {
  return { category: 'food', brand: null, model: 'kfc', constraints: {}, ...over } as IntentNormalized;
}

/** A Claude stub whose clarify returns a (would-be electronics) question, and explainRanking THROWS. */
function flakyClaude(opts: { clarifyAsks: boolean; explainThrows: boolean }): ClaudeClient {
  return {
    async clarify() {
      return {
        intentNormalized: intent(),
        needClarification: opts.clarifyAsks,
        question: opts.clarifyAsks
          ? { dimension: 'storage', textAr: 's', textEn: 's', chips: [{ value: 'a', labelAr: 'a', labelEn: 'a' }] }
          : undefined,
      };
    },
    async clarifierSet() {
      return []; // no smart set → deterministic config fallback (keeps this resilience test stable)
    },
    async explainRanking() {
      if (opts.explainThrows) throw new Error('Claude stop_reason=max_tokens — no usable tool output');
      return [];
    },
  };
}

function oneFoodOffer(): ResolvedOffer {
  const sku: Sku = {
    id: 'dish_prov_talabat_1', category: 'food', canonicalName: 'Zinger Meal — Kfc',
    brand: 'Kfc', model: 'Zinger Meal — Kfc', attributes: { currency: 'KWD', sector: 'food' },
  };
  const offer: Offer = {
    id: 'off_prov_talabat_1', skuId: sku.id, providerId: 'prov_talabat', providerName: 'Talabat',
    priceFils: 2000, inStock: true, deeplinkUrl: 'https://www.talabat.com/kuwait/kfc',
    source: 'live', fetchedAt: '2026-06-26T12:00:00.000Z',
  };
  return { offer, sku };
}

function makeService(claude: ClaudeClient, resolved: ResolvedOffer[]): SearchService {
  const offers = {
    resolveOffers: async () => resolved,
    resolveBroadened: async () => resolved,
  } as unknown as OffersService;
  const quota = { tryConsume: async () => ({ allowed: true, used: 1 }) } as unknown as QuotaService;
  return new SearchService(claude, offers, new SessionStore(), new EventsService(), quota);
}

describe('Search resilience (v2 HIGH defect fixes)', () => {
  it('D-V2-1: explainRanking throwing does NOT 500 — food still returns cards with a data-only why', async () => {
    const svc = makeService(flakyClaude({ clarifyAsks: false, explainThrows: true }), [oneFoodOffer()]);
    // ≥5 gate: food now asks ≥5 clarifiers too (OWNER DIRECTIVE 2026-06-26); skip through to results.
    const res = await skipToTerminal(svc, await svc.startIntent({ sector: 'food', locale: 'en', intentRaw: 'kfc' }, 'p1'), 'p1');
    expect(res.state).toBe('results');
    expect(res.cards).toHaveLength(1);
    // data-only fallback "why" (price at provider), never blank, never invented
    expect(res.cards![0].priceFils).toBe(2000);
    expect(res.cards![0].whyEn).toContain('Talabat');
    expect(res.cards![0].deeplinkUrl).toBe('https://www.talabat.com/kuwait/kfc');
  });

  it('≥5 GATE: food now asks ≥5 clarifiers before search (SUPERSEDES the old discovery skip)', async () => {
    // OWNER DIRECTIVE 2026-06-26: food/realestate are NO LONGER no-clarifier discovery sectors — every
    // sector presents ≥5 dimensions before any provider dispatch. "kfc" pre-resolves `dish` (the raw
    // query) so 4 more questions are asked → 5 presented total before results.
    const svc = makeService(flakyClaude({ clarifyAsks: false, explainThrows: false }), [oneFoodOffer()]);
    let res = await svc.startIntent({ sector: 'food', locale: 'en', intentRaw: 'kfc' }, 'p1');
    expect(res.state).toBe('clarifying');
    expect(res.totalQuestions).toBeGreaterThanOrEqual(5);
    let presented = 0;
    while (res.state === 'clarifying') {
      presented = res.clarifierCount;
      res = await svc.submitAnswer(
        { searchSessionId: res.searchSessionId, dimension: res.questions![0].dimension, answer: '__skip__' },
        'p1',
      );
    }
    expect(presented).toBeGreaterThanOrEqual(5); // ≥5 presented before search dispatched
    expect(res.state).toBe('results'); // skip-all still searches (never a dead end)
  });

  it('D-V2-2: a genuinely empty food result carries ≥1 broadenSuggestions — never a bare 0', async () => {
    const svc = makeService(flakyClaude({ clarifyAsks: false, explainThrows: false }), []);
    const res = await skipToTerminal(svc, await svc.startIntent({ sector: 'food', locale: 'en', intentRaw: 'zzznotareal' }, 'p1'), 'p1');
    expect(res.state).toBe('empty');
    expect(res.cards).toEqual([]);
    expect(res.broadenSuggestions && res.broadenSuggestions.length).toBeGreaterThanOrEqual(1);
  });
});
