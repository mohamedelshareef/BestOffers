import { Logger } from '@nestjs/common';
import { OtpSender, OtpSendInput } from '../otp-sender.interface';

/**
 * Twilio sender (config-ready, NOT wired offline). Selected by OTP_PROVIDER=twilio. Handles BOTH
 * WhatsApp (twilio whatsapp: channel) and the SMS fallback in one provider — the simplest fallback
 * path (ADR-004 Decision 1). Uses the REST API over fetch (no SDK) so it only executes when keys
 * exist. Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_SMS_FROM.
 */
export class TwilioOtpSender implements OtpSender {
  private readonly logger = new Logger('TwilioOtpSender');
  private readonly sid = process.env.TWILIO_ACCOUNT_SID;
  private readonly token = process.env.TWILIO_AUTH_TOKEN;
  private readonly waFrom = process.env.TWILIO_WHATSAPP_FROM;
  private readonly smsFrom = process.env.TWILIO_SMS_FROM;

  private assertConfigured(channel: 'whatsapp' | 'sms') {
    if (!this.sid || !this.token) throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN)');
    if (channel === 'whatsapp' && !this.waFrom) throw new Error('TWILIO_WHATSAPP_FROM not set');
    if (channel === 'sms' && !this.smsFrom) throw new Error('TWILIO_SMS_FROM not set');
  }

  async send(input: OtpSendInput): Promise<{ messageId: string; channel: 'whatsapp' | 'sms' }> {
    this.assertConfigured(input.channel);
    const from =
      input.channel === 'whatsapp' ? `whatsapp:${this.waFrom}` : (this.smsFrom as string);
    const to = input.channel === 'whatsapp' ? `whatsapp:${input.phoneE164}` : input.phoneE164;
    const body = new URLSearchParams({ From: from, To: to, Body: `${input.code} is your BestOffers code` });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Twilio send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { messageId: json.sid ?? 'twilio_unknown', channel: input.channel };
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: !!(this.sid && this.token) };
  }
}
