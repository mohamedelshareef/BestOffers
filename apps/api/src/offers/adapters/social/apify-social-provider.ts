import { RawPost, SocialProvider, SocialQuery, SocialVertical } from './social-provider';
import { TrackedAccountsStore, normalizeCategory } from './tracked-accounts.store';

/**
 * ApifySocialProvider (ADR-006 §Decision-1) — the REAL Instagram acquisition lane.
 *
 * Bound when SOCIAL_PROVIDER=apify. Calls the Apify `instagram-scraper` actor over a small CURATED
 * allow-list of verified Kuwait DIRECT-seller handles, pulls the run's dataset synchronously, and maps
 * each real post row → RawPost. We never fetch Instagram ourselves (IG=RED, ADR-006 §1); Apify does the
 * acquisition off our infrastructure and we consume structured JSON.
 *
 * HANDLE SOURCE — DB-driven (ADR-006 `tracked_accounts`): when a `TrackedAccountsStore` is injected, the
 * allow-list is read from the DB (status='verified' rows, sector + matched dish-category ordering) so we
 * keep GROWING it without a code change. The hardcoded HANDLES_FOOD / REALESTATE_HANDLES dicts below
 * remain ONLY as the offline fallback used when the table is empty (or no store was wired). To append a
 * good account live: `store.addTrackedAccount({handle,sector,category})` (defaults status='verified').
 * Hashtag-discovery finds (the home-kitchen / من-المالك long tail) can be auto-inserted as
 * status='confirm' — staged, NOT surfaced live until a human promotes them via `store.promote(handle)`.
 *
 * Two acquisition modes (both flow through the SAME mapRow → Claude extraction → relevance filter):
 *   1. HANDLE mode (always on): pull recent posts for the curated [V] allow-list handles per vertical.
 *   2. HASHTAG-DISCOVERY mode (opt-in, SOCIAL_HASHTAG_DISCOVERY=on): pull recent posts for a small curated
 *      set of Kuwait food/RE hashtags — this captures the home-kitchen / individual-seller long tail that
 *      cannot be hand-listed (food-instagram-accounts.md §3, real-estate-instagram-accounts.md §3). STRICT
 *      cost-cap: a separate cache, small resultsLimit, dedup by permalink against the handle posts.
 *
 * VERIFIED call shapes (free tier, 2026-06-26):
 *   HANDLE:  POST .../acts/apify~instagram-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN
 *            body { directUrls:["https://www.instagram.com/<handle>/"], resultsType:"posts",
 *                   resultsLimit:N, onlyPostsNewerThan:"30 days" }
 *   HASHTAG: same endpoint, body { search:"<tag>", searchType:"hashtag", resultsType:"posts",
 *                   resultsLimit:N, onlyPostsNewerThan:"30 days" } (the actor also accepts
 *                   directUrls:["https://www.instagram.com/explore/tags/<tag>/"] — search is cleaner).
 *   → 200 with a JSON ARRAY of post rows: { id, shortCode, caption, hashtags, url, timestamp, … }.
 *   url = permalink, timestamp = ISO date. A handle that fails resolves to a single
 *   { error:'not_found', … } row, which we skip.
 *
 * COST PROTECTION (free credits):
 *   - in-process TTL cache (SOCIAL_TTL_MS, 6h) keyed by vertical+mode — user traffic never triggers Apify.
 *   - a per-MONTH call cap (SOCIAL_MONTHLY_RESULT_CAP, default 50) covering BOTH modes so a misconfigured
 *     loop can't burn the free tier; once the cap is hit we serve cache (or []) and log a warning.
 *   - resultsLimit hard-capped per handle/hashtag; hashtag mode uses a SMALLER limit + smaller curated set.
 *   - hashtag discovery is OFF by default (SOCIAL_HASHTAG_DISCOVERY) — opt-in only.
 */

/**
 * Curated, verified Kuwait DIRECT-seller FOOD handles — [V] from food-instagram-accounts.md "Seed list"
 * (the researcher's CATEGORY-TAGGED `HANDLES_FOOD`). @ stripped. Each handle is tagged with a `dish_category`
 * so the matcher routes a query to the right sellers (rice query → rice/home-meal sellers, NOT bakeries).
 *
 * OWNER BUG FIX (2026-06-27): "Bukhari food" (رز بخاري, a RICE dish) used to surface @layers_kw cakes because
 * the old flat list was bakery-heavy and there was NO category routing. We now LEAD a food run with the
 * handles in the MATCHING dish category (see `routeFoodHandles`) so rice/grill/dessert queries pull the right
 * accounts first. Deliberately EXCLUDES aggregator/offers-repost pages (offer_food_kw, kuwait_eateries, …)
 * per the DIRECT-seller rule. CONFIRM-only/unverified/non-Kuwait handles are NOT included.
 */
export type FoodDishCategory = 'rice' | 'home-meal' | 'grill' | 'meal-prep' | 'dessert' | 'cloud';

const HANDLES_FOOD: Record<FoodDishCategory, string[]> = {
  // RICE & main rice dishes (bukhari, machboos, biryani, kabsa, mandi, mansaf) — fixes the "Bukhari→cake" bug
  rice: [
    'bukhari_kuwait', 'alamir_bukhari', 'maidaalmandi', 'malekalmajbous',
    'machbos_daqoos', 'manasif_', 'mansafna_kw', 'kabsa.house',
  ],
  // HOME-cooked daily meals (مطبخ منزلي / اكل بيتي)
  'home-meal': [
    'homechefkw', 'kuwait_kitchens', 'beitelmansaf', 'kuwaitkitchensgroup',
  ],
  // GRILLS (مشاوي / مشكاك)
  grill: [
    'mashawi_alzayn', 'mashawi.kw', 'mashawikw', 'mishkak_kw',
  ],
  // MEAL-PREP / healthy subscriptions (cleanest priced offers)
  'meal-prep': [
    'basickuwait', 'scale.kuwait', 'chefpaulkitchen', 'portionkw', 'themealboxkw',
    'cleaneats.co', 'numou.life', 'dietstation', 'wolfnutrition.kw', 'linasanddinasretail',
    'dietcenterkw', 'thedietcare', 'lofatgroup', 'proteinkw', 'tuningkw', 'caloriecontrol',
  ],
  // DESSERTS / bakery (SUPPORTING set — must NOT lead a rice/grill/meal query)
  dessert: [
    'layers_kw', 'thecakeshop_kuwait', 'bakehaus.kuwait', 'js_bakery', 'bakingstudiokuwait',
    'sheezbakes', 'cakentakekw', 'zahracakes_kwt', 'baker_tanya.kw',
  ],
  // CLOUD / IG-led brands
  cloud: [
    'burgerinn.kw', 'bbtkw', 'mug.cr', 'collective_kw',
  ],
};

/**
 * Query → dish-category routing (researcher's starter map, food-instagram-accounts.md "Matcher guidance").
 * Lowercased AR+EN keywords. When a food query hits one of these, we LEAD the handle run with that
 * category's accounts (plus the linked support category) so the right sellers are fetched/ranked first.
 */
const FOOD_CATEGORY_KEYWORDS: Array<{ category: FoodDishCategory; also?: FoodDishCategory; words: string[] }> = [
  {
    category: 'rice',
    also: 'home-meal',
    words: [
      'bukhari', 'bukhary', 'boukhari', 'بخاري',
      'machboos', 'majboos', 'machbous', 'makboos', 'مجبوس', 'مكبوس',
      'biryani', 'biriyani', 'briyani', 'برياني', 'بريانى',
      'kabsa', 'kabseh', 'كبسه', 'كبسة',
      'mandi', 'مندي',
      'mansaf', 'منسف',
      'rice', 'riz', 'رز', 'ارز', 'أرز', 'maqluba', 'مقلوبه', 'مقلوبة',
    ],
  },
  {
    category: 'home-meal',
    also: 'rice',
    words: ['home food', 'homemade', 'اكل بيتي', 'أكل بيتي', 'مطبخ منزلي', 'daily meal', 'box', 'بوكس', 'وجبات بيتيه'],
  },
  {
    category: 'grill',
    words: ['mashawi', 'mashwi', 'grill', 'grilled', 'mishkak', 'tikka', 'kebab', 'kabab', 'مشاوي', 'مشكاك', 'مشويات', 'كباب', 'شواء', 'تكه'],
  },
  {
    category: 'meal-prep',
    words: ['diet', 'healthy', 'keto', 'paleo', 'meal plan', 'meal prep', 'low carb', 'subscription', 'دايت', 'صحي', 'كيتو', 'اشتراك وجبات', 'رجيم'],
  },
  {
    category: 'dessert',
    words: ['cake', 'كيك', 'كيكه', 'dessert', 'حلى', 'حلو', 'حلويات', 'sweet', 'sweets', 'cupcake', 'كب كيك', 'بسبوسه', 'كنافه'],
  },
  {
    category: 'cloud',
    words: ['burger', 'برجر', 'coffee', 'قهوه', 'قهوة', 'كوفي'],
  },
];

const FOOD_CATEGORY_ORDER: FoodDishCategory[] = ['rice', 'home-meal', 'grill', 'meal-prep', 'dessert', 'cloud'];

/**
 * Order the food handle list so the matching dish category for the query is fetched/ranked FIRST.
 * Rice query → rice + home-meal accounts lead; a cake query → dessert leads. When no dish category is
 * detected, fall back to the full seed in a stable order (meal-prep first — cleanest priced offers).
 * ALWAYS returns the full deduped union (every seeded seller stays reachable) — only the ORDER changes,
 * so the per-handle limit + ranker surface the right category first without dropping the long tail.
 */
/**
 * Resolve the FULL dish-category order for a query: the matched category(ies) LEAD, then the rest in a
 * stable order. Exported + shared by `routeFoodHandles` (hardcoded fallback) AND the DB-driven handle
 * selection (so DB rows are ranked into the same rice-first / cake-first order).
 */
export function foodCategoryOrder(query: string): FoodDishCategory[] {
  const q = (query || '').toLowerCase();
  const lead: FoodDishCategory[] = [];
  for (const rule of FOOD_CATEGORY_KEYWORDS) {
    if (rule.words.some((w) => q.includes(w.toLowerCase()))) {
      if (!lead.includes(rule.category)) lead.push(rule.category);
      if (rule.also && !lead.includes(rule.also)) lead.push(rule.also);
    }
  }
  return lead.length
    ? [...lead, ...FOOD_CATEGORY_ORDER.filter((c) => !lead.includes(c))]
    : ['meal-prep', ...FOOD_CATEGORY_ORDER.filter((c) => c !== 'meal-prep')];
}

export function routeFoodHandles(query: string): string[] {
  const order = foodCategoryOrder(query);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const cat of order) {
    for (const h of HANDLES_FOOD[cat]) {
      if (!seen.has(h)) {
        seen.add(h);
        out.push(h);
      }
    }
  }
  return out;
}

/** Flat union of all seeded food handles (stable order) — used when no query is supplied. */
const FOOD_HANDLES = routeFoodHandles('');

/**
 * Curated, verified Kuwait DIRECT flat-lister REAL-ESTATE handles — [V] from
 * real-estate-instagram-accounts.md "Seed list". @ stripped. Furnished-apartment operators (strongest
 * direct listers, post own units with area+rooms+phone) then a small direct broker. EXCLUDES portals
 * (q84sale/boshamlan/bayut/opensooq — those are the separate portal data layer) and CONFIRM-only handles.
 */
const REALESTATE_HANDLES = [
  // Furnished-apartment operators (strongest direct listers)
  'majestic_kuwait',
  'amadell_for_rent',
  'q8_rent',
  // Direct broker / from-owner
  'reokuwait',
];

const HANDLES: Record<SocialVertical, string[]> = {
  food: FOOD_HANDLES,
  realestate: REALESTATE_HANDLES,
};

/**
 * Small curated hashtag set for long-tail discovery (food-instagram-accounts.md §3 +
 * real-estate-instagram-accounts.md §3). These surface the home-kitchen / من-المالك individual sellers
 * that CANNOT be hand-listed. Kept SMALL — each tag = one hashtag-scraper run → cost. Tags WITHOUT '#'.
 *
 * REAL FINDING (live probe 2026-06-27): the dedicated `apify/instagram-hashtag-scraper` actor DOES expand
 * a tag into real recent posts (caption + permalink + owner). The very niche AR tags (e.g.
 * `مطبخ_منزلي_الكويت`) often return `no_items` — IG has few/none indexed (matches the researcher's note
 * that these tags surface noise). We therefore lead each vertical with a BUSY tag that returns posts and
 * keep the niche AR tag too (free of cost when empty — the relevance filter drops off-topic results
 * downstream). Order = most-likely-to-return first.
 */
const DISCOVERY_HASHTAGS: Record<SocialVertical, string[]> = {
  food: ['foodkuwait', 'مطبخ_منزلي_الكويت'],
  realestate: ['kuwaitrealestate', 'شقق_للايجار_الكويت'],
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

  // Cache keyed by `${vertical}:${mode}` so handle vs hashtag pulls cache independently.
  private readonly cache = new Map<string, CacheEntry>();
  private monthKey = currentMonthKey();
  private callsThisMonth = 0;

  /**
   * Optional DB-backed allow-list (ADR-006 `tracked_accounts`). When present, handle selection queries
   * the DB (verified rows, sector + matched category ordering) instead of the hardcoded HANDLES_FOOD /
   * REALESTATE_HANDLES dicts. The hardcoded list is used ONLY as an offline fallback when the table is
   * empty (or no store was injected — e.g. an offline spike with no DB).
   */
  constructor(private readonly accounts?: TrackedAccountsStore) {}

  private get token(): string | undefined {
    return process.env.APIFY_TOKEN;
  }
  private get actor(): string {
    // Apify actor ids use `~` in the run path (org~actor); `/` is also accepted but `~` is canonical.
    return (process.env.APIFY_IG_ACTOR ?? 'apify/instagram-scraper').replace('/', '~');
  }
  /**
   * Hashtag discovery uses a DIFFERENT actor: the post-scraper's `searchType:hashtag` only returns tag
   * ENTITIES (a /explore/tags/ row, no caption) on the free tier — VERIFIED 2026-06-27. The dedicated
   * `apify/instagram-hashtag-scraper` actor expands a tag into real recent POSTS (caption+permalink+owner).
   */
  private get hashtagActor(): string {
    return (process.env.APIFY_IG_HASHTAG_ACTOR ?? 'apify/instagram-hashtag-scraper').replace('/', '~');
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
  /** Hashtag discovery is opt-in and harder to cost-bound (one tag = many accounts) → smaller limit. */
  private get hashtagDiscoveryOn(): boolean {
    return (process.env.SOCIAL_HASHTAG_DISCOVERY ?? '').toLowerCase() === 'on';
  }
  private get perHashtagLimit(): number {
    const env = Number(process.env.APIFY_HASHTAG_RESULTS_LIMIT);
    return Number.isFinite(env) && env > 0 ? Math.min(env, 15) : 5;
  }

  async fetchPosts(query: SocialQuery): Promise<RawPost[]> {
    if (!this.token) {
      throw new Error(
        'ApifySocialProvider: APIFY_TOKEN missing. Set SOCIAL_PROVIDER=mock for offline/tests, or ' +
          'provide APIFY_TOKEN to run the live Instagram lane (ADR-006 §3).',
      );
    }

    // 1) HANDLE mode — the curated [V] allow-list (always on). For FOOD the handle ORDER is routed to the
    //    query's dish category (rice query → rice/home-meal sellers first, NOT bakeries) — OWNER bug fix.
    const handlePosts = await this.pullMode(query.vertical, 'handles', query.text);

    // 2) HASHTAG-DISCOVERY mode — opt-in long-tail. Deduped by permalink against the handle posts.
    if (!this.hashtagDiscoveryOn) {
      return rankByQuery(handlePosts, query);
    }
    const hashtagPosts = await this.pullMode(query.vertical, 'hashtags', query.text);
    const merged = dedupeByPermalink([...handlePosts, ...hashtagPosts]);
    return rankByQuery(merged, query);
  }

  /**
   * Resolve the curated handle allow-list for a vertical from the DB (tracked_accounts, status='verified')
   * when a store is wired, falling back to the hardcoded HANDLES dict ONLY when the table is empty or no
   * store was injected. For FOOD the DB rows are RANKED into the query's dish-category order (rice→rice
   * sellers lead) using the same routing as `routeFoodHandles`. Logs the source so a live run shows
   * whether handles came from the DB or the fallback.
   */
  private async resolveHandleTargets(vertical: SocialVertical, queryText: string): Promise<string[]> {
    if (this.accounts) {
      try {
        const dbHandles = await this.dbHandles(vertical, queryText);
        if (dbHandles.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[ApifySocialProvider] handles source=DB (tracked_accounts) vertical=${vertical} ` +
              `count=${dbHandles.length} lead=${dbHandles.slice(0, 3).join(',')}`,
          );
          return dbHandles;
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[ApifySocialProvider] tracked_accounts empty for vertical=${vertical} — using hardcoded fallback.`,
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ApifySocialProvider] tracked_accounts query failed (${(e as Error).message}) — using fallback.`,
        );
      }
    }
    // Offline / empty-DB fallback (the ONLY remaining use of the hardcoded dicts).
    return vertical === 'food' ? routeFoodHandles(queryText) : HANDLES[vertical];
  }

  /** Query the DB allow-list; for food rank rows into the query's dish-category lead order. */
  private async dbHandles(vertical: SocialVertical, queryText: string): Promise<string[]> {
    const store = this.accounts!;
    if (vertical !== 'food') {
      const rows = await store.verifiedForSector(vertical);
      return rows.map((r) => r.handle);
    }
    const rows = await store.verifiedForSector('food');
    const order = foodCategoryOrder(queryText).map(normalizeCategory);
    const rank = (cat: string) => {
      const i = order.indexOf(normalizeCategory(cat));
      return i === -1 ? order.length : i;
    };
    const seen = new Set<string>();
    return rows
      .slice()
      .sort((a, b) => rank(a.category) - rank(b.category))
      .map((r) => r.handle)
      .filter((h) => (seen.has(h) ? false : (seen.add(h), true)));
  }

  /**
   * Cache-or-run one acquisition mode for a vertical. Each (vertical, mode) caches independently and
   * shares the single monthly call cap. Returns [] when there's nothing curated for that vertical/mode.
   */
  private async pullMode(
    vertical: SocialVertical,
    mode: 'handles' | 'hashtags',
    queryText = '',
  ): Promise<RawPost[]> {
    // Handle targets come from the DB allow-list (tracked_accounts, verified rows) when a store is wired;
    // otherwise from the hardcoded HANDLES dict (offline fallback). FOOD order is routed to the query's
    // dish category (rice→rice sellers first), fixing the "Bukhari→cake" bug. RE keeps its seed order.
    const handleTargets = await this.resolveHandleTargets(vertical, queryText);
    const targets = mode === 'handles' ? handleTargets : DISCOVERY_HASHTAGS[vertical];
    if (!targets || targets.length === 0) return [];

    const cacheKey = `${vertical}:${mode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.posts;
    }

    // Monthly call cap — protect the free credits. Covers BOTH modes. Reset on month rollover.
    const nowMonth = currentMonthKey();
    if (nowMonth !== this.monthKey) {
      this.monthKey = nowMonth;
      this.callsThisMonth = 0;
    }
    if (this.callsThisMonth >= this.monthlyCap) {
      if (cached) return cached.posts; // stale cache rather than a new call
      // eslint-disable-next-line no-console
      console.warn(
        `[ApifySocialProvider] monthly cap ${this.monthlyCap} reached (mode=${mode}) — serving no live ` +
          `posts (set SOCIAL_MONTHLY_RESULT_CAP to raise).`,
      );
      return [];
    }

    const posts =
      mode === 'handles'
        ? await this.runHandles(targets, vertical)
        : await this.runHashtags(targets, vertical);
    this.callsThisMonth += 1;
    this.cache.set(cacheKey, { posts, expiresAt: Date.now() + this.ttlMs });
    return posts;
  }

  /** One Apify run over the curated allow-list handles → mapped RawPost[] (error rows skipped). */
  private async runHandles(handles: string[], vertical: SocialVertical): Promise<RawPost[]> {
    const directUrls = handles.map((h) => `https://www.instagram.com/${h}/`);
    return this.runActor(
      this.actor,
      { directUrls, resultsType: 'posts', resultsLimit: this.perHandleLimit, onlyPostsNewerThan: '30 days' },
      vertical,
    );
  }

  /**
   * ONE Apify run over the curated hashtags (the hashtag-scraper actor takes the whole `hashtags` array in
   * a single run — one call, one cap charge) → mapped RawPost[]. `resultsLimit` is a SMALL per-tag cap. The
   * long-tail posts (home-kitchen / من-المالك sellers NOT in the hand list) flow the SAME Claude extraction
   * + relevance filter + permalink dedup downstream. Empty/no_items tags are dropped by mapRow.
   */
  private async runHashtags(hashtags: string[], vertical: SocialVertical): Promise<RawPost[]> {
    const posts = await this.runActor(
      this.hashtagActor,
      { hashtags, resultsLimit: this.perHashtagLimit, onlyPostsNewerThan: '30 days' },
      vertical,
    ).catch(() => [] as RawPost[]);
    return dedupeByPermalink(posts);
  }

  /** POST the actor run-sync endpoint with a body and map the returned dataset rows. */
  private async runActor(
    actor: string,
    body: Record<string, unknown>,
    vertical: SocialVertical,
  ): Promise<RawPost[]> {
    const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${this.token}`;
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

/** Dedupe posts by permalink (a hashtag post can repeat a handle post, or appear under two tags). */
export function dedupeByPermalink(posts: RawPost[]): RawPost[] {
  const seen = new Set<string>();
  const out: RawPost[] = [];
  for (const p of posts) {
    if (seen.has(p.permalink)) continue;
    seen.add(p.permalink);
    out.push(p);
  }
  return out;
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
