import { SearchService } from './search.service';
import { MIN_CLARIFIER_QUESTIONS } from './clarifier-sets';
import { SessionStore } from './session.store';
import { EventsService } from '../events/events.service';
import { CLAUDE_CLIENT, ClaudeClient } from '../ai/claude-client.interface';
import { MockClaudeClient } from '../ai/mock-claude-client';
import { OffersService, ResolvedOffer } from '../offers/offers.service';
import { QuotaService } from '../quota/quota.service';
import { Offer, Sector, SearchResponse, Sku } from '@bestoffers/shared';

/**
 * SMART per-query clarifier generation (OWNER DIRECTIVE 2026-06-27).
 *
 * The ≥5 follow-up questions must be SMART and SPECIFIC to what the user actually requested — NOT a
 * fixed generic per-sector list. These tests drive the SearchService with the canned-but-tailored
 * MockClaudeClient.clarifierSet (the deterministic stand-in for Claude's structured generation) and
 * assert the presented dimensions are query-appropriate AND different per item:
 *   - "laptop" asks use_case/ram/screen_size — NOT phone storage/color.
 *   - "iPhone 16" asks storage/color/condition/applecare — phone-specific.
 *   - "chilled with rice" asks rice_dish/protein/spice — dish-specific.
 *   - an UNRECOGNIZED item → mock returns [] → the gate falls back to the deterministic config set.
 */

const quota = { tryConsume: jest.fn(async () => ({ allowed: true, used: 1 })) } as unknown as QuotaService;

function oneOffer(sector: Sector): ResolvedOffer {
  const sku: Sku = {
    id: `sku_${sector}_1`,
    category: sector === 'electronics' ? 'smartphone' : sector,
    canonicalName: 'Item',
    brand: 'Brand',
    model: 'Item',
    attributes: { sector, area: 'salwa' },
  };
  const offer: Offer = {
    id: `off_${sector}_1`,
    skuId: sku.id,
    providerId: `prov_${sector}`,
    providerName: 'Provider',
    priceFils: 5000,
    inStock: true,
    deeplinkUrl: 'https://example.com/x',
    source: 'live',
    fetchedAt: '2026-06-26T12:00:00.000Z',
  };
  return { offer, sku };
}

function makeService(claude: ClaudeClient = new MockClaudeClient(), sector: Sector = 'electronics'): SearchService {
  void CLAUDE_CLIENT;
  const offers = {
    resolveOffers: async () => [oneOffer(sector)],
    resolveBroadened: async () => [oneOffer(sector)],
  } as unknown as OffersService;
  return new SearchService(claude, offers, new SessionStore(), new EventsService(), quota);
}

/**
 * Drive the clarifier loop (skipping every question) and collect the ASKED dimensions in order, plus
 * the final presented total (asked + pre-resolved). A specific item like "iPhone 16"/"chilled with
 * rice" pre-resolves 1 dimension from the free text (RULE-7), so it ASKS floor-1 and PRESENTS ≥floor.
 */
async function collectDimensions(
  svc: SearchService,
  sector: Sector,
  intentRaw: string,
): Promise<{ asked: string[]; presented: number }> {
  let res: SearchResponse = await svc.startIntent({ sector, locale: 'en', intentRaw }, 'p');
  const asked: string[] = [];
  let presented = 0;
  let steps = 0;
  while (res.state === 'clarifying') {
    if (steps++ > 12) throw new Error('clarifier loop did not terminate');
    const q = res.questions![0];
    asked.push(q.dimension);
    presented = res.clarifierCount; // PRESENTED = asked-so-far + pre-resolved (RULE-7)
    res = await svc.submitAnswer(
      { searchSessionId: res.searchSessionId, dimension: q.dimension, answer: '__skip__' },
      'p',
    );
  }
  return { asked, presented };
}

describe('SMART clarifier set — tailored to the exact requested item', () => {
  it('"laptop" asks laptop dimensions (use_case/ram/screen_size) and NEVER phone storage/color', async () => {
    const { asked, presented } = await collectDimensions(makeService(), 'electronics', 'laptop');
    expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS); // ≥5 PRESENTED before search
    expect(asked).toEqual(expect.arrayContaining(['use_case', 'ram', 'screen_size']));
    // the KEY assertion: a laptop query must NOT inherit the generic phone clarifiers
    expect(asked).not.toContain('storage');
    expect(asked).not.toContain('color');
  });

  it('"iPhone 16" asks phone-specific dimensions (storage/color/condition/applecare)', async () => {
    // "iPhone 16" pre-resolves `model` from the free text (RULE-7) → floor reached after 4 ASKED phone
    // dimensions (storage/color/budget/condition); applecare is the 5th smart dim, only reached if more
    // were needed. The set is phone-specific, never laptop-shaped.
    const { asked, presented } = await collectDimensions(makeService(), 'electronics', 'iPhone 16');
    expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
    expect(asked).toEqual(expect.arrayContaining(['storage', 'color', 'condition']));
    // phone-specific, not laptop-specific
    expect(asked).not.toContain('ram');
    expect(asked).not.toContain('screen_size');
  });

  it('"chilled with rice" asks rice-dish-specific dimensions (rice_dish/protein/spice)', async () => {
    const { asked, presented } = await collectDimensions(
      makeService(new MockClaudeClient(), 'food'),
      'food',
      'chilled with rice',
    );
    expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
    expect(asked).toEqual(expect.arrayContaining(['rice_dish', 'protein', 'spice']));
  });

  it('different items produce DIFFERENT question sets (not a fixed generic list)', async () => {
    const laptop = (await collectDimensions(makeService(), 'electronics', 'laptop')).asked;
    const iphone = (await collectDimensions(makeService(), 'electronics', 'iPhone 16')).asked;
    // same sector, different item → the smart sets must diverge
    expect(laptop).not.toEqual(iphone);
    const onlyInLaptop = laptop.filter((d) => !iphone.includes(d));
    expect(onlyInLaptop.length).toBeGreaterThan(0); // e.g. ram/screen_size/use_case
  });

  it('UNRECOGNIZED item → mock returns no smart set → gate FALLS BACK to the deterministic config set', async () => {
    // "zzznotareal" hits none of the canned smart sets → clarifierSet returns [] → config fallback.
    const { asked, presented } = await collectDimensions(makeService(), 'electronics', 'zzznotareal');
    expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
    // the config ELECTRONICS set leads with model/storage/color/budget/condition
    expect(asked).toEqual(expect.arrayContaining(['storage', 'color', 'budget', 'condition']));
  });

  it('Claude clarifierSet THROWS → gate falls back to the deterministic config set (never breaks)', async () => {
    const throwingClaude: ClaudeClient = {
      clarify: async () => ({ intentNormalized: { constraints: {} }, needClarification: false }),
      clarifierSet: async () => {
        throw new Error('Claude stop_reason=max_tokens — no usable tool output');
      },
      explainRanking: async () => [],
    };
    const { asked, presented } = await collectDimensions(
      makeService(throwingClaude),
      'electronics',
      'laptop',
    );
    expect(presented).toBeGreaterThanOrEqual(MIN_CLARIFIER_QUESTIONS);
    // a throw → config ELECTRONICS set, NOT the smart laptop set
    expect(asked).toEqual(expect.arrayContaining(['storage', 'color', 'condition']));
    expect(asked).not.toContain('use_case');
  });

  it('a smart-set query still reaches a real result set after the ≥5 floor (never a dead end)', async () => {
    const svc = makeService();
    let res: SearchResponse = await svc.startIntent(
      { sector: 'electronics', locale: 'en', intentRaw: 'laptop' },
      'p',
    );
    while (res.state === 'clarifying') {
      res = await svc.submitAnswer(
        { searchSessionId: res.searchSessionId, dimension: res.questions![0].dimension, answer: '__skip__' },
        'p',
      );
    }
    expect(res.state).toBe('results');
    expect(res.cards && res.cards.length).toBeGreaterThanOrEqual(1);
  });
});
