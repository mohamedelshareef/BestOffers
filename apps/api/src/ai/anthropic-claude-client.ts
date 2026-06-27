import { Injectable, Logger } from '@nestjs/common';
import { IntentNormalized } from '@bestoffers/shared';
import {
  ClarifierInput,
  ClarifierQuestionDraft,
  ClarifierResult,
  ClarifierSetInput,
  ClaudeClient,
  RankExplanation,
  RankInput,
} from './claude-client.interface';

/**
 * Production Claude binding (ADR-002). Bound when CLAUDE_PROVIDER=anthropic.
 *
 *  - Uses the Anthropic TS SDK, imported DYNAMICALLY so the dependency is optional at test time
 *    (the offline suite binds MockClaudeClient and never loads the SDK / needs a key).
 *  - Opus 4.8 (claude-opus-4-8) for clarify + rank-explain; tool-use forces a STRUCTURED, parseable
 *    JSON shape (no brittle prose parsing).
 *  - Checks stop_reason / tool_use presence; on refusal/unavailable, raises so the orchestrator can
 *    fall back to the data-only path (S1-4 NFR — truthfulness > availability).
 *  - This client must NEVER return prices/providers — only an intent shape, ONE clarifier question,
 *    and explanation TEXT grounded in a supplied attribute key (truthfulness, AC D3.3).
 *
 * DI NOTE: the API key is read from process.env at call time, NOT injected as a constructor param.
 * A bare `constructor(private apiKey = process.env...)` makes Nest try to resolve a provider for the
 * (typeless) param → "can't resolve dependencies ... argument Object at index [0]" boot crash. The
 * provider takes zero constructor args so DI binds it cleanly via the CLAUDE_CLIENT token.
 */
@Injectable()
export class AnthropicClaudeClient implements ClaudeClient {
  private readonly logger = new Logger(AnthropicClaudeClient.name);
  private readonly model = process.env.CLAUDE_MODEL ?? 'claude-opus-4-8';
  // SPEED (OWNER DIRECTIVE 2026-06-26, RULE-10): the ≥5 clarifier QUESTIONS are now config-driven
  // (clarifier-sets.ts) — Claude no longer GENERATES them. The only remaining clarifier-phase model
  // call is the single intent-normalization `clarify`, which runs on the FAST model (Haiku) by default
  // to keep the clarifier phase quick. Override with CLAUDE_CLARIFY_MODEL.
  private readonly clarifyModel = process.env.CLAUDE_CLARIFY_MODEL ?? 'claude-haiku-4-5';
  // SPEED: rank-explanations are short, low-stakes "why" lines (not pricing/ranking — those are CODE).
  // Use the FAST model (Haiku) for them by default; Opus is overkill and the slow path on food queries
  // with dozens of dishes. Override with CLAUDE_EXPLAIN_MODEL.
  private readonly explainModel =
    process.env.CLAUDE_EXPLAIN_MODEL ?? 'claude-haiku-4-5';
  private client: any;

  private get apiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY;
  }

  private async sdk() {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY missing — bind MockClaudeClient for offline/dev.');
    }
    if (!this.client) {
      // dynamic import keeps @anthropic-ai/sdk out of the offline test path
      const mod: any = await import('@anthropic-ai/sdk');
      const Anthropic = mod.default ?? mod.Anthropic;
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /** Lightweight health probe — does NOT spend tokens; just confirms the SDK + key wire up. */
  async health(): Promise<boolean> {
    try {
      await this.sdk();
      return true;
    } catch (err) {
      this.logger.error(`health() failed: ${(err as Error).message}`);
      return false;
    }
  }

  // ─────────────────────────────── Step 1: clarify ───────────────────────────────

  async clarify(input: ClarifierInput): Promise<ClarifierResult> {
    const client = await this.sdk();

    const system = [
      'You are the intent + clarifier engine for "BestOffers", a Kuwaiti price-comparison app.',
      'Users write in Kuwaiti Arabic dialect, MSA, or English. Normalize to a structured intent.',
      'You ask AT MOST ONE clarifying question per turn, and ONLY for a dimension not already known',
      'and not already in askedDimensions. Probe missing dimensions in this order: storage, color, budget.',
      // PRECISION (owner directive): keep the question tightly scoped to the SAME requested item.
      'Every question MUST narrow down the EXACT item the user asked for — never drift to a different',
      'product, a different model/generation, accessories, or unrelated attributes. Do NOT ask about',
      'a dimension that does not apply to this product (e.g. never ask storage for a fridge, color for',
      'a service). If the requested item is already specific enough to search, set needClarification=false',
      'rather than padding with a low-value question. Preserve the user\'s exact model — do NOT broaden',
      '"iPhone 16" to "iPhone 16 Pro" or substitute a different brand.',
      'If category/brand/model + enough constraints are known, set needClarification=false.',
      'You NEVER invent prices, providers, or stock. You only normalize intent and ask one question.',
      'Always call the `emit_clarifier` tool with the structured result. Provide Arabic (textAr) and',
      'English (textEn) for any question, with 3 concise chips each (value + labelAr + labelEn).',
    ].join(' ');

    const tool = {
      name: 'emit_clarifier',
      description: 'Return the normalized intent and, if needed, ONE clarifier question.',
      input_schema: {
        type: 'object',
        properties: {
          intentNormalized: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              brand: { type: 'string' },
              model: { type: 'string' },
              constraints: {
                type: 'object',
                properties: {
                  budgetFils: { type: 'number' },
                  storage: { type: 'string' },
                  color: { type: 'string' },
                },
              },
            },
            required: ['constraints'],
          },
          needClarification: { type: 'boolean' },
          question: {
            type: 'object',
            properties: {
              dimension: { type: 'string', enum: ['storage', 'color', 'budget'] },
              textAr: { type: 'string' },
              textEn: { type: 'string' },
              chips: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    labelAr: { type: 'string' },
                    labelEn: { type: 'string' },
                  },
                  required: ['value', 'labelAr', 'labelEn'],
                },
              },
            },
            required: ['dimension', 'textAr', 'textEn', 'chips'],
          },
        },
        required: ['intentNormalized', 'needClarification'],
      },
    };

    const userMsg = JSON.stringify({
      intentRaw: input.intentRaw,
      sector: input.sector,
      locale: input.locale,
      askedDimensions: input.askedDimensions,
    });

    const res = await client.messages.create({
      model: this.clarifyModel, // RULE-10: fast model for the clarifier phase
      max_tokens: 1024,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'emit_clarifier' },
      messages: [{ role: 'user', content: userMsg }],
    });

    const out = this.toolInput(res, 'emit_clarifier');
    const intentNormalized: IntentNormalized = {
      category: out.intentNormalized?.category,
      brand: out.intentNormalized?.brand,
      model: out.intentNormalized?.model,
      constraints: out.intentNormalized?.constraints ?? {},
    };

    const needClarification = !!out.needClarification && !!out.question;
    this.logger.log(
      `clarify: model=${this.clarifyModel} need=${needClarification} ` +
        `cat=${intentNormalized.category ?? '-'} model_field=${intentNormalized.model ?? '-'} ` +
        `q=${out.question?.dimension ?? '-'}`,
    );

    if (!needClarification) {
      return { intentNormalized, needClarification: false };
    }
    return {
      intentNormalized,
      needClarification: true,
      question: {
        dimension: out.question.dimension,
        textAr: out.question.textAr,
        textEn: out.question.textEn,
        chips: out.question.chips ?? [],
      },
    };
  }

  // ───────────────────── Step 1b: SMART per-query clarifier set ─────────────────────

  /**
   * OWNER DIRECTIVE 2026-06-27: Claude proposes ≥`minQuestions` narrowing dimensions TAILORED to the
   * exact request — never a fixed generic per-sector list. Strictly about the SAME requested item
   * (no drift / no upsell). Runs on the FAST model; bounded `max_tokens`. The caller (SearchService)
   * falls back to the deterministic config set if this throws / times out / returns < minQuestions.
   */
  async clarifierSet(input: ClarifierSetInput): Promise<ClarifierQuestionDraft[]> {
    const client = await this.sdk();

    const system = [
      'You are the clarifier-question generator for "BestOffers", a Kuwaiti price-comparison app.',
      `The user asked for a specific item. Propose AT LEAST ${input.minQuestions} SMART follow-up`,
      'questions that narrow down EXACTLY what THIS user requested — tailored to the actual item,',
      'NOT a generic per-category checklist.',
      'EXAMPLES of tailoring: "laptop" → use-case (gaming/work/study), RAM, screen size, budget, brand',
      '(NOT phone storage/color). "iPhone 16" → storage, color, budget, condition, AppleCare. "chilled',
      'with rice" → which rice dish (biryani/machboos/bowl), protein, spice level, portion/people,',
      'budget. "flat in Salwa for rent" → rent/buy, bedrooms, budget, furnished, floor/amenities.',
      // NO-DRIFT (RULE-2): every question stays on the SAME requested item.
      'HARD RULES: (1) Every question MUST narrow the SAME item the user asked for — never introduce a',
      'different product, a different brand/model, an upsell, or an unrelated category. (2) Do NOT ask',
      'about a dimension that does not apply to this item. (3) Do NOT re-ask a dimension the user',
      `already stated (alreadyResolved: ${JSON.stringify(input.alreadyResolved)}). (4) Order broad→narrow.`,
      '(5) Each question = ONE dimension, with a short stable lowercase `dimension` key (e.g. "ram",',
      '"use_case", "screen_size", "rice_dish", "protein", "bedrooms"). (6) Every question needs 3–5',
      'concise chips (value + Arabic labelAr + English labelEn) PLUS always include one "Any / لا يهم"',
      'chip. Use Western 0-9 numerals in every label. Arabic (textAr) first, English (textEn) mirror.',
      'Always call `emit_clarifier_set`.',
    ].join(' ');

    const tool = {
      name: 'emit_clarifier_set',
      description: 'Return the tailored ordered list of narrowing questions for this exact request.',
      input_schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dimension: { type: 'string', description: 'short stable lowercase key for this dimension' },
                textAr: { type: 'string' },
                textEn: { type: 'string' },
                chips: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                      labelAr: { type: 'string' },
                      labelEn: { type: 'string' },
                    },
                    required: ['value', 'labelAr', 'labelEn'],
                  },
                },
              },
              required: ['dimension', 'textAr', 'textEn', 'chips'],
            },
          },
        },
        required: ['questions'],
      },
    };

    const userMsg = JSON.stringify({
      intentRaw: input.intentRaw,
      sector: input.sector,
      locale: input.locale,
      minQuestions: input.minQuestions,
      alreadyResolved: input.alreadyResolved,
    });

    const res = await client.messages.create({
      model: this.clarifyModel, // RULE-10: fast model (Haiku) for the clarifier phase
      max_tokens: 2560, // headroom for ≥5 bilingual questions × 4–5 chips (a tight cap truncates → max_tokens)
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'emit_clarifier_set' },
      messages: [{ role: 'user', content: userMsg }],
    });

    const out = this.toolInput(res, 'emit_clarifier_set');
    const raw: any[] = Array.isArray(out.questions) ? out.questions : [];

    // Sanitize + dedupe by dimension key; drop malformed/empty entries. The caller treats a
    // short/empty list as a generation failure and falls back to the deterministic config set.
    const seen = new Set<string>();
    const resolvedSet = new Set(input.alreadyResolved.map((d) => d.toLowerCase()));
    const questions: ClarifierQuestionDraft[] = [];
    for (const q of raw) {
      const dim = String(q?.dimension ?? '').trim().toLowerCase();
      const textAr = String(q?.textAr ?? '').trim();
      const textEn = String(q?.textEn ?? '').trim();
      const chips = Array.isArray(q?.chips)
        ? q.chips
            .filter((c: any) => c && c.value != null && c.labelAr && c.labelEn)
            .map((c: any) => ({ value: String(c.value), labelAr: String(c.labelAr), labelEn: String(c.labelEn) }))
        : [];
      if (!dim || !textAr || !textEn || chips.length < 2) continue;
      if (seen.has(dim) || resolvedSet.has(dim)) continue;
      seen.add(dim);
      questions.push({ dimension: dim, textAr, textEn, chips });
    }

    this.logger.log(
      `clarifierSet: model=${this.clarifyModel} item="${input.intentRaw}" generated=${questions.length} ` +
        `dims=[${questions.map((q) => q.dimension).join(',')}]`,
    );
    return questions;
  }

  // ─────────────────────────── Step 2: explain ranking ───────────────────────────

  async explainRanking(input: RankInput): Promise<RankExplanation[]> {
    const client = await this.sdk();

    // Give the model ONLY the fields it may cite (no raw prices to author with — it cites the KEY,
    // and the orchestrator re-reads the real value from data via verifyCitation).
    const citableKeys = [
      'price',
      'provider',
      'inStock',
      'storage',
      'color',
      'screen',
      'brand',
      'model',
      'category',
    ];
    const offers = input.rankedOffers.map(({ offer, sku }, rank) => ({
      offerId: offer.id,
      rank, // 0 = best (cheapest-first, decided by CODE)
      provider: offer.providerName,
      brand: sku.brand,
      model: sku.model,
      category: sku.category,
      attributes: sku.attributes, // storage/color/screen…
    }));

    const system = [
      'You write short, truthful purchase explanations for ranked offers in a Kuwaiti app.',
      'The ranking is ALREADY DECIDED by code (rank 0 = best). You do NOT re-rank or invent prices.',
      'For each offer write a one-line "why" in Arabic (whyAr) and English (whyEn), and set',
      '`citedAttributeKey` to the ONE supplied attribute your explanation is grounded in.',
      `citedAttributeKey MUST be one of: ${citableKeys.join(', ')}, and that attribute MUST be present`,
      'for that offer. Rank 0 is the best/cheapest pick — say so. Keep each line under 12 words.',
      // PRECISION (owner directive): the "why" must reference the ACTUAL attribute the user asked about
      // (the supplied intentNormalized: the model/storage/color/budget they requested). Cite the
      // attribute that makes THIS offer relevant to THAT request. Do NOT pad with unrelated praise,
      // generic marketing ("great phone!"), or attributes the user did not ask about. No emojis.
      'If the only honest thing to say is the rank/price, say just that — fewer, true words beat padding.',
    ].join(' ');

    const tool = {
      name: 'emit_explanations',
      description: 'Return one grounded explanation per offer, in the same order.',
      input_schema: {
        type: 'object',
        properties: {
          explanations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                offerId: { type: 'string' },
                citedAttributeKey: { type: 'string', enum: citableKeys },
                whyAr: { type: 'string' },
                whyEn: { type: 'string' },
              },
              required: ['offerId', 'citedAttributeKey', 'whyAr', 'whyEn'],
            },
          },
        },
        required: ['explanations'],
      },
    };

    const userMsg = JSON.stringify({
      intentNormalized: input.intentNormalized,
      locale: input.locale,
      offers,
    });

    const res = await client.messages.create({
      model: this.explainModel,
      max_tokens: 2048,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'emit_explanations' },
      messages: [{ role: 'user', content: userMsg }],
    });

    const out = this.toolInput(res, 'emit_explanations');
    const list: RankExplanation[] = Array.isArray(out.explanations) ? out.explanations : [];
    this.logger.log(`explainRanking: model=${this.explainModel} explained=${list.length}/${offers.length}`);
    return list.map((e) => ({
      offerId: e.offerId,
      citedAttributeKey: e.citedAttributeKey,
      whyAr: e.whyAr,
      whyEn: e.whyEn,
    }));
  }

  // ─────────────────────────────────── helpers ───────────────────────────────────

  /** Pull a tool_use block's input by name; raise on refusal/missing so callers can fall back. */
  private toolInput(res: any, toolName: string): any {
    if (res?.stop_reason && res.stop_reason !== 'tool_use' && res.stop_reason !== 'end_turn') {
      throw new Error(`Claude stop_reason=${res.stop_reason} — no usable tool output`);
    }
    const block = (res?.content ?? []).find(
      (b: any) => b.type === 'tool_use' && b.name === toolName,
    );
    if (!block) {
      throw new Error(`Claude returned no '${toolName}' tool_use block`);
    }
    return block.input ?? {};
  }
}
