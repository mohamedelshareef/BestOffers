import { SearchResponse } from '@bestoffers/shared';
import { SearchService } from './search.service';

/**
 * Test helper: drive a search session through the ≥5 clarifier gate by SKIPPING every presented
 * question until it reaches a terminal (results/empty) state. Used by specs that only care about the
 * post-clarifier result, now that EVERY sector presents ≥5 questions (OWNER DIRECTIVE 2026-06-26).
 */
export async function skipToTerminal(
  svc: SearchService,
  res: SearchResponse,
  pseudo: string,
  maxSteps = 12,
): Promise<SearchResponse> {
  let cur = res;
  let steps = 0;
  while (cur.state === 'clarifying') {
    if (steps++ > maxSteps) throw new Error('clarifier loop did not terminate (skip-all should search)');
    const dim = cur.questions![0].dimension;
    cur = await svc.submitAnswer(
      { searchSessionId: cur.searchSessionId, dimension: dim, answer: '__skip__' },
      pseudo,
    );
  }
  return cur;
}
