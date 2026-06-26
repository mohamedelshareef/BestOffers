import { RawPost, SocialProvider, SocialQuery, SocialVertical } from './social-provider';

/**
 * ApifySocialProvider (ADR-006 §Decision-1) — the REAL Instagram acquisition lane.
 *
 * Bound when SOCIAL_PROVIDER=apify. Calls the Apify `instagram-scraper` actor over a small CURATED
 * allow-list of verified Kuwait food handles (food-instagram-accounts.md), pulls the run's dataset
 * synchronously, and maps each real post row → RawPost. We never fetch Instagram ourselves (IG=RED,
 * ADR-006 §1); Apify does the acquisition off our infrastructure and we consume structured JSON.
 *
 * VERIFIED call shape (free tier, 2026-06-26):
 *   POST https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN
 *   body { directUrls:["https://www.instagram.com/<handle>/"], resultsType:"posts",
 *          resultsLimit:N, onlyPostsNewerThan:"30 days" }
 *   → 200 with a JSON ARRAY of post rows: { id, shortCode, caption, hashtags, url, timestamp, … }.
 *   url = permalink, timestamp = ISO date. A handle that fails resolves to a single
 *   { error:'not_found', … } row, which we skip.
 *
 * COST PROTECTION (free credits):
 *   - in-process TTL cache (SOCIAL_TTL_MS, 6h) keyed by vertical — user traffic never triggers Apify.
 *   - a per-MONTH call cap (SOCIAL_MONTHLY_RESULT_CAP, default 50) so a misconfigured loop can't burn
 *     the free tier; once the cap is hit we serve cache (or []) and log a warning.
 *   - resultsLimit hard-capped per handle; a small curated handle list (~5).
 */

/** Curated, verified Kuwait FOOD handles (food-instagram-accounts.md §A/§B) — [V] verified profiles. */
const FOOD_HANDLES = ['offer_food_kw', 'basickuwait', 'kuwait_eateries', 'themealboxkw', 'mug.cr'];

/** Real-estate handles are not seeded for the live lane yet (Phase-2, ADR-006). */
const HANDLES: Record<SocialVertical, string[]> = {
  food: FOOD_HANDLES,
  realestate: [],
};

interface ApifyRow {
  id?: string;
  shortCode?: string;
  caption?: string;
  hashtags?: string[];
  url?: string;
  timestamp?: string;
  displayUrl?: string;
  ownerUsername?: string;
  error?: string; // 'not_found' for a failed handle row — skipped
}

interface CacheEntry {
  posts: RawPost[];
  expiresAt: number;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export class ApifySocialProvider implements SocialProvider {
  readonly name = 'apify';

  private readonly cache = new Map<SocialVertical, CacheEntry>();
  private monthKey = currentMonthKey();
  private callsThisMonth = 0;

  private get token(): string | undefined {
    return process.env.APIFY_TOKEN;
  }
  private get actor(): string {
    // Apify actor ids use `~` in the run path (org~actor); `/` is also accepted but `~` is canonical.
    return (process.env.APIFY_IG_ACTOR ?? 'apify/instagram-scraper').replace('/', '~');
  }
  private get ttlMs(): number {
    const env = Number(process.env.SOCIAL_TTL_MS);
    return Number.isFinite(env) && env > 0 ? env : SIX_HOURS_MS;
  }
  private get monthlyCap(): number {
    const env = Number(process.env.SOCIAL_MONTHLY_RESULT_CAP);
    return Number.isFinite(env) && env > 0 ? env : 50;
  }
  private get perHandleLimit(): number {
    const env = Number(process.env.APIFY_RESULTS_LIMIT);
    return Number.isFinite(env) && env > 0 ? Math.min(env, 30) : 10;
  }

  async fetchPosts(query: SocialQuery): Promise<RawPost[]> {
    if (!this.token) {
      throw new Error(
        'ApifySocialProvider: APIFY_TOKEN missing. Set SOCIAL_PROVIDER=mock for offline/tests, or ' +
          'provide APIFY_TOKEN to run the live Instagram lane (ADR-006 §3).',
      );
    }
    const handles = HANDLES[query.vertical];
    if (!handles || handles.length === 0) return [];

    // Serve a fresh cache hit — user search traffic must never trigger an Apify run (decouples cost).
    const cached = this.cache.get(query.vertical);
    if (cached && cached.expiresAt > Date.now()) {
      return rankByQuery(cached.posts, query);
    }

    // Monthly call cap — protect the free credits. Reset the counter when the month rolls over.
    const nowMonth = currentMonthKey();
    if (nowMonth !== this.monthKey) {
      this.monthKey = nowMonth;
      this.callsThisMonth = 0;
    }
    if (this.callsThisMonth >= this.monthlyCap) {
      // Cap reached: serve a stale cache if we have one, else empty — NEVER another Apify call.
      if (cached) return rankByQuery(cached.posts, query);
      // eslint-disable-next-line no-console
      console.warn(
        `[ApifySocialProvider] monthly cap ${this.monthlyCap} reached — serving no live posts ` +
          `(set SOCIAL_MONTHLY_RESULT_CAP to raise).`,
      );
      return [];
    }

    const posts = await this.runActor(handles, query.vertical);
    this.callsThisMonth += 1;
    this.cache.set(query.vertical, { posts, expiresAt: Date.now() + this.ttlMs });
    return rankByQuery(posts, query);
  }

  /** One Apify run over the curated allow-list → mapped RawPost[] (not_found/error rows skipped). */
  private async runActor(handles: string[], vertical: SocialVertical): Promise<RawPost[]> {
    const directUrls = handles.map((h) => `https://www.instagram.com/${h}/`);
    const url = `https://api.apify.com/v2/acts/${this.actor}/run-sync-get-dataset-items?token=${this.token}`;
    const body = {
      directUrls,
      resultsType: 'posts',
      resultsLimit: this.perHandleLimit,
      onlyPostsNewerThan: '30 days',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Apify run failed: HTTP ${res.status} ${await safeText(res)}`);
    }
    const rows = (await res.json()) as ApifyRow[];
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => mapRow(r, vertical)).filter((p): p is RawPost => p !== null);
  }
}

/** Map one Apify dataset row → RawPost; return null for not_found/error rows or rows missing a permalink. */
export function mapRow(row: ApifyRow, vertical: SocialVertical): RawPost | null {
  if (!row || row.error) return null; // skip { error:'not_found' } and other error rows gracefully
  const permalink = row.url ?? (row.shortCode ? `https://www.instagram.com/p/${row.shortCode}/` : '');
  if (!permalink) return null;
  const caption = (row.caption ?? '').trim();
  if (!caption) return null; // no caption → nothing for Claude to extract
  return {
    id: row.id ?? row.shortCode ?? permalink,
    ownerHandle: row.ownerUsername ?? '',
    caption,
    imageUrl: row.displayUrl ?? '',
    permalink,
    timestamp: row.timestamp ?? new Date().toISOString(),
    vertical,
  };
}

/** Light pre-rank toward the query terms (same idea as the mock provider) — all posts still flow on. */
function rankByQuery(posts: RawPost[], query: SocialQuery): RawPost[] {
  const limit = query.limit ?? 16;
  const terms = query.text.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return posts.slice(0, limit);
  return posts
    .map((p) => ({ p, score: terms.reduce((s, t) => s + (p.caption.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p)
    .slice(0, limit);
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}
