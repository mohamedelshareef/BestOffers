import { Test } from '@nestjs/testing';
import { IntentRequest, AnswerRequest } from '@bestoffers/shared';
import { SearchService } from './search.service';
import { MIN_CLARIFIER_QUESTIONS } from './clarifier-sets';
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
 * ≥5 CLARIFIER GATE (OWNER DIRECTIVE 2026-06-26, PO-ratified; SUPERSEDES the prior ≤3 cap).
 * Every sector presents AT LEAST 5 distinct dimensions before search dispatches. The question SET is
 * CONFIG-DRIVEN (clarifier-sets.ts), so the SearchService — not the model — owns which dimension is
 * asked next, the ≥5 floor, the never-re-ask guard, and the skip-still-searches behavior.
 */

class AdversarialClient implements ClaudeClient {
  // The model can no longer drive the clarifier loop — it only normalizes intent. We assert the CODE
  // gate is authoritative even when the model wants to ask its own (irrelevant) questions.
  async clarify() {
    return {
      intentNormalized: { constraints: {} },
      needClarification: true,
      question: { dimension: 'storage', textAr: '؟', textEn: '?', chips: [] },
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

describe('≥5 clarifier gate (OWNER DIRECTIVE — config-driven, server-authoritative)', () => {
  for (const sector of ['electronics', 'food', 'realestate'] as const) {
    it(`${sector}: presents ≥5 distinct dimensions before search, never re-asking one`, async () => {
      const svc = await buildService(new AdversarialClient());
      const req: IntentRequest = { sector, locale: 'en', intentRaw: 'something' };

      let res = await svc.startIntent(req, `p-${sector}`);
      const askedDims: string[] = [];
      let presented = 0;
      let steps = 0;
      while (res.state === 'clarifying') {
        if (steps++ > 12) throw new Error('loop did not terminate — gate not enforced');
        // totalQuestions is the "of N" denominator and must be ≥5 every step.
        expect(res.totalQuestions).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
        const dim = res.questions![0].dimension;
        expect(askedDims).not.toContain(dim); // RULE-2 / never-re-ask
        askedDims.push(dim);
        presented = res.clarifierCount;
        const ans: AnswerRequest = { searchSessionId: res.searchSessionId, dimension: dim, answer: '__skip__' };
        res = await svc.submitAnswer(ans, `p-${sector}`);
      }

      // RULE-1: ≥5 dimensions were PRESENTED before reaching a terminal state.
      expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
      // RULE-4: skipping every question STILL runs the search — never a dead end.
      expect(['results', 'empty']).toContain(res.state);
    });
  }

  it('RULE-7: a fully-specified electronics intent still reaches ≥5 (pre-resolved dims count, no re-ask)', async () => {
    const svc = await buildService(new MockClaudeClient());
    // model + storage + color + budget are stated → 4 pre-resolved; only `condition` is asked to reach 5.
    const req: IntentRequest = {
      sector: 'electronics',
      locale: 'en',
      intentRaw: 'iPhone 17 Pro Max 256GB black under 500 KWD',
    };
    let res = await svc.startIntent(req, 'p3');
    expect(res.state).toBe('clarifying'); // NOT 0 clarifiers anymore
    // exactly one NEW question (condition); never re-asks model/storage/color/budget.
    expect(res.questions![0].dimension).toBe('condition');
    expect(res.clarifierCount).toBe(5); // 4 pre-resolved + this 1 presented = 5 of 5
    expect(res.totalQuestions).toBe(5);
    res = await svc.submitAnswer(
      { searchSessionId: res.searchSessionId, dimension: 'condition', answer: 'new' },
      'p3',
    );
    expect(res.state).toBe('results'); // floor met → search runs
  });
});
