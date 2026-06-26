import type {
  AnswerRequest,
  IntentRequest,
  PaywallError,
  SearchResponse,
} from '@bestoffers/shared';

/** Thrown when the backend gate returns 402 PAYWALL (F-D2). Carries the {used,limit} body so the
 *  screen can preserve the blocked intent and route to the paywall. */
export class PaywallRequired extends Error {
  constructor(public readonly info: PaywallError) {
    super('PAYWALL');
  }
}

/**
 * Thin client for the Slice 3 search contract. UI-agnostic and testable without an Expo runtime.
 * Inject `fetchImpl` in tests (offline). When a `tokenProvider` yields an access token it is attached
 * as `Authorization: Bearer <access>` — authed searches are metered (5 free, then 402 PAYWALL).
 */
export class SearchClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly tokenProvider: () => string | null = () => null,
  ) {}

  async startIntent(req: IntentRequest, pseudoId: string): Promise<SearchResponse> {
    return this.post('/search/intent', { ...req, pseudoId });
  }

  async submitAnswer(req: AnswerRequest, pseudoId: string): Promise<SearchResponse> {
    return this.post('/search/answer', { ...req, pseudoId });
  }

  private async post(path: string, body: unknown): Promise<SearchResponse> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = this.tokenProvider();
    if (token) headers['authorization'] = `Bearer ${token}`;
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (res.status === 402) {
      const info = (await res.json()) as PaywallError;
      throw new PaywallRequired(info);
    }
    if (!res.ok) {
      throw new Error(`search request failed: ${res.status}`);
    }
    return (await res.json()) as SearchResponse;
  }
}
