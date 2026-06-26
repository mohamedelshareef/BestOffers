-- BestOffers core schema (S2-2). Postgres-compatible DDL.
-- Money is integer FILS (1 KWD = 1000 fils). PII (phone) lives ONLY in `users`.
-- Only `pseudo_id` ever crosses into `events` (privacy wall, system-design §Privacy).
-- `offer_history` is APPEND-ONLY (the B2B price-intelligence asset).
--
-- Notes for Postgres production:
--   * swap TEXT pk defaults for `uuid DEFAULT gen_random_uuid()`
--   * swap the JSON TEXT columns for `jsonb`
--   * add a generated tsvector `search_text` + pg_trgm index on `skus` (system-design §SKU-grouping)
-- The SQLite local runner (migrate.ts) executes this as-is; types below are chosen to be valid in both.

-- ---------- Identity & session (PII boundary) ----------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  phone_e164    TEXT NOT NULL UNIQUE,      -- +965… ; PII — never copied into events
  pseudo_id     TEXT NOT NULL UNIQUE,      -- the ONLY id allowed into analytics
  locale_pref   TEXT NOT NULL DEFAULT 'ar' CHECK (locale_pref IN ('ar','en')),
  biometric_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_otps (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  phone_e164  TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL,
  expires_at         TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  revoked_at         TEXT
);

-- ---------- Providers & catalog ----------
CREATE TABLE IF NOT EXISTS providers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  sector            TEXT NOT NULL CHECK (sector IN ('electronics','food')),
  access_channel    TEXT NOT NULL CHECK (access_channel IN ('affiliate','scrape')),
  base_url          TEXT,
  deeplink_template TEXT,
  enabled           INTEGER NOT NULL DEFAULT 1,   -- admin G1 toggle gates user search
  affiliate_meta    TEXT,                          -- jsonb in Postgres
  last_sync_at      TEXT,
  health_status     TEXT,
  robots_ok         INTEGER NOT NULL DEFAULT 0,    -- legal gate
  tos_reviewed      INTEGER NOT NULL DEFAULT 0     -- scraping stays behind tos_reviewed=1
);

CREATE TABLE IF NOT EXISTS skus (
  id             TEXT PRIMARY KEY,
  category       TEXT NOT NULL,                     -- smartphone | laptop | tv …
  canonical_name TEXT NOT NULL,
  brand          TEXT,
  model          TEXT,
  attributes     TEXT,                              -- jsonb in Postgres: {storage,color,screen}
  gtin           TEXT,
  mpn            TEXT
  -- Postgres: + search_text tsvector GENERATED, + GIN/pg_trgm index
);

CREATE TABLE IF NOT EXISTS offers (
  id               TEXT PRIMARY KEY,
  sku_id           TEXT NOT NULL REFERENCES skus(id),
  provider_id      TEXT NOT NULL REFERENCES providers(id),
  provider_sku_ref TEXT,
  price_fils       INTEGER NOT NULL,                -- KWD as integer fils
  currency         TEXT NOT NULL DEFAULT 'KWD',
  in_stock         INTEGER,                         -- nullable (unknown)
  deeplink_url     TEXT NOT NULL,
  raw_payload      TEXT,                            -- jsonb in Postgres
  fetched_at       TEXT NOT NULL,
  ttl_expires_at   TEXT,
  source           TEXT NOT NULL DEFAULT 'live' CHECK (source IN ('live','cache')),
  UNIQUE (sku_id, provider_id)
);

-- APPEND-ONLY price history — never UPDATE/DELETE. Powers price-over-time + deal confidence.
CREATE TABLE IF NOT EXISTS offer_history (
  id          TEXT PRIMARY KEY,
  sku_id      TEXT NOT NULL REFERENCES skus(id),
  provider_id TEXT NOT NULL REFERENCES providers(id),
  price_fils  INTEGER NOT NULL,
  in_stock    INTEGER,
  observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offer_history_sku_time ON offer_history(sku_id, observed_at);

-- ---------- Anonymized analytics (pseudo_id only — NO PII) ----------
CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,
  ts                TEXT NOT NULL,
  pseudo_id         TEXT NOT NULL,                  -- the only identity allowed here
  search_session_id TEXT,
  type              TEXT NOT NULL,
  payload           TEXT                            -- jsonb in Postgres; bucketed values, NO PII
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
