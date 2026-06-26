import Database from 'better-sqlite3';
import { Db } from './db.port';

/**
 * SqliteDb — the DEFAULT driver (DB_DRIVER=sqlite). Wraps better-sqlite3's SYNCHRONOUS API behind the
 * async `Db` port (returns resolved Promises). better-sqlite3 serializes writes on the single
 * connection, which is exactly what makes the freemium atomic `UPDATE … WHERE used_count < limit
 * RETURNING` race-safe locally. SQLite ≥3.35 supports RETURNING, so `run()` can surface the returned row.
 *
 * The raw `Database` handle stays accessible via `.handle` so the existing specs (which seed/inspect
 * tables synchronously via `dbs.db.prepare(...)`) are untouched.
 */
export class SqliteDb implements Db {
  readonly driver = 'sqlite' as const;
  readonly handle: Database.Database;

  constructor(handle: Database.Database) {
    this.handle = handle;
  }

  async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.handle.prepare(sql).get(...(params as any[])) as T | undefined;
  }

  async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.handle.prepare(sql).all(...(params as any[])) as T[];
  }

  async run<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const stmt = this.handle.prepare(sql);
    if (/\breturning\b/i.test(sql)) {
      return stmt.get(...(params as any[])) as T | undefined;
    }
    stmt.run(...(params as any[]));
    return undefined;
  }

  async tx<T>(fn: (txc: Db) => Promise<T>): Promise<T> {
    // better-sqlite3 transactions are synchronous; since our fn is async we emulate a transaction with
    // explicit BEGIN/COMMIT/ROLLBACK on the same handle (single connection → serialized).
    this.handle.exec('BEGIN');
    try {
      const r = await fn(this);
      this.handle.exec('COMMIT');
      return r;
    } catch (e) {
      this.handle.exec('ROLLBACK');
      throw e;
    }
  }

  async close(): Promise<void> {
    this.handle.close();
  }
}
