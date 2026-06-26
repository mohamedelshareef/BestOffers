import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AnswerRequest, IntentRequest, SearchResponse } from '@bestoffers/shared';
import { SearchService } from './search.service';
import { JwtService } from '../auth/jwt.service';

/**
 * Slice 3 contract (system-design):
 *   POST /search/intent  → { state, questions?[] | cards?[] }
 *   POST /search/answer  → next step
 *
 * Auth is OPTIONAL on the search path: a Bearer access token (ADR-004) is verified when present and
 * its `sub`/`pseudo_id` drive the freemium gate (Slice D) — authed users are metered (5 free, then
 * 402 PAYWALL). Anonymous/demo callers (no token) pass a pseudoId in the body and are NOT metered
 * (the gate keys on the canonical account, BA F-D2 AC-2). 402 is thrown by SearchService.runSearch.
 */
@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly jwt: JwtService,
  ) {}

  @Post('intent')
  intent(
    @Body() body: IntentRequest & { pseudoId?: string },
    @Headers('authorization') auth?: string,
  ): Promise<SearchResponse> {
    const ctx = this.resolveAuth(auth);
    return this.search.startIntent(body, ctx?.pseudoId ?? body.pseudoId ?? 'anon-pseudo', ctx?.userId);
  }

  @Post('answer')
  answer(@Body() body: AnswerRequest & { pseudoId?: string }): Promise<SearchResponse> {
    // userId is carried on the session created at /intent, so answer needs no token re-check.
    return this.search.submitAnswer(body, body.pseudoId ?? 'anon-pseudo');
  }

  private resolveAuth(header?: string): { userId: string; pseudoId: string } | undefined {
    if (!header || !header.startsWith('Bearer ')) return undefined;
    try {
      const c = this.jwt.verifyAccess(header.slice('Bearer '.length).trim());
      return { userId: c.sub, pseudoId: c.pseudo_id };
    } catch {
      return undefined; // invalid token → treat as anonymous (demo-friendly); never 500
    }
  }
}
