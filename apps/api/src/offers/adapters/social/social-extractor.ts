import { RawPost } from './social-provider';

/**
 * SocialExtractor — turns ONE raw IG post into a structured offer (ADR-006 §2a) or null (not an offer).
 *
 * Bound by SOCIAL_EXTRACTOR: 'anthropic' (real Claude, default when a key is present) | 'mock'
 * (deterministic, offline — tests). Real extraction reads the caption and emits structured JSON via
 * forced tool-use; deterministic guards in `social-ingest.adapter` then enforce truthfulness AFTER the
 * model returns (price null unless literally in the caption; permalink/posted_at verbatim).
 */

/** Food extraction (ADR-006 §2a). priceFils null unless a price literally appears in the caption. */
export interface FoodExtract {
  isOffer: boolean;
  item: string;
  desc?: string;
  priceFils: number | null;
  restaurant: string;
}

/** Real-estate extraction (ADR-006 §2a). rentFils null unless a rent literally appears in the caption. */
export interface RealEstateExtract {
  isOffer: boolean;
  area: string | null;
  rooms: number | null;
  rentFils: number | null;
  furnished: 'furnished' | 'semi' | 'unfurnished' | null;
}

export type SocialExtract =
  | ({ vertical: 'food' } & FoodExtract)
  | ({ vertical: 'realestate' } & RealEstateExtract);

export interface SocialExtractor {
  readonly name: string;
  /** Extract structured offer fields from a post's caption. Returns null when it is not an offer. */
  extract(post: RawPost): Promise<SocialExtract | null>;
}
