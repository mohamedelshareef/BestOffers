import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SubStatus } from '@bestoffers/shared';
import { DbService } from '../db/db.service';
import { BillingProvider, WebhookResult, isPremiumStatus } from './billing-provider.interface';

/**
 * Offline default (ADR-004 Decision 4). No Stripe network calls.
 *  - createCheckoutSession returns a dev URL; "confirming" it (POST /billing/webhook with a mock
 *    event, or the dev-confirm helper) flips subscriptions.status → 'active' locally.
 *  - BILLING_DEV_GRANT=true → isPremium() ALWAYS true (exercise premium paths);
 *    =false → status-driven (exercise the paywall).
 */
@Injectable()
export class MockBillingProvider implements BillingProvider {
  private readonly logger = new Logger('MockBillingProvider');

  constructor(private readonly dbs: DbService) {}

  private get db() {
    return this.dbs.db;
  }

  private get devGrant(): boolean {
    return process.env.BILLING_DEV_GRANT === 'true';
  }

  async getOrCreateCustomer(userId: string): Promise<{ customerId: string }> {
    const row = this.db.prepare('SELECT stripe_customer_id FROM subscriptions WHERE user_id=?').get(userId) as
      | { stripe_customer_id: string | null }
      | undefined;
    if (row?.stripe_customer_id) return { customerId: row.stripe_customer_id };
    const customerId = `cus_mock_${randomUUID().slice(0, 12)}`;
    this.db
      .prepare(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, status, updated_at)
         VALUES (?,?,'none',?)
         ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id, updated_at=excluded.updated_at`,
      )
      .run(userId, customerId, new Date().toISOString());
    return { customerId };
  }

  async createCheckoutSession(userId: string, customerId: string): Promise<{ url: string }> {
    // Dev URL the app/test can "confirm" → POST /billing/webhook with {type:'mock.confirm', userId}.
    return { url: `mock-checkout://confirm?user=${encodeURIComponent(userId)}&customer=${customerId}` };
  }

  /**
   * Mock webhook: accepts a JSON event of shape {type, userId, status?, currentPeriodEnd?}.
   * No signature to verify (mock). Maps mock events to the same normalized status changes Stripe would.
   */
  async handleWebhook(rawBody: Buffer): Promise<WebhookResult | null> {
    let evt: { type: string; userId: string; status?: SubStatus; currentPeriodEnd?: string };
    try {
      evt = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return null;
    }
    if (!evt.userId) return null;

    switch (evt.type) {
      case 'mock.confirm':
      case 'checkout.session.completed':
        return { userId: evt.userId, status: 'active', currentPeriodEnd: this.in30Days() };
      case 'customer.subscription.updated':
        return {
          userId: evt.userId,
          status: evt.status ?? 'active',
          currentPeriodEnd: evt.currentPeriodEnd ? new Date(evt.currentPeriodEnd) : this.in30Days(),
        };
      case 'customer.subscription.deleted':
        // Carry the paid-through date if the event supplies one (Stripe's deleted object has
        // current_period_end) so a cancel-but-paid-through user keeps premium until it passes (D1-1).
        return {
          userId: evt.userId,
          status: 'canceled',
          currentPeriodEnd: evt.currentPeriodEnd ? new Date(evt.currentPeriodEnd) : undefined,
        };
      case 'invoice.payment_failed':
        return { userId: evt.userId, status: 'past_due' };
      default:
        return null;
    }
  }

  async isPremium(userId: string): Promise<boolean> {
    if (this.devGrant) return true;
    const row = this.db
      .prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id=?')
      .get(userId) as { status: SubStatus; current_period_end: string | null } | undefined;
    return isPremiumStatus(row?.status, row?.current_period_end);
  }

  private in30Days(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
}
