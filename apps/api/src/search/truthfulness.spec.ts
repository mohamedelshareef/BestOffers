import { Test } from '@nestjs/testing';
import { IntentRequest } from '@bestoffers/shared';
import { verifyCitation, TruthfulnessViolationError, citableAttributes } from './truthfulness';
import { RankExplanation, ClaudeClient, CLAUDE_CLIENT } from '../ai/claude-client.interface';
import { MOCK_OFFERS, MOCK_SKUS } from '../offers/mock-offers.dataset';
import { SearchService } from './search.service';
import { skipToTerminal } from './clarifier-test-util';
import { SessionStore } from './session.store';
import { OffersService } from '../offers/offers.service';
import { EventsService } from '../events/events.service';
import { MockClaudeClient } from '../ai/mock-claude-client';
import { QuotaService } from '../quota/quota.service';

// Anonymous search (no userId) → the freemium gate is never invoked; a no-op stub satisfies DI.
const quotaStub = { tryConsume: jest.fn(), status: jest.fn() } as unknown as QuotaService;

/**
 * THE ranking-truthfulness invariant (AC D3.3): every "why this offer" must cite a REAL attribute
 * present in the offer/sku data — never invented. Tested at two levels:
 *   1. the guard (verifyCitation) directly
 *   2. end-to-end: an adversarial client that invents an attribute must NOT corrupt the card.
 */
describe('truthfulness guard (AC D3.3)', () => {
  const offer = MOCK_OFFERS[0];
  const sku = MOCK_SKUS.find((s) => s.id === offer.skuId)!;

  it('accepts an explanation that cites a real, present attribute', () => {
    const ex: RankExplanation = {
      offerId: offer.id,
      citedAttributeKey: 'storage',
      whyEn: '256GB storage',
      whyAr: 'سعة 256',
    };
    const cited = verifyCitation(ex, offer, sku);
    expect(cited).toEqual({ key: 'storage', value: '256GB' });
  });

  it('rejects an explanation that cites an attribute NOT in the data (invented)', () => {
    const ex: RankExplanation = {
      offerId: offer.id,
      citedAttributeKey: 'warranty', // not a citable attribute on this offer/sku
      whyEn: '3-year warranty included',
      whyAr: 'ضمان ٣ سنوات',
    };
    expect(() => verifyCitation(ex, offer, sku)).toThrow(TruthfulnessViolationError);
  });

  it('rejects a real key whose value is empty (no fabrication from blanks)', () => {
    const skuNoColor = { ...sku, attributes: { ...sku.attributes, color: '' } };
    const ex: RankExplanation = {
      offerId: offer.id,
      citedAttributeKey: 'color',
      whyEn: 'nice color',
      whyAr: 'لون جميل',
    };
    expect(() => verifyCitation(ex, offer, skuNoColor)).toThrow(TruthfulnessViolationError);
  });

  it('every citable attribute resolves to a real value from the data', () => {
    const attrs = citableAttributes(offer, sku);
    expect(attrs.price).toBe(String(offer.priceFils));
    expect(attrs.provider).toBe(offer.providerName);
    expect(attrs.storage).toBe('256GB');
  });
});

class InventingClient implements ClaudeClient {
  // mimics the real clarifier so the flow reaches search
  private mock = new MockClaudeClient();
  clarify = this.mock.clarify.bind(this.mock);
  async explainRanking(): Promise<RankExplanation[]> {
    // returns a fabricated attribute for EVERY offer
    return MOCK_OFFERS.map((o) => ({
      offerId: o.id,
      citedAttributeKey: 'freeShipping', // invented — not in the data
      whyEn: 'Free lifetime shipping!',
      whyAr: 'شحن مجاني مدى الحياة!',
    }));
  }
}

describe('end-to-end: invented "why" never reaches a card (AC D3.3)', () => {
  it('falls back to a data-only why citing a real attribute', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        SessionStore,
        OffersService,
        EventsService,
        { provide: CLAUDE_CLIENT, useClass: InventingClient },
        { provide: QuotaService, useValue: quotaStub },
      ],
    }).compile();
    const svc = moduleRef.get(SearchService);

    const req: IntentRequest = {
      sector: 'electronics',
      locale: 'en',
      intentRaw: 'iPhone 17 Pro Max 256GB black under 500 KWD',
    };
    // ≥5 gate (OWNER DIRECTIVE 2026-06-26): a fully-specified intent pre-resolves 4 dims; skip the
    // remaining presented question(s) to reach results. The truthfulness assertion below is unchanged.
    const res = await skipToTerminal(svc, await svc.startIntent(req, 'pX'), 'pX');
    expect(res.state).toBe('results');

    for (const card of res.cards!) {
      // the invented claim must NOT survive
      expect(card.whyEn).not.toMatch(/shipping/i);
      expect(card.whyCitedAttribute.key).not.toBe('freeShipping');
      // whatever it cites must be a real attribute with a real value on that card's offer/sku
      const sku = MOCK_SKUS.find((s) => s.id === card.skuId)!;
      const offer = MOCK_OFFERS.find((o) => o.id === card.offerId)!;
      const attrs = citableAttributes(offer, sku);
      expect(attrs[card.whyCitedAttribute.key]).toBe(card.whyCitedAttribute.value);
      expect(card.whyCitedAttribute.value).not.toBe('');
    }
  });
});
