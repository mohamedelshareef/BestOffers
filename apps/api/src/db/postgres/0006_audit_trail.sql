-- ADR-009 — `audit_trail` — POSTGRES (Supabase) port of src/db/migrations/0006_audit_trail.sql.
-- Total operational record of EVERY inbound HTTP request, recorded once, off the request path.
-- See the local migration for full rationale.
--
-- SQLite -> Postgres port notes:
--   * TEXT PK            -> uuid PK (the recorder mints the uuid app-side == request_id; no DEFAULT needed,
--                          but gen_random_uuid() kept as a safety net for any direct insert).
--   * TEXT ISO ts        -> timestamptz.
--   * TEXT(JSON)         -> jsonb (request_summary / response_summary).
--   * Partial error index (pg-only) for fast 5xx review.
-- Idempotent.

CREATE TABLE IF NOT EXISTS audit_trail (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts               timestamptz NOT NULL DEFAULT now(),
  method           text NOT NULL,
  path             text NOT NULL,
  route            text,
  status_code      int,
  duration_ms      int,
  actor            text NOT NULL DEFAULT 'anon',
  ip_hash          text,
  user_agent       text,
  sector           text,
  query            text,
  request_summary  jsonb,
  request_bytes    int,
  response_summary jsonb,
  response_bytes   int,
  error_code       text,
  error_message    text,
  request_id       text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_trail(ts);
CREATE INDEX IF NOT EXISTS idx_audit_route ON audit_trail(route);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor);
-- pg-only: fast error review (partial index over server errors)
CREATE INDEX IF NOT EXISTS idx_audit_errors ON audit_trail(ts) WHERE status_code >= 500;
