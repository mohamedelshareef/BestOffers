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
 * Blink Tier-1 adapter (ADR-003 §1, S2.6-2). LIVE, deterministic, NO browser, NO Claude.
 * Blink = Shopify storefront (blink.com.kw) → clean structured JSON, the easiest electronics source.
 *
 * - DISCOVER: `/search/suggest.json?q=...&resources[type]=product` → products with title/handle/price.
 * - FETCH:    `/products/{handle}.json` → the authoritative product object (variants, sku, available).
 * - EXTRACT:  first available variant → price (KWD decimal string → fils), sku, availability, image.
 *   Truthfulness: priceTokenInSource() drops any price not present verbatim in the fetched JSON.
 */
export class BlinkAdapter implements ProviderAdapter {
  readonly providerId = 'prov_blink';
  readonly providerName = 'Blink';
  readonly sector = 'electronics' as const;
  readonly tier = 'http' as const;
  enabled = true;

  private _lastOkAt: string | null = null;
  private _consecutiveFailures = 0;

  private readonly baseUrl = 'https://www.blink.com.kw';

  async discover(query: DiscoveryQuery, ctx: FetchCtx): Promise<ProductRef[]> {
    const q = encodeURIComponent(query.text);
    const limit = query.limit ?? 5;
    const url = `${this.baseUrl}/search/suggest.json?q=${q}&resources%5Btype%5D=product&resources%5Blimit%5D=${limit}`;
    const { status, body } = await httpGet(url, ctx, 'application/json');
    if (status !== 200) throw new Error(`Blink suggest ${status}`);

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return [];
    }
    const products = readSuggestProducts(json);
    return products
      .filter((p) => p.handle)
      .slice(0, limit)
      .map((p) => ({
        url: `${this.baseUrl}/products/${p.handle}.json`,
        handle: p.handle,
      }));
  }

  async fetch(ref: ProductRef, ctx: FetchCtx): Promise<RawPage> {
    const { status, body, url } = await httpGet(ref.url, ctx, 'application/json');
    if (status !== 200) throw new Error(`Blink product ${status} for ${ref.url}`);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Blink product non-JSON for ${ref.url}`);
    }
    return { url, json, fetchedAt: new Date().toISOString() };
  }

  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const product = (raw.json as { product?: ShopifyProduct } | undefined)?.product;
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) return [];

    // Prefer the first available variant; fall back to the first variant.
    const variant = product.variants.find((v) => v.available) ?? product.variants[0];
    const kwd = parseFloat(variant.price);
    if (!Number.isFinite(kwd) || kwd <= 0) return [];
    const priceFils = Math.round(kwd * 1000);

    // TRUTHFULNESS: drop if the price is not present verbatim in the fetched JSON.
    if (!priceTokenInSource(priceFils, raw)) return [];

    const handle = product.handle;
    const image =
      variant.featured_image?.src ?? product.images?.[0]?.src ?? undefined;

    const offer: NormalizedOffer = {
      providerSkuRef: variant.sku || String(variant.id),
      title: cleanTitle(product.title),
      priceFils,
      attrs: blinkAttrs(product, variant),
      deeplink: `${this.baseUrl}/products/${handle}`,
      inStock: typeof variant.available === 'boolean' ? variant.available : null,
      imageUrl: image,
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

interface ShopifyVariant {
  id: number;
  sku?: string;
  price: string; // "364.900"
  available?: boolean;
  option1?: string | null;
  option2?: string | null;
  featured_image?: { src?: string } | null;
}
interface ShopifyProduct {
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  variants: ShopifyVariant[];
  images?: Array<{ src?: string }>;
}

function readSuggestProducts(json: unknown): Array<{ handle: string; title?: string }> {
  const results = (json as any)?.resources?.results?.products;
  if (!Array.isArray(results)) return [];
  return results.map((p: any) => ({ handle: String(p.handle ?? ''), title: p.title }));
}

function blinkAttrs(product: ShopifyProduct, variant: ShopifyVariant): Record<string, string> {
  const attrs: Record<string, string> = { currency: 'KWD' };
  if (product.vendor) attrs.brand = product.vendor;
  const opts = [variant.option1, variant.option2].filter(Boolean).join(' ');
  const storage = `${product.title} ${opts}`.match(/(\d+)\s?GB/i);
  if (storage) attrs.storage = `${storage[1]}GB`;
  return attrs;
}

function cleanTitle(title: string): string {
  return (title ?? '').replace(/^"|"$/g, '').trim();
}
