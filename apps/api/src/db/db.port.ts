/**
 * Async DB port (Supabase runtime cutover). The accounts/billing/quota/auth services depend ONLY on
 * this surface, so the underlying engine is selectable at runtime by `DB_DRIVER`:
 *   - `sqlite` (DEFAULT) → SqliteDb (better-sqlite3, synchronous under the hood, returns resolved
 *     Promises). Keeps the 102 API tests + offline/keyless boot green.
 *   - `pg`             → PgDb (Supabase Postgres via a pooled `pg` connection).
 *
 * Query style is the SQLite `?` placeholder used throughout the services. PgDb rewrites `?`→`$n` so
 * the call sites need no per-dialect churn. `tx()` runs a callback inside a single transaction — on
 * the Supabase **transaction pooler (:6543) there is no session state**, so anything that needs
 * `SET LOCAL`/GUCs (e.g. RLS role for a test) MUST be wrapped here in one transaction.
 */
export interface Db {
  /** First row or undefined. Params are positional (`?` in SQL). */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** All rows. */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /**
   * Execute a write. If the SQL has a `RETURNING` clause the first returned row is given back
   * (used by the atomic freemium quota UPDATE). Otherwise resolves undefined.
   */
  run<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** Run `fn` inside a single transaction (one pooled connection for pg). */
  tx<T>(fn: (txc: Db) => Promise<T>): Promise<T>;
  /** Driver tag for diagnostics/health. */
  readonly driver: 'sqlite' | 'pg';
  close(): Promise<void>;
}

/** Rewrites positional `?` placeholders to Postgres `$1,$2…` (ignores `?` inside string literals). */
export function rewritePlaceholders(sql: string): string {
  let i = 0;
  let inSingle = false;
  let out = '';
  for (let p = 0; p < sql.length; p++) {
    const ch = sql[p];
    if (ch === "'") inSingle = !inSingle;
    if (ch === '?' && !inSingle) {
      out += `$${++i}`;
    } else {
      out += ch;
    }
  }
  return out;
}
