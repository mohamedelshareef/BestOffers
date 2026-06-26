import { Inject, Injectable } from '@nestjs/common';
import { BillingStatus, SubStatus } from '@bestoffers/shared';
import { DbService } from '../db/db.service';
import { BILLING_PROVIDER, BillingProvider } from './billing-provider.interface';

/**
 * Billing orchestration (ADR-004 Slice C). The webhook result is the ONLY writer of
 * subscriptions.status — that table is the source of truth the freemium gate reads (Decision 4/5).
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly dbs: DbService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
  ) {}

  async checkout(userId: string): Promise<{ url: string }> {
    const { customerId } = await this.provider.getOrCreateCustomer(userId);
    return this.provider.createCheckoutSession(userId, customerId);
  }

  /** Verifies + applies a webhook event to subscriptions (source of truth). Idempotent per status. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ applied: boolean }> {
    const result = await this.provider.handleWebhook(rawBody, signature);
    if (!result) return { applied: false };
    // When a webhook omits current_period_end (e.g. a cancel event that doesn't restate it), KEEP the
    // existing paid-through date rather than nulling it — that date governs canceled-within-period
    // premium access (D1-1). COALESCE(excluded, existing) preserves it on UPDATE.
    await this.dbs.run(
      `INSERT INTO subscriptions (user_id, status, current_period_end, updated_at)
       VALUES (?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         status=excluded.status,
         current_period_end=COALESCE(excluded.current_period_end, subscriptions.current_period_end),
         updated_at=excluded.updated_at`,
      [
        result.userId,
        result.status,
        result.currentPeriodEnd ? result.currentPeriodEnd.toISOString() : null,
        new Date().toISOString(),
      ],
    );
    return { applied: true };
  }

  async status(userId: string): Promise<BillingStatus> {
    const row = await this.dbs.get<{ status: SubStatus; current_period_end: string | null }>(
      'SELECT status, current_period_end FROM subscriptions WHERE user_id=?',
      [userId],
    );
    const status: SubStatus = row?.status ?? 'none';
    const premium = await this.provider.isPremium(userId);
    return { status, premium, currentPeriodEnd: row?.current_period_end ?? null };
  }

  isPremium(userId: string): Promise<boolean> {
    return this.provider.isPremium(userId);
  }
}
