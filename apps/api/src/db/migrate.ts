/**
 * Local-dev migration runner. Applies the Postgres-compatible DDL into a SQLite file
 * (acceptable local DB per Sprint 2 goal — schema stays Postgres-portable).
 *
 *   npm run migrate --workspace @bestoffers/api      # → apps/api/dev.sqlite
 *
 * Production uses Postgres; run 0001_init.sql there (after the jsonb/uuid/tsvector swaps noted
 * in the file header) via your migration tool of choice.
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DB_PATH = process.env.SQLITE_PATH ?? join(__dirname, '..', '..', 'dev.sqlite');
const MIGRATIONS_DIR = join(__dirname, 'migrations');

function run() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec(sql);
    console.log(`applied ${file}`);
  }

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r: any) => r.name);
  console.log(`migrated → ${DB_PATH}`);
  console.log(`tables: ${tables.join(', ')}`);
  db.close();
}

run();
