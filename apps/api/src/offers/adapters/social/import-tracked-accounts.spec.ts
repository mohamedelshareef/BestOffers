import Database from 'better-sqlite3';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SqliteDb } from '../../../db/sqlite-db';
import { TrackedAccountsStore } from './tracked-accounts.store';
import { importTrackedAccounts } from '../../../../scripts/import-tracked-accounts';

/**
 * Import script tests (ADR-006): the seed → tracked_accounts upsert is idempotent and maps
 * VERIFIED→verified (live) vs CONFIRM→confirm (staged, NOT live). A tiny fixture seed keeps it
 * deterministic; importTrackedAccounts honors IG_SEED_PATH.
 */
function migratedDb(): SqliteDb {
  const handle = new Database(':memory:');
  const dir = join(__dirname, '..', '..', '..', 'db', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    handle.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return new SqliteDb(handle);
}

const FIXTURE = {
  accounts: [
    { handle: 'rice_v', sector: 'food', category: 'rice', status: 'VERIFIED', note: 'live rice' },
    { handle: 'rice_c', sector: 'food', category: 'rice', status: 'CONFIRM', note: 'staged rice' },
    { handle: 'rent_v', sector: 'realestate', category: 'rent', status: 'VERIFIED', note: 'live rent' },
  ],
};

describe('importTrackedAccounts', () => {
  let seedPath: string;
  beforeAll(() => {
    seedPath = join(mkdtempSync(join(tmpdir(), 'bo-seed-')), 'seed.json');
    writeFileSync(seedPath, JSON.stringify(FIXTURE));
    process.env.IG_SEED_PATH = seedPath;
  });
  afterAll(() => delete process.env.IG_SEED_PATH);

  it('imports VERIFIED as verified (live) and CONFIRM as confirm (staged)', async () => {
    const db = migratedDb();
    const r = await importTrackedAccounts(db as any);
    expect(r.inserted).toBe(3);
    expect(r.updated).toBe(0);

    const store = new TrackedAccountsStore(db);
    // verified rice handle is live; confirm rice handle is NOT
    const liveRice = await store.verifiedHandles('food', 'rice');
    expect(liveRice).toContain('rice_v');
    expect(liveRice).not.toContain('rice_c');
    // confirm row exists but staged
    const staged = await db.get<{ status: string }>('SELECT status FROM tracked_accounts WHERE handle = ?', ['rice_c']);
    expect(staged!.status).toBe('confirm');
    await db.close();
  });

  it('is idempotent — re-import updates, never duplicates', async () => {
    const db = migratedDb();
    await importTrackedAccounts(db as any);
    const second = await importTrackedAccounts(db as any);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(3);
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM tracked_accounts');
    expect(n!.n).toBe(3);
    await db.close();
  });
});
