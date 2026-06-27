import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { SqliteDb } from '../../../db/sqlite-db';
import { TrackedAccountsStore } from './tracked-accounts.store';
import { ApifySocialProvider, foodCategoryOrder } from './apify-social-provider';

/**
 * tracked_accounts store + DB-driven handle selection (ADR-006). Uses a REAL isolated in-memory SQLite
 * with the actual migrations applied (so the CHECK constraints + index + SQL are exercised, not mocked).
 */
function freshDb(): SqliteDb {
  const handle = new Database(':memory:');
  handle.pragma('foreign_keys = ON');
  const dir = join(__dirname, '..', '..', '..', 'db', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    handle.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return new SqliteDb(handle);
}

describe('TrackedAccountsStore — idempotent upsert + verified/confirm gating', () => {
  it('upsert inserts then UPDATES by handle (idempotent, no duplicate)', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);

    expect(await store.upsert({ handle: 'bukhari_kuwait', sector: 'food', category: 'rice', status: 'verified' }))
      .toBe('inserted');
    // re-import same handle with a changed note → updates, never duplicates
    expect(
      await store.upsert({ handle: 'bukhari_kuwait', sector: 'food', category: 'rice', status: 'verified', note: 'changed' }),
    ).toBe('updated');

    const rows = await db.all<{ n: number }>('SELECT COUNT(*) AS n FROM tracked_accounts');
    expect(rows[0].n).toBe(1); // unique by handle
    const row = await db.get<{ note: string }>('SELECT note FROM tracked_accounts WHERE handle = ?', ['bukhari_kuwait']);
    expect(row!.note).toBe('changed');
    await db.close();
  });

  it('strips a leading @ and normalizes hyphen categories to underscore', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    await store.upsert({ handle: '@homechefkw', sector: 'food', category: 'home-meal', status: 'verified' });
    const row = await db.get<{ handle: string; category: string }>(
      'SELECT handle, category FROM tracked_accounts WHERE handle = ?',
      ['homechefkw'],
    );
    expect(row!.handle).toBe('homechefkw'); // @ stripped
    expect(row!.category).toBe('home_meal'); // hyphen → underscore
    await db.close();
  });

  it('verifiedHandles returns ONLY verified rows — confirm/disabled are gated out', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    await store.upsert({ handle: 'rice_live', sector: 'food', category: 'rice', status: 'verified' });
    await store.upsert({ handle: 'rice_staged', sector: 'food', category: 'rice', status: 'confirm' });
    await store.upsert({ handle: 'rice_off', sector: 'food', category: 'rice', status: 'disabled' });

    const live = await store.verifiedHandles('food', 'rice');
    expect(live).toEqual(['rice_live']);
    expect(live).not.toContain('rice_staged'); // confirm NOT used live until promoted
    expect(live).not.toContain('rice_off');
    await db.close();
  });

  it('promote() flips a confirm row to verified so it becomes live', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    await store.upsert({ handle: 'newfind', sector: 'food', category: 'rice', status: 'confirm' });
    expect(await store.verifiedHandles('food', 'rice')).toEqual([]);
    await store.promote('newfind');
    expect(await store.verifiedHandles('food', 'rice')).toEqual(['newfind']);
    await db.close();
  });

  it('addTrackedAccount appends as VERIFIED by default; confirm when asked (hashtag-discovery)', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    await store.addTrackedAccount({ handle: 'vetted', sector: 'realestate', category: 'rent' });
    await store.addTrackedAccount({ handle: 'discovered', sector: 'realestate', category: 'rent', status: 'confirm' });
    const live = await store.verifiedHandles('realestate', 'rent');
    expect(live).toContain('vetted'); // vetted append goes live
    expect(live).not.toContain('discovered'); // hashtag find is staged
    await db.close();
  });

  it('counts groups by sector/category/status', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    await store.upsert({ handle: 'a', sector: 'food', category: 'rice', status: 'verified' });
    await store.upsert({ handle: 'b', sector: 'food', category: 'rice', status: 'verified' });
    await store.upsert({ handle: 'c', sector: 'food', category: 'rice', status: 'confirm' });
    const counts = await store.counts();
    const verified = counts.find((r) => r.category === 'rice' && r.status === 'verified');
    const confirm = counts.find((r) => r.category === 'rice' && r.status === 'confirm');
    expect(verified!.n).toBe(2);
    expect(confirm!.n).toBe(1);
    await db.close();
  });
});

describe('ApifySocialProvider — DB-driven handle selection (mocked Apify HTTP)', () => {
  let captured: Array<Record<string, any>>;
  const realFetch = global.fetch;

  beforeEach(() => {
    captured = [];
    process.env.APIFY_TOKEN = 'dummy';
    process.env.SOCIAL_TTL_MS = '1'; // effectively no cache between calls
    (global as any).fetch = async (_url: string, opts: any) => {
      captured.push(JSON.parse(opts.body));
      return { ok: true, json: async () => [] } as any;
    };
  });
  afterEach(() => {
    (global as any).fetch = realFetch;
    delete process.env.APIFY_TOKEN;
    delete process.env.SOCIAL_TTL_MS;
  });

  function handlesOf(body: Record<string, any>): string[] {
    return (body.directUrls ?? []).map((u: string) =>
      u.replace('https://www.instagram.com/', '').replace(/\/$/, ''),
    );
  }

  it('food query reads VERIFIED handles from the DB, rice-category leading', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    // mixed categories + a confirm row that must NOT appear
    await store.upsert({ handle: 'rice_seller', sector: 'food', category: 'rice', status: 'verified' });
    await store.upsert({ handle: 'cake_seller', sector: 'food', category: 'dessert', status: 'verified' });
    await store.upsert({ handle: 'rice_staged', sector: 'food', category: 'rice', status: 'confirm' });

    const provider = new ApifySocialProvider(store);
    await provider.fetchPosts({ vertical: 'food', text: 'bukhari rice', limit: 16 });

    const handles = handlesOf(captured[0]);
    expect(handles).toContain('rice_seller');
    expect(handles).toContain('cake_seller');
    expect(handles).not.toContain('rice_staged'); // confirm gated out
    // rice leads dessert for a rice query (foodCategoryOrder sanity)
    expect(foodCategoryOrder('bukhari rice')[0]).toBe('rice');
    expect(handles.indexOf('rice_seller')).toBeLessThan(handles.indexOf('cake_seller'));
    await db.close();
  });

  it('real-estate query reads VERIFIED RE handles from the DB (not the hardcoded 4)', async () => {
    const db = freshDb();
    const store = new TrackedAccountsStore(db);
    await store.upsert({ handle: 're_one', sector: 'realestate', category: 'rent', status: 'verified' });
    await store.upsert({ handle: 're_two', sector: 'realestate', category: 'agency', status: 'verified' });
    await store.upsert({ handle: 're_staged', sector: 'realestate', category: 'sale', status: 'confirm' });

    const provider = new ApifySocialProvider(store);
    await provider.fetchPosts({ vertical: 'realestate', text: 'flat salwa', limit: 16 });

    const handles = handlesOf(captured[0]);
    expect(handles.sort()).toEqual(['re_one', 're_two']);
    expect(handles).not.toContain('re_staged');
    await db.close();
  });

  it('falls back to the hardcoded list when the DB allow-list is EMPTY', async () => {
    const db = freshDb(); // migrated but no rows
    const provider = new ApifySocialProvider(new TrackedAccountsStore(db));
    await provider.fetchPosts({ vertical: 'realestate', text: 'flat', limit: 16 });
    const handles = handlesOf(captured[0]);
    // the hardcoded RE fallback seed
    expect(handles).toContain('majestic_kuwait');
    expect(handles.length).toBeGreaterThan(0);
    await db.close();
  });

  it('falls back to the hardcoded list when NO store is wired (offline spike)', async () => {
    const provider = new ApifySocialProvider(undefined);
    await provider.fetchPosts({ vertical: 'realestate', text: 'flat', limit: 16 });
    const handles = handlesOf(captured[0]);
    expect(handles).toEqual(['majestic_kuwait', 'amadell_for_rent', 'q8_rent', 'reokuwait']);
  });
});
