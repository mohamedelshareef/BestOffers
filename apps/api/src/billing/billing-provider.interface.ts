import { SubStatus } from '@bestoffers/shared';

export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

export interface WebhookResult {
  userId: string;
  status: SubStatus;
  currentPeriodEnd?: Date;
}

/**
 * FROZEN interface (ADR-004 Decision 4). subscriptions.status is the SOURCE OF TRUTH for the
 * freemium bypass — never trust the client. The webhook (signature-verified when real) is the only
 * writer of status. BILLING_PROVIDER = 'mock' | 'stripe'.
 */
export interface BillingProvider {
  getOrCreateCustomer(userId: string): Promise<{ customerId: string }>;
  createCheckoutSession(userId: string, customerId: string): Promise<{ url: string }>;
  /** Verifies signature, returns the normalized status change, or null if not actionable. */
  handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult | null>;
  isPremium(userId: string): Promise<boolean>;
}

/**
 * Single source of premium-truth, shared by Mock + Stripe providers (QA D1-1 / D2-1).
 *  - active/trialing → premium (D2-1 defense: if current_period_end is set AND in the past,
 *    treat as NOT premium — covers a missed/delayed cancellation webhook so a lapsed paid period
 *    never grants free access indefinitely).
 *  - canceled → premium ONLY while still within the paid period (current_period_end in the future)
 *    so a cancel-but-paid-through user keeps access until period end (F-D1 AC-7).
 * A null current_period_end on active/trialing keeps premium (no TTL info to enforce).
 */
export function isPremiumStatus(status: SubStatus | undefined, currentPeriodEnd: string | null | undefined): boolean {
  if (!status) return false;
  const end = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : null;
  const withinPeriod = end !== null && end > Date.now();
  if (status === 'active' || status === 'trialing') {
    // Missed-webhook defense: an explicit period_end in the past lapses premium.
    return end === null || withinPeriod;
  }
  if (status === 'canceled') {
    return withinPeriod;
  }
  return false;
}
