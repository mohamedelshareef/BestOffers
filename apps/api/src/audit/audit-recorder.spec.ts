import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { SqliteDb } from '../db/sqlite-db';
import { AuditRecorderService } from './audit-recorder.service';
import { forbiddenKey, redactString, sanitizeObject, ipHash } from './audit.redact';
import { AuditRow } from './audit.types';

/**
 * ADR-009 Slice B — recorder + redaction. Uses a REAL isolated in-memory SQLite with the actual
 * 0006 migration applied (so the audit_trail DDL + INSERT are exercised, not mocked).
 */
function freshDb(): SqliteDb {
  const handle = new Database(':memory:');
  handle.pragma('foreign_keys = ON');
  const dir = join(__dirname, '..', 'db', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    handle.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return new SqliteDb(handle);
}

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: 'req_' + Math.random().toString(36).slice(2),
    ts: new Date().toISOString(),
    method: 'POST',
    path: '/search/intent',
    route: '/search/intent',
    statusCode: 200,
    durationMs: 12,
    actor: 'anon',
    ipHash: null,
    userAgent: 'jest',
    sector: 'food',
    query: 'kfc',
    requestSummary: { hasQuery: true },
    requestBytes: 40,
    responseSummary: { state: 'clarifying', questions: 5 },
    responseBytes: 120,
    errorCode: null,
    errorMessage: null,
    requestId: 'req_x',
    ...overrides,
  };
}

describe('audit redaction — forbidden keys / value scrub (ADR-009 Decision 3)', () => {
  it('flags every never-log key class (case-insensitive substring)', () => {
    for (const k of [
      'Authorization', 'authorization', 'Cookie', 'set-cookie', 'x-api-key', 'apify_token',
      'refresh_token', 'access_token', 'jwt', 'bearerToken', 'stripe_client_secret',
      'supabase_service_role_key', 'webhook_secret', 'password', 'otp', 'code', 'cvv',
      'card_number', 'phone', 'phone_e164', 'phoneE164', 'email', 'name', 'intentRaw',
    ]) {
      expect(forbiddenKey(k)).toBe(true);
    }
    // a benign key is NOT forbidden
    for (const k of ['sector', 'hasQuery', 'state', 'cards', 'route']) {
      expect(forbiddenKey(k)).toBe(false);
    }
  });

  it('redactString scrubs phone / email / bearer / jwt / stripe / hex secrets from kept free-text', () => {
    expect(redactString('call me on +96550001122 now')).not.toMatch(/96550001122/);
    expect(redactString('email me at a.b@x.com')).not.toMatch(/@x\.com/);
    expect(redactString('Bearer abc.def.ghi token')).not.toMatch(/abc\.def\.ghi/);
    expect(redactString('eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe('[redacted]');
    expect(redactString('key sk_live_abcdefgh12345')).not.toMatch(/sk_live/);
    expect(redactString('deadbeefdeadbeefdeadbeefdeadbeef00')).not.toMatch(/deadbeef/);
  });

  it('sanitizeObject is allow-list only — drops a forbidden key even if allowed by name', () => {
    const out = sanitizeObject({ hasQuery: true, password: 'x', otp: '1234' }, ['hasQuery', 'password', 'otp']);
    expect(out).toEqual({ hasQuery: true });
  });

  it('ipHash is a salted HMAC, never the raw ip', () => {
    const h = ipHash('1.2.3.4', 'salt');
    expect(h).not.toContain('1.2.3.4');
    expect(h).toHaveLength(64); // sha256 hex
    expect(ipHash(null, 'salt')).toBeNull();
  });
});

describe('AuditRecorderService — fire-and-forget queue (ADR-009 Decision 2)', () => {
  it('enqueue → flush → exactly one row lands per enqueue', async () => {
    const db = freshDb();
    const rec = new AuditRecorderService(db as any);
    rec.enqueue(row({ id: 'a', requestId: 'a' }));
    rec.enqueue(row({ id: 'b', requestId: 'b', route: '/health', sector: null, query: null }));
    await rec.flush();
    const rows = await db.all<{ n: number }>('SELECT COUNT(*) AS n FROM audit_trail');
    expect(rows[0].n).toBe(2);
    await db.close();
  });

  it('NEVER persists a secret/OTP/phone value — final scrub strips them from stored row', async () => {
    const db = freshDb();
    const rec = new AuditRecorderService(db as any);
    rec.enqueue(
      row({
        id: 'secret1',
        requestId: 'secret1',
        // hostile inputs that must NOT survive into the DB
        query: 'my otp is 654321 phone +96599887766 token eyJhbGciOiJ.aaaa.bbbb',
        errorMessage: 'failed with Authorization: Bearer sk_live_supersecretvalue123',
        userAgent: 'UA a.b@mail.com',
        requestSummary: { hasQuery: true, password: 'hunter2', authorization: 'Bearer zzz' } as any,
      }),
    );
    await rec.flush();
    const stored = await db.get<Record<string, string>>('SELECT * FROM audit_trail WHERE id = ?', ['secret1']);
    const blob = JSON.stringify(stored).toLowerCase();
    for (const forbidden of [
      '654321', '96599887766', 'eyjhbgci', 'sk_live_supersecret', 'hunter2', 'a.b@mail.com', 'bearer zzz',
    ]) {
      expect(blob).not.toContain(forbidden.toLowerCase());
    }
    // benign metadata survived
    expect(stored!.request_summary).toContain('hasQuery');
    await db.close();
  });

  it('a DB insert failure NEVER propagates into the caller (self-protecting)', async () => {
    const throwingDb = { run: jest.fn().mockRejectedValue(new Error('db down')) };
    const rec = new AuditRecorderService(throwingDb as any);
    expect(() => rec.enqueue(row())).not.toThrow();
    await expect(rec.flush()).resolves.toBeUndefined();
    expect(throwingDb.run).toHaveBeenCalled();
  });

  it('AUDIT_ENABLED=false → enqueue is a no-op (kill-switch)', async () => {
    const prev = process.env.AUDIT_ENABLED;
    process.env.AUDIT_ENABLED = 'false';
    const db = freshDb();
    const rec = new AuditRecorderService(db as any);
    rec.enqueue(row());
    await rec.flush();
    const rows = await db.all<{ n: number }>('SELECT COUNT(*) AS n FROM audit_trail');
    expect(rows[0].n).toBe(0);
    process.env.AUDIT_ENABLED = prev;
    await db.close();
  });

  it('backpressure drops OLDEST beyond AUDIT_QUEUE_MAX, never blocks', async () => {
    const prev = process.env.AUDIT_QUEUE_MAX;
    process.env.AUDIT_QUEUE_MAX = '3';
    // a db.run that never resolves so the queue accumulates past the cap before draining
    const db = { run: jest.fn(() => new Promise(() => {})) };
    const rec = new AuditRecorderService(db as any);
    for (let i = 0; i < 10; i++) rec.enqueue(row({ id: 'r' + i, requestId: 'r' + i }));
    expect(rec.droppedCount()).toBeGreaterThan(0);
    process.env.AUDIT_QUEUE_MAX = prev;
  });
});
