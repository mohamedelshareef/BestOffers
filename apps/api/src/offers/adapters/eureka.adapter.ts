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

/**
 * Eureka Tier-2 (`render`) adapter (ADR-003 Slice B). Eureka (eureka.com.kw) is an AngularJS SPA —
 * category/search/PDP pages return only an empty shell to a plain fetcher (recon: AMBER, needs
 * rendering). BUT its search is powered by an **Algolia** index, and the SPA itself reads prices via
 * that JSON API. Per ADR-003 §2/§3 ("prefer the XHR/JSON-endpoint sniff over a full render where
 * found — far faster and just as truthful"), this adapter hits the Algolia query endpoint directly
 * instead of booting Chromium.
 *
 * - DISCOVER + EXTRACT happen together: ONE Algolia POST returns the matching products WITH their
 *   live prices/stock/ids. We turn each hit into a ProductRef whose price is already known; fetch()
 *   re-serves that captured JSON as the RawPage source so the truthfulness guard runs against the
 *   exact bytes the price came from.
 * - The product DEEPLINK is the real SPA PDP route `/products/details/{id}?name=...` (what the site's
 *   own result template builds), so a tapped card lands on the live Eureka product page.
 * - PRICE: `clprc` (current list price, KWD) → fils. STOCK: `avaqt` (available qty) > 0.
 * - Tier declared `render` so the runtime routes it to the Tier-2 budget (~5s); the Algolia path
 *   resolves in ~200-400ms, well inside it. `render-fetch.renderHtml` is the documented fallback if
 *   Eureka ever drops Algolia (no code path needs it today).
 *
 * Credentials (Algolia app id / SEARCH-ONLY api key / index) are PUBLIC — shipped in the site's own
 * page (`#cky` / `#srcapk` hidden inputs) and used client-side by every visitor's browser.
 */
export class EurekaAdapter implements ProviderAdapter {
  readonly providerId = 'prov_eureka';
  readonly providerName = 'Eureka';
  readonly sector = 'electronics' as const;
  readonly tier = 'render' as const;
  enabled = true;

  private _lastOkAt: string | null = null;
  private _consecutiveFailures = 0;

  private readonly baseUrl = 'https://www.eureka.com.kw';
  // Public, search-only Algolia credentials (served in eureka.com.kw page source).
  private readonly algoliaAppId = '5GPHMAA239';
  private readonly algoliaApiKey = '3d7dbc330852592da244c87ae924a221';
  private readonly algoliaIndex = 'instant_records';

  async discover(query: DiscoveryQuery, ctx: FetchCtx): Promise<ProductRef[]> {
    const limit = query.limit ?? 5;
    const url = `https://${this.algoliaAppId}-dsn.algolia.net/1/indexes/${this.algoliaIndex}/query`;
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(ctx.timeoutMs),
      headers: {
        'X-Algolia-Application-Id': this.algoliaAppId,
        'X-Algolia-API-Key': this.algoliaApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: query.text, hitsPerPage: Math.max(limit * 2, 10) }),
    });
    if (!res.ok) throw new Error(`Eureka Algolia ${res.status}`);
    const json = (await res.json()) as { hits?: EurekaHit[] };
    const hits = Array.isArray(json.hits) ? json.hits : [];

    // Keep real products (drop obvious accessories so a "iphone 16" query doesn't surface cases).
    const products = hits.filter(isLikelyProduct).slice(0, limit);
    return products.map((hit) => ({
      url: this.deeplink(hit),
      providerSkuRef: String(hit.objectID ?? hit.id),
      // Stash the captured hit so fetch() can re-serve it as the source (no second round-trip).
      payload: hit,
    }));
  }

  async fetch(ref: ProductRef, _ctx: FetchCtx): Promise<RawPage> {
    // The Algolia hit captured at discovery IS the fetched source — re-serve it as the RawPage.
    const hit = ref.payload as EurekaHit | undefined;
    if (!hit) throw new Error('Eureka fetch: missing captured hit');
    return { url: ref.url, json: hit, fetchedAt: new Date().toISOString() };
  }

  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const hit = raw.json as EurekaHit | undefined;
    if (!hit || typeof hit.clprc !== 'number') return [];

    const priceFils = Math.round(hit.clprc * 1000);
    if (!Number.isFinite(priceFils) || priceFils <= 0) return [];

    // TRUTHFULNESS: keep only if the price token is present verbatim in the fetched source bytes.
    if (!priceTokenInSource(priceFils, raw)) return [];

    const offer: NormalizedOffer = {
      providerSkuRef: String(hit.objectID ?? hit.id),
      title: cleanTitle(hit.itmn ?? ''),
      priceFils,
      attrs: eurekaAttrs(hit),
      deeplink: raw.url,
      inStock: typeof hit.avaqt === 'number' ? hit.avaqt > 0 : null,
      imageUrl: hit.ipic ? `https://cdnimage.eureka.com.kw/UploadFiles/Products/${hit.ipic}` : undefined,
      source: 'render',
      fetchedAt: raw.fetchedAt,
    };
    return [offer];
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

  private deeplink(hit: EurekaHit): string {
    const id = hit.objectID ?? hit.id;
    const name = (hit.itmn ?? '').replace(/\s+/g, '_');
    return `${this.baseUrl}/products/details/${id}?name=${encodeURIComponent(name)}`;
  }
}

/**
 * Eureka Algolia hit (field map decoded from the live index):
 *   itmn = item name/title · bn = brand · cn = category path · ipic = image filename
 *   clprc/clprcv = current price (KWD) · lprc = list/was price · avaqt = available qty · id/objectID
 */
interface EurekaHit {
  id?: number | string;
  objectID?: string;
  itmn?: string;
  bn?: string;
  cn?: string;
  ipic?: string;
  clprc?: number;
  clprcv?: number;
  lprc?: number;
  avaqt?: number;
}

/** Drop obvious accessories so a phone/laptop query returns the device, not its case/charger. */
function isLikelyProduct(hit: EurekaHit): boolean {
  const name = (hit.itmn ?? '').toLowerCase();
  const cat = (hit.cn ?? '').toLowerCase();
  if (/access|cover|case|cable|charger|magsafe|protector|screen guard|adapter|strap/.test(name))
    return false;
  if (/access/.test(cat)) return false;
  return typeof hit.clprc === 'number' && hit.clprc > 0;
}

function eurekaAttrs(hit: EurekaHit): Record<string, string> {
  const attrs: Record<string, string> = { currency: 'KWD' };
  if (hit.bn) attrs.brand = hit.bn;
  if (hit.cn) attrs.category = hit.cn; // category PATH (e.g. "…> Laptops > Note Books") — relevance signal
  const name = hit.itmn ?? '';
  const storage = name.match(/(\d+)\s?(GB|TB)\b/i);
  if (storage) attrs.storage = `${storage[1]}${storage[2].toUpperCase()}`;
  const screen = name.match(/(\d+(?:\.\d+)?)[\s-]?inch/i);
  if (screen) attrs.screen = `${screen[1]}"`;
  return attrs;
}

function cleanTitle(name: string): string {
  return (name ?? '').replace(/\s+/g, ' ').trim();
}
