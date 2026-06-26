import { Injectable, Logger } from '@nestjs/common';
import { SubStatus } from '@bestoffers/shared';
import { DbService } from '../db/db.service';
import { BillingProvider, WebhookResult, isPremiumStatus } from './billing-provider.interface';

/**
 * Stripe impl (config-ready, NOT wired offline). Selected by BILLING_PROVIDER=stripe. The Stripe SDK
 * is dynamic-imported so the app/tests boot WITHOUT the dependency or keys present. Webhook signatures
 * are verified via STRIPE_WEBHOOK_SECRET (raw body required — see main.ts rawBody config).
 *
 * Requires: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID ($1/mo USD recurring).
 */
@Injectable()
export class StripeBillingProvider implements BillingProvider {
  private readonly logger = new Logger('StripeBillingProvider');
  private client: any;

  constructor(private readonly dbs: DbService) {}

  private async stripe(): Promise<any> {
    if (this.client) return this.client;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    // Dynamic import: absent in offline/CI; only loaded when BILLING_PROVIDER=stripe with keys.
    const Stripe = (await import('stripe' as string)).default;
    this.client = new Stripe(key, { apiVersion: '2024-06-20' });
    return this.client;
  }

  async getOrCreateCustomer(userId: string): Promise<{ customerId: string }> {
    const row = await this.dbs.get<{ stripe_customer_id: string | null }>(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id=?',
      [userId],
    );
    if (row?.stripe_customer_id) return { customerId: row.stripe_customer_id };
    const stripe = await this.stripe();
    const customer = await stripe.customers.create({ metadata: { user_id: userId } });
    await this.dbs.run(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, status, updated_at)
       VALUES (?,?,'none',?)
       ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id, updated_at=excluded.updated_at`,
      [userId, customer.id, new Date().toISOString()],
    );
    return { customerId: customer.id };
  }

  async createCheckoutSession(userId: string, customerId: string): Promise<{ url: string }> {
    const stripe = await this.stripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL ?? 'bestoffers://billing/success',
      cancel_url: process.env.STRIPE_CANCEL_URL ?? 'bestoffers://billing/cancel',
      client_reference_id: userId,
      metadata: { user_id: userId },
    });
    return { url: session.url as string };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult | null> {
    const stripe = await this.stripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret); // throws on bad signature
    const obj = event.data.object as any;
    const userId = obj.metadata?.user_id ?? obj.client_reference_id;
    if (!userId) return null;

    const map: Record<string, SubStatus | undefined> = {
      'checkout.session.completed': 'active',
      'customer.subscription.updated': this.normalizeStatus(obj.status),
      'customer.subscription.deleted': 'canceled',
      'invoice.payment_failed': 'past_due',
    };
    const status = map[event.type];
    if (!status) return null;
    const periodEnd = obj.current_period_end ? new Date(obj.current_period_end * 1000) : undefined;
    return { userId, status, currentPeriodEnd: periodEnd };
  }

  async isPremium(userId: string): Promise<boolean> {
    const row = await this.dbs.get<{ status: SubStatus; current_period_end: string | null }>(
      'SELECT status, current_period_end FROM subscriptions WHERE user_id=?',
      [userId],
    );
    return isPremiumStatus(row?.status, row?.current_period_end);
  }

  private normalizeStatus(s: string): SubStatus {
    if (s === 'active' || s === 'trialing' || s === 'past_due' || s === 'canceled') return s;
    return 'none';
  }
}
