import { IntentNormalized } from '@bestoffers/shared';
import { OffersService } from '../offers/offers.service';
import { rankOffers } from './ranker';
import { buildFallback, isExactMatch } from './fallback';

/**
 * ELECTRONICS precision (OWNER DIRECTIVE — "iPhone 16 must not return unrelated products").
 *
 * The catalog distinguishes "iPhone 17 Pro" from "iPhone 17 Pro Max" (a DIFFERENT model — the trailing
 * "Max" is a model-defining word, not a storage/color variant). A search for "iPhone 17 Pro" must treat
 * ONLY true "iPhone 17 Pro" SKUs as EXACT; "iPhone 17 Pro Max" must NOT appear in the exact set (it may
 * surface as a brand-`alternative`, clearly labeled — never mislabeled as the asked product).
 *
 * (Same rule the owner cited for "iPhone 16" vs "iPhone 16 Pro Max"; we assert it on the models that
 * have OFFLINE offers — iPhone 16 SKUs are served live-only, off in the jest.setup LIVE_FETCH=off run.)
 */
describe('electronics precision — exact model identity (Pro ≠ Pro Max)', () => {
  const offers = new OffersService();
  const intent: IntentNormalized = {
    category: 'smartphone',
    brand: 'Apple',
    model: 'iPhone 17 Pro',
    constraints: {},
  };

  it('exact set is "iPhone 17 Pro" ONLY — "iPhone 17 Pro Max" is excluded from exact', async () => {
    const primary = await offers.resolveOffers(intent);
    expect(primary.length).toBeGreaterThan(0);
    const exact = primary.filter((o) => isExactMatch(intent, o));
    expect(exact.length).toBeGreaterThan(0);
    for (const o of exact) {
      expect(o.sku.model.toLowerCase()).toBe('iphone 17 pro');
      // explicit exclusion: no "Pro Max" in the exact set
      expect(o.sku.model.toLowerCase()).not.toContain('max');
    }
  });

  it('isExactMatch is FALSE for an "iPhone 17 Pro Max" SKU under an "iPhone 17 Pro" intent', async () => {
    const broadened = await offers.resolveBroadened(intent);
    const proMax = broadened.find((o) => o.sku.model.toLowerCase() === 'iphone 17 pro max');
    expect(proMax).toBeDefined();
    expect(isExactMatch(intent, proMax!)).toBe(false);
  });

  it('"iPhone 17 Pro Max" surfaces only as an `alternative` (adjacent) — never mislabeled exact', async () => {
    const primary = await offers.resolveOffers(intent);
    const broadened = await offers.resolveBroadened(intent);
    const ranked = rankOffers(intent, primary);
    const broadenedRanked = rankOffers(intent, broadened, { applyBudgetFilter: false });
    const fb = buildFallback(intent, ranked, broadenedRanked);

    for (const e of fb.exact) expect(e.sku.model.toLowerCase()).toBe('iphone 17 pro');
    expect(fb.exact.some((e) => e.sku.model.toLowerCase().includes('max'))).toBe(false);
    const proMaxAlts = fb.alternatives.filter((a) => a.sku.model.toLowerCase() === 'iphone 17 pro max');
    for (const a of proMaxAlts) expect(a.relation).toBe('alternative');
  });

  it('a bare-number generation differs: "iPhone 17 Pro" intent excludes "iPhone 16/17" plain models from exact', async () => {
    // modelIsExactlyAsked rejects a trailing bare generation number too — sanity on the helper via
    // a hand-built offer that starts with the asked model but adds a generation token.
    const fake = {
      offer: { id: 'x', skuId: 's', providerId: 'p', providerName: 'P', priceFils: 1, inStock: true,
        deeplinkUrl: 'u', source: 'mock' as const, fetchedAt: '' },
      sku: { id: 's', category: 'smartphone', canonicalName: 'c', brand: 'Apple',
        model: 'iPhone 17 Pro 18', attributes: {} },
    };
    expect(isExactMatch(intent, fake as any)).toBe(false);
  });

  it('an impossible model ("iPhone 99") yields ZERO exact — no unrelated product padded as exact', async () => {
    const ghost: IntentNormalized = { category: 'smartphone', brand: 'Apple', model: 'iPhone 99', constraints: {} };
    const primary = await offers.resolveOffers(ghost);
    const exact = primary.filter((o) => isExactMatch(ghost, o));
    expect(exact).toHaveLength(0);
  });
});
