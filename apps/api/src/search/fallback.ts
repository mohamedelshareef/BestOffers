import {
  BroadenSuggestion,
  Fils,
  IntentNormalized,
  RelationTag,
  RELATION_ORDER,
} from '@bestoffers/shared';
import { ResolvedOffer } from '../offers/offers.service';

/**
 * F-SR1 "Smart no-match fallback" — SERVER-SIDE, pure, deterministic.
 *
 * The app must NEVER dead-end. When a search has no exact match (or fewer than N), or the user's
 * hard constraints can't be fully satisfied, we surface relevant REAL alternatives "around it".
 *
 * HARD TRUTHFULNESS RULE (enforced in CODE, not just a prompt): every alternative is a REAL offer
 * from the already-fetched `resolved` set. We never synthesize a product/price. `within_budget` is
 * never assigned to an over-budget offer. The relation tag + delta are derived ONLY from real
 * offer/sku fields. Reuses the already-fetched offers — no extra live round-trips (~6s budget).
 *
 * PO decisions baked in: N=3 · near-budget band ±15% · surface over-budget items with a delta tag
 * (don't hide them) · cap total alternatives at 10 · include only genuinely-relevant relation
 * classes (do NOT force one of every class).
 */

/** Relevance floor (PO): below this many exact matches, augment with alternatives. */
export const RELEVANCE_FLOOR_N = 3;
/** Near-budget band (PO): same-category offers within ±15% of budget qualify as `within_budget`. */
export const NEAR_BUDGET_BAND = 0.15;
/** Cap (PO): total alternatives surfaced across all relation classes. */
export const MAX_ALTERNATIVES = 10;

/** A real offer tagged with its relation to the request + (optional) over-budget delta. */
export interface TaggedOffer extends ResolvedOffer {
  relation: RelationTag;
  /** fils over the stated budget; only set on a `within_budget`-class offer priced above budget. */
  overBudgetDeltaFils?: Fils;
}

export interface FallbackResult {
  /** Real exact matches (relation 'exact'), shown first. May be empty. */
  exact: TaggedOffer[];
  /** Real tagged alternatives, ranked + capped. Genuinely-relevant classes only. */
  alternatives: TaggedOffer[];
  /** True when fewer than N exact matches existed → augmentation ran (AC-1). */
  triggered: boolean;
  /** Distinct relation classes present among the alternatives (for the fallback_served event). */
  classesPresent: RelationTag[];
}

/** Lowercased attribute value or undefined (truthfulness: never invent a missing attribute). */
function attr(o: ResolvedOffer, key: string): string | undefined {
  const v = o.sku.attributes[key];
  return v == null ? undefined : v.toLowerCase();
}

/**
 * Is `skuModel` EXACTLY the model the user asked for? (PRECISION, owner directive.)
 * True when the SKU model equals the asked model, ignoring a trailing storage/color qualifier that
 * some catalogs append (e.g. asked "iPhone 16" matches "iPhone 16" but NOT "iPhone 16 Pro Max" — the
 * extra token "Pro Max" is a DIFFERENT model, not a storage/color variant). We compare token-wise:
 * the SKU model must START with all asked tokens AND have no extra model-defining word after them.
 * Trailing storage/color tokens (e.g. "128gb", "black") are tolerated, model tokens (pro/max/plus/
 * ultra/mini/se/air + a bare number generation) are NOT.
 */
function modelIsExactlyAsked(skuModel: string, askedModel: string): boolean {
  const asked = askedModel.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const sku = skuModel.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (asked.length === 0) return true;
  if (sku.length < asked.length) return false;
  for (let i = 0; i < asked.length; i++) {
    if (sku[i] !== asked[i]) return false; // must start with the asked model verbatim
  }
  // any EXTRA tokens beyond the asked model must be storage/color qualifiers, not model words.
  const MODEL_WORDS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'se', 'air', 'fe', 'lite', 'note']);
  for (let i = asked.length; i < sku.length; i++) {
    const tok = sku[i];
    if (MODEL_WORDS.has(tok)) return false; // a model-defining word → different model, not exact
    if (/^\d{1,2}$/.test(tok)) return false; // a bare generation number (e.g. "16" → "17") → different model
  }
  return true;
}

/**
 * Discovery-based sectors (food, real-estate) have NO pre-defined model identity: each resolved
 * offer is a dish/flat the lane discovered + ranked live against the free-text intent (ADR-005/006).
 * There is no "exact model" to anchor on and no adjacent-model/related-category fallback notion, so
 * EVERY resolved offer is treated as an exact result (the AI already did the intent match upstream).
 * The model-substring fallback machinery below is electronics-shaped and must not apply here.
 */
const DISCOVERY_SECTORS = new Set(['food', 'realestate']);

/** Does this offer satisfy ALL stated hard constraints (model+storage+color+budget where given)? */
export function isExactMatch(intent: IntentNormalized, o: ResolvedOffer): boolean {
  if (intent.category && DISCOVERY_SECTORS.has(intent.category)) {
    // Only a stated budget can exclude a discovered offer; a price-on-request offer (priceFils=0) is
    // never budget-excluded (its price is unknown, not zero).
    const { budgetFils } = intent.constraints;
    if (budgetFils != null && o.offer.priceFils > 0 && o.offer.priceFils > budgetFils) return false;
    return true;
  }
  const { storage, color, budgetFils } = intent.constraints;
  // PRECISION (owner directive): an EXACT match must be the ASKED model, not merely a model that
  // CONTAINS it. "iPhone 16" must NOT count "iPhone 16 Pro Max" / "iPhone 16 Plus" as exact — those
  // are different products (they become `adjacent` alternatives via isAdjacent). Storage/color
  // variants live in attrs, not the model string, so requiring exact model identity is correct here.
  if (intent.model && !modelIsExactlyAsked(o.sku.model, intent.model)) return false;
  if (storage && attr(o, 'storage') !== String(storage).toLowerCase()) return false;
  if (color && attr(o, 'color') !== String(color).toLowerCase()) return false;
  if (budgetFils != null && o.offer.priceFils > budgetFils) return false;
  return true;
}

/**
 * Same exact model the user asked for, but differing storage and/or color (AC-6 i → `closest`).
 * Requires intent.model so we can anchor "same model". Excludes anything that's an exact match.
 */
function isClosest(intent: IntentNormalized, o: ResolvedOffer): boolean {
  if (!intent.model) return false;
  return o.sku.model.toLowerCase() === intent.model.toLowerCase();
}

/**
 * Adjacent model in the SAME brand line / generation (AC-6 ii → `alternative`). Same category,
 * same brand, but a DIFFERENT model (e.g. iPhone 16 → 16 Pro / 15 / 17). Brand-anchored so we
 * never cross brands. Excludes the requested model itself (that's `closest`/`exact`).
 */
function isAdjacent(intent: IntentNormalized, o: ResolvedOffer): boolean {
  if (!intent.brand) return false;
  if (o.sku.brand.toLowerCase() !== intent.brand.toLowerCase()) return false;
  if (intent.category && o.sku.category !== intent.category) return false;
  if (intent.model && o.sku.model.toLowerCase() === intent.model.toLowerCase()) return false;
  return true;
}

/**
 * Same category, near budget (AC-6 iii → `within_budget`, ±15%). Only meaningful when a budget was
 * stated. Surfaces both within-budget AND just-over-budget (PO: don't hide them — delta-tag them).
 * Excludes same-model (closest) and same-brand-adjacent (those are stronger classes).
 */
function isNearBudget(intent: IntentNormalized, o: ResolvedOffer): boolean {
  const budget = intent.constraints.budgetFils;
  if (budget == null) return false;
  if (intent.category && o.sku.category !== intent.category) return false;
  if (isClosest(intent, o) || isAdjacent(intent, o)) return false;
  const upper = budget * (1 + NEAR_BUDGET_BAND);
  const lower = budget * (1 - NEAR_BUDGET_BAND);
  return o.offer.priceFils >= lower && o.offer.priceFils <= upper;
}

/**
 * Related / complementary companion items (AC-6 iv → `related`): a DIFFERENT category than the
 * request (e.g. case/charger/AirPods for a phone). Always a separate, clearly-labeled class —
 * never mixed into the primary alternatives. Only fires when the resolved set genuinely contains
 * cross-category companions (our matchSkus rarely returns these, so `related` is usually absent).
 */
function isRelated(intent: IntentNormalized, o: ResolvedOffer): boolean {
  if (!intent.category) return false;
  return o.sku.category !== intent.category;
}

/**
 * Classify a single real offer into the strongest relation class it qualifies for.
 * Order of precedence mirrors the ranked priority (AC-6 / AC-10). Returns null if the offer is not
 * a relevant alternative of any class (it will simply not be surfaced — never invented away).
 */
function classify(intent: IntentNormalized, o: ResolvedOffer): RelationTag | null {
  if (isClosest(intent, o)) return 'closest';
  if (isAdjacent(intent, o)) return 'alternative';
  if (isNearBudget(intent, o)) return 'within_budget';
  if (isRelated(intent, o)) return 'related';
  return null;
}

/**
 * Build the no-match fallback over the REAL resolved offer set.
 *
 * @param ranked  the offers ALREADY ranked by the existing deterministic ranker (we preserve that
 *                intra-class order, then group by relation and cap). No re-fetch, no invented data.
 * @param broadenedRanked  OPTIONAL wider, ranked pool (same category / same brand, model filter
 *                dropped, budget NOT hard-filtered) from `OffersService.resolveBroadened`. The
 *                `alternative` (adjacent model), `within_budget` (incl. over-budget+delta) and
 *                `related` classes are drawn from THIS set, so they can surface real offers that the
 *                model-scoped + budget-filtered primary `ranked` list doesn't contain. Defaults to
 *                `ranked` (back-compat) when not supplied. Still 100% real fetched offers — no synthesis.
 */
export function buildFallback(
  intent: IntentNormalized,
  ranked: ResolvedOffer[],
  broadenedRanked: ResolvedOffer[] = ranked,
): FallbackResult {
  const exactSet = new Set<string>();
  const exact: TaggedOffer[] = [];
  for (const o of ranked) {
    if (isExactMatch(intent, o)) {
      exact.push({ ...o, relation: 'exact' });
      exactSet.add(o.offer.id);
    }
  }

  // AC-2: when exact matches ≥ N, fallback does NOT run — exact set shown unchanged, zero alts.
  const triggered = exact.length < RELEVANCE_FLOOR_N;
  if (!triggered) {
    return { exact, alternatives: [], triggered: false, classesPresent: [] };
  }

  // Alternatives are classified over the broadened pool, de-duped against the exact set. Preserve the
  // broadened ranker's intra-class order via its index map.
  const seen = new Set<string>(exactSet);
  const budget = intent.constraints.budgetFils;
  const alternatives: TaggedOffer[] = [];
  for (const o of broadenedRanked) {
    if (seen.has(o.offer.id)) continue; // skip exact matches AND any duplicate from the wider pool
    seen.add(o.offer.id);
    const relation = classify(intent, o);
    if (!relation) continue;
    const tagged: TaggedOffer = { ...o, relation };
    // AC-12/13: a within_budget-class offer priced OVER budget keeps the class but is delta-tagged
    // and ranked below truly-within ones — NEVER mislabeled as actually within budget.
    if (relation === 'within_budget' && budget != null && o.offer.priceFils > budget) {
      tagged.overBudgetDeltaFils = o.offer.priceFils - budget;
    }
    alternatives.push(tagged);
  }

  // Rank: by relation class (closest > alternative > within_budget > related), then within a class
  // within-budget before over-budget, then preserve the deterministic ranker's order (price/spec).
  const rankIndex = new Map(broadenedRanked.map((o, i) => [o.offer.id, i]));
  alternatives.sort((a, b) => {
    const ra = RELATION_ORDER[a.relation];
    const rb = RELATION_ORDER[b.relation];
    if (ra !== rb) return ra - rb;
    const oa = a.overBudgetDeltaFils ?? 0;
    const ob = b.overBudgetDeltaFils ?? 0;
    if (oa !== ob) return oa - ob; // within-budget (0) ahead of over-budget
    return (rankIndex.get(a.offer.id) ?? 0) - (rankIndex.get(b.offer.id) ?? 0);
  });

  const capped = alternatives.slice(0, MAX_ALTERNATIVES);
  const classesPresent = [...new Set(capped.map((a) => a.relation))];
  return { exact, alternatives: capped, triggered: true, classesPresent };
}

/**
 * Empty-empty broadening suggestions (AC-14/15/16). Only constraint-relaxations / category pivots
 * derived from what the user actually stated — NEVER invented SKUs. Ordered by which constraint is
 * most likely the binding one (color → budget → storage → model). Always returns ≥1 control so the
 * empty state is never a bare "0 results".
 */
export function broadenSuggestions(intent: IntentNormalized): BroadenSuggestion[] {
  const out: BroadenSuggestion[] = [];
  const c = intent.constraints;
  if (c.color != null) {
    out.push({ dimension: 'color', action: 'drop', labelAr: 'أزل فلتر اللون', labelEn: 'Remove color filter' });
  }
  if (c.budgetFils != null) {
    out.push({ dimension: 'budget', action: 'widen', labelAr: 'ارفع الميزانية', labelEn: 'Raise the budget' });
  }
  if (c.storage != null) {
    out.push({ dimension: 'storage', action: 'drop', labelAr: 'جرّب سعة أخرى', labelEn: 'Try another storage size' });
  }
  // Always offer a category pivot as a last resort (AC-14: ≥1 actionable control, never bare empty).
  // Relax the most specific stated identity (model > brand) to widen toward the category.
  out.push({
    dimension: intent.model ? 'model' : 'brand',
    action: 'category',
    labelAr: 'تصفّح الفئة كاملة',
    labelEn: 'Browse the whole category',
  });
  return out;
}
