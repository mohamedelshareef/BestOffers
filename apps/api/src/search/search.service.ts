import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AnswerRequest,
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

/** HARD bound on clarifier questions — enforced in CODE, not just the prompt (AC C2.1). */
export const MAX_CLARIFIER_QUESTIONS = 3;

@Injectable()
export class SearchService {
  constructor(
    @Inject(CLAUDE_CLIENT) private readonly claude: ClaudeClient,
    private readonly offers: OffersService,
    private readonly sessions: SessionStore,
    private readonly events: EventsService,
    private readonly quota: QuotaService,
  ) {}

  /** POST /search/intent — opens a session, runs the first clarifier step. */
  async startIntent(req: IntentRequest, pseudoId: string, userId?: string): Promise<SearchResponse> {
    const clar = await this.claude.clarify({
      intentRaw: req.intentRaw,
      sector: req.sector,
      locale: req.locale,
      askedDimensions: [],
    });

    const session = this.sessions.create({
      pseudoId,
      userId,
      sector: req.sector,
      locale: req.locale,
      intentRaw: req.intentRaw,
      intentNormalized: clar.intentNormalized,
    });

    // No PII: only normalized category + pseudoId are logged (S1-4 privacy wall).
    this.events.log({
      type: 'intent_submitted',
      pseudoId,
      searchSessionId: session.id,
      payload: { sector: req.sector, category: clar.intentNormalized.category ?? 'unknown' },
    });

    return this.advance(session, clar.needClarification ? clar.question : undefined);
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

    // ask Claude for the next step, but the CODE owns the bound + the never-re-ask guard.
    const clar = await this.claude.clarify({
      intentRaw: session.intentRaw,
      sector: session.sector,
      locale: session.locale,
      askedDimensions: session.askedDimensions,
    });
    session.intentNormalized = clar.intentNormalized
      ? { ...clar.intentNormalized, constraints: { ...clar.intentNormalized.constraints, ...session.intentNormalized.constraints } }
      : session.intentNormalized;

    const nextQuestion = clar.needClarification ? clar.question : undefined;
    return this.advance(session, nextQuestion);
  }

  /**
   * Decide: ask another question, or run the search.
   * The bound (≤3) and never-re-ask are GUARANTEED here regardless of what the model asks for.
   */
  private async advance(
    session: SearchSession,
    proposedQuestion?: { dimension: string; textAr: string; textEn: string; chips: any[] },
  ): Promise<SearchResponse> {
    // DISCOVERY SECTORS (food, realestate) go straight to results — code-enforced, NOT prompt-trusted.
    // Each dish/flat IS its own result (no canonical SKU to disambiguate by storage/color/budget), so
    // the electronics clarifier dimensions don't apply. Mock-claude already returns needClarification=
    // false for these; the REAL Claude does NOT reliably honor that and asked storage/color for "kfc"
    // (D-V2-1 root cause #2). Suppressing here makes the behavior deterministic across both providers.
    const isDiscoverySector = session.sector === 'food' || session.sector === 'realestate';
    const canAskMore = !isDiscoverySector && session.clarifierCount < MAX_CLARIFIER_QUESTIONS;
    const notAlreadyAsked =
      !!proposedQuestion && !session.askedDimensions.includes(proposedQuestion.dimension);

    if (proposedQuestion && canAskMore && notAlreadyAsked) {
      session.askedDimensions.push(proposedQuestion.dimension);
      session.clarifierCount += 1;
      session.status = 'clarifying';
      this.sessions.save(session);
      return {
        searchSessionId: session.id,
        state: 'clarifying',
        questions: [proposedQuestion],
        clarifierCount: session.clarifierCount,
      };
    }

    // proceed to search (bound reached, model satisfied, or it tried to re-ask a dimension)
    return this.runSearch(session);
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
    let explanations: Awaited<ReturnType<typeof this.claude.explainRanking>> = [];
    try {
      explanations = await this.claude.explainRanking({
        intentNormalized: session.intentNormalized,
        locale: session.locale,
        rankedOffers: ranked.map((r) => ({ offer: r.offer, sku: r.sku })),
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
    }
  }

  private applyAnswer(session: SearchSession, dimension: string, answer: string): void {
    const c = session.intentNormalized.constraints;
    if (dimension === 'budget') {
      const kwd = parseInt(answer, 10);
      if (!Number.isNaN(kwd)) c.budgetFils = kwd * 1000;
    } else {
      c[dimension] = answer;
    }
  }

  private assumptionsFrom(session: SearchSession): string[] {
    return Object.entries(session.answers)
      .filter(([, v]) => v == null)
      .map(([dim]) => `assumed default for ${dim}`);
  }
}
