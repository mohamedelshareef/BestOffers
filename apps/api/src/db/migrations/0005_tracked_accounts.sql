-- ADR-006 — Instagram ingestion: `tracked_accounts` curated allow-list store.
-- Postgres-compatible DDL; the SQLite local runner (migrate.ts) executes it as-is.
--
-- WHY: the IG ingestion lane (apify-social-provider.ts) used to read a HARDCODED list of handles per
-- sector/category. This table moves that curated allow-list into the DB so we keep GROWING it (append a
-- good account; auto-insert a hashtag-discovered handle as status='confirm' for later promotion) WITHOUT
-- a code change. The provider now queries this table (sector + matched category, status='verified'); the
-- hardcoded list remains ONLY as an offline fallback when the table is empty.
--
-- Columns mirror team/research/ig-accounts-seed.json (the researcher's machine-readable seed):
--   sector     food | realestate
--   category   food: rice|home_meal|grill|meal_prep|dessert|cloud   |   realestate: rent|sale|agency
--   status     verified (used LIVE) | confirm (loaded but NOT live until promoted) | disabled (kill-switch)
-- follower_tier/recency/posts_prices/lang are signal metadata carried from the seed (auditable, not live-critical).
--
-- Postgres production notes: TEXT pk → uuid DEFAULT gen_random_uuid(); TEXT ISO timestamps → timestamptz.
-- See db/postgres/0005_tracked_accounts.sql for the Supabase port.
-- Idempotent.

CREATE TABLE IF NOT EXISTS tracked_accounts (
  id            TEXT PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,            -- IG handle WITHOUT '@'
  sector        TEXT NOT NULL CHECK (sector IN ('food','realestate')),
  category      TEXT NOT NULL,                   -- dish/RE category (see header)
  follower_tier TEXT,                            -- micro | mid | large (signal estimate)
  recency       TEXT,                            -- active | very-active
  posts_prices  TEXT,                            -- yes | dm | image
  lang          TEXT,                            -- ar | en | both
  status        TEXT NOT NULL DEFAULT 'confirm'  -- verified=live, confirm=staged, disabled=off
                  CHECK (status IN ('verified','confirm','disabled')),
  note          TEXT,                            -- one-line context
  added_at      TEXT NOT NULL,                   -- ISO8601 first-seen
  last_seen_at  TEXT                             -- ISO8601 last successful pull (updated by ingestion)
);

-- Hot path: provider selects by (sector, category, status='verified'). Index covers it.
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_lookup
  ON tracked_accounts(sector, category, status);
