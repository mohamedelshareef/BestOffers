import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AnswerRequest,
  ClarifierQuestion,
  formatFils,
  IntentRequest,
  ResultCard,
  SearchResponse,
} from '@bestoffers/shared';
import { CLAUDE_CLIENT, ClaudeClient } from '../ai/claude-client.interface';
import { OffersService, ResolvedOffer } from '../offers/offers.service';
import { rankOffers } from './ranker';
import {
  broadenSuggestions,
  buildFallback,
  isExactMatch,
  RELEVANCE_FLOOR_N,
  TaggedOffer,
} from './fallback';
import { SearchSession, SessionStore } from './session.store';
import { TruthfulnessViolationError, verifyCitation } from './truthfulness';
import { EventsService } from '../events/events.service';
import { QuotaService } from '../quota/quota.service';
import { PaywallException } from './paywall.exception';
import {
  CLARIFIER_SETS,
  MIN_CLARIFIER_QUESTIONS,
  PreResolveContext,
  toQuestion,
} from './clarifier-sets';

/**
 * Server-authoritative ≥5 clarifier floor (OWNER DIRECTIVE 2026-06-26, PO-ratified): irrespective of
 * sector, search does NOT dispatch to providers until at least this many distinct dimensions have been
 * PRESENTED (answered or skipped). This SUPERSEDES the prior ≤3 cap + the "food/realestate = no
 * clarifiers" discovery rule. The question SETS are config-driven per sector (`clarifier-sets.ts`).
 */
export const MAX_CLARIFIER_QUESTIONS = MIN_CLARIFIER_QUESTIONS;

/**
 * SPEED: cap how many ranked offers get a model-authored "why". Food queries can return dozens-to-
 * hundreds of dishes; explaining all of them is the dominant latency cost. The top N (the cards the
 * user actually reads) get a Claude "why"; the rest fall through to the truthful data-only why line.
 */
export const EXPLAIN_TOP_N = Number(process.env.EXPLAIN_TOP_N ?? 8);

/**
 * SPEED bound for the SMART per-query clarifier generation (RULE-10). Claude (Haiku) proposes the
 * tailored ≥5 set; if it doesn't answer within this budget we fall back to the deterministic config
 * set so the user never waits. Override with CLARIFIER_GEN_TIMEOUT_MS.
 */
export const CLARIFIER_GEN_TIMEOUT_MS = Number(process.env.CLARIFIER_GEN_TIMEOUT_MS ?? 12000);

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(CLAUDE_CLIENT) private readonly claude: ClaudeClient,
    private readonly offers: OffersService,
    private readonly sessions: SessionStore,
    private readonly events: EventsService,
    private readonly quota: QuotaService,
  ) {}

  /** POST /search/intent — opens a session, runs the first clarifier step. */
  async startIntent(req: IntentRequest, pseudoId: string, userId?: string): Promise<SearchResponse> {
    // SPEED: kick off intent-normalization AND the SMART clarifier-set generation IN PARALLEL — they
    // are independent fast-model calls, so the clarifier phase pays ONE Haiku round-trip, not two
    // sequential ones. The smart set is generated from the RAW intent + sector (it doesn't need the
    // normalized output); pre-resolved dimensions are deduped post-hoc against the normalized intent.
    const clarP = this.claude.clarify({
      intentRaw: req.intentRaw,
      sector: req.sector,
      locale: req.locale,
      askedDimensions: [],
    });
    const setP = this.generateClarifierSet({
      intentRaw: req.intentRaw,
      sector: req.sector,
      locale: req.locale,
      alreadyResolved: [], // deduped against the resolved intent below
    });
    const [clar, generated] = await Promise.all([clarP, setP]);

    const session = this.sessions.create({
      pseudoId,
      userId,
      sector: req.sector,
      locale: req.locale,
      intentRaw: req.intentRaw,
      intentNormalized: clar.intentNormalized,
    });

    // RULE-7: dimensions the user already stated in free-text intent are PRE-RESOLVED and count toward
    // the ≥5 without being re-asked. Mark them now so the gate doesn't interrogate what's already known.
    this.markPreResolved(session);

    // OWNER DIRECTIVE 2026-06-27: store the SMART, query-specific set tailored to THIS exact item — NOT
    // the generic per-sector list. Drop any generated dim that collides with a now-known pre-resolved
    // dimension (RULE-7). undefined when Claude failed/timed out/returned < floor → the gate falls back
    // to the deterministic config set (`clarifier-sets.ts`), so it never breaks the flow.
    session.generatedQuestions = this.reconcileGenerated(generated, this.preResolvedDimensions(session));
    this.sessions.save(session);

    // No PII: only normalized category + pseudoId are logged (S1-4 privacy wall).
    this.events.log({
      type: 'intent_submitted',
      pseudoId,
      searchSessionId: session.id,
      payload: { sector: req.sector, category: clar.intentNormalized.category ?? 'unknown' },
    });

    return this.advance(session);
  }

  /** POST /search/answer — records an answer, runs the next step (clarify again or search). */
  async submitAnswer(req: AnswerRequest, pseudoId: string): Promise<SearchResponse> {
    const session = this.sessions.get(req.searchSessionId);
    if (!session) throw new NotFoundException('search session not found');

    // record the answer + fold it into normalized intent
    const answer = req.answer === '__skip__' ? null : req.answer;
    session.answers[req.dimension] = answer;
    if (answer != null) {
      this.applyAnswer(session, req.dimension, answer);
    }

    this.events.log({
      type: 'clarifier_answered',
      pseudoId,
      searchSessionId: session.id,
      payload: { dimension: req.dimension, skipped: answer == null },
    });

    // The CODE owns the ≥5 gate + which dimension comes next (config-driven), NOT the model. We no
    // longer round-trip Claude per answer — the per-sector set in `clarifier-sets.ts` is authoritative,
    // which also keeps the clarifier phase fast (no extra model call between chips).
    return this.advance(session);
  }

  /**
   * SERVER-AUTHORITATIVE ≥5 GATE (RULE-1). Present the NEXT unresolved dimension from this sector's
   * config set, or — once ≥5 distinct dimensions have been PRESENTED (asked or pre-resolved) — run the
   * search. Skipping widens an axis but still counts toward the 5 and never short-circuits (RULE-4).
   */
  private async advance(session: SearchSession): Promise<SearchResponse> {
    const presented = this.presentedCount(session); // pre-resolved + already-asked (RULE-7 + RULE-4)
    const total = Math.max(MIN_CLARIFIER_QUESTIONS, this.preResolvedDimensions(session).length);

    // Search ONLY dispatches once the floor is met (RULE-1). Until then, present the next dimension
    // that is neither pre-resolved nor already asked.
    if (presented < MIN_CLARIFIER_QUESTIONS) {
      const next = this.nextQuestion(session);
      if (next) {
        session.askedDimensions.push(next.dimension);
        // "N of total" counts PRESENTED dimensions (asked + pre-resolved) so a fully-specified intent
        // that pre-resolved 4 shows "5 of 5" on its single asked question.
        session.clarifierCount = this.presentedCount(session);
        session.status = 'clarifying';
        this.sessions.save(session);
        return {
          searchSessionId: session.id,
          state: 'clarifying',
          questions: [next],
          clarifierCount: session.clarifierCount,
          totalQuestions: total,
        };
      }
      // No more questions to present but floor not reached (set < 5 — a config/generation edge we
      // don't want to dead-loop on): fall through to search rather than hang.
    }

    // Floor met (or no more questions available) → dispatch to providers (RULE-4: skip-all still searches).
    return this.runSearch(session);
  }

  /**
   * Generate the SMART, query-specific clarifier set (OWNER DIRECTIVE 2026-06-27) from the raw intent.
   * Returns the raw tailored list (or [] on failure/timeout); the caller reconciles it against the
   * resolved pre-known dimensions and the ≥5 floor. Bounded by CLARIFIER_GEN_TIMEOUT_MS so a slow/hung
   * model never blocks the user — on timeout/throw it resolves to [] (→ deterministic config fallback).
   */
  private async generateClarifierSet(input: {
    intentRaw: string;
    sector: string;
    locale: SearchSession['locale'];
    alreadyResolved: string[];
  }): Promise<ClarifierQuestion[]> {
    try {
      const generated = await this.withTimeout(
        this.claude.clarifierSet({
          intentRaw: input.intentRaw,
          sector: input.sector,
          locale: input.locale,
          minQuestions: MIN_CLARIFIER_QUESTIONS,
          alreadyResolved: input.alreadyResolved,
        }),
        CLARIFIER_GEN_TIMEOUT_MS,
      );
      return (generated ?? []).map((q) => ({
        dimension: q.dimension,
        textAr: q.textAr,
        textEn: q.textEn,
        chips: q.chips,
      }));
    } catch (err) {
      this.logger.warn(`clarifierSet generation failed (${(err as Error).message}) → config fallback`);
      return [];
    }
  }

  /**
   * Reconcile a raw generated set with the now-known pre-resolved dimensions (RULE-7) + the ≥5 floor.
   * Drops dims that collide with a pre-resolved one, dedupes, and only TRUSTS the smart set when it can
   * still carry the floor (need = 5 − pre-resolved). Otherwise returns undefined → config fallback (we
   * never serve a half-smart / half-config set). When intent already covers the floor, no smart set is
   * needed (undefined → config, which the gate skips down to the search anyway).
   */
  private reconcileGenerated(
    generated: ClarifierQuestion[],
    alreadyResolved: string[],
  ): ClarifierQuestion[] | undefined {
    const need = Math.max(0, MIN_CLARIFIER_QUESTIONS - alreadyResolved.length);
    if (need === 0) return undefined;

    const resolvedSet = new Set(alreadyResolved.map((d) => d.toLowerCase()));
    const seen = new Set<string>();
    const clean: ClarifierQuestion[] = [];
    for (const q of generated) {
      const dim = q.dimension.toLowerCase();
      if (resolvedSet.has(dim) || seen.has(dim)) continue;
      seen.add(dim);
      clean.push(q);
    }
    if (clean.length >= need) {
      this.logger.log(`clarifierSet smart=ON dims=[${clean.map((q) => q.dimension).join(',')}]`);
      return clean;
    }
    this.logger.log(`clarifierSet smart=OFF (only ${clean.length}/${need}) → config fallback`);
    return undefined;
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`clarifier-gen timeout ${ms}ms`)), ms);
      timer.unref?.(); // don't keep the event loop alive on this guard timer
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }

  /** The next question to present — from the smart generated set when present, else the config set. */
  private nextQuestion(session: SearchSession): ClarifierQuestion | undefined {
    const pre = new Set(this.preResolvedDimensions(session));
    if (session.generatedQuestions?.length) {
      return session.generatedQuestions.find(
        (q) => !pre.has(q.dimension) && !session.askedDimensions.includes(q.dimension),
      );
    }
    const dims = CLARIFIER_SETS[session.sector] ?? [];
    const next = dims.find((d) => !pre.has(d.dimension) && !session.askedDimensions.includes(d.dimension));
    return next ? toQuestion(next) : undefined;
  }

  /** Distinct dimensions PRESENTED to the user: pre-resolved from intent + explicitly asked (RULE-7). */
  private presentedCount(session: SearchSession): number {
    const pre = this.preResolvedDimensions(session);
    const set = new Set([...pre, ...session.askedDimensions]);
    return set.size;
  }

  /** Dimensions the user's free-text intent already resolved (RULE-7) — counted, never re-asked. */
  private preResolvedDimensions(session: SearchSession): string[] {
    const dims = CLARIFIER_SETS[session.sector] ?? [];
    const ctx: PreResolveContext = {
      raw: (session.intentRaw ?? '').toLowerCase(),
      constraints: session.intentNormalized.constraints,
      model: session.intentNormalized.model,
    };
    return dims.filter((d) => d.preResolved(ctx)).map((d) => d.dimension);
  }

  /** Stamp pre-resolved dimensions into `answers` (as recorded, not skipped) so they count + feed filters. */
  private markPreResolved(session: SearchSession): void {
    for (const dim of this.preResolvedDimensions(session)) {
      if (!(dim in session.answers)) session.answers[dim] = '__prefilled__';
    }
  }

  private async runSearch(session: SearchSession): Promise<SearchResponse> {
    // ── Freemium gate (ADR-004 Decision 5 / BA F-D2) ──
    // Enforced here, at the value-delivery moment (clarifiers resolved, provider search about to run).
    // Only metered for AUTHED users; idempotent per session so refinements/duplicate submits of the
    // SAME search never recount (AC-3). Premium users bypass (counter untouched). Over quota → 402.
    if (session.userId && !session.quotaConsumed) {
      const gate = await this.quota.tryConsume(session.userId);
      if (!gate.allowed) {
        session.status = 'empty';
        this.sessions.save(session);
        throw new PaywallException(gate.used);
      }
      session.quotaConsumed = true;
      this.sessions.save(session);
    }

    // The SECTOR the user picked (category tile) is authoritative for routing the offer lane — the
    // clarifier's free-form `category` guess (e.g. "apartment_rent") must not override it. For food
    // and real-estate we pin category to the sector and ensure `model` carries the raw query (the
    // discovery term the social/Talabat lanes search on). Electronics keeps the clarifier's category.
    this.pinIntentToSector(session);

    const startedAt = Date.now();
    const resolved = await this.offers.resolveOffers(session.intentNormalized);

    // ── F-SR1: NEVER dead-end. Compute the no-match fallback from the REAL resolved offer set. ──
    // resolved.length === 0 means the resolved MODEL has no SKU/offers at all (matchSkus empty) — the
    // genuine empty-empty case (NOT a provider failure: the live layer degrades to partial results, it
    // doesn't return []). Show a HELPFUL empty state with actionable broaden controls, never a bare 0.
    if (resolved.length === 0) {
      session.status = 'empty';
      this.sessions.save(session);
      const broaden = broadenSuggestions(session.intentNormalized);
      this.events.log({
        type: 'empty_result',
        pseudoId: session.pseudoId,
        searchSessionId: session.id,
        payload: { category: session.intentNormalized.category ?? 'unknown' },
      });
      // F-SR1 AC-20: anonymized empty_empty event (pseudo_id only; no PII, no raw query text).
      this.events.log({
        type: 'empty_empty',
        pseudoId: session.pseudoId,
        searchSessionId: session.id,
        payload: {
          category: session.intentNormalized.category ?? 'unknown',
          broaden_count: broaden.length,
          broaden_dimensions: broaden.map((b) => b.dimension),
        },
      });
      return {
        searchSessionId: session.id,
        state: 'empty',
        cards: [],
        clarifierCount: session.clarifierCount,
        totalQuestions: Math.max(MIN_CLARIFIER_QUESTIONS, this.preResolvedDimensions(session).length),
        assumptions: this.assumptionsFrom(session),
        broadenSuggestions: broaden, // AC-14: ≥1 actionable control
      };
    }

    const ranked = rankOffers(session.intentNormalized, resolved);

    // Group exact matches first, then real tagged alternatives (closest/alternative/within_budget/
    // related), capped + ranked. When ≥N exact matches exist, fallback does NOT run (zero alts).
    // The fallback also draws on a BROADENED pool (same brand/category, model filter dropped, budget
    // not hard-filtered) so adjacent-model + over-budget alternatives can surface as REAL offers that
    // the model-scoped primary list doesn't contain. Resolve it lazily only when the fallback triggers
    // (exact set is thin) to avoid the extra work on exact-rich queries.
    const exactCount = resolved.filter((o) => isExactMatch(session.intentNormalized, o)).length;
    let broadenedRanked = ranked;
    if (exactCount < RELEVANCE_FLOOR_N) {
      const broadened = await this.offers.resolveBroadened(session.intentNormalized);
      broadenedRanked = rankOffers(session.intentNormalized, broadened, { applyBudgetFilter: false });
    }
    const fallback = buildFallback(session.intentNormalized, ranked, broadenedRanked);
    const ordered: TaggedOffer[] = [...fallback.exact, ...fallback.alternatives];
    const cards = await this.assembleCards(session, ordered, fallback.triggered);

    session.status = 'results';
    this.sessions.save(session);

    this.events.log({
      type: 'search_executed',
      pseudoId: session.pseudoId,
      searchSessionId: session.id,
      payload: {
        source: ranked[0]?.offer.source ?? 'cache',
        latency_ms: Date.now() - startedAt,
        result_count: cards.length,
      },
    });

    // F-SR1 AC-20: anonymized fallback_served event — relation classes present, counts per class,
    // whether exact matches existed. pseudo_id only; no PII, no raw query text.
    if (fallback.triggered) {
      const perClass: Record<string, number> = {};
      for (const a of fallback.alternatives) perClass[a.relation] = (perClass[a.relation] ?? 0) + 1;
      this.events.log({
        type: 'fallback_served',
        pseudoId: session.pseudoId,
        searchSessionId: session.id,
        payload: {
          category: session.intentNormalized.category ?? 'unknown',
          had_exact: fallback.exact.length > 0,
          exact_count: fallback.exact.length,
          alternatives_count: fallback.alternatives.length,
          classes_present: fallback.classesPresent,
          per_class: perClass,
        },
      });
    }
    for (const [rank, card] of cards.entries()) {
      this.events.log({
        type: 'offer_returned',
        pseudoId: session.pseudoId,
        searchSessionId: session.id,
        payload: {
          provider: card.providerId,
          category: session.intentNormalized.category ?? 'unknown',
          price_fils: card.priceFils,
          rank,
        },
      });
    }

    return {
      searchSessionId: session.id,
      state: 'results',
      cards,
      clarifierCount: session.clarifierCount,
      totalQuestions: Math.max(MIN_CLARIFIER_QUESTIONS, this.preResolvedDimensions(session).length),
      assumptions: this.assumptionsFrom(session),
      fallbackServed: fallback.triggered || undefined,
    };
  }

  /**
   * Build cards: price/provider/deeplink from DATA; only the "why" text comes from the model.
   * When `fallbackTriggered`, each card carries its closed-vocab `relation` tag (+ over-budget delta)
   * so UX can group exact vs alternatives. On a normal exact-rich set (no fallback) the relation tag
   * is OMITTED — the existing UX renders unchanged (AC-2: zero alternative-tagged cards).
   */
  private async assembleCards(
    session: SearchSession,
    ranked: TaggedOffer[],
    fallbackTriggered = false,
  ): Promise<ResultCard[]> {
    // The "why" text is the ONLY model-authored field on a card; price/provider/deeplink are DATA.
    // A model failure (max_tokens, refusal, network) must NEVER abort the search — every card already
    // has a truthful data-only "why" fallback below. So we degrade to empty explanations instead of
    // letting explainRanking throw out of runSearch (which previously 500'd the whole food result and
    // surfaced as "0 cards" — D-V2-1). Truthful by construction: a missing explanation → data-only why.
    // SPEED: only the TOP cards get a model-authored "why" — the rest fall through to the truthful
    // data-only "why" path below. On a food query that can return 50–280 dishes, asking Claude to
    // explain every one was the dominant latency cost (a multi-KB tool payload + long completion).
    // The user reads the top results; ranks beyond EXPLAIN_TOP_N keep the data-only price/provider line.
    const toExplain = ranked.slice(0, EXPLAIN_TOP_N);
    let explanations: Awaited<ReturnType<typeof this.claude.explainRanking>> = [];
    try {
      explanations = await this.claude.explainRanking({
        intentNormalized: session.intentNormalized,
        locale: session.locale,
        rankedOffers: toExplain.map((r) => ({ offer: r.offer, sku: r.sku })),
      });
    } catch {
      explanations = []; // never-block: cards fall through to the data-only "why" path below.
    }
    const byOffer = new Map(explanations.map((e) => [e.offerId, e]));

    return ranked.map((r) => {
      const ex = byOffer.get(r.offer.id);
      let whyAr = '';
      let whyEn = '';
      let cited: { key: string; value: string };

      try {
        if (!ex) throw new TruthfulnessViolationError(r.offer.id, 'missing');
        // GUARD: the cited attribute must be real, supplied data — else fall back to data-only why.
        cited = verifyCitation(ex, r.offer, r.sku);
        whyAr = ex.whyAr;
        whyEn = ex.whyEn;
      } catch (err) {
        if (!(err instanceof TruthfulnessViolationError)) throw err;
        // data-only fallback: never block, never invent (S1-4 robustness NFR).
        cited = { key: 'price', value: String(r.offer.priceFils) };
        whyEn = `${formatFils(r.offer.priceFils)} at ${r.offer.providerName}`;
        whyAr = `${formatFils(r.offer.priceFils, { suffix: ' د.ك' })} لدى ${r.offer.providerName}`;
      }

      // Social "price on request" (ADR-006): priceFils=0 + priceOnRequest attr → the card shows a
      // localized "price on request — see post" instead of a fabricated KWD price (truthfulness).
      const priceOnRequest = r.sku.attributes.priceOnRequest === 'true' && r.offer.priceFils === 0;
      const priceLabel = priceOnRequest
        ? session.locale === 'ar'
          ? 'السعر بالخاص — شوف البوست'
          : 'Price on request — see post'
        : formatFils(r.offer.priceFils);

      return {
        skuId: r.sku.id,
        offerId: r.offer.id,
        productName: r.sku.canonicalName,
        providerId: r.offer.providerId,
        providerName: r.offer.providerName,
        priceFils: r.offer.priceFils,
        priceLabel,
        whyAr,
        whyEn,
        whyCitedAttribute: cited,
        deeplinkUrl: r.offer.deeplinkUrl,
        imageUrl: r.sku.imageUrl,
        source: r.offer.source,
        matchesPreferences: this.matchesPreferences(session, r),
        // F-SR1: relation tag + over-budget delta surfaced ONLY when fallback ran (additive; AC-2/7/13).
        relation: fallbackTriggered ? r.relation : undefined,
        overBudgetDeltaFils: fallbackTriggered ? r.overBudgetDeltaFils : undefined,
      };
    });
  }

  /**
   * Does this offer's SKU satisfy ALL the user's answered preferences (storage/color/budget)?
   * Used to tag "closest match" cards. Returns undefined when no preference was answered.
   * NOTE: this is a DISPLAY tag only — it never filters; ranking already floats matches to the top.
   */
  private matchesPreferences(session: SearchSession, r: ResolvedOffer): boolean | undefined {
    const { storage, color, budgetFils } = session.intentNormalized.constraints;
    if (storage == null && color == null && budgetFils == null) return undefined;
    if (storage && r.sku.attributes.storage?.toLowerCase() !== String(storage).toLowerCase()) return false;
    if (color && r.sku.attributes.color?.toLowerCase() !== String(color).toLowerCase()) return false;
    if (budgetFils != null && r.offer.priceFils > budgetFils) return false;
    return true;
  }

  /**
   * Pin the resolved intent's category to the user-chosen SECTOR for the social/Talabat lanes
   * (food, realestate). The sector is the source of truth (the user tapped that category tile); the
   * clarifier's free-form `category` (e.g. "apartment_rent") would otherwise miss the resolver
   * branch. Also guarantees `model` carries the raw query text the discovery step needs.
   */
  private pinIntentToSector(session: SearchSession): void {
    if (session.sector === 'realestate' || session.sector === 'food') {
      session.intentNormalized.category = session.sector;
      if (!session.intentNormalized.model || !session.intentNormalized.model.trim()) {
        session.intentNormalized.model = session.intentRaw.trim();
      }
      return;
    }
    // ELECTRONICS (ADR-007 Q1): catalog-free discovery searches the providers on the intent's query
    // text. Claude normally fills `model`, but for an off-catalog item it may leave it blank (the
    // "Dish washing Machine" class) — guarantee the raw query is carried so the real provider search
    // still runs. Only seed it when LIVE_FETCH is on (the catalog-free path); offline (LIVE_FETCH=off)
    // keeps the strict MOCK_SKUS model-identity matching used by the precision specs.
    if (
      process.env.LIVE_FETCH !== 'off' &&
      (!session.intentNormalized.model || !session.intentNormalized.model.trim())
    ) {
      session.intentNormalized.model = session.intentRaw.trim();
    }
  }

  private applyAnswer(session: SearchSession, dimension: string, answer: string): void {
    const c = session.intentNormalized.constraints;
    if (dimension === 'budget') {
      const kwd = parseInt(answer, 10);
      if (!Number.isNaN(kwd)) c.budgetFils = kwd * 1000;
      return;
    }
    // Always keep the raw answer in constraints (structured query — RULE-3) so the relevance filter +
    // ranker + matchesPreferences can read every answered dimension.
    c[dimension] = answer;

    // DISCOVERY SECTORS: the relevance filter (filterDishesByQuery / filterFlatsByQuery) drives off
    // `intent.model` (the discovery term). Fold a `dish`/`area` answer into the model text so a chip
    // answer measurably TIGHTENS the result set (RULE-3/5), not just sits in constraints. Skipping an
    // axis (answer null) never reaches here, so a skip leaves the term unchanged = widened (RULE-4).
    // Generated smart sets use query-specific keys (e.g. food `rice_dish`/`protein`, RE `area`); fold
    // any of these dish/area-like answers into the discovery term too so a smart-set answer tightens
    // the result set, exactly like the config `dish`/`area` dimensions do.
    const foodQueryDims = ['dish', 'rice_dish', 'protein', 'cuisine'];
    const realestateQueryDims = ['area', 'neighborhood', 'location'];
    const foldsIntoQuery =
      (session.sector === 'food' && foodQueryDims.includes(dimension)) ||
      (session.sector === 'realestate' && realestateQueryDims.includes(dimension));
    if (foldsIntoQuery && answer && answer !== '__skip__') {
      const base = (session.intentNormalized.model ?? session.intentRaw ?? '').trim();
      // append the chip term if it isn't already in the query (avoid "rice rice")
      if (!base.toLowerCase().includes(answer.toLowerCase())) {
        session.intentNormalized.model = `${base} ${answer}`.trim();
      }
    }
  }

  private assumptionsFrom(session: SearchSession): string[] {
    return Object.entries(session.answers)
      .filter(([, v]) => v == null)
      .map(([dim]) => `assumed default for ${dim}`);
  }
}
