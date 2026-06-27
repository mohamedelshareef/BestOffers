/**
 * Import the IG account seed (team/research/ig-accounts-seed.json) into the `tracked_accounts` table.
 *
 *   npx ts-node apps/api/scripts/import-tracked-accounts.ts
 *
 * - Idempotent UPSERT by handle (re-running updates metadata, never duplicates).
 * - VERIFIED seed rows  → status='verified' (used LIVE by the IG provider).
 * - CONFIRM  seed rows  → status='confirm'  (loaded but NOT used live until promoted via store.promote()).
 * - Prints per-sector/category counts after import.
 *
 * Run the migration first (npm run migrate). Honors DB_DRIVER/SQLITE_PATH like the rest of the app.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { DbService } from '../src/db/db.service';
import { TrackedAccountsStore } from '../src/offers/adapters/social/tracked-accounts.store';
import { SocialVertical } from '../src/offers/adapters/social/social-provider';

interface SeedAccount {
  handle: string;
  sector: SocialVertical;
  category: string;
  follower_tier?: string;
  recency?: string;
  posts_prices?: string;
  lang?: string;
  status: string; // "VERIFIED" | "CONFIRM"
  note?: string;
}

/** Resolved at call-time so tests can point IG_SEED_PATH at a fixture. */
function seedPath(): string {
  return (
    process.env.IG_SEED_PATH ??
    join(__dirname, '..', '..', '..', 'team', 'research', 'ig-accounts-seed.json')
  );
}

export async function importTrackedAccounts(db: DbService): Promise<{
  inserted: number;
  updated: number;
  perSectorCategory: Record<string, { verified: number; confirm: number }>;
}> {
  const raw = JSON.parse(readFileSync(seedPath(), 'utf8')) as { accounts: SeedAccount[] };
  const store = new TrackedAccountsStore(db);

  let inserted = 0;
  let updated = 0;
  const perSectorCategory: Record<string, { verified: number; confirm: number }> = {};

  for (const a of raw.accounts) {
    const status = a.status?.toUpperCase() === 'VERIFIED' ? 'verified' : 'confirm';
    const result = await store.upsert({
      handle: a.handle,
      sector: a.sector,
      category: a.category,
      follower_tier: a.follower_tier ?? null,
      recency: a.recency ?? null,
      posts_prices: a.posts_prices ?? null,
      lang: a.lang ?? null,
      status,
      note: a.note ?? null,
    });
    if (result === 'inserted') inserted += 1;
    else updated += 1;

    const key = `${a.sector}/${a.category}`;
    perSectorCategory[key] ??= { verified: 0, confirm: 0 };
    perSectorCategory[key][status] += 1;
  }

  return { inserted, updated, perSectorCategory };
}

async function main() {
  const db = new DbService();
  const { inserted, updated, perSectorCategory } = await importTrackedAccounts(db);

  console.log(`\nImport complete: ${inserted} inserted, ${updated} updated.\n`);
  console.log('Per sector/category (verified | confirm):');
  for (const [key, c] of Object.entries(perSectorCategory).sort()) {
    console.log(`  ${key.padEnd(22)}  verified=${c.verified}  confirm=${c.confirm}`);
  }

  const store = new TrackedAccountsStore(db);
  const counts = await store.counts();
  console.log('\nDB counts (live query, by status):');
  for (const r of counts) {
    console.log(`  ${r.sector}/${r.category}`.padEnd(28) + `  ${r.status.padEnd(9)} ${r.n}`);
  }
  await db.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
