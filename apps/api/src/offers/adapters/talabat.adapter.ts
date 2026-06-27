import {
  AdapterHealth,
  DiscoveryQuery,
  FetchCtx,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
  RawPage,
} from './provider-adapter.interface';
import { httpGet } from './http-fetch';
import { priceTokenInSource } from './source-validation';
import { InMemoryProviderUrlCache, ProviderUrlCache } from './provider-url-cache';

/**
 * Talabat Tier-1 FOOD adapter (ADR-005 Slice F-1). LIVE, deterministic JSON parse, NO browser,
 * NO Claude, NO scraping of any walled app — Talabat exposes a plain same-origin JSON price API.
 *
 * Verified live against real Kuwait restaurants (2026-06-26):
 *  - DISCOVER: `GET /{country}/restaurants` SSR HTML → restaurant slugs (e.g. `kfc`, `chicken-tikka`,
 *    `kababji`). For each candidate slug, `GET /{country}/{slug}` → `__NEXT_DATA__` →
 *    `props.pageProps.data.vendorId` (KFC=5804, Chicken Tikka=5859, Kababji=710511). slug→vendorId is
 *    persisted in `provider_url_cache` (24h TTL) so repeat queries skip the page round-trip.
 *  - FETCH:    `GET /nextMenuApi/v2/branches/{vendorId}/menu` → JSON (200, no auth/cookie/Cloudflare).
 *  - EXTRACT:  `result.menu.menuSection[].itm[]` → { nm:name, pr:price KWD float, opr:old-price,
 *    id, imgurl }. price_fils = round(pr*1000) (rounds float-precision noise e.g. 1.9250000119 → 1925).
 *    PROMO: opr is -1 when absent; a real promo is `opr > pr` ⇒ is_promo + old_price_fils + discount%.
 *  - TRUTHFULNESS: price copied verbatim from the JSON; `priceTokenInSource` drops any price not in
 *    the fetched bytes. NO Claude in this lane = truthful by construction.
 *
 * Each Talabat dish is one offer (intra-Talabat each item is distinct; cross-provider dish-grouping is
 * a later Food slice per ADR-005 §Lane-1). The food TTL is short (~5 min) since promos are volatile.
 */
export class TalabatAdapter implements ProviderAdapter {
  readonly providerId = 'prov_talabat';
  readonly providerName = 'Talabat';
  readonly sector = 'food' as const;
  readonly tier = 'http' as const;
  enabled = true;

  private _lastOkAt: string | null = null;
  private _consecutiveFailures = 0;

  private readonly baseUrl = 'https://www.talabat.com';
  private readonly country = 'kuwait';

  /** slug→vendorId cache (provider_url_cache analogue, 24h TTL). Injectable for tests. */
  constructor(private readonly urlCache: ProviderUrlCache = new InMemoryProviderUrlCache()) {}

  /**
   * Resolve the query's dish/restaurant intent to candidate restaurant ProductRefs (slug+vendorId).
   *
   * REAL DISCOVERY (ADR-007): we hit Talabat's OWN restaurant SEARCH — `GET /{country}/restaurants?
   * searchTerm=<q>` — which returns the vendors Talabat actually indexes for that term (verified live:
   * `mcdonald`→mcdonalds slugs, `ice cream`→ice-cream shops, `donuts`→Dunkin/etc, `karak`→karak vendors,
   * `breakfast`→breakfast spots). This is NOT a hand-listed slug map; ANY vendor Talabat sells is findable.
   * The unparametrized listing only returns a ~40-vendor featured subset (no McDonald's / ice-cream /
   * donut / karak / breakfast), which is why those queries used to honest-empty.
   *
   * Fallback: if the search returns nothing parseable we fall back to the plain featured listing so a
   * generic query still demonstrates live prices.
   */
  async discover(query: DiscoveryQuery, ctx: FetchCtx): Promise<ProductRef[]> {
    const limit = query.limit ?? 5;
    const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);

    // 1) Real search via Talabat's restaurant SERP (searchTerm). Returns the vendors Talabat indexes.
    const searchUrl = `${this.baseUrl}/${this.country}/restaurants?searchTerm=${encodeURIComponent(query.text)}`;
    let slugs: string[] = [];
    try {
      const { status, body } = await httpGet(searchUrl, ctx, 'text/html');
      if (status === 200) slugs = extractRestaurantSlugs(body);
    } catch {
      /* fall through to featured listing */
    }

    // The SERP places matching vendors first; rank slugs that literally contain a query token to the
    // front (a true name match like "mcdonalds1" / "vermilion-ice-cream" beats an unrelated SERP filler).
    const isHit = (s: string) => terms.some((t) => t.length >= 2 && s.includes(t));
    slugs = [...slugs.filter(isHit), ...slugs.filter((s) => !isHit(s))];

    // 2) Fallback to the featured listing only if search yielded nothing usable.
    if (slugs.length === 0) {
      const listUrl = `${this.baseUrl}/${this.country}/restaurants`;
      const { status, body } = await httpGet(listUrl, ctx, 'text/html');
      if (status !== 200) throw new Error(`Talabat restaurants ${status}`);
      const listed = extractRestaurantSlugs(body);
      if (listed.length === 0) return [];
      const matched = listed.filter(isHit);
      slugs = matched.length > 0 ? matched : listed;
    }

    const picked = slugs.slice(0, limit);

    const refs: ProductRef[] = [];
    for (const slug of picked) {
      const vendorId = await this.resolveVendorId(slug, ctx);
      if (vendorId) {
        refs.push({
          url: `${this.baseUrl}/nextMenuApi/v2/branches/${vendorId}/menu`,
          handle: slug,
          providerSkuRef: vendorId,
        });
      }
    }
    return refs;
  }

  /** slug → vendorId via the restaurant page `__NEXT_DATA__`, cached (provider_url_cache, 24h). */
  private async resolveVendorId(slug: string, ctx: FetchCtx): Promise<string | null> {
    const cached = await this.urlCache.get(this.providerId, slug);
    if (cached) return cached;

    const { status, body } = await httpGet(`${this.baseUrl}/${this.country}/${slug}`, ctx, 'text/html');
    if (status !== 200) return null;
    const vendorId = extractVendorId(body);
    if (vendorId) await this.urlCache.set(this.providerId, slug, vendorId);
    return vendorId;
  }

  async fetch(ref: ProductRef, ctx: FetchCtx): Promise<RawPage> {
    const { status, body } = await httpGet(ref.url, ctx, 'application/json');
    if (status !== 200) throw new Error(`Talabat menu ${status} for ${ref.url}`);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Talabat menu non-JSON for ${ref.url}`);
    }
    // Carry the restaurant slug (captured at discovery) into the RawPage url as `#slug=…` so extract()
    // can build the dish deeplink + the cross-restaurant title (the menu API itself only knows vendorId).
    const slug = ref.handle ?? '';
    return { url: `${ref.url}#slug=${slug}`, json, fetchedAt: new Date().toISOString() };
  }

  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const restaurantSlug = restaurantSlugFromUrl(raw.url);
    const menu = (raw.json as TalabatMenuResponse | undefined)?.result?.menu;
    const sections = menu?.menuSection;
    if (!Array.isArray(sections)) return [];

    // The menu API carries no restaurant name (only vendorId) — derive a display name from the slug.
    const restaurantName = restaurantSlug ? titleCaseSlug(restaurantSlug) : undefined;
    const out: NormalizedOffer[] = [];
    for (const section of sections) {
      const items = section.itm;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const offer = this.toOffer(item, section, raw, restaurantSlug, restaurantName);
        if (offer) out.push(offer);
      }
    }
    return out;
  }

  private toOffer(
    item: TalabatItem,
    section: TalabatSection,
    raw: RawPage,
    restaurantSlug: string,
    restaurantName?: string,
  ): NormalizedOffer | null {
    const name = (item.nm ?? '').trim();
    if (!name) return null;

    const kwd = Number(item.pr);
    if (!Number.isFinite(kwd) || kwd <= 0) return null;
    const priceFils = Math.round(kwd * 1000); // rounds float-precision noise (1.92500001→1925 fils)

    // TRUTHFULNESS: drop if the price is not present verbatim in the fetched JSON bytes.
    if (!priceTokenInSource(priceFils, raw)) return null;

    // PROMO: opr (old price) is -1 / 0 / absent when there is NO promo. A real promo is opr > pr.
    const opr = Number(item.opr);
    const isPromo = Number.isFinite(opr) && opr > kwd;
    const oldPriceFils = isPromo ? Math.round(opr * 1000) : undefined;

    const attrs: Record<string, string> = { currency: 'KWD', sector: 'food' };
    if (restaurantName) attrs.restaurant = restaurantName;
    if (section.nm) attrs.category = section.nm;
    if (isPromo && oldPriceFils != null) {
      attrs.isPromo = 'true';
      attrs.oldPriceFils = String(oldPriceFils);
      attrs.discountPct = String(Math.round(((opr - kwd) / opr) * 100));
    }

    return {
      providerSkuRef: String(item.id ?? `${restaurantSlug}:${name}`),
      title: restaurantName ? `${name} — ${restaurantName}` : name,
      priceFils,
      attrs,
      deeplink: `${this.baseUrl}/${this.country}/${restaurantSlug}`,
      inStock: item.isf === false ? true : item.isf === true ? false : null,
      imageUrl: item.imgurl || undefined,
      source: 'http',
      fetchedAt: raw.fetchedAt,
    };
  }

  health(): AdapterHealth {
    return { lastOkAt: this._lastOkAt, consecutiveFailures: this._consecutiveFailures };
  }

  markOk(): void {
    this._lastOkAt = new Date().toISOString();
    this._consecutiveFailures = 0;
  }
  markFail(): void {
    this._consecutiveFailures += 1;
  }
}

// ── Talabat JSON shapes (subset, verified live 2026-06-26) ──────────────────────────────────────
interface TalabatMenuResponse {
  result?: {
    menu?: { menuSection?: TalabatSection[] };
  };
}
interface TalabatSection {
  nm?: string; // section name e.g. "Offers", "Meals"
  itm?: TalabatItem[];
}
interface TalabatItem {
  id?: number | string;
  nm?: string; // dish name
  pr?: number | string; // price KWD
  opr?: number | string; // old price (-1 = no promo)
  imgurl?: string;
  isf?: boolean; // "is sold out" flag (true ⇒ unavailable)
}

/**
 * Restaurant slugs from the `/{country}/restaurants` SSR HTML. Talabat links restaurants as
 * `"/kuwait/{slug}"`; we keep lower-case kebab slugs (a-z, 0-9, -) and exclude known non-restaurant
 * paths (restaurants list, cuisines, etc.).
 */
function extractRestaurantSlugs(html: string): string[] {
  const EXCLUDE = new Set([
    'restaurants', 'restaurant', 'cuisine', 'cuisines', 'login', 'register',
    'account', 'cart', 'checkout', 'search', 'offers', 'grocery', 'groceries',
    // SERP (?searchTerm=) page footer/nav links — not vendors.
    'terms', 'faq', 'privacy', 'contact-us', 'sitemap', 'about-us', 'careers',
    'blog', 'all-areas',
  ]);
  const slugs = new Set<string>();
  for (const m of html.matchAll(/"\/kuwait\/([a-z0-9][a-z0-9-]{1,})"/gi)) {
    const slug = m[1].toLowerCase();
    if (!EXCLUDE.has(slug) && !slug.includes('/')) slugs.add(slug);
  }
  return [...slugs];
}

/** "chicken-tikka" → "Chicken Tikka" (best-effort display name; the menu API has no name field). */
function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** vendorId from a restaurant page's `__NEXT_DATA__` (props.pageProps.data.vendorId). */
function extractVendorId(html: string): string | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      const d = data?.props?.pageProps?.data ?? data?.props?.pageProps;
      const v = d?.vendorId ?? d?.id ?? d?.branchId;
      if (v != null) return String(v);
    } catch {
      /* fall through to regex */
    }
    const vm = m[1].match(/"vendorId"\s*:\s*"?(\d+)"?/);
    if (vm) return vm[1];
  }
  const direct = html.match(/"vendorId"\s*:\s*"?(\d+)"?/);
  return direct ? direct[1] : null;
}

/** Recover the restaurant slug carried on the RawPage url (`…#slug=kfc`) by fetch(). */
function restaurantSlugFromUrl(url: string): string {
  const m = url.match(/#slug=([^#]*)$/);
  return m ? decodeURIComponent(m[1]) : '';
}
