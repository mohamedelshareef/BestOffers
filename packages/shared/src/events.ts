/**
 * Anonymized analytics events (S1-4 §"event-logging pipeline", BA §3 schema).
 * HARD RULE: only `pseudoId` ever enters events — phone/PII never leaves `users`.
 * No free-text PII: intent is logged as normalized categories + bucketed values.
 */

export type EventType =
  | 'intent_submitted'
  | 'clarifier_answered'
  | 'search_executed' // includes freshness source + latency_ms
  | 'offer_returned' // → price history (B2B asset)
  | 'empty_result' // → unmet demand (B2B asset)
  | 'fallback_served' // F-SR1: no-match fallback augmented a weak/zero result with real alternatives
  | 'empty_empty' // F-SR1: truly nothing relevant — helpful empty + broaden suggestions shown
  | 'card_tapped' // CTR + affiliate attribution
  | 'result_refined'
  | 'session_outcome'
  | 'alert_triggered';

export interface AnalyticsEvent {
  type: EventType;
  pseudoId: string; // the ONLY identity that crosses into analytics
  searchSessionId?: string;
  ts: string; // ISO-8601
  payload: Record<string, unknown>; // bucketed/normalized only — NO PII, NO free text
}

/**
 * Keys that must NEVER appear in an event payload OR an audit_trail row (defense-in-depth, validated
 * at the sink). ONE source of truth — the events sink and the ADR-009 audit recorder both gate on it.
 * Matching is case-insensitive and substring-aware in the audit redactor (so `Authorization`,
 * `stripe_client_secret`, `supabase_service_role_key` etc. are all caught), so list canonical stems.
 */
export const PII_FORBIDDEN_KEYS = [
  // — phone / identity PII (the original privacy-wall set) —
  'phone',
  'phone_e164',
  'phoneE164',
  'email',
  'name',
  'intentRaw',
  'intent_raw',
  // — credentials / OTP —
  'code',
  'otp',
  'password',
  'passwd',
  'magiclink',
  'magic_link',
  // — auth tokens / secrets (ADR-009 never-log list) —
  'authorization',
  'cookie',
  'set-cookie',
  'bearer',
  'jwt',
  'token',
  'access_token',
  'accessToken',
  'refresh',
  'refresh_token',
  'refreshToken',
  'apikey',
  'api_key',
  'apify_token',
  'service_role',
  'service_role_key',
  'webhook_secret',
  'signing_secret',
  'secret',
  'key',
  // — payment data —
  'card',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'client_secret',
  'clientSecret',
] as const;
