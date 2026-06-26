/**
 * SocialProvider — the acquisition sub-interface for the IG "social offers" lane (ADR-006 §2/§Decision-2).
 *
 * It abstracts WHERE raw Instagram posts come from so the `SocialIngestAdapter` is provider-agnostic:
 *   - `MockSocialProvider`  (default, SOCIAL_PROVIDER=mock) → seeded realistic posts, NO network, NO key.
 *   - `ApifySocialProvider` (SOCIAL_PROVIDER=apify, config-ready stub) → calls Apify `instagram-scraper`.
 *
 * The adapter consumes the SAME `RawPost` shape regardless of provider — so the mock→real cutover is a
 * one-line env flip plus an Apify token. We NEVER fetch Instagram ourselves (IG=RED, ADR-006 §1).
 */

export type SocialVertical = 'food' | 'realestate';

/**
 * One raw Instagram post as a commercial IG-data provider would return it (Apify dataset row subset,
 * ADR-006 §2). `permalink` + `timestamp` are non-hallucinatable provenance: they flow verbatim to the
 * card; Claude never authors them.
 */
export interface RawPost {
  /** Provider's post id / shortcode. */
  id: string;
  /** Account handle without '@', e.g. "boshamlan_re". */
  ownerHandle: string;
  /** AR/EN free-form caption (where prices may or may not appear). */
  caption: string;
  /** Image/media URL (placeholder ok in mock). */
  imageUrl: string;
  /** Canonical post URL — the CTA deep-link. https://www.instagram.com/p/<code>/ */
  permalink: string;
  /** ISO-8601 post time (within last 30d in the seed). */
  timestamp: string;
  /** food | realestate — which extraction schema to apply. */
  vertical: SocialVertical;
}

export interface SocialQuery {
  vertical: SocialVertical;
  /** free-text intent terms (e.g. "salwa 2 bedroom", "meal prep") used to pre-rank candidate posts. */
  text: string;
  /** max posts to return. */
  limit?: number;
}

export interface SocialProvider {
  /** 'mock' | 'apify' | 'brightdata' — for logging/diagnostics. */
  readonly name: string;
  /** Pull recent posts (last ~30d) for the vertical, optionally biased toward the query terms. */
  fetchPosts(query: SocialQuery): Promise<RawPost[]>;
}
