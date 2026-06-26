import { IntentNormalized } from '@bestoffers/shared';
import { rankOffers } from './ranker';
import { OffersService } from '../offers/offers.service';

/**
 * AC D2.2 — ranking is by match-quality (price/spec from DATA) and DETERMINISTIC for the same
 * (query, data snapshot). No LLM in the ordering. No sponsored boosting (AC D2.6).
 */
describe('deterministic ranker (AC D2.2, D2.6)', () => {
  const offers = new OffersService();

  it('ranks the cheapest in-stock matching SKU first', async () => {
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      constraints: { storage: '256GB', color: 'black' },
    };
    const ranked = rankOffers(intent, await offers.resolveOffers(intent));
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    // Eureka 419500 (in stock) beats X-cite 425000 (in stock) beats Blink 432000 (OUT of stock).
    expect(ranked[0].offer.providerName).toBe('Eureka');
    expect(ranked[0].offer.priceFils).toBe(419500);
  });

  it('is deterministic: identical input → identical order across runs', async () => {
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      constraints: { storage: '256GB', color: 'black' },
    };
    const a = rankOffers(intent, await offers.resolveOffers(intent)).map((r) => r.offer.id);
    const b = rankOffers(intent, await offers.resolveOffers(intent)).map((r) => r.offer.id);
    const c = rankOffers(intent, await offers.resolveOffers(intent)).map((r) => r.offer.id);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('prefers spec-match over a cheaper mismatch', async () => {
    // user wants 512GB; the 512 SKU (489000) must outrank cheaper 256 SKUs.
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      constraints: { storage: '512GB' },
    };
    const ranked = rankOffers(intent, await offers.resolveOffers(intent));
    expect(ranked[0].sku.attributes.storage).toBe('512GB');
  });

  it('filters out offers above budget, but never dead-ends if all exceed it', async () => {
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      constraints: { storage: '256GB', color: 'black', budgetFils: 420000 },
    };
    const ranked = rankOffers(intent, await offers.resolveOffers(intent));
    // only Eureka 419500 is within 420000
    expect(ranked.every((r) => r.offer.priceFils <= 420000)).toBe(true);
    expect(ranked[0].offer.providerName).toBe('Eureka');

    // impossible budget → falls back to all, never empty (AC cross-cutting #4)
    const impossible: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      constraints: { storage: '256GB', color: 'black', budgetFils: 1 },
    };
    const fallback = rankOffers(impossible, await offers.resolveOffers(impossible));
    expect(fallback.length).toBeGreaterThan(0);
  });
});
