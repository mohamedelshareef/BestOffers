import { Db, rewritePlaceholders } from './db.port';

// `pg` ships no bundled types and we don't add @types/pg (keeps the dep surface lean; the driver is
// dynamic-imported so sqlite/offline never loads it). Type the pool/client structurally as `any`.
type PgPool = any;
type PgPoolClient = any;

/**
 * PgDb — the Supabase driver (DB_DRIVER=pg). Wraps a `pg.Pool` pointed at DATABASE_URL (the verified
 * Tokyo **transaction pooler :6543**).
 *
 * TXN-POOLER CAVEAT (critical): the transaction pooler swaps the backend connection between
 * statements — there is NO session state. So:
 *   - We do NOT use named/server-side prepared statements that outlive a statement.
 *   - Any `SET LOCAL` / GUC (e.g. an RLS-role probe) MUST live inside a single `tx()` (one checked-out
 *     client for the whole transaction). `tx()` checks out ONE client and runs BEGIN…COMMIT on it.
 *
 * TYPE NORMALIZATION (back to the SQLite-shaped expectations the services already encode):
 *   - boolean  → 0 | 1            (services read email_verified/notif_enabled/… as 0/1)
 *   - Date     → ISO string       (services read *_at / current_period_end as ISO text)
 *   - jsonb    → JSON string       (ProfileService JSON.parse(notif_prefs))
 *   - bigint   → number            (count(*) comes back as a JS bigint-string from pg)
 * uuid/text/int already match. This keeps every service's row-reading code unchanged across drivers.
 */
export class PgDb implements Db {
  readonly driver = 'pg' as const;
  private readonly pool: PgPool;

  private constructor(pool: PgPool) {
    this.pool = pool;
  }

  /** Async factory (pg is dynamic-imported so sqlite/offline never loads it). */
  static async create(connectionString: string): Promise<PgDb> {
    const pg = (await import('pg' as string)).default;
    const pool: PgPool = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX ?? 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // No statement_timeout GUC reliance across the txn pooler; keep it per-query if needed.
    });
    return new PgDb(pool);
  }

  private static normalizeRow<T>(row: Record<string, unknown> | undefined): T | undefined {
    if (!row) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = PgDb.normalizeValue(v);
    }
    return out as T;
  }

  private static normalizeValue(v: unknown): unknown {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return Number(v);
    // jsonb comes back already-parsed (object/array). The services that read jsonb columns expect a
    // JSON STRING (they JSON.parse it). Re-stringify objects/arrays; leave scalars as-is.
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    // pg returns count(*) / int8 as a numeric string; coerce purely-numeric strings to number so
    // `{ c: number }` reads keep working. (uuid/text are not all-digit so they're untouched.)
    if (typeof v === 'string' && /^\d+$/.test(v) && v.length < 16) return Number(v);
    return v;
  }

  private async exec<T>(runner: PgPool | PgPoolClient, sql: string, params: unknown[]): Promise<T[]> {
    const res = await runner.query(rewritePlaceholders(sql), params as any[]);
    return res.rows.map((r: Record<string, unknown>) => PgDb.normalizeRow<T>(r)!);
  }

  async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.exec<T>(this.pool, sql, params);
    return rows[0];
  }

  async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.exec<T>(this.pool, sql, params);
  }

  async run<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.exec<T>(this.pool, sql, params);
    return rows[0]; // RETURNING surfaces here; plain writes → undefined
  }

  /** One checked-out client for the whole transaction → safe across the txn pooler (no session bleed). */
  async tx<T>(fn: (txc: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const scoped: Db = {
      driver: 'pg',
      get: <U>(sql: string, params: unknown[] = []) => this.exec<U>(client, sql, params).then((r) => r[0]),
      all: <U>(sql: string, params: unknown[] = []) => this.exec<U>(client, sql, params),
      run: <U>(sql: string, params: unknown[] = []) => this.exec<U>(client, sql, params).then((r) => r[0]),
      tx: (inner) => inner(scoped), // already in a txn; reuse the same client
      close: async () => undefined,
    };
    try {
      await client.query('BEGIN');
      const r = await fn(scoped);
      await client.query('COMMIT');
      return r;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection may be dead; ignore */
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
