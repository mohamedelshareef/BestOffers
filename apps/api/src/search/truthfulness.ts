import { Offer, Sku } from '@bestoffers/shared';
import { RankExplanation } from '../ai/claude-client.interface';

/**
 * Ranking-truthfulness invariant (AC D3.3).
 * The model authors only explanation TEXT; the attribute it cites MUST exist in the supplied
 * offer/sku data. A "why" that cites an attribute not present is a bug — this guard catches it.
 *
 * Returns the verified citation { key, value } when valid, or throws TruthfulnessViolationError.
 * Callers use this to (a) assert in tests and (b) fall back to a data-only "why" in production.
 */

export class TruthfulnessViolationError extends Error {
  constructor(
    public readonly offerId: string,
    public readonly citedKey: string,
  ) {
    super(`"why" for offer ${offerId} cites attribute "${citedKey}" not present in the offer data`);
    this.name = 'TruthfulnessViolationError';
  }
}

/** The attribute keys that are considered "real, supplied data" for an offer+sku. */
export function citableAttributes(offer: Offer, sku: Sku): Record<string, string> {
  return {
    price: String(offer.priceFils),
    provider: offer.providerName,
    inStock: String(offer.inStock),
    storage: sku.attributes.storage ?? '',
    color: sku.attributes.color ?? '',
    screen: sku.attributes.screen ?? '',
    brand: sku.brand,
    model: sku.model,
    category: sku.category,
  };
}

export function verifyCitation(
  explanation: RankExplanation,
  offer: Offer,
  sku: Sku,
): { key: string; value: string } {
  const attrs = citableAttributes(offer, sku);
  const key = explanation.citedAttributeKey;
  const value = attrs[key];
  // The key must be a known attribute AND carry a real (non-empty) value.
  if (value == null || value === '') {
    throw new TruthfulnessViolationError(offer.id, key);
  }
  return { key, value };
}
