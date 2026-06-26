import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { join } from 'path';

/**
 * Runtime DB handle for the accounts/billing/quota slices (ADR-004). Opens the SAME local
 * dev.sqlite that migrate.ts/seed.ts produce — the schema is Postgres-portable, so prod swaps
 * this for a pg pool pointed at DATABASE_URL (Supabase pooled conn) behind the same method surface.
 *
 * better-sqlite3 is SYNCHRONOUS and SERIALIZES writes within a single connection — which is exactly
 * what makes the freemium atomic `UPDATE … WHERE used_count < limit RETURNING` race-safe locally
 * (see QuotaService). In Postgres the same single-statement conditional UPDATE is atomic per-row.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly db: Database.Database;

  constructor() {
    const path =
      process.env.SQLITE_PATH ?? join(__dirname, '..', '..', 'dev.sqlite');
    this.db = new Database(path);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
  }

  onModuleDestroy() {
    this.db.close();
  }
}
