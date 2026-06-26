import { AccountsClient, ApiError, userIdFromMockCheckoutUrl } from './accountsClient';

/**
 * Offline smoke tests for the Phase-2b accounts/auth/billing client: it attaches the Bearer token to
 * guarded calls, omits it on auth endpoints, surfaces typed ApiError on non-ok, and the mock
 * checkout URL → userId parse (paywall self-confirm) is correct. fetch is faked — no API, no network.
 */
describe('AccountsClient', () => {
  function fakeFetch(captured: any[], status = 200, json: any = {}) {
    return (async (url: any, init: any) => {
      captured.push({ url, method: init.method, headers: init.headers, body: init.body && JSON.parse(init.body) });
      return { ok: status < 400, status, json: async () => json } as any;
    }) as unknown as typeof fetch;
  }

  it('attaches Authorization: Bearer on guarded calls', async () => {
    const calls: any[] = [];
    const client = new AccountsClient('http://api', () => 'tok-123', fakeFetch(calls, 200, { used: 2, limit: 5, premium: false }));
    await client.getQuota();
    expect(calls[0].url).toBe('http://api/me/quota');
    expect(calls[0].headers.authorization).toBe('Bearer tok-123');
  });

  it('does NOT attach a token on the auth endpoints', async () => {
    const calls: any[] = [];
    const client = new AccountsClient('http://api', () => 'tok-123', fakeFetch(calls));
    await client.verifyOtp('+96550000000', '000000');
    expect(calls[0].url).toBe('http://api/auth/otp/verify');
    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[0].body).toEqual({ phoneE164: '+96550000000', code: '000000' });
  });

  it('throws a typed ApiError carrying the status', async () => {
    const calls: any[] = [];
    const client = new AccountsClient('http://api', () => null, fakeFetch(calls, 401, { message: 'unauthorized' }));
    await expect(client.getProfile()).rejects.toBeInstanceOf(ApiError);
    await expect(client.getProfile()).rejects.toMatchObject({ status: 401 });
  });

  it('parses the userId out of the mock checkout URL', () => {
    expect(userIdFromMockCheckoutUrl('mock-checkout://confirm?user=u_42&customer=c_1')).toBe('u_42');
    expect(userIdFromMockCheckoutUrl('mock-checkout://confirm?user=a%40b&customer=c')).toBe('a@b');
    expect(userIdFromMockCheckoutUrl('mock-checkout://confirm?customer=c')).toBeNull();
  });
});
