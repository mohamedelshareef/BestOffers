import { SearchService } from './search.service';
import { MIN_CLARIFIER_QUESTIONS } from './clarifier-sets';
import { SessionStore } from './session.store';
import { EventsService } from '../events/events.service';
import { ClaudeClient } from '../ai/claude-client.interface';
import { OffersService, ResolvedOffer } from '../offers/offers.service';
import { QuotaService } from '../quota/quota.service';
import { Offer, Sector, Sku } from '@bestoffers/shared';

/**
 * OWNER DIRECTIVE 2026-06-26 (PO-ratified) — server-authoritative ≥5 clarifier gate.
 * Focused tests for the three contracts the task calls out explicitly:
 *   (1) the ≥5 gate: NO provider dispatch until ≥5 dimensions presented, per sector;
 *   (2) skip-still-searches: skipping all 5 still produces results (never a dead end);
 *   (3) clarifier turns do NOT burn an F-D2 free search (RULE-8): only the final search counts.
 */

function oneOffer(sector: Sector): ResolvedOffer {
  const sku: Sku = {
    id: `sku_${sector}_1`,
    category: sector === 'electronics' ? 'smartphone' : sector,
    canonicalName: 'Test Item',
    brand: 'Brand',
    model: 'Test Item',
    attributes: { sector, area: 'salmiya' },
  };
  const offer: Offer = {
    id: `off_${sector}_1`,
    skuId: sku.id,
    providerId: `prov_${sector}`,
    providerName: 'Provider',
    priceFils: 5000,
    inStock: true,
    deeplinkUrl: 'https://example.com/x',
    source: 'live',
    fetchedAt: '2026-06-26T12:00:00.000Z',
  };
  return { offer, sku };
}

/** Claude stub: only normalizes intent (never drives the loop in the new design). */
const passiveClaude: ClaudeClient = {
  async clarify() {
    return { intentNormalized: { constraints: {} }, needClarification: false };
  },
  async clarifierSet() {
    return []; // no smart set → deterministic config fallback (the ≥5 gate under test)
  },
  async explainRanking() {
    return [];
  },
};

/** A QuotaService spy: counts how many times tryConsume fires (the freemium decrement). */
function spyQuota() {
  const tryConsume = jest.fn(async () => ({ allowed: true, used: 1 }));
  return { svc: { tryConsume } as unknown as QuotaService, tryConsume };
}

function makeService(resolved: ResolvedOffer[], quota: QuotaService): SearchService {
  const offers = {
    resolveOffers: async () => resolved,
    resolveBroadened: async () => resolved,
  } as unknown as OffersService;
  return new SearchService(passiveClaude, offers, new SessionStore(), new EventsService(), quota);
}

describe('≥5 gate — server-authoritative, no provider dispatch until floor met', () => {
  for (const sector of ['electronics', 'food', 'realestate'] as const) {
    it(`${sector}: provider resolveOffers is NOT called until ≥5 dimensions are presented`, async () => {
      const resolveOffers = jest.fn(async () => [oneOffer(sector)]);
      const offers = {
        resolveOffers,
        resolveBroadened: async () => [oneOffer(sector)],
      } as unknown as OffersService;
      const { svc: quota } = spyQuota();
      const svc = new SearchService(passiveClaude, offers, new SessionStore(), new EventsService(), quota);

      let res = await svc.startIntent({ sector, locale: 'en', intentRaw: 'q' }, 'p');
      expect(res.state).toBe('clarifying');
      expect(res.totalQuestions).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);

      let presentedBeforeSearch = 0;
      while (res.state === 'clarifying') {
        // provider search must NOT have fired yet (gate closed)
        expect(resolveOffers).not.toHaveBeenCalled();
        presentedBeforeSearch = res.clarifierCount;
        res = await svc.submitAnswer(
          { searchSessionId: res.searchSessionId, dimension: res.questions![0].dimension, answer: 'x' },
          'p',
        );
      }
      // gate opened only after ≥5 presented
      expect(presentedBeforeSearch).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
      expect(resolveOffers).toHaveBeenCalledTimes(1);
      expect(res.state).toBe('results');
    });
  }
});

describe('skip-still-searches — skipping all 5 never dead-ends', () => {
  for (const sector of ['electronics', 'food', 'realestate'] as const) {
    it(`${sector}: skip every presented question → still reaches a result set`, async () => {
      const { svc: quota } = spyQuota();
      const svc = makeService([oneOffer(sector)], quota);
      let res = await svc.startIntent({ sector, locale: 'en', intentRaw: 'q' }, 'p');
      let presented = 0;
      while (res.state === 'clarifying') {
        presented = res.clarifierCount;
        res = await svc.submitAnswer(
          { searchSessionId: res.searchSessionId, dimension: res.questions![0].dimension, answer: '__skip__' },
          'p',
        );
      }
      expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
      expect(res.state).toBe('results'); // a broad but real set, never an error
      expect(res.cards && res.cards.length).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('RULE-8 — clarifier turns do NOT burn a free search', () => {
  it('the freemium counter increments exactly ONCE (at final search), not per clarifier turn', async () => {
    const { svc: quota, tryConsume } = spyQuota();
    const svc = makeService([oneOffer('electronics')], quota);

    // AUTHED search (userId present) so the gate is active.
    let res = await svc.startIntent({ sector: 'electronics', locale: 'en', intentRaw: 'a phone' }, 'p', 'user-1');
    let turns = 0;
    while (res.state === 'clarifying') {
      // not consumed during any clarifier turn
      expect(tryConsume).not.toHaveBeenCalled();
      turns += 1;
      res = await svc.submitAnswer(
        { searchSessionId: res.searchSessionId, dimension: res.questions![0].dimension, answer: '__skip__' },
        'p',
      );
    }
    expect(turns).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS); // ≥5 clarifier turns happened
    expect(res.state).toBe('results');
    expect(tryConsume).toHaveBeenCalledTimes(1); // exactly one free-search decrement, for the whole flow
  });
});
