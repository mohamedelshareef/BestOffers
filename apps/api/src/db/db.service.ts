import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { join } from 'path';
import { Db } from './db.port';
import { SqliteDb } from './sqlite-db';
import { PgDb } from './pg-db';

/**
 * Driver-selecting DB facade (Supabase runtime cutover). Implements the async `Db` port and dispatches
 * to the engine chosen by `DB_DRIVER`:
 *   - `sqlite` (DEFAULT) → opens the local dev/test SQLite synchronously (unchanged behaviour: the
 *     102 API tests + keyless offline boot stay green).
 *   - `pg`             → a Supabase `pg.Pool` on DATABASE_URL (Tokyo txn pooler :6543), created LAZILY
 *     on first query (the pool factory is async; this ctor stays sync so `new DbService()` in specs
 *     and Nest DI is unchanged).
 *
 * Services depend on the async surface (`get/all/run/tx`). The raw better-sqlite3 handle is still
 * exposed as `.db` IN SQLITE MODE for the existing specs that seed/inspect tables synchronously.
 */
@Injectable()
export class DbService implements Db, OnModuleDestroy {
  readonly driver: 'sqlite' | 'pg';
  private sqlite?: SqliteDb;
  private pg?: PgDb;
  private pgInit?: Promise<PgDb>;

  constructor() {
    this.driver = process.env.DB_DRIVER === 'pg' ? 'pg' : 'sqlite';
    if (this.driver === 'sqlite') {
      const path = process.env.SQLITE_PATH ?? join(__dirname, '..', '..', 'dev.sqlite');
      const handle = new Database(path);
      handle.pragma('foreign_keys = ON');
      handle.pragma('journal_mode = WAL');
      this.sqlite = new SqliteDb(handle);
    }
  }

  /** Raw better-sqlite3 handle — ONLY valid in sqlite mode (specs use it synchronously). */
  get db(): Database.Database {
    if (!this.sqlite) {
      throw new Error('DbService.db (sync handle) is only available with DB_DRIVER=sqlite');
    }
    return this.sqlite.handle;
  }

  private async active(): Promise<Db> {
    if (this.sqlite) return this.sqlite;
    if (this.pg) return this.pg;
    if (!this.pgInit) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DB_DRIVER=pg requires DATABASE_URL');
      this.pgInit = PgDb.create(url).then((p) => (this.pg = p));
    }
    return this.pgInit;
  }

  async get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return (await this.active()).get<T>(sql, params);
  }
  async all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    return (await this.active()).all<T>(sql, params);
  }
  async run<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return (await this.active()).run<T>(sql, params);
  }
  async tx<T>(fn: (txc: Db) => Promise<T>): Promise<T> {
    return (await this.active()).tx<T>(fn);
  }

  async close(): Promise<void> {
    if (this.sqlite) this.sqlite.handle.close();
    if (this.pg) await this.pg.close();
  }

  onModuleDestroy() {
    // Best-effort; sqlite close is sync, pg close is async (fire-and-forget on shutdown).
    if (this.sqlite) this.sqlite.handle.close();
    if (this.pg) void this.pg.close();
  }
}
