import { RawPost, SocialProvider, SocialQuery, SocialVertical } from './social-provider';

/**
 * MockSocialProvider (ADR-006 Phase-1, mock-first) — returns ~14 realistic seeded "Instagram posts"
 * so the owner can SEE the social-offers loop end-to-end with NO Apify key, NO live IG, $0 spend.
 *
 * The seeds mimic real Kuwait IG patterns the research flagged (food-instagram-accounts.md /
 * real-estate-providers-feasibility.md):
 *   - RE flats: area (Salwa/Salmiya/Mahboula/Hawally/Jabriya/Mangaf), rooms, monthly rent in KWD,
 *     furnished status — SOME with a literal rent, SOME "للسعر الخاص / DM for price".
 *   - Food: meal-prep package prices, restaurant offers (literal KWD), desserts "DM for price".
 * Each post carries a realistic permalink (instagram.com/p/<code>/), a handle, an image URL
 * (placeholder), an AR/EN caption, and a posted_at within the last 30 days (anchored to 2026-06-26).
 *
 * Prices live in the CAPTION here (mock); Claude extracts them with the truthfulness guard (price=null
 * unless literally present). The seeds intentionally include "DM for price" posts to prove the guard.
 */

// Anchor "now" for deterministic, reproducible posted_at within the last 30 days.
const NOW = new Date('2026-06-26T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

const SEED_POSTS: RawPost[] = [
  // ── Real estate — flats for rent (mix of literal rent + DM-for-price) ──────────────────────────
  {
    id: 'C8aRe01',
    ownerHandle: 'q8.realtor',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe01x9Qk/',
    imageUrl: 'https://placehold.co/600x600/0B6B5B/FFFFFF?text=Salwa+Flat',
    timestamp: daysAgo(2),
    caption:
      'شقة للإيجار في السالوة 🔑 غرفتين وصالة، مفروشة بالكامل، قريبة من الجمعية.\n' +
      'الإيجار: 420 د.ك شهرياً. للتواصل دايركت.\n' +
      '2BR furnished flat for rent in Salwa — 420 KWD/month. DM to view.',
  },
  {
    id: 'C8aRe02',
    ownerHandle: 'salwa.homes.kw',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe02m4Lp/',
    imageUrl: 'https://placehold.co/600x600/0E8C74/FFFFFF?text=Salwa+2BR',
    timestamp: daysAgo(5),
    caption:
      'للإيجار شقة بالسالوة قطعة 3، غرفتين نوم + غرفة خادمة، غير مفروشة، طابق ثاني.\n' +
      'السعر بالخاص 📩 #السالوة #شقق_للايجار\n' +
      'Spacious 2 bedroom apartment in Salwa, unfurnished, maid room. Price on request — DM.',
  },
  {
    id: 'C8aRe03',
    ownerHandle: 'salmiya.rentals',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe03h7Tz/',
    imageUrl: 'https://placehold.co/600x600/075345/FFFFFF?text=Salmiya+1BR',
    timestamp: daysAgo(1),
    caption:
      'For rent in Salmiya, Block 10 — cozy 1 bedroom, semi-furnished, sea-view building.\n' +
      'Rent 300 KWD/month, includes maintenance.\n' +
      'شقة غرفة وصالة بالسالمية، 300 د.ك، قريبة من شارع سالم المبارك.',
  },
  {
    id: 'C8aRe04',
    ownerHandle: 'mahboula.flats',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe04w2Bn/',
    imageUrl: 'https://placehold.co/600x600/0B6B5B/FFFFFF?text=Mahboula+3BR',
    timestamp: daysAgo(8),
    caption:
      'شقة كبيرة في المهبولة 🏢 ثلاث غرف نوم، مفروشة، إطلالة بحر، مع موقف سيارة.\n' +
      'الإيجار 550 دينار شهري.\n' +
      '3BR furnished apartment in Mahboula, sea view + parking — 550 KWD per month.',
  },
  {
    id: 'C8aRe05',
    ownerHandle: 'hawally.estate',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe05f8Vm/',
    imageUrl: 'https://placehold.co/600x600/0E8C74/FFFFFF?text=Hawally+Studio',
    timestamp: daysAgo(12),
    caption:
      'استوديو للإيجار في حولي قريب من جمعية حولي، مفروش بالكامل، مناسب لعزابي.\n' +
      '250 د.ك شامل الكهرباء والماء.\n' +
      'Furnished studio in Hawally, bills included — 250 KWD/month. DM for viewing.',
  },
  {
    id: 'C8aRe06',
    ownerHandle: 'jabriya.homes',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe06k3Qd/',
    imageUrl: 'https://placehold.co/600x600/075345/FFFFFF?text=Jabriya+2BR',
    timestamp: daysAgo(18),
    caption:
      'للإيجار في الجابرية، شقة غرفتين وصالة، نص مفروشة، عمارة جديدة.\n' +
      'للسعر والمعاينة الرجاء التواصل على الخاص 📩\n' +
      '2 bedroom semi-furnished flat in Jabriya, new building. Price on request.',
  },
  {
    id: 'C8aRe07',
    ownerHandle: 'salwa.homes.kw',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe07p1Rw/',
    imageUrl: 'https://placehold.co/600x600/0B6B5B/FFFFFF?text=Salwa+3BR',
    timestamp: daysAgo(22),
    caption:
      'شقة فخمة في السالوة، ثلاث غرف نوم، مفروشة بالكامل، طابق أرضي مع حديقة.\n' +
      'الإيجار 600 د.ك شهرياً 🌿\n' +
      'Luxury 3BR furnished ground-floor flat in Salwa with garden — 600 KWD/month.',
  },
  {
    id: 'C8aRe08',
    ownerHandle: 'mangaf.rent.kw',
    vertical: 'realestate',
    permalink: 'https://www.instagram.com/p/C8aRe08d6Yx/',
    imageUrl: 'https://placehold.co/600x600/0E8C74/FFFFFF?text=Mangaf+1BR',
    timestamp: daysAgo(27),
    caption:
      'غرفة وصالة في المنقف، غير مفروشة، عمارة هادئة، قريبة من الكورنيش.\n' +
      'الإيجار 230 دينار.\n' +
      '1 bedroom unfurnished in Mangaf near the corniche — 230 KWD/month.',
  },

  // ── Food — IG restaurant / meal-prep / dessert offers (mix of literal price + DM) ──────────────
  {
    id: 'C8aFo01',
    ownerHandle: 'basickuwait',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo01n5Hk/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Meal+Prep',
    timestamp: daysAgo(3),
    caption:
      'باقة الدايت الأسبوعية 🥗 خمس وجبات يومياً، توصيل لباب البيت.\n' +
      'السعر 75 د.ك للأسبوع (عرض الصيف).\n' +
      'Weekly meal-prep package, 5 meals/day, home delivery — 75 KWD/week. Summer offer!',
  },
  {
    id: 'C8aFo02',
    ownerHandle: 'themealboxkw',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo02b8Jq/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Grill+Box',
    timestamp: daysAgo(4),
    caption:
      'بوكس المشاوي للعائلة 🍢 يكفي ٤ أشخاص، مشاوي مشكلة + رز + سلطات.\n' +
      'عرض نهاية الأسبوع: 12.500 د.ك بدل 15 د.ك.\n' +
      'Family grill box (serves 4) weekend offer — 12.500 KWD (was 15 KWD).',
  },
  {
    id: 'C8aFo03',
    ownerHandle: 'js_bakery',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo03c2Mw/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Custom+Cake',
    timestamp: daysAgo(6),
    caption:
      'كيكات مناسبات حسب الطلب 🎂 تصاميم خاصة، طلب قبل ٣ أيام.\n' +
      'للأسعار والطلبات الرجاء التواصل على الواتساب / الدايركت 📩\n' +
      'Custom occasion cakes, made to order. Price via DM/WhatsApp.',
  },
  {
    id: 'C8aFo04',
    ownerHandle: 'offer_food_kw',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo04r9Pl/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Breakfast+Deal',
    timestamp: daysAgo(9),
    caption:
      'عرض الفطور الكويتي 🍳 بلاليط + خبز ايراني + جبن + شاي حليب.\n' +
      'بـ 3.250 د.ك فقط، توصيل لجميع المناطق.\n' +
      'Kuwaiti breakfast platter offer — only 3.250 KWD, delivery everywhere.',
  },
  {
    id: 'C8aFo05',
    ownerHandle: 'mug.cr',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo05t4Dn/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Coffee+Bundle',
    timestamp: daysAgo(14),
    caption:
      'بَندل القهوة المختصة ☕ حبتين من أفضل المحاصيل + هدية كوب.\n' +
      'بـ 9.750 د.ك، الكمية محدودة.\n' +
      'Specialty coffee bundle — 2 bags + free mug, 9.750 KWD. Limited stock.',
  },
  {
    id: 'C8aFo06',
    ownerHandle: 'zahracakes_kwt',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo06y7Gv/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Cupcakes',
    timestamp: daysAgo(20),
    caption:
      'كب كيك بنكهات متنوعة 🧁 مثالية للعزايم والتوزيعات.\n' +
      'الأسعار حسب الكمية، تواصلوا معنا بالخاص.\n' +
      'Assorted cupcakes for events. Pricing by quantity — DM us.',
  },
  {
    id: 'C8aFo07',
    ownerHandle: 'kuwait_eateries',
    vertical: 'food',
    permalink: 'https://www.instagram.com/p/C8aFo07a3Sx/',
    imageUrl: 'https://placehold.co/600x600/C8881C/FFFFFF?text=Burger+Combo',
    timestamp: daysAgo(25),
    caption:
      'عرض برجر اللحم الأنغوس 🍔 برجر دبل + بطاطس + مشروب.\n' +
      'بـ 2.950 د.ك، صالح طوال الأسبوع.\n' +
      'Angus double-burger combo + fries + drink — 2.950 KWD, all week.',
  },
];

export class MockSocialProvider implements SocialProvider {
  readonly name = 'mock';

  constructor(private readonly seed: RawPost[] = SEED_POSTS) {}

  async fetchPosts(query: SocialQuery): Promise<RawPost[]> {
    const limit = query.limit ?? 16;
    const pool = this.seed.filter((p) => p.vertical === query.vertical);

    // Light pre-rank toward query terms so "flat in Salwa" surfaces Salwa posts first; ALL posts in
    // the vertical still flow to extraction so the AI can do the real intent match downstream.
    const terms = query.text.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const scored = pool
      .map((p) => ({ p, score: termScore(p.caption.toLowerCase(), terms) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);

    return scored.slice(0, limit);
  }
}

/** Count how many query terms appear in the caption (incl. AR area-name aliases). */
function termScore(caption: string, terms: string[]): number {
  let s = 0;
  for (const t of terms) {
    if (caption.includes(t)) s += 1;
    const alias = AREA_ALIASES[t];
    if (alias && caption.includes(alias)) s += 1;
  }
  return s;
}

/** Minimal EN→AR area alias map so an English query term scores its Arabic caption (ADR-006/RE research). */
const AREA_ALIASES: Record<string, string> = {
  salwa: 'السالوة',
  salmiya: 'السالمية',
  mahboula: 'المهبولة',
  hawally: 'حولي',
  jabriya: 'الجابرية',
  mangaf: 'المنقف',
};

export const __SEED_POSTS_FOR_TEST = SEED_POSTS;
