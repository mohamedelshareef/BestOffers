import { Injectable } from '@nestjs/common';
import { FREE_SEARCH_LIMIT, QuotaStatus } from '@bestoffers/shared';
import { DbService } from '../db/db.service';
import { BillingService } from '../billing/billing.service';

/**
 * Freemium gate (ADR-004 Decision 5 / BA F-D2). Server-authoritative, keyed by userId.
 *
 * Order of checks at the enforcement point:
 *   1. premium? → proceed unlimited, counter NEVER touched (bypass is first + authoritative).
 *   2. else atomic conditional increment: UPDATE … WHERE used_count < LIMIT RETURNING used_count.
 *      - The single conditional statement is the cap (no read-then-write race). With better-sqlite3
 *        the write is serialized on the connection; in Postgres the per-row UPDATE is atomic. Either
 *        way, two concurrent #5 submissions can produce AT MOST one successful increment to 5 — the
 *        other gets zero rows updated → PAYWALL. Never a 6th free search.
 */
@Injectable()
export class QuotaService {
  constructor(
    private readonly dbs: DbService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Try to consume one free search. Returns:
   *   { allowed:true, premium:true }            → subscriber bypass
   *   { allowed:true, premium:false, used }     → counted a free search (used = new count, 1..5)
   *   { allowed:false, premium:false, used:5 }  → over quota → caller returns 402 PAYWALL
   */
  async tryConsume(userId: string): Promise<{ allowed: boolean; premium: boolean; used: number }> {
    if (await this.billing.isPremium(userId)) {
      return { allowed: true, premium: true, used: await this.usedCount(userId) };
    }
    await this.ensureRow(userId);

    // ATOMIC conditional increment via a single conditional UPDATE … RETURNING — the DB enforces the
    // cap with no read-then-write race (SQLite ≥3.35 and Postgres both support RETURNING).
    const row = await this.dbs.run<{ used_count: number }>(
      `UPDATE search_quota SET used_count = used_count + 1, updated_at = ?
       WHERE user_id = ? AND used_count < ?
       RETURNING used_count`,
      [new Date().toISOString(), userId, FREE_SEARCH_LIMIT],
    );

    if (!row) {
      return { allowed: false, premium: false, used: FREE_SEARCH_LIMIT };
    }
    return { allowed: true, premium: false, used: row.used_count };
  }

  async status(userId: string): Promise<QuotaStatus> {
    const premium = await this.billing.isPremium(userId);
    return { used: await this.usedCount(userId), limit: FREE_SEARCH_LIMIT, premium };
  }

  private async usedCount(userId: string): Promise<number> {
    const row = await this.dbs.get<{ used_count: number }>(
      'SELECT used_count FROM search_quota WHERE user_id=?',
      [userId],
    );
    return row?.used_count ?? 0;
  }

  private async ensureRow(userId: string): Promise<void> {
    await this.dbs.run(
      'INSERT INTO search_quota (user_id, used_count, updated_at) VALUES (?,0,?) ON CONFLICT(user_id) DO NOTHING',
      [userId, new Date().toISOString()],
    );
  }
}
