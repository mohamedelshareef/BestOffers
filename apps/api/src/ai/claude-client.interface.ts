import { IntentNormalized, Locale, Offer, Sku } from '@bestoffers/shared';

/**
 * The mockable boundary around Claude (ADR-002: three bounded, code-orchestrated calls).
 * Tests bind MockClaudeClient → run fully offline, no API key.
 * Production binds AnthropicClaudeClient.
 *
 * IMPORTANT (truthfulness, AC D3.3): the ranking call returns ONLY an ordering of offer ids
 * plus explanation text. Prices, providers, ranks-as-facts come from DATA, never from here.
 */

export interface ClarifierInput {
  intentRaw: string;
  sector: string;
  locale: Locale;
  /** dimensions already asked — Claude is told never to re-ask (AC C2.6); code also guarantees it. */
  askedDimensions: string[];
}

export interface ClarifierQuestionDraft {
  dimension: string;
  textAr: string;
  textEn: string;
  chips: { value: string; labelAr: string; labelEn: string }[];
}

export interface ClarifierResult {
  intentNormalized: IntentNormalized;
  needClarification: boolean;
  /** at most ONE question per step; the orchestrator enforces the ≤3 total bound. */
  question?: ClarifierQuestionDraft;
}

/** One offer's explanation, grounded in a supplied attribute. */
export interface RankExplanation {
  offerId: string;
  /** the sku/offer attribute key this explanation is grounded in (truthfulness anchor). */
  citedAttributeKey: string;
  whyAr: string;
  whyEn: string;
}

export interface RankInput {
  intentNormalized: IntentNormalized;
  locale: Locale;
  /** offers already ranked deterministically by CODE; Claude only explains, never re-prices. */
  rankedOffers: { offer: Offer; sku: Sku }[];
}

export interface ClaudeClient {
  /** Step 1: intent + clarifier (Opus in prod). */
  clarify(input: ClarifierInput): Promise<ClarifierResult>;
  /** Step 2: explanations for an ALREADY-RANKED list (Opus in prod). */
  explainRanking(input: RankInput): Promise<RankExplanation[]>;
}

/** DI token for the Claude client binding. */
export const CLAUDE_CLIENT = Symbol('CLAUDE_CLIENT');
