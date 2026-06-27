import { PII_FORBIDDEN_KEYS } from '@bestoffers/shared';
import { createHmac } from 'crypto';

/**
 * ADR-009 Decision 3 — HARD redaction, deny-by-default. ONE source of truth = PII_FORBIDDEN_KEYS
 * (the events sink list, extended with the auth/secret/payment stems). Used by the audit recorder,
 * interceptor and exception filter so a secret/token/OTP/phone value can NEVER land in a row.
 *
 * Two layers:
 *   1. forbiddenKey(k)  — drop a whole field whose KEY matches a forbidden stem (case-insensitive,
 *      substring → catches Authorization / stripe_client_secret / supabase_service_role_key / x-api-key).
 *   2. redactString(s)  — scrub VALUES of any free-text we DO keep (query, error_message): strip
 *      phone/email/bearer-token/jwt/long-hex-secret patterns even if they slipped into a kept field.
 */

const FORBIDDEN_STEMS = (PII_FORBIDDEN_KEYS as readonly string[]).map((k) => k.toLowerCase());

/**
 * True if a field KEY matches any forbidden stem. Matching is TOKEN-aware (split on non-alphanumeric
 * AND camelCase boundaries) so `Authorization`/`refresh_token`/`stripeClientSecret`/`x-api-key` all
 * flag, while a benign plural like `cards` (count) or `cardinality` does NOT falsely match the `card`
 * stem. A token flags if it EQUALS a stem, or the stem is a multi-word phrase contained in the key,
 * or a token starts with a clearly-secret stem.
 */
const SECRET_PREFIX_STEMS = new Set(['authorization', 'apify_token', 'service_role', 'refresh_token']);

export function forbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  // split camelCase + delimiters into tokens: refreshToken→[refresh,token], x-api-key→[x,api,key]
  const tokens = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // collapsed = camelCase tokens joined (intentRaw → "intentraw") so a single-word stem with no
  // separator still matches a camelCase key.
  const collapsed = tokens.join('');
  for (const stem of FORBIDDEN_STEMS) {
    if (stem.includes('_') || stem.includes('-')) {
      // multi-part stem (phone_e164, set-cookie, refresh_token) → substring on the raw key,
      // also on the collapsed form (intent_raw must catch the camelCase intentRaw).
      const bare = stem.replace(/[_-]/g, '');
      if (lower.includes(stem) || collapsed.includes(bare)) return true;
    } else if (tokens.includes(stem) || collapsed === stem) {
      return true;
    } else if (SECRET_PREFIX_STEMS.has(stem) && tokens.some((t) => t.startsWith(stem))) {
      return true;
    }
  }
  return false;
}

// value-level scrub patterns (defense in depth for kept free-text fields)
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9._-]{10,}/g; // JWT (header.payload.sig starts eyJ)
const LONG_SECRET_RE = /\b(?:sk|pk|whsec|rk)_[A-Za-z0-9_]{8,}\b/g; // stripe/api key prefixes (allow _ in body)
const HEX_SECRET_RE = /\b[A-Fa-f0-9]{32,}\b/g; // 32+ hex = likely a secret/hash
// 4+ digit runs (phone fragments, OTP codes, card digits) — free-text in audit has no analytic need
// for raw numbers, so scrub them. Catches a bare 6-digit OTP and e.164/local phone fragments.
const DIGIT_RUN_RE = /\+?\d[\d\s().-]{2,}\d/g;

/** Scrub PII/secret SUBSTRINGS from a value we keep (returns '' if it becomes empty). */
export function redactString(input: string | null | undefined, max = 500): string | null {
  if (input == null) return null;
  let s = String(input);
  s = s
    .replace(BEARER_RE, '[redacted]')
    .replace(JWT_RE, '[redacted]')
    .replace(LONG_SECRET_RE, '[redacted]')
    .replace(HEX_SECRET_RE, '[redacted]')
    .replace(EMAIL_RE, '[redacted]')
    .replace(DIGIT_RUN_RE, '[redacted]')
    .trim();
  if (s.length > max) s = s.slice(0, max);
  return s.length ? s : null;
}

/**
 * Build a SANITIZED object from an allow-list of body fields. Drops any field whose key is forbidden,
 * and recursively scrubs nested objects. Returns null if nothing safe remains.
 * `allow` = the explicit set of keys we permit for this route family (deny-by-default).
 */
export function sanitizeObject(
  obj: Record<string, unknown> | null | undefined,
  allow: string[],
): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const key of allow) {
    if (!(key in obj)) continue;
    if (forbiddenKey(key)) continue; // belt-and-suspenders: never allow a forbidden key
    const v = (obj as Record<string, unknown>)[key];
    if (v == null) continue;
    if (typeof v === 'string') {
      const r = redactString(v, 200);
      if (r) out[key] = r;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
    }
    // objects/arrays in a body summary are dropped (deny-by-default; allow-list is flat scalars)
  }
  return Object.keys(out).length ? out : null;
}

/** Final pass over a built summary: drop any forbidden key that slipped in (deny-by-default). */
export function dropForbiddenKeys(
  obj: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!obj) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (forbiddenKey(k)) continue;
    out[k] = typeof v === 'string' ? (redactString(v, 200) ?? '') : v;
  }
  return Object.keys(out).length ? out : null;
}

/** Salted HMAC-SHA256 of a client IP. Never store the raw IP. */
export function ipHash(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHmac('sha256', salt).update(ip).digest('hex');
}
