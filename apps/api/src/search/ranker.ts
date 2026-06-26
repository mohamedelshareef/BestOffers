import { IntentNormalized } from '@bestoffers/shared';
import { ResolvedOffer } from '../offers/offers.service';

/**
 * DETERMINISTIC match-quality ranking (AC D2.2). Pure function — same (intent, offers) → same order.
 * Facts only: price + spec match from DATA. The LLM never participates in ordering (truthfulness +
 * determinism). No paid/sponsored boosting (AC D2.6, neutrality).
 *
 * Score model (higher = better):
 *   + spec-match points for each stated constraint the SKU satisfies
 *   + in-stock preference
 *   − price (lower price ranks higher)
 * Deterministic tie-break: by priceFils asc, then offer.id asc.
 */

const SPEC_MATCH_WEIGHT = 1_000_000; // dominates price so a better-matching SKU never loses to a cheaper mismatch
const IN_STOCK_WEIGHT = 100_000;

export interface RankedOffer extends ResolvedOffer {
  score: number;
}

export function rankOffers(
  intent: IntentNormalized,
  offers: ResolvedOffer[],
  opts: { applyBudgetFilter?: boolean } = {},
): RankedOffer[] {
  const budget = intent.constraints.budgetFils;
  // The primary ranked list hard-filters by budget (AC D2.2). The fallback path passes
  // applyBudgetFilter:false so over-budget alternatives survive into buildFallback and can be
  // surfaced with an explicit over-budget delta (AC-12/13) instead of being silently dropped.
  const applyBudgetFilter = opts.applyBudgetFilter ?? true;

  const withinBudget = applyBudgetFilter && budget != null
    ? offers.filter((o) => o.offer.priceFils <= budget)
    : offers;

  // If a budget filtered everything out, fall back to all offers (never a dead-end; AC cross-cutting #4).
  const pool = withinBudget.length > 0 ? withinBudget : offers;

  const scored: RankedOffer[] = pool.map((ro) => ({
    ...ro,
    score: scoreOffer(intent, ro),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.offer.priceFils !== b.offer.priceFils) return a.offer.priceFils - b.offer.priceFils;
    return a.offer.id < b.offer.id ? -1 : a.offer.id > b.offer.id ? 1 : 0;
  });

  return scored;
}

function scoreOffer(intent: IntentNormalized, ro: ResolvedOffer): number {
  let score = 0;
  const { storage, color } = intent.constraints;
  const attrs = ro.sku.attributes;

  if (storage && attrs.storage?.toLowerCase() === String(storage).toLowerCase()) {
    score += SPEC_MATCH_WEIGHT;
  }
  if (color && attrs.color?.toLowerCase() === String(color).toLowerCase()) {
    score += SPEC_MATCH_WEIGHT;
  }
  // Real-estate (social lane) spec-match: an offer whose AREA appears in the query text outranks
  // off-area flats (so "flat in Salwa" floats Salwa posts above Salmiya/Mahboula). area is in attrs.
  const queryText = `${intent.model ?? ''} ${intent.category ?? ''}`.toLowerCase();
  if (attrs.area && queryText.includes(attrs.area.toLowerCase())) {
    score += SPEC_MATCH_WEIGHT;
  }
  if (ro.offer.inStock === true) {
    score += IN_STOCK_WEIGHT;
  }
  // cheaper is better — subtract price so lower price yields a higher score. A "price on request"
  // offer (priceFils=0, social lane) must NOT rank as the cheapest: penalize it to sit below all
  // real-priced offers of equal spec-match (its price is unknown, not zero).
  if (ro.offer.priceFils === 0 && attrs.priceOnRequest === 'true') {
    score -= PRICE_ON_REQUEST_PENALTY;
  } else {
    score -= ro.offer.priceFils;
  }
  return score;
}

/** A price-on-request offer ranks just below any real-priced offer of equal spec-match (never "cheapest"). */
const PRICE_ON_REQUEST_PENALTY = 10_000_000;
