import { IntentNormalized } from '@bestoffers/shared';
import { OffersService } from './offers.service';
import { rankOffers } from '../search/ranker';

/**
 * BUG regression (iPhone-16 "no results"): the post-clarifier offer selection must NOT hard-filter
 * candidate SKUs by the answered storage/color. Those preferences are a SOFT RANK signal only
 * (applied in `rankOffers`). So when the live/mock catalog has offers for the resolved MODEL but
 * none in the answered storage (e.g. user answers a storage the model isn't sold in), the search
 * must still return the real offers — ranked, with the closest match first — NEVER the empty state.
 * Only a model with NO offers at all yields empty. (LIVE_FETCH=off → mock dataset; jest.setup forces it.)
 */
describe('OffersService — no empty result when offers exist for the model (BUG fix)', () => {
  const offers = new OffersService();

  it('returns offers for an UNSATISFIABLE storage answer (model has offers, just not that storage)', async () => {
    // iPhone 17 Pro Max exists in 256GB/512GB only. Answering 1TB used to hard-filter to ZERO SKUs
    // → empty. Now it must still resolve the real 256/512 offers.
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 17 Pro Max',
      constraints: { storage: '1TB', color: 'black' },
    };
    const resolved = await offers.resolveOffers(intent);
    expect(resolved.length).toBeGreaterThan(0); // NOT empty — the core bug

    // and ranking is stable + every card is a real iPhone 17 Pro Max offer.
    const ranked = rankOffers(intent, resolved);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.sku.model === 'iPhone 17 Pro Max')).toBe(true);
  });

  it('still resolves the same offers regardless of which storage/color was answered', async () => {
    const base: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 17 Pro Max',
      constraints: {},
    };
    const all = (await offers.resolveOffers(base)).map((r) => r.offer.id).sort();
    const withStorage = (
      await offers.resolveOffers({ ...base, constraints: { storage: '1TB' } })
    )
      .map((r) => r.offer.id)
      .sort();
    // the answered (unsatisfiable) preference does NOT remove any offer — it only re-ranks.
    expect(withStorage).toEqual(all);
  });

  it('only a model with NO offers at all yields an empty result set', async () => {
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 99 Imaginary',
      constraints: { storage: '256GB' },
    };
    const resolved = await offers.resolveOffers(intent);
    expect(resolved.length).toBe(0); // genuinely no SKU → the ONLY empty case
  });
});
