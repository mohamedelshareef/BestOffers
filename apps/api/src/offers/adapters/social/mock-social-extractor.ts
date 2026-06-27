import { RawPost } from './social-provider';
import { SocialExtract, SocialExtractor } from './social-extractor';

/**
 * MockSocialExtractor — deterministic, offline stand-in for the real Claude extractor (no key, no
 * network). Used by the offline test suite and as a fallback when no key is present. Mirrors the
 * ADR-006 §2a schemas and the SAME truthfulness rule: a price is captured ONLY if a literal KWD price
 * appears in the caption; "DM / price on request" → price null.
 *
 * This is a regex stand-in for what Claude does; the structural truthfulness guard in
 * `SocialIngestAdapter` runs regardless of which extractor produced the value.
 */
export class MockSocialExtractor implements SocialExtractor {
  readonly name = 'mock';

  async extract(post: RawPost): Promise<SocialExtract | null> {
    const cap = post.caption;
    const priceFils = parseKwdPrice(cap);

    if (post.vertical === 'food') {
      return {
        vertical: 'food',
        isOffer: true,
        item: foodItem(cap, post.ownerHandle),
        priceFils,
        restaurant: post.ownerHandle,
      };
    }
    const tenure = parseTenure(cap);
    return {
      vertical: 'realestate',
      isOffer: true,
      tenure,
      area: parseArea(cap),
      rooms: parseRooms(cap),
      priceFils,
      priceUnit: parsePriceUnit(cap, tenure),
      rentFils: priceFils, // backward-compatible alias
      furnished: parseFurnished(cap),
    };
  }
}

/**
 * Tenure (rent vs sale) from the caption. Sale markers (للبيع / تمليك / for sale) win over rent markers
 * (للإيجار / للايجار / for rent / شهري / monthly). null when the caption states neither.
 */
export function parseTenure(caption: string): 'rent' | 'sale' | null {
  const lc = caption.toLowerCase();
  if (/للبيع|تمليك|for sale|freehold/i.test(caption) || lc.includes('for sale')) return 'sale';
  if (/للإيجار|للايجار|for rent|شهري|شهريا|monthly|\/month|per month/i.test(caption) || lc.includes('for rent'))
    return 'rent';
  return null;
}

/** Price unit: 'month' when a monthly marker is present (or tenure=rent), 'total' for sale, else null. */
export function parsePriceUnit(caption: string, tenure: 'rent' | 'sale' | null): 'month' | 'total' | null {
  if (/شهري|شهريا|monthly|\/month|per month|للشهر/i.test(caption)) return 'month';
  if (tenure === 'rent') return 'month';
  if (tenure === 'sale') return 'total';
  return null;
}

/**
 * Parse the FIRST literal KWD price in a caption → integer fils, else null.
 * Handles: "420 د.ك", "12.500 د.ك", "75 د.ك", "2.950 KWD", "300 KWD", "230 دينار", "550 دينار".
 * "السعر بالخاص / DM for price / price on request" → no number → null.
 */
export function parseKwdPrice(caption: string): number | null {
  // Match a number that may carry grouped thousands (300,000 / 300.000 as a SALE price) OR a
  // decimal KWD amount (12.500 / 420). Disambiguating the two is the whole RE price bug:
  //   "300,000 د.ك" is THREE-HUNDRED-THOUSAND dinar (a sale), not 300.000 (= 300).
  const m = caption.match(/(\d[\d.,]*\d|\d)\s*(?:د\.?\s*ك|kwd|kd|دينار)/i);
  if (!m) return null;
  const kwd = parseKwdNumber(m[1]);
  if (kwd == null || !Number.isFinite(kwd) || kwd <= 0) return null;
  return Math.round(kwd * 1000);
}

/**
 * Interpret a Kuwaiti-dinar number string. KWD uses 3 decimal places (fils). Heuristic:
 *  - A trailing group of EXACTLY 3 digits after a separator, where another separator/group precedes it
 *    (e.g. "1,250,000" or "1.250.000"), is GROUPED THOUSANDS → 1250000.
 *  - A single separator with 1–3 trailing digits ("12.500", "420.5", "75") is a DECIMAL KWD amount.
 *  - "300,000" (one separator, 3 trailing) is ambiguous but in KWD captions denotes 300,000 dinar (a
 *    sale) — only fractional fils would use 3 decimals AND such prices are written "300.000" rarely; we
 *    treat a 3-digit group after a COMMA as thousands, after a DOT as decimal fils (KWD convention).
 */
export function parseKwdNumber(s: string): number | null {
  const seps = (s.match(/[.,]/g) || []).length;
  if (seps === 0) return Number(s);
  if (seps >= 2) {
    // multiple separators → grouped thousands; drop all separators
    return Number(s.replace(/[.,]/g, ''));
  }
  // exactly one separator
  const sep = s.includes(',') ? ',' : '.';
  const [intPart, frac = ''] = s.split(sep);
  if (sep === ',' && frac.length === 3) {
    // "300,000" → grouped thousands (sale price), 300000
    return Number(intPart + frac);
  }
  // decimal KWD amount: "12.500" → 12.5, "420.5" → 420.5
  return Number(`${intPart}.${frac}`);
}

const AREAS: { ar: string; en: string }[] = [
  { ar: 'السالوة', en: 'Salwa' },
  { ar: 'السالمية', en: 'Salmiya' },
  { ar: 'المهبولة', en: 'Mahboula' },
  { ar: 'حولي', en: 'Hawally' },
  { ar: 'الجابرية', en: 'Jabriya' },
  { ar: 'المنقف', en: 'Mangaf' },
];

function parseArea(caption: string): string | null {
  const lc = caption.toLowerCase();
  for (const a of AREAS) {
    if (caption.includes(a.ar) || lc.includes(a.en.toLowerCase())) return a.en;
  }
  return null;
}

function parseRooms(caption: string): number | null {
  if (/استوديو|studio/i.test(caption)) return 0;
  if (/ثلاث غرف|3\s*br|3\s*bedroom|three bedroom/i.test(caption)) return 3;
  if (/غرفتين|2\s*br|2\s*bedroom|two bedroom/i.test(caption)) return 2;
  if (/غرفة وصالة|1\s*br|1\s*bedroom|one bedroom/i.test(caption)) return 1;
  return null;
}

function parseFurnished(caption: string): 'furnished' | 'semi' | 'unfurnished' | null {
  if (/نص مفروشة|semi-?furnished/i.test(caption)) return 'semi';
  if (/غير مفروشة|unfurnished/i.test(caption)) return 'unfurnished';
  if (/مفروشة|furnished/i.test(caption)) return 'furnished';
  return null;
}

function foodItem(caption: string, handle: string): string {
  // First non-empty caption line (strip trailing emoji/hashtags) is a good item label for the mock.
  const line = caption.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? handle;
  return line.replace(/[#️⃣].*$/u, '').replace(/[🥗🍢🎂🍳☕🧁🍔🔑🏢🌿📩📍]/gu, '').trim() || handle;
}
