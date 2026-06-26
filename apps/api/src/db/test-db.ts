import Database from 'better-sqlite3';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Creates a fresh, migrated SQLite DB in a temp dir and points process.env.SQLITE_PATH at it, so
 * DbService (which reads SQLITE_PATH) opens an isolated per-suite DB. Returns the path. Call BEFORE
 * the Nest test module is created. Each spec gets its own DB → no cross-test bleed.
 */
export function makeTestDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bo-test-'));
  const path = join(dir, 'test.sqlite');
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  db.close();
  process.env.SQLITE_PATH = path;
  return path;
}
