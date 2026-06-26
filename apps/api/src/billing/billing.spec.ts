import { makeTestDb } from '../db/test-db';
import { DbService } from '../db/db.service';
import { MockBillingProvider } from './mock-billing-provider';
import { BillingService } from './billing.service';

/**
 * Slice C — Stripe subscription (mock). subscriptions.status transitions via the (mock) webhook are
 * the source of truth that drives premium. No Stripe network calls.
 */
describe('BillingService (mock provider, webhook-driven status)', () => {
  let dbs: DbService;
  let svc: BillingService;
  const USER = 'user-B';

  beforeEach(() => {
    makeTestDb();
    process.env.BILLING_PROVIDER = 'mock';
    process.env.BILLING_DEV_GRANT = 'false';
    dbs = new DbService();
    svc = new BillingService(dbs, new MockBillingProvider(dbs));
    const now = new Date().toISOString();
    dbs.db.prepare('INSERT INTO auth_users (id, phone_e164, created_at) VALUES (?,?,?)').run(USER, '+96599999999', now);
    dbs.db.prepare('INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?,?,?)').run(USER, 'none', now);
  });
  afterEach(() => dbs.onModuleDestroy());

  const hook = (type: string, extra: Record<string, unknown> = {}) =>
    svc.handleWebhook(Buffer.from(JSON.stringify({ type, userId: USER, ...extra })), 'mock-sig');

  it('checkout returns a dev URL (no Stripe call)', async () => {
    const { url } = await svc.checkout(USER);
    expect(url).toMatch(/^mock-checkout:\/\/confirm/);
  });

  it('starts at none → not premium', async () => {
    const s = await svc.status(USER);
    expect(s).toMatchObject({ status: 'none', premium: false });
  });

  it('checkout.session.completed → active → premium', async () => {
    await hook('checkout.session.completed');
    const s = await svc.status(USER);
    expect(s.status).toBe('active');
    expect(s.premium).toBe(true);
    expect(s.currentPeriodEnd).toBeTruthy();
  });

  it('invoice.payment_failed → past_due → NOT premium (gated as free)', async () => {
    await hook('checkout.session.completed');
    await hook('invoice.payment_failed');
    const s = await svc.status(USER);
    expect(s.status).toBe('past_due');
    expect(s.premium).toBe(false);
  });

  it('customer.subscription.deleted → canceled → NOT premium (period end in the past)', async () => {
    await hook('checkout.session.completed');
    await hook('customer.subscription.deleted');
    // Force the carried-over paid-through date into the past, then re-check.
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    dbs.db.prepare('UPDATE subscriptions SET current_period_end=? WHERE user_id=?').run(past, USER);
    const s = await svc.status(USER);
    expect(s.status).toBe('canceled');
    expect(s.premium).toBe(false);
  });

  // D1-1 (HIGH): canceled-but-within-paid-period keeps premium until current_period_end passes.
  it('canceled WITHIN paid period → STILL premium', async () => {
    const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    await hook('checkout.session.completed');
    await hook('customer.subscription.deleted', { currentPeriodEnd: future });
    const s = await svc.status(USER);
    expect(s.status).toBe('canceled');
    expect(s.currentPeriodEnd).toBe(future);
    expect(s.premium).toBe(true);
  });

  // D1-1 (HIGH): canceled past the paid period → premium ends.
  it('canceled PAST paid period → NOT premium', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    await hook('checkout.session.completed');
    await hook('customer.subscription.deleted', { currentPeriodEnd: past });
    const s = await svc.status(USER);
    expect(s.status).toBe('canceled');
    expect(s.premium).toBe(false);
  });

  // D2-1 (MED, missed-webhook defense): status=active but period already lapsed → NOT premium.
  it('active but current_period_end in the PAST → NOT premium (missed-webhook defense)', async () => {
    await hook('checkout.session.completed');
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    dbs.db.prepare('UPDATE subscriptions SET current_period_end=? WHERE user_id=?').run(past, USER);
    const s = await svc.status(USER);
    expect(s.status).toBe('active');
    expect(s.premium).toBe(false);
  });

  it('trialing counts as premium', async () => {
    await hook('customer.subscription.updated', { status: 'trialing' });
    const s = await svc.status(USER);
    expect(s.status).toBe('trialing');
    expect(s.premium).toBe(true);
  });

  it('ignores unactionable events (no status change)', async () => {
    await hook('checkout.session.completed');
    const before = await svc.status(USER);
    const r = await svc.handleWebhook(Buffer.from(JSON.stringify({ type: 'noise.event', userId: USER })), 'sig');
    expect(r.applied).toBe(false);
    expect((await svc.status(USER)).status).toBe(before.status);
  });
});
