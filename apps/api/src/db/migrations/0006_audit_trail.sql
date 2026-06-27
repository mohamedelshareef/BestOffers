-- ADR-009 — `audit_trail`: total operational record of EVERY inbound HTTP request.
-- One row per request, recorded once (on response or via the exception filter), OFF the request path
-- (fire-and-forget) so it NEVER slows or breaks a request. Money/PII rules are enforced in the recorder
-- (redact() allow-list), NOT trusted from callers — the table just stores the already-sanitized row.
--
-- Distinct from `events` (anonymized product analytics, opt-in): this is automatic + total operational
-- audit + per-route latency/error/volume analytics + search sector/query analytics.
--
-- Postgres production notes: TEXT pk → uuid DEFAULT gen_random_uuid(); TEXT ISO ts → timestamptz;
-- request/response_summary TEXT(JSON) → jsonb. See db/postgres/0006_audit_trail.sql for the Supabase port.
-- Retention: prune rows older than AUDIT_RETENTION_DAYS (default 90) in batches (ADR-009 Decision 1).
-- Idempotent.

CREATE TABLE IF NOT EXISTS audit_trail (
  id               TEXT PRIMARY KEY,                 -- request-scoped uuid (== request_id)
  ts               TEXT NOT NULL,                    -- ISO8601 request start time
  method           TEXT NOT NULL,                    -- GET/POST/...
  path             TEXT NOT NULL,                    -- concrete URL path, query string STRIPPED (PII)
  route            TEXT,                             -- matched route template, e.g. /search/intent (analytics key, low-cardinality)
  status_code      INTEGER,                          -- HTTP status (4xx/5xx from the exception filter too)
  duration_ms      INTEGER,                          -- wall-clock handler time
  actor            TEXT NOT NULL DEFAULT 'anon',     -- pseudo_id if authed, else 'anon'. NEVER phone/email/user_id
  ip_hash          TEXT,                             -- HMAC-SHA256(ip, AUDIT_IP_SALT), NOT raw IP. NULL if AUDIT_IP=off
  user_agent       TEXT,                             -- UA string, truncated 256 chars
  sector           TEXT,                             -- search analytics: electronics|food|realestate; NULL elsewhere
  query            TEXT,                             -- NORMALIZED + PII-scrubbed search query, /search/* only, <=200 chars
  request_summary  TEXT,                             -- JSON: SANITIZED allow-listed body fields only; NULL if nothing safe
  request_bytes    INTEGER,                          -- content-length of request body
  response_summary TEXT,                             -- JSON: SANITIZED result shape (counts/state), NOT full payload
  response_bytes   INTEGER,                          -- serialized response size
  error_code       TEXT,                             -- app error code / exception name on failure; NULL on success
  error_message    TEXT,                             -- SANITIZED, truncated 500 chars; NULL on success
  request_id       TEXT NOT NULL                     -- correlation id (== id; surfaced as x-request-id header)
);

-- time-range scans + pruning
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_trail(ts);
-- per-endpoint volume / latency / error analytics
CREATE INDEX IF NOT EXISTS idx_audit_route ON audit_trail(route);
-- per-actor activity / abuse investigation
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor);
