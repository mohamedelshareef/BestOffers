import type { SearchResponse } from '@bestoffers/shared';
import { PaywallRequired, SearchClient } from '../api/searchClient';
import { BlockedSearch } from './resume';

/**
 * D1 (HIGH) regression: after subscribing, the resume must deliver the EXACT blocked result set —
 * the final clarifier answer that 402'd at the value-delivery moment — NOT restart the clarifier flow
 * (F-D2 AC-5: "runs as the first unlimited search, no re-typing"). These are pure-logic tests of the
 * BlockedSearch replay used by the intent screen; fetch is faked (offline).
 */
const cards = (id: string): SearchResponse =>
  ({ searchSessionId: id, state: 'results', clarifierCount: 2, cards: [{ offerId: 'o1' } as any] } as SearchResponse);

describe('BlockedSearch — post-subscribe resume delivers the blocked results', () => {
  it('captures the blocked call and resume replays THAT same call (not a fresh intent)', async () => {
    const blocked = new BlockedSearch();
    let answerCalls = 0;
    let intentCalls = 0;
    // Simulate: the FINAL clarifier answer is what got blocked by the gate.
    const answerCall = async (): Promise<SearchResponse> => {
      answerCalls += 1;
      if (answerCalls === 1) throw new PaywallRequired({ error: 'PAYWALL', used: 5, limit: 5 });
      return cards('session-42'); // post-subscribe replay resolves to the blocked result set
    };
    const intentCall = async (): Promise<SearchResponse> => {
      intentCalls += 1;
      return { searchSessionId: 's', state: 'clarifying', clarifierCount: 0, questions: [] } as any;
    };

    // 1) the answer 402s → captured
    await expect(blocked.run(answerCall)).rejects.toBeInstanceOf(PaywallRequired);
    expect(blocked.pending).toBe(true);

    // 2) resume replays the SAME answer call → lands on results; never touches the intent (no re-typing)
    const resumed = await blocked.resume();
    expect(resumed?.state).toBe('results');
    expect(resumed?.searchSessionId).toBe('session-42');
    expect(answerCalls).toBe(2); // the answer call was replayed
    expect(intentCalls).toBe(0); // clarifier flow was NOT restarted
    expect(blocked.pending).toBe(false); // single-shot
  });

  it('resume preserves the resolved searchSessionId end-to-end through SearchClient', async () => {
    // Backend gives 402 on the metered answer, then (after subscribe) returns the resolved cards for
    // the SAME session id. Prove the client replays the identical /search/answer body.
    const bodies: any[] = [];
    let n = 0;
    const fetchImpl = (async (_url: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      n += 1;
      if (n === 1) return { ok: false, status: 402, json: async () => ({ error: 'PAYWALL', used: 5, limit: 5 }) };
      return { ok: true, status: 200, json: async () => cards('sess-9') };
    }) as unknown as typeof fetch;
    const client = new SearchClient('http://api', fetchImpl, () => 'tok');
    const blocked = new BlockedSearch();

    const call = () => client.submitAnswer({ searchSessionId: 'sess-9', dimension: 'budget', answer: '500' }, 'p');
    await expect(blocked.run(call)).rejects.toBeInstanceOf(PaywallRequired);
    const resumed = await blocked.resume();

    expect(resumed?.state).toBe('results');
    expect(bodies).toHaveLength(2);
    // Identical request replayed verbatim — same session, same dimension/answer (no re-typing).
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1].searchSessionId).toBe('sess-9');
  });

  it('a non-paywall error does NOT capture a blocked call', async () => {
    const blocked = new BlockedSearch();
    await expect(blocked.run(async () => { throw new Error('500'); })).rejects.toThrow('500');
    expect(blocked.pending).toBe(false);
    expect(await blocked.resume()).toBeNull();
  });
});
