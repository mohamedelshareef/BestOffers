import { Logger } from '@nestjs/common';

/** DI token for the active OtpSender impl (selected by OTP_PROVIDER). */
export const OTP_SENDER = Symbol('OTP_SENDER');

export interface OtpSendInput {
  phoneE164: string; // +965…
  code: string; // plaintext code to deliver — NEVER logged
  locale: 'ar' | 'en';
  channel: 'whatsapp' | 'sms';
}

/**
 * FROZEN interface (ADR-004 Decision 1). The orchestrator tries channel:'whatsapp' first; on a
 * thrown error it retries via channel:'sms' (SMS fallback). Real impls send a pre-approved WhatsApp
 * authentication template. `send` returns a provider message id; it MUST throw on hard failure so
 * the caller can fall back.
 *
 * OTP_PROVIDER = 'mock' | 'meta_whatsapp' | 'twilio' | '360dialog'.
 */
export interface OtpSender {
  send(input: OtpSendInput): Promise<{ messageId: string; channel: 'whatsapp' | 'sms' }>;
  health(): Promise<{ ok: boolean }>;
}

/**
 * Offline default. Logs "DEV OTP for +965… = <code>" so the dev can read it, returns a fixed
 * messageId, never touches the network. In dev, verify also accepts the universal OTP_DEV_CODE
 * (default 000000) so the flow works with no provider at all.
 */
export class MockOtpSender implements OtpSender {
  private readonly logger = new Logger('MockOtpSender');

  async send(input: OtpSendInput): Promise<{ messageId: string; channel: 'whatsapp' | 'sms' }> {
    // Dev convenience: surface the code in server logs (real impls never log the code).
    this.logger.log(`DEV OTP for ${input.phoneE164} = ${input.code} (channel=${input.channel})`);
    return { messageId: `mock_${Date.now()}`, channel: input.channel };
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
