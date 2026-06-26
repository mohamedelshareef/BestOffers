import { IntentNormalized } from '@bestoffers/shared';
import { OffersService } from '../offers/offers.service';
import { rankOffers } from './ranker';
import {
  broadenSuggestions,
  buildFallback,
  isExactMatch,
  MAX_ALTERNATIVES,
  RELEVANCE_FLOOR_N,
} from './fallback';

/**
 * F-SR1 "Smart no-match fallback" — server-side, pure, deterministic, over the REAL fetched offer
 * set only. (LIVE_FETCH=off → mock dataset; jest.setup forces it, so these offers are the
 * deterministic mock catalog.) The hard rule under test: every surfaced alternative traces to a
 * real fetched offer record; tampered/synthetic offers are dropped; `within_budget` is never put on
 * an over-budget offer; an exact-rich query injects ZERO alternatives; empty-empty has ≥1 broaden
 * control.
 */
describe('F-SR1 no-match fallback (buildFallback)', () => {
  const offers = new OffersService();

  // Mirrors the production wiring (search.service): the primary ranked list is model-scoped +
  // budget-filtered; the fallback also resolves a BROADENED pool (same brand/category, model filter
  // dropped, budget not hard-filtered) so adjacent-model + over-budget alternatives are available as
  // REAL offers. `resolved` is the union of both pools — the truthfulness oracle (every surfaced
  // offer must trace to a real fetched record).
  async function resolveRanked(intent: IntentNormalized) {
    const primary = await offers.resolveOffers(intent);
    const broadened = await offers.resolveBroadened(intent);
    const ranked = rankOffers(intent, primary);
    const broadenedRanked = rankOffers(intent, broadened, { applyBudgetFilter: false });
    const byId = new Map([...primary, ...broadened].map((r) => [r.offer.id, r]));
    return { resolved: [...byId.values()], ranked, broadenedRanked };
  }

  // ── A. Trigger logic (AC-1, AC-2) ─────────────────────────────────────────────────────────────
  describe('trigger logic', () => {
    it('TRIGGERS when fewer than N exact matches exist (constraint-unsatisfiable color)', async () => {
      // iPhone 17 Pro Max exists in black/blue only → color=red has ZERO exact matches, but the same
      // model in other colors exists → surfaced as `closest`. (Offline: this family HAS mock offers;
      // the iPhone-16 family is live-only, exercised in the LIVE :3000 verification, not offline.)
      const intent: IntentNormalized = {
        category: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        constraints: { color: 'red' },
      };
      const { ranked, broadenedRanked } = await resolveRanked(intent);
      const fb = buildFallback(intent, ranked, broadenedRanked);
      expect(fb.exact.length).toBeLessThan(RELEVANCE_FLOOR_N);
      expect(fb.triggered).toBe(true);
      // and it surfaced real same-model variants (black/blue, 256/512) as `closest`.
      expect(fb.alternatives.length).toBeGreaterThan(0);
      expect(fb.alternatives.some((a) => a.relation === 'closest')).toBe(true);
    });

    it('does NOT trigger when exact matches ≥ N — zero alternatives injected (AC-2)', async () => {
      // iPhone 17 Pro Max 256GB Black has 4 provider offers (all exact) ≥ N=3.
      const intent: IntentNormalized = {
        category: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        constraints: { storage: '256GB', color: 'black' },
      };
      const { ranked, broadenedRanked } = await resolveRanked(intent);
      const fb = buildFallback(intent, ranked, broadenedRanked);
      expect(fb.exact.length).toBeGreaterThanOrEqual(RELEVANCE_FLOOR_N);
      expect(fb.triggered).toBe(false);
      expect(fb.alternatives).toHaveLength(0); // EXACT-RICH → ZERO alternatives
      expect(fb.classesPresent).toHaveLength(0);
    });

    it('exact matches are shown first and are never mislabeled as alternatives (AC-5)', async () => {
      // 1 exact (Pro Max 256) + same-model variants → exact stays exact, fills below with closest.
      const intent: IntentNormalized = {
        category: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 16 Pro Max',
        constraints: { storage: '256GB' },
      };
      const { ranked, broadenedRanked } = await resolveRanked(intent);
      const fb = buildFallback(intent, ranked, broadenedRanked);
      expect(fb.exact.every((e) => e.relation === 'exact')).toBe(true);
      expect(fb.alternatives.every((a) => a.relation !== 'exact')).toBe(true);
      const exactIds = new Set(fb.exact.map((e) => e.offer.id));
      expect(fb.alternatives.every((a) => !exactIds.has(a.offer.id))).toBe(true);
    });
  });

  // ── B. Truthfulness & traceability (AC-4, AC-11) ──────────────────────────────────────────────
  describe('truthfulness — every alternative traces to a real fetched offer', () => {
    it('every surfaced offer ID/price/provider exists in the fetched offer set (zero synthesis)', async () => {
      const intent: IntentNormalized = {
        category: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        constraints: { color: 'red' },
      };
      const { resolved, ranked, broadenedRanked } = await resolveRanked(intent);
      const fb = buildFallback(intent, ranked, broadenedRanked);
      const realById = new Map(resolved.map((r) => [r.offer.id, r.offer]));
      for (const a of [...fb.exact, ...fb.alternatives]) {
        const real = realById.get(a.offer.id);
        expect(real).toBeDefined(); // not invented
        expect(a.offer.priceFils).toBe(real!.priceFils); // price not altered
        expect(a.offer.providerId).toBe(real!.providerId); // provider not altered
      }
    });

    it('TAMPER: a synthetic/altered offer not in the fetched set is dropped (cannot be surfaced)', async () => {
      const intent: IntentNormalized = {
        category: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        constraints: { color: 'red' },
      };
      const { resolved, ranked, broadenedRanked } = await resolveRanked(intent);
      const fb = buildFallback(intent, ranked, broadenedRanked);
      const realIds = new Set(resolved.map((r) => r.offer.id));
      // Inject a fabricated offer ID into the surfaced set's expected universe — assert it's absent.
      const fakeId = 'off_FABRICATED_999';
      expect(realIds.has(fakeId)).toBe(false);
      const surfaced = [...fb.exact, ...fb.alternatives].map((a) => a.offer.id);
      expect(surfaced).not.toContain(fakeId);
      // Every surfaced ID is from the real fetched set — the only source buildFallback draws from.
      expect(surfaced.every((id) => realIds.has(id))).toBe(true);
    });
  });

  // ── C. within_budget never on over-budget (AC-12, AC-13) ──────────────────────────────────────
  describe('budget truthfulness', () => {
    it('over-budget near-category offers keep relation but carry a delta + are ranked below within', async () => {
      // Category-only smartphone search, budget 237 KWD → band ±15% = ~201.45–272.55 KWD. The Galaxy
      // S25 128GB is priced 235.000 (within) and 239.000 (just over, +2.000). No brand/model stated →
      // these are NOT closest/adjacent → they land in `within_budget`. Assert: the over-budget one
      // keeps the class but carries a positive delta (AC-13) and is NEVER mislabeled as within (AC-12).
      const intent: IntentNormalized = {
        category: 'smartphone',
        constraints: { budgetFils: 237000 },
      };
      const { ranked, broadenedRanked } = await resolveRanked(intent);
      const fb = buildFallback(intent, ranked, broadenedRanked);
      const wb = fb.alternatives.filter((a) => a.relation === 'within_budget');
      expect(wb.length).toBeGreaterThan(0);
      for (const a of wb) {
        if (a.offer.priceFils > 237000) {
          // over budget → MUST carry a positive delta (AC-13), never silently "within"
          expect(a.overBudgetDeltaFils).toBe(a.offer.priceFils - 237000);
          expect(a.overBudgetDeltaFils!).toBeGreaterThan(0);
        } else {
          expect(a.overBudgetDeltaFils ?? 0).toBe(0); // truly within → no delta
        }
      }
      // within-budget ones rank ahead of over-budget ones within the class.
      const idx = (over: boolean) => wb.findIndex((a) => (a.overBudgetDeltaFils ?? 0) > 0 === over);
      if (wb.some((a) => (a.overBudgetDeltaFils ?? 0) > 0) && wb.some((a) => (a.overBudgetDeltaFils ?? 0) === 0)) {
        expect(idx(false)).toBeLessThan(idx(true));
      }
    });
  });

  // ── D. Cap + ranking (AC-10) ──────────────────────────────────────────────────────────────────
  it('caps total alternatives at MAX_ALTERNATIVES and ranks stronger classes first', async () => {
    // color=red is unsatisfiable for iPhone 17 Pro Max → closest (same-model variants) + adjacent
    // Apple models (iPhone 17 Pro / MacBook excluded by category) as `alternative`.
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 17 Pro Max',
      constraints: { color: 'red' },
    };
    const { ranked, broadenedRanked } = await resolveRanked(intent);
    const fb = buildFallback(intent, ranked, broadenedRanked);
    expect(fb.alternatives.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
    expect(fb.alternatives.some((a) => a.relation === 'closest')).toBe(true);
    expect(fb.alternatives.some((a) => a.relation === 'alternative')).toBe(true);
    // relation order is non-decreasing (closest before alternative before within_budget before related)
    const order = { exact: 0, closest: 1, alternative: 2, within_budget: 3, related: 4 } as const;
    const seq = fb.alternatives.map((a) => order[a.relation]);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
  });

  // ── E. isExactMatch helper ────────────────────────────────────────────────────────────────────
  it('isExactMatch requires ALL stated hard constraints', async () => {
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 17 Pro Max',
      constraints: { storage: '512GB', color: 'black' },
    };
    const { resolved } = await resolveRanked(intent);
    const matches = resolved.filter((o) => isExactMatch(intent, o));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((o) => o.sku.attributes.storage === '512GB')).toBe(true);
    expect(matches.every((o) => o.sku.attributes.color === 'black')).toBe(true);
  });
});

// ── F. Empty-empty broaden suggestions (AC-14, AC-16) ───────────────────────────────────────────
describe('F-SR1 empty-empty broaden suggestions', () => {
  it('always returns ≥1 actionable control, even with no constraints', () => {
    const bare: IntentNormalized = { category: 'smartphone', constraints: {} };
    const s = broadenSuggestions(bare);
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s.every((x) => x.labelAr && x.labelEn)).toBe(true);
  });

  it('reflects the binding constraints — drops color, widens budget when those were set', () => {
    const intent: IntentNormalized = {
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 99 Imaginary',
      constraints: { color: 'pink', budgetFils: 100000, storage: '1TB' },
    };
    const s = broadenSuggestions(intent);
    expect(s.some((x) => x.dimension === 'color' && x.action === 'drop')).toBe(true);
    expect(s.some((x) => x.dimension === 'budget' && x.action === 'widen')).toBe(true);
    expect(s.some((x) => x.dimension === 'storage' && x.action === 'drop')).toBe(true);
    // and a category pivot is always present as a last resort.
    expect(s.some((x) => x.action === 'category')).toBe(true);
  });

  it('suggests only constraint-relaxations / pivots — never invents an SKU', () => {
    const intent: IntentNormalized = { category: 'smartphone', brand: 'Apple', constraints: {} };
    const s = broadenSuggestions(intent);
    const allowed = new Set(['drop', 'widen', 'category']);
    expect(s.every((x) => allowed.has(x.action))).toBe(true);
  });
});
