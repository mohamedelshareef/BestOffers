import { Db } from '../../../db/db.port';
import { SocialVertical } from './social-provider';

/**
 * TrackedAccountsStore — the DB-backed curated IG allow-list (ADR-006 `tracked_accounts`).
 *
 * The IG ingestion lane (apify-social-provider.ts) reads handles from HERE — by (sector, category,
 * status='verified') — instead of a hardcoded in-code dict, so we can keep GROWING the list without a
 * code change. The hardcoded list survives ONLY as an offline fallback when this table is empty.
 *
 * status semantics:
 *   - 'verified' → used LIVE (returned by `verifiedHandles`).
 *   - 'confirm'  → staged: loaded but NOT used live until promoted to 'verified'. Hashtag-discovery finds
 *                  are auto-inserted here (`addTrackedAccount(..., {status:'confirm'})`).
 *   - 'disabled' → kill-switched, never returned.
 *
 * Category note: the seed/DB use UNDERSCORE categories (home_meal, meal_prep). The provider's in-code
 * FoodDishCategory uses HYPHENS (home-meal, meal-prep). `normalizeCategory` bridges them so a lookup by
 * either form works.
 */

export type TrackedStatus = 'verified' | 'confirm' | 'disabled';

export interface TrackedAccount {
  id: string;
  handle: string;
  sector: SocialVertical;
  category: string;
  follower_tier?: string | null;
  recency?: string | null;
  posts_prices?: string | null;
  lang?: string | null;
  status: TrackedStatus;
  note?: string | null;
  added_at: string;
  last_seen_at?: string | null;
}

export interface AddTrackedAccountInput {
  handle: string;
  sector: SocialVertical;
  category: string;
  follower_tier?: string | null;
  recency?: string | null;
  posts_prices?: string | null;
  lang?: string | null;
  status?: TrackedStatus;
  note?: string | null;
}

/** food categories use '_' in the DB/seed; the provider's FoodDishCategory uses '-'. Normalize to '_'. */
export function normalizeCategory(category: string): string {
  return (category || '').trim().toLowerCase().replace(/-/g, '_');
}

export class TrackedAccountsStore {
  constructor(private readonly db: Db) {}

  /**
   * Idempotent upsert BY HANDLE. Re-importing the seed updates metadata + status but never duplicates a
   * handle (UNIQUE). `added_at` is set once (first import); `last_seen_at` is left untouched here (the
   * ingestion pipeline maintains it). Returns 'inserted' | 'updated' for import accounting.
   */
  async upsert(input: AddTrackedAccountInput, now = new Date().toISOString()): Promise<'inserted' | 'updated'> {
    const handle = input.handle.trim().replace(/^@/, '');
    const category = normalizeCategory(input.category);
    const existing = await this.db.get<{ id: string }>(
      'SELECT id FROM tracked_accounts WHERE handle = ?',
      [handle],
    );
    if (existing) {
      await this.db.run(
        `UPDATE tracked_accounts
           SET sector = ?, category = ?, follower_tier = ?, recency = ?, posts_prices = ?,
               lang = ?, status = ?, note = ?
         WHERE handle = ?`,
        [
          input.sector,
          category,
          input.follower_tier ?? null,
          input.recency ?? null,
          input.posts_prices ?? null,
          input.lang ?? null,
          input.status ?? 'confirm',
          input.note ?? null,
          handle,
        ],
      );
      return 'updated';
    }
    await this.db.run(
      `INSERT INTO tracked_accounts
         (id, handle, sector, category, follower_tier, recency, posts_prices, lang, status, note, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `ta_${handle}`,
        handle,
        input.sector,
        category,
        input.follower_tier ?? null,
        input.recency ?? null,
        input.posts_prices ?? null,
        input.lang ?? null,
        input.status ?? 'confirm',
        input.note ?? null,
        now,
      ],
    );
    return 'inserted';
  }

  /**
   * Public helper to keep APPENDING good accounts. Defaults to status='verified' (a vetted append goes
   * live). Hashtag-discovery finds should pass status='confirm' so they're staged, not surfaced, until a
   * human promotes them. Idempotent (upsert by handle).
   */
  async addTrackedAccount(input: AddTrackedAccountInput): Promise<'inserted' | 'updated'> {
    return this.upsert({ status: 'verified', ...input });
  }

  /** All VERIFIED handles for a (sector, category), live-ordered. category accepts '-' or '_'. */
  async verifiedHandles(sector: SocialVertical, category: string): Promise<string[]> {
    const rows = await this.db.all<{ handle: string }>(
      `SELECT handle FROM tracked_accounts
        WHERE sector = ? AND category = ? AND status = 'verified'
        ORDER BY handle`,
      [sector, normalizeCategory(category)],
    );
    return rows.map((r) => r.handle);
  }

  /** All VERIFIED handles for a sector (every category), categories returned too for routing. */
  async verifiedForSector(sector: SocialVertical): Promise<Array<{ handle: string; category: string }>> {
    return this.db.all<{ handle: string; category: string }>(
      `SELECT handle, category FROM tracked_accounts
        WHERE sector = ? AND status = 'verified'
        ORDER BY category, handle`,
      [sector],
    );
  }

  /** Per-(sector, category, status) counts — used by the import report and ops. */
  async counts(): Promise<Array<{ sector: string; category: string; status: string; n: number }>> {
    return this.db.all<{ sector: string; category: string; status: string; n: number }>(
      `SELECT sector, category, status, COUNT(*) AS n
         FROM tracked_accounts
        GROUP BY sector, category, status
        ORDER BY sector, category, status`,
    );
  }

  /** Promote a staged ('confirm') handle to live ('verified'). */
  async promote(handle: string): Promise<void> {
    await this.db.run(
      `UPDATE tracked_accounts SET status = 'verified' WHERE handle = ? AND status = 'confirm'`,
      [handle.trim().replace(/^@/, '')],
    );
  }

  /** Touch last_seen_at after a successful ingestion pull (kept here so callers don't hand-write SQL). */
  async markSeen(handle: string, now = new Date().toISOString()): Promise<void> {
    await this.db.run('UPDATE tracked_accounts SET last_seen_at = ? WHERE handle = ?', [now, handle]);
  }
}
