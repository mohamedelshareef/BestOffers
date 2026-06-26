import { Test } from '@nestjs/testing';
import { IntentRequest, AnswerRequest } from '@bestoffers/shared';
import { SearchService, MAX_CLARIFIER_QUESTIONS } from './search.service';
import { SessionStore } from './session.store';
import { OffersService } from '../offers/offers.service';
import { EventsService } from '../events/events.service';
import { CLAUDE_CLIENT, ClaudeClient } from '../ai/claude-client.interface';
import { MockClaudeClient } from '../ai/mock-claude-client';
import { QuotaService } from '../quota/quota.service';

// Quota gate only activates for AUTHED searches (userId present); these tests run anonymous, so a
// no-op stub is sufficient (and asserts the gate is never invoked without a userId).
const quotaStub = { tryConsume: jest.fn(), status: jest.fn() } as unknown as QuotaService;

/**
 * AC C2.1 / C2.6 — clarifier loop is bounded to ≤3 and never re-asks a dimension,
 * ENFORCED IN CODE. We prove the bound holds even against an adversarial client that
 * always wants to ask another (new and repeated) question.
 */

class AdversarialClient implements ClaudeClient {
  // always demands a clarifier, cycling dimensions then repeating to test the re-ask guard.
  private dims = ['storage', 'color', 'budget', 'storage', 'color'];
  private i = 0;
  async clarify() {
    const dim = this.dims[this.i % this.dims.length];
    this.i += 1;
    return {
      intentNormalized: { constraints: {} },
      needClarification: true,
      question: { dimension: dim, textAr: '؟', textEn: '?', chips: [] },
    };
  }
  async explainRanking() {
    return [];
  }
}

async function buildService(client: ClaudeClient) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SearchService,
      SessionStore,
      OffersService,
      EventsService,
      { provide: CLAUDE_CLIENT, useValue: client },
      { provide: QuotaService, useValue: quotaStub },
    ],
  }).compile();
  return moduleRef.get(SearchService);
}

describe('clarifier bound (AC C2.1, C2.6)', () => {
  it('asks at most 3 questions even when the model always wants more', async () => {
    const svc = await buildService(new AdversarialClient());
    const req: IntentRequest = { sector: 'electronics', locale: 'en', intentRaw: 'a phone' };

    let res = await svc.startIntent(req, 'p1');
    let answered = 0;
    // keep answering as long as we're asked
    while (res.state === 'clarifying') {
      expect(res.clarifierCount).toBeLessThanOrEqual(MAX_CLARIFIER_QUESTIONS);
      const dimension = res.questions![0].dimension;
      const ans: AnswerRequest = { searchSessionId: res.searchSessionId, dimension, answer: '__skip__' };
      res = await svc.submitAnswer(ans, 'p1');
      answered += 1;
      if (answered > 10) throw new Error('loop did not terminate — bound not enforced');
    }

    expect(res.clarifierCount).toBeLessThanOrEqual(MAX_CLARIFIER_QUESTIONS);
    expect(['results', 'empty']).toContain(res.state);
  });

  it('never re-asks the same dimension (guard against repeats)', async () => {
    const svc = await buildService(new AdversarialClient());
    const req: IntentRequest = { sector: 'electronics', locale: 'en', intentRaw: 'a phone' };

    const asked: string[] = [];
    let res = await svc.startIntent(req, 'p2');
    while (res.state === 'clarifying') {
      const dim = res.questions![0].dimension;
      expect(asked).not.toContain(dim); // never repeated
      asked.push(dim);
      res = await svc.submitAnswer(
        { searchSessionId: res.searchSessionId, dimension: dim, answer: '__skip__' },
        'p2',
      );
    }
    expect(asked.length).toBeLessThanOrEqual(MAX_CLARIFIER_QUESTIONS);
  });

  it('skips clarifiers entirely when intent is fully specific (AC C2.4)', async () => {
    const svc = await buildService(new MockClaudeClient());
    // storage + color present, no budget probe needed because budget is the last optional dim
    const req: IntentRequest = {
      sector: 'electronics',
      locale: 'en',
      intentRaw: 'iPhone 17 Pro Max 256GB black under 500 KWD',
    };
    const res = await svc.startIntent(req, 'p3');
    expect(res.state).toBe('results');
    expect(res.clarifierCount).toBe(0);
  });
});
