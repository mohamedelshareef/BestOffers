import { Logger } from '@nestjs/common';
import { OtpSender, OtpSendInput } from '../otp-sender.interface';

/**
 * Twilio WhatsApp/SMS OTP sender — REPLICATES the MohaFootball project's OTP method.
 *
 * WHAT FOOTBALL ACTUALLY DOES (verified in /Football/src/contexts/AuthContext.tsx):
 *   login   → supabase.auth.signInWithOtp({ phone, options: { channel: 'whatsapp' } })
 *   verify  → supabase.auth.verifyOtp({ phone, token, type: 'sms' })
 * i.e. Football does NOT call Twilio directly — it delegates to SUPABASE AUTH's phone-OTP, with the
 * WhatsApp channel selected. Supabase Auth in turn is wired (in the Supabase dashboard → Auth → SMS
 * provider) to TWILIO using TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER, and Supabase
 * delivers the code over Twilio's WhatsApp channel. Football's docs/TODO.md confirms: "Code already
 * calls signInWithOtp({ phone }) — this is config only" (the Twilio creds live in Supabase config).
 *
 * REPLICATION HERE: BestOffers runs its OWN OTP flow (AuthService generates+hashes the code, this sender
 * delivers it), so we reproduce the SAME underlying transport Supabase uses for Football: Twilio's
 * WhatsApp channel. That is a POST to the Twilio Messages REST endpoint with a `whatsapp:` From/To pair
 * — exactly the request Supabase's Twilio-WhatsApp integration issues on Football's behalf. SMS is the
 * fallback (plain From/To, same endpoint), matching verifyOtp's `type:'sms'` lineage.
 *
 * Selected by OTP_PROVIDER=twilio (also covers 360dialog — Twilio-compatible REST). Uses fetch (no SDK)
 * so it only touches the network when keys exist. Env (Football's names, with optional overrides):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  (required)
 *   TWILIO_PHONE_NUMBER                     (Football's single number; used for BOTH WhatsApp + SMS From)
 *   TWILIO_WHATSAPP_FROM / TWILIO_SMS_FROM  (optional per-channel overrides; default to TWILIO_PHONE_NUMBER)
 */
export class TwilioOtpSender implements OtpSender {
  private readonly logger = new Logger('TwilioOtpSender');
  private get sid() { return process.env.TWILIO_ACCOUNT_SID; }
  private get token() { return process.env.TWILIO_AUTH_TOKEN; }
  // Football ships a single TWILIO_PHONE_NUMBER; honour per-channel overrides if present.
  private get waFrom() { return process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER; }
  private get smsFrom() { return process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER; }

  /** The Twilio Messages REST endpoint — identical to what Supabase's Twilio integration POSTs to. */
  private endpoint(): string {
    return `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
  }

  private assertConfigured(channel: 'whatsapp' | 'sms') {
    if (!this.sid || !this.token) throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN)');
    if (channel === 'whatsapp' && !this.waFrom) throw new Error('TWILIO_PHONE_NUMBER/TWILIO_WHATSAPP_FROM not set');
    if (channel === 'sms' && !this.smsFrom) throw new Error('TWILIO_PHONE_NUMBER/TWILIO_SMS_FROM not set');
  }

  /** Localized OTP message body (AR/EN). Plaintext code is delivered, never logged here. */
  private body(input: OtpSendInput): string {
    return input.locale === 'ar'
      ? `${input.code} رمز الدخول الخاص بك في BestOffers`
      : `${input.code} is your BestOffers code`;
  }

  async send(input: OtpSendInput): Promise<{ messageId: string; channel: 'whatsapp' | 'sms' }> {
    this.assertConfigured(input.channel);
    // WhatsApp channel = `whatsapp:` prefix on BOTH From and To (the Supabase/Twilio WhatsApp shape).
    const from =
      input.channel === 'whatsapp' ? `whatsapp:${this.waFrom}` : (this.smsFrom as string);
    const to =
      input.channel === 'whatsapp' ? `whatsapp:${input.phoneE164}` : input.phoneE164;

    const params = new URLSearchParams({ From: from, To: to, Body: this.body(input) });
    const res = await fetch(this.endpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Throw so AuthService.deliver() falls back from whatsapp → sms (F-C1 AC-8).
      throw new Error(`Twilio ${input.channel} send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { messageId: json.sid ?? 'twilio_unknown', channel: input.channel };
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: !!(this.sid && this.token) };
  }
}
