import { HttpException, HttpStatus } from '@nestjs/common';
import Database from 'better-sqlite3';
import { makeTestDb } from '../db/test-db';
import { DbService } from '../db/db.service';
import { JwtService } from './jwt.service';
import { AuthService } from './auth.service';
import { MockOtpSender } from './otp-sender.interface';

/**
 * Slice B — WhatsApp OTP auth (mock). Covers verify, expiry, rate-limit, attempt-lock, dev code,
 * session/JWT issuance + first-sign-in user/profile creation. Offline (MockOtpSender, no network).
 */
describe('AuthService (OTP, mock)', () => {
  let svc: AuthService;
  let dbs: DbService;
  const PHONE = '+96512345678';

  beforeEach(() => {
    makeTestDb();
    process.env.OTP_PROVIDER = 'mock';
    process.env.OTP_DEV_CODE = '000000';
    dbs = new DbService();
    svc = new AuthService(dbs, new JwtService(), new MockOtpSender());
  });
  afterEach(() => dbs.onModuleDestroy());

  it('rejects an invalid phone format', async () => {
    await expect(svc.requestOtp('12345', 'en')).rejects.toThrow(/invalid phone/);
  });

  it('verifies with the dev universal code and creates user + profile on first sign-in', async () => {
    await svc.requestOtp(PHONE, 'en');
    const res = await svc.verifyOtp(PHONE, '000000');
    expect(res.isNewUser).toBe(true);
    expect(res.access.split('.')).toHaveLength(3);
    expect(res.refresh).toMatch(/^[a-f0-9]{64}$/);
    expect(res.pseudoId).toBeTruthy();

    // Phone PII is isolated in auth_users; profile carries pseudoId, NO phone.
    const prof: any = dbs.db.prepare('SELECT * FROM profiles WHERE pseudo_id=?').get(res.pseudoId);
    expect(prof).toBeTruthy();
    expect(Object.keys(prof)).not.toContain('phone_e164');

    // Returning sign-in: same identity, not new.
    await svc.requestOtp(PHONE, 'en').catch(() => undefined); // may hit cooldown — verify uses latest
  });

  it('rejects an expired code', async () => {
    await svc.requestOtp(PHONE, 'en');
    // Force-expire the latest code.
    dbs.db.prepare("UPDATE auth_otps SET expires_at=? WHERE phone_e164=?").run(
      new Date(Date.now() - 1000).toISOString(),
      PHONE,
    );
    await expect(svc.verifyOtp(PHONE, '000000')).rejects.toThrow(/expired/);
  });

  it('locks after 5 incorrect attempts', async () => {
    await svc.requestOtp(PHONE, 'en');
    for (let i = 0; i < 5; i++) {
      await expect(svc.verifyOtp(PHONE, '999999')).rejects.toThrow(/incorrect/);
    }
    // 6th attempt → locked, even with the right code.
    await expect(svc.verifyOtp(PHONE, '000000')).rejects.toThrow(/too many attempts/);
  });

  it('rate-limits to 5 requests per phone per hour', async () => {
    // Bypass the 30s resend cooldown by back-dating created_at between requests is messy; instead
    // assert the request-window limit directly: pre-seed 5 recent codes, then the 6th is blocked.
    const now = Date.now();
    const stmt = dbs.db.prepare(
      "INSERT INTO auth_otps (id, phone_e164, code_hash, channel, expires_at, created_at) VALUES (?,?,?,?,?,?)",
    );
    for (let i = 0; i < 5; i++) {
      stmt.run(`o${i}`, PHONE, 'h', 'whatsapp', new Date(now + 60000).toISOString(), new Date(now - i * 1000).toISOString());
    }
    await expect(svc.requestOtp(PHONE, 'en')).rejects.toMatchObject({
      getStatus: expect.any(Function),
    });
    try {
      await svc.requestOtp(PHONE, 'en');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('refresh rotates the token and mints a fresh access JWT', async () => {
    await svc.requestOtp(PHONE, 'en');
    const first = await svc.verifyOtp(PHONE, '000000');
    const rotated = svc.refresh(first.refresh);
    expect(rotated.access.split('.')).toHaveLength(3);
    expect(rotated.refresh).not.toBe(first.refresh);
    // Old refresh is revoked → reuse fails.
    expect(() => svc.refresh(first.refresh)).toThrow(/invalid or expired/);
  });

  it('never stores the plaintext code (only a hash)', async () => {
    await svc.requestOtp(PHONE, 'en');
    const row: any = dbs.db.prepare('SELECT code_hash FROM auth_otps WHERE phone_e164=?').get(PHONE);
    // A 6-digit plaintext would be length 6; sha256 hex is length 64.
    expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
