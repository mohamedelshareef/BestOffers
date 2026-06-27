/**
 * ADR-009 — frozen AuditRow / AuditRecorder interface. One row per inbound HTTP request.
 * Constructed by the interceptor/filter from an explicit ALLOW-LIST (never by dumping the raw
 * request/response), then every string field is run through the recorder's redact() scrub before
 * insert. NEVER carries a secret/token/OTP/phone value (see PII_FORBIDDEN_KEYS + audit.redact).
 */
export interface AuditRow {
  id: string; // == requestId (uuid)
  ts: string; // ISO-8601 request start
  method: string;
  path: string; // query string STRIPPED
  route: string; // matched template, e.g. '/search/intent'
  statusCode: number;
  durationMs: number;
  actor: string; // pseudoId | 'anon' — NEVER phone/email
  ipHash: string | null; // HMAC(ip, salt) | null
  userAgent: string | null; // truncated 256
  sector: string | null; // search analytics
  query: string | null; // normalized + scrubbed, /search/* only, <=200
  requestSummary: Record<string, unknown> | null; // allow-listed, sanitized
  requestBytes: number | null;
  responseSummary: Record<string, unknown> | null; // shape only
  responseBytes: number | null;
  errorCode: string | null;
  errorMessage: string | null; // sanitized, <=500
  requestId: string; // == id
}

export interface AuditRecorder {
  /** Fire-and-forget. Returns immediately, NEVER throws into the caller. */
  enqueue(row: AuditRow): void;
  /** tests only — await pending writes */
  flush(): Promise<void>;
}
