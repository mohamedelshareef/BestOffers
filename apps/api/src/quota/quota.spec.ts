import { makeTestDb } from '../db/test-db';
import { DbService } from '../db/db.service';
import { QuotaService } from './quota.service';
import { MockBillingProvider } from '../billing/mock-billing-provider';
import { BillingService } from '../billing/billing.service';

/**
 * Slice D — freemium gate. Atomic no-6th-free-search (race-safe), premium bypass.
 * The cap is the single conditional UPDATE … WHERE used_count < 5 RETURNING — DB-enforced.
 */
describe('QuotaService (freemium gate)', () => {
  let dbs: DbService;
  let quota: QuotaService;
  let billing: BillingService;
  const USER = 'user-A';

  beforeEach(() => {
    makeTestDb();
    process.env.BILLING_PROVIDER = 'mock';
    process.env.BILLING_DEV_GRANT = 'false';
    dbs = new DbService();
    const provider = new MockBillingProvider(dbs);
    billing = new BillingService(dbs, provider);
    quota = new QuotaService(dbs, billing);
    seedUser(dbs, USER);
  });
  afterEach(() => dbs.onModuleDestroy());

  it('allows exactly 5 free searches, then blocks the 6th', async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await quota.tryConsume(USER);
      expect(r.allowed).toBe(true);
      expect(r.used).toBe(i);
    }
    const sixth = await quota.tryConsume(USER);
    expect(sixth.allowed).toBe(false);
    expect(sixth.used).toBe(5);
  });

  it('NEVER serves a 6th free search under concurrent submissions at 5/5 (race-safe)', async () => {
    // Consume 4, leaving room for exactly one more.
    for (let i = 0; i < 4; i++) await quota.tryConsume(USER);
    // Fire many concurrent attempts for the LAST slot — only one may succeed.
    const results = await Promise.all(Array.from({ length: 25 }, () => quota.tryConsume(USER)));
    const allowed = results.filter((r) => r.allowed);
    expect(allowed).toHaveLength(1); // at most one crosses 4→5; the rest hit the paywall
    expect((dbs.db.prepare('SELECT used_count c FROM search_quota WHERE user_id=?').get(USER) as any).c).toBe(5);
  });

  it('premium users bypass the gate — counter never increments', async () => {
    flipPremium(dbs, USER, 'active');
    for (let i = 0; i < 10; i++) {
      const r = await quota.tryConsume(USER);
      expect(r.allowed).toBe(true);
      expect(r.premium).toBe(true);
    }
    expect((dbs.db.prepare('SELECT used_count c FROM search_quota WHERE user_id=?').get(USER) as any).c).toBe(0);
  });

  it('BILLING_DEV_GRANT=true grants premium to everyone (bypass)', async () => {
    process.env.BILLING_DEV_GRANT = 'true';
    const r = await quota.tryConsume(USER);
    expect(r.premium).toBe(true);
    expect(r.allowed).toBe(true);
    process.env.BILLING_DEV_GRANT = 'false';
  });

  it('status reports used/limit/premium', async () => {
    await quota.tryConsume(USER);
    await quota.tryConsume(USER);
    const s = await quota.status(USER);
    expect(s).toEqual({ used: 2, limit: 5, premium: false });
  });
});

function seedUser(dbs: DbService, id: string) {
  const now = new Date().toISOString();
  dbs.db.prepare('INSERT INTO auth_users (id, phone_e164, created_at) VALUES (?,?,?)').run(id, `+9650000${id}`, now);
  dbs.db.prepare('INSERT INTO profiles (id, pseudo_id, created_at) VALUES (?,?,?)').run(id, `ps_${id}`, now);
  dbs.db.prepare('INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?,?,?)').run(id, 'none', now);
  dbs.db.prepare('INSERT INTO search_quota (user_id, used_count, updated_at) VALUES (?,0,?)').run(id, now);
}

function flipPremium(dbs: DbService, id: string, status: string) {
  dbs.db.prepare('UPDATE subscriptions SET status=? WHERE user_id=?').run(status, id);
}
