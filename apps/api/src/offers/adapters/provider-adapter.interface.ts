/**
 * ProviderAdapter — the pluggable fetch boundary frozen from ADR-003 §1 (S2.6-1).
 *
 * A new provider = a new adapter; the orchestrator (`OffersService.resolveOffers`) never
 * knows the tier. Pipeline per provider: discover() → fetch() → extract() → NormalizedOffer[].
 *
 * Slice A ships two Tier-1 (`http`) adapters — X-cite + Blink — deterministic parse, NO Claude.
 * Tier 2 (`render`) / Tier 3 (`render_residential`) plug in behind THIS SAME interface later.
 */

export type FetchTier = 'http' | 'render' | 'render_residential' | 'social';

/** A discovered product URL/handle for a provider (output of discover()). */
export interface ProductRef {
  url: string;
  handle?: string;
  providerSkuRef?: string;
  /** Canonical SKU id this ref maps to, when the discovery source already knows it (known-URL map). */
  skuId?: string;
  /**
   * Optional opaque payload captured at discovery — e.g. an XHR/JSON hit whose price was already
   * fetched (Tier-2 XHR-sniff adapters like Eureka). fetch() re-serves it as the RawPage source so
   * the truthfulness guard runs against the exact bytes, with no second round-trip.
   */
  payload?: unknown;
}

/** Raw retrieval of ONE product page/payload (output of fetch()). */
export interface RawPage {
  url: string;
  /** Exactly one of html/json is populated depending on the source. */
  html?: string;
  json?: unknown;
  fetchedAt: string; // ISO-8601
}

/**
 * Adapter output → feeds the unchanged normalize/SKU-group spine (ADR-003 §1).
 * price/sku/stock come ONLY from the fetched source (truthfulness, enforced structurally).
 */
export interface NormalizedOffer {
  providerSkuRef: string;
  title: string;
  priceFils: number;
  attrs: Record<string, string>;
  deeplink: string;
  inStock: boolean | null;
  imageUrl?: string;
  source: 'http' | 'render' | 'residential';
  fetchedAt: string;
  /** Canonical SKU id, when discovery resolved it (known-URL map). */
  skuId?: string;
}

/** What the orchestrator asks an adapter to discover. */
export interface DiscoveryQuery {
  /** Free-text/normalized query terms (e.g. "iphone 16", "macbook air"). */
  text: string;
  /** Optional canonical SKU candidates the caller already matched (known-URL discovery). */
  skuIds?: string[];
  /** Max product refs to return. */
  limit?: number;
}

export interface FetchCtx {
  /** Per-site hard timeout in ms (Tier 1 ≈ 1500 per ADR-003 §4). */
  timeoutMs: number;
  /** Realistic stable UA + Accept-Language (ADR-003 §5). */
  userAgent: string;
  acceptLanguage: string;
}

export interface AdapterHealth {
  lastOkAt: string | null;
  consecutiveFailures: number;
}

export interface ProviderAdapter {
  providerId: string; // FK → providers.id (e.g. 'prov_xcite')
  providerName: string; // display name ('X-cite')
  sector: 'electronics' | 'food' | 'realestate';
  tier: FetchTier;
  enabled: boolean; // mirrors providers.enabled + runtime kill-switch

  discover(query: DiscoveryQuery, ctx: FetchCtx): Promise<ProductRef[]>;
  fetch(ref: ProductRef, ctx: FetchCtx): Promise<RawPage>;
  extract(raw: RawPage): Promise<NormalizedOffer[]>;

  health(): AdapterHealth;
}

/** Default fetch context (ADR-003 §4/§5 values). */
export const DEFAULT_HTTP_CTX: FetchCtx = {
  timeoutMs: 1500,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  acceptLanguage: 'en,ar',
};
