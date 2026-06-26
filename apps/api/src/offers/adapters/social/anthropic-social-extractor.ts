import { Logger } from '@nestjs/common';
import { RawPost } from './social-provider';
import { SocialExtract, SocialExtractor } from './social-extractor';

/**
 * AnthropicSocialExtractor — REAL Claude reads each IG caption and emits a structured offer (ADR-006
 * §2a) via forced tool-use. Bound when a key is present (SOCIAL_EXTRACTOR=anthropic, default with key).
 *
 *  - SDK is dynamically imported (kept off the offline test path; tests bind the deterministic mock).
 *  - The model copies a price ONLY if it literally appears in the caption; otherwise priceFils/rentFils
 *    is null. A post-extraction guard in `SocialIngestAdapter` ALSO drops any price not present in the
 *    caption bytes (defense-in-depth — the truthfulness rule does not rely on the prompt alone).
 *  - permalink + posted_at are NOT sent to / produced by the model — they flow verbatim from the post.
 */
export class AnthropicSocialExtractor implements SocialExtractor {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicSocialExtractor.name);
  private readonly model = process.env.SOCIAL_EXTRACT_MODEL ?? process.env.CLAUDE_MODEL ?? 'claude-opus-4-8';
  private client: any;

  private get apiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY;
  }

  private async sdk() {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY missing — bind MockSocialExtractor for offline.');
    if (!this.client) {
      const mod: any = await import('@anthropic-ai/sdk');
      const Anthropic = mod.default ?? mod.Anthropic;
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async extract(post: RawPost): Promise<SocialExtract | null> {
    const client = await this.sdk();
    const tool =
      post.vertical === 'food' ? FOOD_TOOL : RE_TOOL;
    const system =
      'You extract a single structured commercial offer from one Instagram caption for a Kuwait ' +
      'price-comparison app. Captions mix Kuwaiti Arabic, MSA, and English. ' +
      'CRITICAL TRUTHFULNESS RULE: copy a PRICE/RENT only if a numeric price literally appears in the ' +
      'caption (e.g. "420 د.ك", "12.500 KWD", "75 د.ك"). If the caption says "السعر بالخاص", "DM for ' +
      'price", "price on request", or has no number, the price field MUST be null. NEVER invent or ' +
      'estimate a price. Prices are in Kuwaiti Dinar; return them as integer fils (1 KWD = 1000 fils, ' +
      'e.g. 420 KWD → 420000, 12.500 KWD → 12500). ' +
      // PRECISION (owner directive): extract ONLY fields LITERALLY present in this caption — never infer
      // an area, room count, restaurant, or attribute that is not actually written. Leave any field the
      // caption does not state as null. Be tightly scoped: do not guess. Set isOffer=false for memes /
      // reposts / announcements / non-commercial posts / posts with no concrete item, so they are dropped.
      'Extract ONLY what is literally written; set any unstated field to null; do NOT infer or pad. ' +
      'Set isOffer=false for memes/reposts/non-offers. ' +
      'Always call the tool.';

    const res = await client.messages.create({
      model: this.model,
      max_tokens: 512,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: JSON.stringify({ handle: post.ownerHandle, caption: post.caption }) }],
    });

    const out = toolInput(res, tool.name);
    if (!out) return null;

    if (post.vertical === 'food') {
      return {
        vertical: 'food',
        isOffer: !!out.isOffer,
        item: String(out.item ?? '').trim(),
        desc: out.desc ? String(out.desc) : undefined,
        priceFils: numOrNull(out.priceFils),
        restaurant: String(out.restaurant ?? post.ownerHandle).trim(),
      };
    }
    return {
      vertical: 'realestate',
      isOffer: !!out.isOffer,
      area: out.area ? String(out.area).trim() : null,
      rooms: numOrNull(out.rooms),
      rentFils: numOrNull(out.rentFils),
      furnished: ['furnished', 'semi', 'unfurnished'].includes(out.furnished) ? out.furnished : null,
    };
  }
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) && (n as number) > 0 ? Math.round(n as number) : null;
}

function toolInput(res: any, name: string): any | null {
  if (res?.stop_reason && res.stop_reason !== 'tool_use' && res.stop_reason !== 'end_turn') return null;
  const block = (res?.content ?? []).find((b: any) => b.type === 'tool_use' && b.name === name);
  return block?.input ?? null;
}

const FOOD_TOOL = {
  name: 'emit_food_offer',
  description: 'Return the structured food offer extracted from the caption. price null unless literally present.',
  input_schema: {
    type: 'object',
    properties: {
      isOffer: { type: 'boolean' },
      item: { type: 'string', description: 'the dish/offer/package name' },
      desc: { type: 'string' },
      priceFils: { type: ['integer', 'null'], description: 'integer fils, or null if no literal price in caption' },
      restaurant: { type: 'string', description: 'restaurant/brand or @handle' },
    },
    required: ['isOffer', 'item', 'priceFils', 'restaurant'],
  },
};

const RE_TOOL = {
  name: 'emit_realestate_offer',
  description: 'Return the structured flat listing extracted from the caption. rent null unless literally present.',
  input_schema: {
    type: 'object',
    properties: {
      isOffer: { type: 'boolean' },
      area: { type: ['string', 'null'], description: 'area/governorate e.g. Salwa, Salmiya, Mahboula' },
      rooms: { type: ['integer', 'null'], description: 'number of bedrooms; null if unstated' },
      rentFils: { type: ['integer', 'null'], description: 'monthly rent integer fils, or null if "DM/price on request"' },
      furnished: { type: ['string', 'null'], enum: ['furnished', 'semi', 'unfurnished', null] },
    },
    required: ['isOffer', 'area', 'rooms', 'rentFils', 'furnished'],
  },
};
