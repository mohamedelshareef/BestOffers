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
    return {
      vertical: 'realestate',
      isOffer: true,
      area: parseArea(cap),
      rooms: parseRooms(cap),
      rentFils: priceFils,
      furnished: parseFurnished(cap),
    };
  }
}

/**
 * Parse the FIRST literal KWD price in a caption → integer fils, else null.
 * Handles: "420 د.ك", "12.500 د.ك", "75 د.ك", "2.950 KWD", "300 KWD", "230 دينار", "550 دينار".
 * "السعر بالخاص / DM for price / price on request" → no number → null.
 */
export function parseKwdPrice(caption: string): number | null {
  const m = caption.match(/(\d+(?:[.,]\d{1,3})?)\s*(?:د\.?\s*ك|kwd|kd|دينار)/i);
  if (!m) return null;
  const kwd = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(kwd) || kwd <= 0) return null;
  return Math.round(kwd * 1000);
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
