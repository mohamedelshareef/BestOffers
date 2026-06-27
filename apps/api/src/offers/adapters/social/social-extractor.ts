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

/** Real-estate tenure: a flat is offered for monthly RENT or for SALE (تمليك / للبيع). */
export type Tenure = 'rent' | 'sale';

/**
 * Real-estate extraction (ADR-006 §2a). priceFils null unless a price literally appears in the caption.
 *  - `tenure`: 'rent' (للإيجار) | 'sale' (للبيع/تمليك) | null when the caption does not state it.
 *  - `priceFils`: the listed price (monthly rent OR sale price per `tenure`/`priceUnit`); null on DM.
 *  - `priceUnit`: 'month' for a monthly rent, 'total' for a sale/lump price; null when unstated.
 * `rentFils` is kept as a backward-compatible alias of priceFils (older callers); prefer priceFils.
 */
export interface RealEstateExtract {
  isOffer: boolean;
  tenure: Tenure | null;
  area: string | null;
  rooms: number | null;
  priceFils: number | null;
  priceUnit: 'month' | 'total' | null;
  /** @deprecated alias of priceFils — kept so existing callers compile. */
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
