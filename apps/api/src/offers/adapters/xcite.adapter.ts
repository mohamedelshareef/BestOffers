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
 * X-cite Tier-1 adapter (ADR-003 §1, S2.6-1). LIVE, deterministic, NO browser, NO Claude.
 *
 * - DISCOVER: known-URL map keyed by canonical SKU (ADR-003 §3 "known-URL cache"). X-cite's
 *   `/search` + `/c` are JS shells (recon), so we do NOT render to discover. The map below holds
 *   ONLY slugs verified live at build time; a slug dropped from catalog yields a soft-404 shell
 *   which extract() rejects (0 offers), keeping the adapter healthy. Sitemap-scan discovery
 *   (sitemap-pdps-*.xml) is a Slice-B enhancement.
 * - FETCH: plain HTTPS GET of the product page `/{slug}/p` → full server HTML.
 * - EXTRACT: parse Next.js `__NEXT_DATA__` JSON — the product node carries
 *   { name, price:{value,formattedPrice}, sku, status, ...colour/image variants }. Price KWD→fils.
 *   Truthfulness: priceTokenInSource() drops any price not present verbatim in the fetched bytes.
 */
export class XciteAdapter implements ProviderAdapter {
  readonly providerId = 'prov_xcite';
  readonly providerName = 'X-cite';
  readonly sector = 'electronics' as const;
  readonly tier = 'http' as const;
  enabled = true;

  private _lastOkAt: string | null = null;
  private _consecutiveFailures = 0;

  private readonly baseUrl = 'https://www.xcite.com';

  /**
   * Verified-live known-URL map: canonical SKU id → X-cite product slug.
   * Each slug was confirmed live (parses to a real product node) on 2026-06-26.
   * Extend by re-running the discovery script; entries that go stale self-drop at extract().
   */
  private readonly knownUrls: Record<string, string> = {
    sku_ip16_128_black: 'apple-iphone-16-6-1-inch-128gb-black',
    sku_ip16_128_white: 'apple-iphone-16-6-1-inch-128gb-white',
    sku_ip16_128_ultramarine: 'apple-iphone-16-6-1-inch-128gb-ultramarine',
    sku_ip16_512_black: 'apple-iphone-16-6-1-inch-512gb-black',
  };

  async discover(query: DiscoveryQuery): Promise<ProductRef[]> {
    const text = query.text.toLowerCase();
    const wantSkuIds = new Set(query.skuIds ?? []);

    const refs: ProductRef[] = [];
    for (const [skuId, slug] of Object.entries(this.knownUrls)) {
      const matchBySku = wantSkuIds.size > 0 && wantSkuIds.has(skuId);
      // text match: any whitespace token of the query appears in the slug (e.g. "iphone 16")
      const matchByText =
        text.length > 0 && text.split(/\s+/).filter(Boolean).every((t) => slug.includes(t));
      if (matchBySku || matchByText) {
        refs.push({ url: `${this.baseUrl}/${slug}/p`, handle: slug, skuId });
      }
    }
    return query.limit ? refs.slice(0, query.limit) : refs;
  }

  async fetch(ref: ProductRef, ctx: FetchCtx): Promise<RawPage> {
    const { status, body, url } = await httpGet(ref.url, ctx, 'text/html');
    if (status !== 200) throw new Error(`X-cite ${status} for ${ref.url}`);
    return { url, html: body, fetchedAt: new Date().toISOString() };
  }

  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const html = raw.html ?? '';
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return [];

    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      return [];
    }

    const prod = findProductNode(data);
    if (!prod) return []; // soft-404 shell / catalog miss → no offer (healthy, just empty)

    const priceFils = Math.round(prod.price.value * 1000);
    if (!Number.isFinite(priceFils) || priceFils <= 0) return [];

    // TRUTHFULNESS: drop if the price is not present verbatim in the fetched source.
    if (!priceTokenInSource(priceFils, raw)) return [];

    const sku = String(prod.sku);
    const offer: NormalizedOffer = {
      providerSkuRef: sku,
      title: cleanTitle(prod.name),
      priceFils,
      attrs: extractAttrs(prod),
      deeplink: raw.url,
      inStock: typeof prod.status === 'string' ? /instock/i.test(prod.status) : null,
      imageUrl: `https://cdn.media.amplience.net/i/xcite/${sku}-01`,
      source: 'http',
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
}

interface XciteProductNode {
  name: string;
  sku: string | number;
  status?: string;
  price: { value: number; currency: string; formattedPrice?: string };
  dimensions?: Array<{ name?: string; key?: string }>;
}

/** Depth-bounded search for the product node (carries price{currency,value} + sku). */
function findProductNode(root: unknown): XciteProductNode | null {
  let found: XciteProductNode | null = null;
  (function walk(o: unknown, depth: number): void {
    if (found || depth > 14 || !o || typeof o !== 'object') return;
    const rec = o as Record<string, unknown>;
    const price = rec.price as { currency?: string; value?: number } | undefined;
    if (price && typeof price.currency === 'string' && typeof price.value === 'number' && rec.sku) {
      found = o as XciteProductNode;
      return;
    }
    for (const k in rec) walk(rec[k], depth + 1);
  })(root, 0);
  return found;
}

function extractAttrs(prod: XciteProductNode): Record<string, string> {
  const attrs: Record<string, string> = { currency: 'KWD' };
  const name = prod.name ?? '';
  const storage = name.match(/(\d+)\s?GB/i);
  if (storage) attrs.storage = `${storage[1]}GB`;
  const screen = name.match(/(\d+(?:\.\d+)?)[\s-]?inch/i);
  if (screen) attrs.screen = `${screen[1]}"`;
  return attrs;
}

function cleanTitle(name: string): string {
  return (name ?? '').replace(/\.\s*$/, '').trim();
}
