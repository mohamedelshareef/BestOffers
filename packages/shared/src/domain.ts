import { Fils } from './money';

/** UI/AI locale. RTL-first; AR primary, EN mirror (S1-1 §4). */
export type Locale = 'ar' | 'en';

export type Sector = 'electronics' | 'food' | 'realestate';

/** Provenance of an offer's price — drives the freshness label (system-design §"real-time but fast"). */
export type OfferSource = 'live' | 'cache';

/**
 * Canonical product. The SKU-grouping target that makes "compare the same product" possible.
 * attributes is the structured spec bag the ranker reads (storage/color/screen…).
 */
export interface Sku {
  id: string;
  category: string; // smartphone | laptop | tv …
  canonicalName: string; // "Apple iPhone 17 Pro Max 256GB Black"
  brand: string;
  model: string;
  attributes: Record<string, string>; // { storage: "256GB", color: "black", screen: "6.9\"" }
  imageUrl?: string;
}

/**
 * A provider's current price for a SKU.
 * Contract from system-design Slice 2: resolveOffers(...) → Offer[].
 * price/provider/deeplink are DATA — never produced by the LLM (truthfulness guardrail, AC D3.3).
 */
export interface Offer {
  id: string;
  skuId: string;
  providerId: string;
  providerName: string;
  priceFils: Fils;
  inStock: boolean | null;
  deeplinkUrl: string;
  source: OfferSource;
  fetchedAt: string; // ISO-8601
}

/** Normalized user intent (output of the Claude clarifier step; structured, parseable). */
export interface IntentNormalized {
  category?: string;
  brand?: string;
  model?: string;
  constraints: {
    budgetFils?: Fils;
    storage?: string;
    color?: string;
    [dimension: string]: string | number | undefined;
  };
}

/** A bounded clarifier question (AC C2.1–C2.2). Bilingual; chips + free text. */
export interface ClarifierQuestion {
  dimension: string; // storage | color | budget …
  textAr: string;
  textEn: string;
  chips: { value: string; labelAr: string; labelEn: string }[];
}

/**
 * A ranked result card (system-design Slice 3 contract; wireframe W9 / §1.4).
 * `why` text is the ONLY field the LLM authors; it must cite a real offer/sku attribute.
 */
export interface ResultCard {
  skuId: string;
  offerId: string;
  productName: string;
  providerId: string;
  providerName: string;
  priceFils: Fils;
  priceLabel: string; // formatted KWD for convenience
  whyAr: string;
  whyEn: string;
  /** The concrete attribute name+value the "why" cites — used by QA to assert truthfulness. */
  whyCitedAttribute: { key: string; value: string };
  deeplinkUrl: string;
  imageUrl?: string;
  source: OfferSource;
  /**
   * True when this offer's SKU satisfies ALL the user's answered preferences (storage/color/budget).
   * False = a relevant offer for the resolved model that does NOT match every preference (the app may
   * tag it "closest match" / "أقرب نتيجة"). Absent when no preference was answered. Offers are RANKED
   * so `true` ones come first; non-matching ones still appear (never an empty state when offers exist).
   */
  matchesPreferences?: boolean;
  /**
   * Closed-vocab relation class (F-SR1 AC-7), set server-side when this card is a no-match
   * FALLBACK alternative. `exact` = a real exact match shown first; the others are alternatives
   * (closest/alternative/within_budget/related). Absent on a normal exact-rich result set (no
   * fallback ran) so the existing UX renders unchanged. UX groups cards by this tag.
   */
  relation?: RelationTag;
  /**
   * Positive fils a `within_budget`-class offer is OVER the stated budget (F-SR1 AC-13). Present
   * ONLY on a near-budget alternative priced above budget — drives the "{delta} over budget" chip.
   * An over-budget offer is NEVER tagged `within_budget`; it keeps `within_budget` relation but
   * carries this delta so UX ranks/labels it below the truly-within-budget ones. 0/absent = within.
   */
  overBudgetDeltaFils?: Fils;
}

/**
 * Closed-vocabulary relation tag for a no-match fallback alternative (F-SR1 AC-7).
 * `exact` is the non-alternative group (a real exact match shown first). The four alternative
 * classes rank from strongest to weakest: closest > alternative > within_budget > related.
 * Set SERVER-SIDE in CODE from the real fetched offer set — never guessed by the client.
 */
export type RelationTag = 'exact' | 'closest' | 'alternative' | 'within_budget' | 'related';

/** Default render priority (lower = stronger / shown higher). Exact group is always first. */
export const RELATION_ORDER: Record<RelationTag, number> = {
  exact: 0,
  closest: 1,
  alternative: 2,
  within_budget: 3,
  related: 4,
};

/**
 * A constraint-relaxation control for the empty-empty state (F-SR1 AC-14/15). Tapping it
 * re-runs the search with the named hard constraint dropped/widened. Bilingual labels.
 * `dimension` names which binding constraint is relaxed; `action` is how (drop vs widen).
 */
export interface BroadenSuggestion {
  dimension: 'color' | 'storage' | 'budget' | 'model' | 'brand';
  action: 'drop' | 'widen' | 'category';
  labelAr: string;
  labelEn: string;
}

export type SearchState = 'clarifying' | 'results' | 'empty';

/** POST /search/intent and /search/answer response (Slice 3 contract). */
export interface SearchResponse {
  searchSessionId: string;
  state: SearchState;
  /** present when state = clarifying */
  questions?: ClarifierQuestion[];
  /** present when state = results */
  cards?: ResultCard[];
  /** how many clarifier questions have been asked so far (≤3, code-enforced). */
  clarifierCount: number;
  /** assumptions the system made on skipped/absent answers (AC C2.3). */
  assumptions?: string[];
  /**
   * True when no-match fallback augmentation ran (F-SR1 AC-1): the `cards` set contains `exact`
   * cards first (if any) then tagged alternatives. Absent/false on a normal exact-rich result set.
   */
  fallbackServed?: boolean;
  /**
   * Empty-empty broadening controls (F-SR1 AC-14): present ONLY when state='empty' AND the empty is
   * a genuine "no matching offers" (not a provider failure). Always ≥1 actionable suggestion so the
   * user is never shown a bare "0 results".
   */
  broadenSuggestions?: BroadenSuggestion[];
}

export interface IntentRequest {
  sector: Sector;
  locale: Locale;
  intentRaw: string;
}

export interface AnswerRequest {
  searchSessionId: string;
  /** dimension being answered (must match an asked question). */
  dimension: string;
  /** chip value or free text; null/"__skip__" = skip (AC C2.3). */
  answer: string | null;
}
