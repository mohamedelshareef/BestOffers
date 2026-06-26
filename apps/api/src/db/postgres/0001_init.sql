-- BestOffers core schema — POSTGRES (Supabase) port of src/db/migrations/0001_init.sql.
-- Target: Supabase managed Postgres (public schema). Applied by db:supabase:push.
--
-- SQLite→Postgres port notes (what changed vs the local migration):
--   * TEXT PRIMARY KEY (app-generated ids) kept as TEXT — the NestJS models still mint string ids
--     (mock/local parity). No AUTOINCREMENT was used in 0001 (no INTEGER PK), so nothing to convert.
--   * INTEGER boolean flags (enabled/robots_ok/tos_reviewed/in_stock) → boolean.
--   * TEXT json columns (affiliate_meta/attributes/raw_payload/payload) → jsonb.
--   * TEXT ISO-8601 timestamps → timestamptz (app inserts ISO strings; Postgres casts them).
--   * Money STAYS integer fils (bigint) — 1 KWD = 1000 fils. No floats for money, ever.
--   * CHECK constraints preserved verbatim.
-- Idempotent: every object guarded by IF NOT EXISTS.

-- ---------- Providers & catalog ----------
CREATE TABLE IF NOT EXISTS providers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  sector            TEXT NOT NULL CHECK (sector IN ('electronics','food')),
  access_channel    TEXT NOT NULL CHECK (access_channel IN ('affiliate','scrape')),
  base_url          TEXT,
  deeplink_template TEXT,
  enabled           boolean NOT NULL DEFAULT true,    -- admin G1 toggle gates user search
  affiliate_meta    jsonb,
  last_sync_at      timestamptz,
  health_status     TEXT,
  robots_ok         boolean NOT NULL DEFAULT false,   -- legal gate
  tos_reviewed      boolean NOT NULL DEFAULT false    -- scraping stays behind tos_reviewed=true
);

CREATE TABLE IF NOT EXISTS skus (
  id             TEXT PRIMARY KEY,
  category       TEXT NOT NULL,                        -- smartphone | laptop | tv …
  canonical_name TEXT NOT NULL,
  brand          TEXT,
  model          TEXT,
  attributes     jsonb,                                -- {storage,color,screen}
  gtin           TEXT,
  mpn            TEXT
  -- Slice-B: + search_text tsvector GENERATED + GIN/pg_trgm index (system-design §SKU-grouping)
);

CREATE TABLE IF NOT EXISTS offers (
  id               TEXT PRIMARY KEY,
  sku_id           TEXT NOT NULL REFERENCES skus(id),
  provider_id      TEXT NOT NULL REFERENCES providers(id),
  provider_sku_ref TEXT,
  price_fils       bigint NOT NULL,                    -- KWD as integer fils
  currency         TEXT NOT NULL DEFAULT 'KWD',
  in_stock         boolean,                            -- nullable (unknown)
  deeplink_url     TEXT NOT NULL,
  raw_payload      jsonb,
  fetched_at       timestamptz NOT NULL,
  ttl_expires_at   timestamptz,
  source           TEXT NOT NULL DEFAULT 'live' CHECK (source IN ('live','cache')),
  UNIQUE (sku_id, provider_id)
);

-- APPEND-ONLY price history — never UPDATE/DELETE. Powers price-over-time + deal confidence.
CREATE TABLE IF NOT EXISTS offer_history (
  id          TEXT PRIMARY KEY,
  sku_id      TEXT NOT NULL REFERENCES skus(id),
  provider_id TEXT NOT NULL REFERENCES providers(id),
  price_fils  bigint NOT NULL,
  in_stock    boolean,
  observed_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offer_history_sku_time ON offer_history(sku_id, observed_at);

-- ---------- Anonymized analytics (pseudo_id only — NO PII) ----------
CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,
  ts                timestamptz NOT NULL,
  pseudo_id         TEXT NOT NULL,                     -- the only identity allowed here
  search_session_id TEXT,
  type              TEXT NOT NULL,
  payload           jsonb                              -- bucketed values, NO PII
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
