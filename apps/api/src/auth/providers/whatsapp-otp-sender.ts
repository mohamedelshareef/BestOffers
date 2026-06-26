import { Logger } from '@nestjs/common';
import { OtpSender, OtpSendInput } from '../otp-sender.interface';

/**
 * Meta WhatsApp Cloud API sender (config-ready, NOT wired offline). Selected by
 * OTP_PROVIDER=meta_whatsapp. Sends a pre-approved authentication template. Throws on hard failure
 * so the orchestrator falls back to SMS. Uses fetch (no SDK) — only runs when keys exist.
 *
 * Requires: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_OTP_TEMPLATE_NAME.
 */
export class WhatsAppOtpSender implements OtpSender {
  private readonly logger = new Logger('WhatsAppOtpSender');
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly template = process.env.WHATSAPP_OTP_TEMPLATE_NAME;

  private assertConfigured() {
    if (!this.phoneNumberId || !this.accessToken || !this.template) {
      throw new Error(
        'WhatsApp OTP not configured (set WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN / WHATSAPP_OTP_TEMPLATE_NAME)',
      );
    }
  }

  async send(input: OtpSendInput): Promise<{ messageId: string; channel: 'whatsapp' | 'sms' }> {
    this.assertConfigured();
    const to = input.phoneE164.replace('+', '');
    const res = await fetch(`https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: this.template,
          language: { code: input.locale === 'ar' ? 'ar' : 'en' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: input.code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: input.code }] },
          ],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`WhatsApp send failed (${res.status}): ${body}`); // → SMS fallback
    }
    const json = (await res.json()) as { messages?: { id: string }[] };
    return { messageId: json.messages?.[0]?.id ?? 'wa_unknown', channel: 'whatsapp' };
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: !!(this.phoneNumberId && this.accessToken && this.template) };
  }
}
