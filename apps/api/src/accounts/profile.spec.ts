import { makeTestDb } from '../db/test-db';
import { DbService } from '../db/db.service';
import { ProfileService } from './profile.service';
import { LocalDiskStorage } from './storage.interface';

/**
 * Slice A — profile read/update. Ownership (RLS-equivalent) is enforced by scoping every query to
 * the caller's userId: a caller cannot read or mutate another user's row. Plus name/email validation
 * and the email-change → re-verification flow (F-A1).
 */
describe('ProfileService (ownership + email re-verify)', () => {
  let dbs: DbService;
  let svc: ProfileService;

  beforeEach(() => {
    makeTestDb();
    dbs = new DbService();
    svc = new ProfileService(dbs, new LocalDiskStorage());
    seedProfile(dbs, 'alice', 'ps_alice');
    seedProfile(dbs, 'bob', 'ps_bob');
  });
  afterEach(() => dbs.onModuleDestroy());

  it('returns only the caller’s own profile', async () => {
    const alice = await svc.getProfile('alice');
    expect(alice.id).toBe('alice');
    expect(alice.pseudoId).toBe('ps_alice');
  });

  it('RLS denial: a user cannot read a non-owned / unknown id', async () => {
    // The service only ever queries WHERE id = <caller>. Asking for someone else means passing your
    // OWN id (from JWT) — you can never address bob's row as alice. A bogus id → not found.
    await expect(svc.getProfile('mallory')).rejects.toThrow(/not found/);
  });

  it('RLS denial: alice updating cannot touch bob’s row (writes are id-scoped)', async () => {
    await svc.updateProfile('alice', { displayName: 'Alice K' });
    // bob is untouched
    expect((await svc.getProfile('bob')).displayName).toBeNull();
    expect((await svc.getProfile('alice')).displayName).toBe('Alice K');
  });

  it('rejects an avatar path not prefixed with the caller’s id (storage ownership)', async () => {
    await expect(svc.updateProfile('alice', { avatarUrl: 'bob/avatar.jpg' })).rejects.toThrow(
      /belong to the caller/,
    );
    // own-prefixed path is accepted
    const p = await svc.updateProfile('alice', { avatarUrl: 'alice/avatar.jpg' });
    expect(p.avatarUrl).toBe('alice/avatar.jpg');
  });

  it('validates name (1–60, letters/spaces/hyphen/apostrophe; Arabic ok)', async () => {
    await expect(svc.updateProfile('alice', { displayName: '   ' })).rejects.toThrow(/name/);
    await expect(svc.updateProfile('alice', { displayName: 'x'.repeat(61) })).rejects.toThrow(/name/);
    expect((await svc.updateProfile('alice', { displayName: 'محمد الشريف' })).displayName).toBe('محمد الشريف');
  });

  it('email change stores pending + keeps prior verified email until re-verified', async () => {
    const p = await svc.updateProfile('alice', { email: 'Alice@Example.com ' });
    expect(p.email).toBeNull(); // effective email unchanged until verify
    expect(p.emailPending).toBe('alice@example.com'); // normalized lowercase/trim
    expect(p.emailVerified).toBe(false);

    const token = svc.lastEmailToken()!;
    const verified = await svc.verifyEmail('alice', token);
    expect(verified.email).toBe('alice@example.com');
    expect(verified.emailVerified).toBe(true);
    expect(verified.emailPending).toBeNull();
  });

  it('rejects an invalid email and an email already in use by another account', async () => {
    await expect(svc.updateProfile('alice', { email: 'not-an-email' })).rejects.toThrow(/invalid email/);
    // give bob a verified email, then alice tries to claim it
    await svc.updateProfile('bob', { email: 'taken@example.com' });
    await svc.verifyEmail('bob', svc.lastEmailToken()!);
    await expect(svc.updateProfile('alice', { email: 'taken@example.com' })).rejects.toThrow(/already in use/);
  });

  it('expired verification token is rejected with a resend hint', async () => {
    await svc.updateProfile('alice', { email: 'a@b.com' });
    dbs.db.prepare('UPDATE profiles SET email_verify_expires_at=? WHERE id=?').run(
      new Date(Date.now() - 1000).toISOString(),
      'alice',
    );
    await expect(svc.verifyEmail('alice', svc.lastEmailToken()!)).rejects.toThrow(/expired/);
  });

  it('clearing email cancels a pending verification', async () => {
    await svc.updateProfile('alice', { email: 'a@b.com' });
    const p = await svc.updateProfile('alice', { email: null });
    expect(p.email).toBeNull();
    expect(p.emailPending).toBeNull();
  });

  it('persists notif prefs + biometric flag', async () => {
    const p = await svc.updateProfile('alice', {
      notifEnabled: true,
      notifPrefs: { price_drop: true, account_security: false },
      biometricEnabled: true,
    });
    expect(p.notifPrefs).toEqual({ price_drop: true, account_security: false });
    expect(p.biometricEnabled).toBe(true);
  });
});

function seedProfile(dbs: DbService, id: string, pseudo: string) {
  const now = new Date().toISOString();
  dbs.db.prepare('INSERT INTO auth_users (id, phone_e164, created_at) VALUES (?,?,?)').run(id, `+965${id}`, now);
  dbs.db.prepare('INSERT INTO profiles (id, pseudo_id, created_at) VALUES (?,?,?)').run(id, pseudo, now);
}
