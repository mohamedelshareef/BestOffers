import type {
  BillingStatus,
  CheckoutResponse,
  Locale,
  OtpChannel,
  OtpRequestResponse,
  OtpVerifyResponse,
  Profile,
  ProfileUpdate,
  QuotaStatus,
  SubStatus,
} from '@bestoffers/shared';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Client for the Phase-2a Accounts/Auth/Billing/Freemium endpoints. UI-agnostic + testable offline
 * (inject fetchImpl + tokenProvider). Attaches `Authorization: Bearer <access>` to every guarded
 * call by reading `tokenProvider()` at request time (so it always uses the freshest token).
 */
export class AccountsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenProvider: () => string | null = () => null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  // ── Auth / OTP (F-C1) ──
  requestOtp(phoneE164: string, locale: Locale, channel: OtpChannel): Promise<OtpRequestResponse> {
    return this.send('POST', '/auth/otp/request', { phoneE164, locale, channel }, false);
  }
  verifyOtp(phoneE164: string, code: string): Promise<OtpVerifyResponse> {
    return this.send('POST', '/auth/otp/verify', { phoneE164, code }, false);
  }
  refresh(refresh: string): Promise<{ access: string; refresh: string; pseudoId?: string }> {
    return this.send('POST', '/auth/refresh', { refresh }, false);
  }

  // ── Profile (F-A1/A2/A3) ──
  getProfile(): Promise<Profile> {
    return this.send('GET', '/me');
  }
  updateProfile(body: ProfileUpdate): Promise<Profile & { emailVerifyToken?: string }> {
    return this.send('PATCH', '/me', body);
  }
  uploadAvatar(base64: string, contentType: string): Promise<{ avatarUrl: string }> {
    return this.send('POST', '/me/avatar', { base64, contentType });
  }
  verifyEmail(token: string): Promise<Profile> {
    return this.send('POST', '/me/email-verify', { token });
  }

  // ── Freemium (F-D2) ──
  getQuota(): Promise<QuotaStatus> {
    return this.send('GET', '/me/quota');
  }

  // ── Billing (F-D1) ──
  billingStatus(): Promise<BillingStatus> {
    return this.send('GET', '/billing/status');
  }
  checkout(): Promise<CheckoutResponse> {
    return this.send('POST', '/billing/checkout', {});
  }
  /**
   * Mock-mode webhook driver. In a real build Stripe calls /billing/webhook directly; in the keyless
   * demo the app self-confirms so the journey is clickable end-to-end (dev affordance). `userId` is
   * parsed from the mock checkout URL (`mock-checkout://confirm?user=<id>`).
   */
  webhook(type: string, userId: string, status?: SubStatus): Promise<{ applied: boolean }> {
    return this.send('POST', '/billing/webhook', { type, userId, status }, false);
  }

  private async send<T>(
    method: string,
    path: string,
    body?: unknown,
    authed = true,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (authed) {
      const token = this.tokenProvider();
      if (token) headers['authorization'] = `Bearer ${token}`;
    }
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = `${method} ${path} → ${res.status}`;
      try {
        const j = await res.json();
        if (j?.message) detail = Array.isArray(j.message) ? j.message.join(', ') : j.message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }
}

/** Extract the userId the mock checkout URL embeds, so the demo can self-confirm the subscription. */
export function userIdFromMockCheckoutUrl(url: string): string | null {
  const m = /[?&]user=([^&]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}
