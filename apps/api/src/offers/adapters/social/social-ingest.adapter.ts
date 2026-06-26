import {
  AdapterHealth,
  DiscoveryQuery,
  FetchCtx,
  NormalizedOffer,
  ProductRef,
  ProviderAdapter,
  RawPage,
} from '../provider-adapter.interface';
import { RawPost, SocialProvider, SocialVertical } from './social-provider';
import { MockSocialProvider } from './mock-social-provider';
import { ApifySocialProvider } from './apify-social-provider';
import { SocialExtract, SocialExtractor } from './social-extractor';
import { MockSocialExtractor } from './mock-social-extractor';
import { AnthropicSocialExtractor } from './anthropic-social-extractor';

/**
 * SocialIngestAdapter (ADR-006 Phase-1) — tier:'social', behind the unchanged `ProviderAdapter`
 * spine. One adapter instance per VERTICAL (food | realestate) so the orchestrator routes by sector.
 *
 * Pipeline (ADR-006 §2):
 *   discover()  → SocialProvider.fetchPosts(last ~30d)  → one ProductRef per post (RawPost as payload)
 *   fetch()     → re-serve the captured RawPost (no IG round-trip; we never fetch IG ourselves)
 *   extract()   → Claude reads the caption → structured offer → NormalizedOffer (or dropped)
 *
 * TRUTHFULNESS (load-bearing, enforced in CODE not just the prompt):
 *   - permalink + posted_at flow VERBATIM from the post (never authored by the model).
 *   - a price is kept ONLY if the price token literally appears in the caption bytes; otherwise the
 *     offer is surfaced with priceFils=0 and attrs.priceOnRequest='true' → the card shows
 *     "price on request — see post" (we NEVER invent a price).
 *
 * Provider/extractor are env-selected, mock by default → $0, no key, no live IG:
 *   SOCIAL_PROVIDER = mock (default) | apify          SOCIAL_EXTRACTOR = anthropic (with key) | mock
 */
export class SocialIngestAdapter implements ProviderAdapter {
  readonly providerName = 'Instagram';
  readonly tier = 'social' as const;
  enabled = true;
  readonly providerId: string;
  readonly sector: 'food' | 'realestate';

  private _lastOkAt: string | null = null;
  private _consecutiveFailures = 0;

  constructor(
    private readonly vertical: SocialVertical,
    private readonly provider: SocialProvider = defaultProvider(),
    private readonly extractor: SocialExtractor = defaultExtractor(),
  ) {
    this.vertical = vertical;
    this.sector = vertical;
    this.providerId = `prov_social_${vertical}`;
  }

  async discover(query: DiscoveryQuery, _ctx: FetchCtx): Promise<ProductRef[]> {
    const posts = await this.provider.fetchPosts({
      vertical: this.vertical,
      text: query.text,
      limit: query.limit ?? 16,
    });
    return posts.map((post) => ({
      url: post.permalink,
      handle: post.ownerHandle,
      providerSkuRef: post.id,
      payload: post, // carry the raw post; fetch() re-serves it (no IG round-trip)
    }));
  }

  async fetch(ref: ProductRef, _ctx: FetchCtx): Promise<RawPage> {
    const post = ref.payload as RawPost;
    return { url: post.permalink, json: post, fetchedAt: new Date().toISOString() };
  }

  async extract(raw: RawPage): Promise<NormalizedOffer[]> {
    const post = raw.json as RawPost;
    if (!post?.caption) return [];

    let ex: SocialExtract | null;
    try {
      ex = await this.extractor.extract(post);
    } catch {
      this._consecutiveFailures += 1;
      return [];
    }
    if (!ex || !ex.isOffer) return [];

    const offer = this.toNormalized(post, ex);
    if (!offer) return [];
    this._lastOkAt = new Date().toISOString();
    this._consecutiveFailures = 0;
    return [offer];
  }

  /** Map the extracted offer → NormalizedOffer, applying the truthfulness price guard. */
  private toNormalized(post: RawPost, ex: SocialExtract): NormalizedOffer | null {
    // TRUTHFULNESS GUARD: a price is only valid if it (or its KWD form) literally appears in the caption.
    const claimedFils = ex.vertical === 'food' ? ex.priceFils : ex.rentFils;
    const priceFils = claimedFils != null && priceLiterallyInCaption(claimedFils, post.caption) ? claimedFils : 0;
    const priceOnRequest = priceFils === 0;

    const attrs: Record<string, string> = {
      currency: 'KWD',
      sector: this.vertical,
      handle: post.ownerHandle,
      permalink: post.permalink, // verbatim from the post
      postedAt: post.timestamp, // verbatim from the post
    };
    if (priceOnRequest) attrs.priceOnRequest = 'true';

    // Title is the offer itself (item / rooms·area); the IG handle is shown separately as the
    // "provider" on the card, so we do NOT repeat it in the title (avoids a redundant @handle).
    let title: string;
    if (ex.vertical === 'food') {
      if (!ex.item) return null;
      title = ex.item;
      attrs.restaurant = ex.restaurant;
      if (ex.desc) attrs.desc = ex.desc;
    } else {
      const areaLabel = ex.area ?? 'Kuwait';
      const roomsLabel = ex.rooms == null ? '' : ex.rooms === 0 ? 'Studio' : `${ex.rooms}BR`;
      const furnishedLabel = ex.furnished ? ` · ${ex.furnished}` : '';
      title = [roomsLabel, areaLabel].filter(Boolean).join(' · ') + furnishedLabel;
      if (ex.area) attrs.area = ex.area;
      if (ex.rooms != null) attrs.rooms = String(ex.rooms);
      if (ex.furnished) attrs.furnished = ex.furnished;
    }

    return {
      providerSkuRef: post.id,
      title,
      priceFils,
      attrs,
      deeplink: post.permalink, // CTA = the exact IG post
      inStock: null,
      imageUrl: post.imageUrl || undefined,
      source: 'http',
      fetchedAt: post.timestamp, // surface the post time as the freshness anchor
    };
  }

  health(): AdapterHealth {
    return { lastOkAt: this._lastOkAt, consecutiveFailures: this._consecutiveFailures };
  }
}

/**
 * The price (integer fils) is valid only if its KWD form literally appears in the caption — same
 * structural truthfulness rule as the live-fetch lane (source-validation.ts), applied to caption text.
 * 420000 fils → look for "420" with a KWD/dinar marker; 12500 → "12.500" / "12,500"; 9750 → "9.750".
 */
export function priceLiterallyInCaption(priceFils: number, caption: string): boolean {
  const kwd = priceFils / 1000;
  const candidates = new Set<string>([
    kwd.toFixed(3), // 12.500
    kwd.toFixed(3).replace('.', ','),
    String(kwd), // 12.5 / 420
    kwd.toFixed(0), // 420
  ]);
  // require the number to sit next to a KWD/dinar marker so a stray "420" elsewhere can't pass.
  for (const c of candidates) {
    const re = new RegExp(escapeRe(c) + '\\s*(?:د\\.?\\s*ك|kwd|kd|دينار)', 'i');
    if (re.test(caption)) return true;
  }
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultProvider(): SocialProvider {
  return process.env.SOCIAL_PROVIDER === 'apify' ? new ApifySocialProvider() : new MockSocialProvider();
}

function defaultExtractor(): SocialExtractor {
  const choice = process.env.SOCIAL_EXTRACTOR;
  if (choice === 'mock') return new MockSocialExtractor();
  if (choice === 'anthropic' || process.env.ANTHROPIC_API_KEY) return new AnthropicSocialExtractor();
  return new MockSocialExtractor();
}
