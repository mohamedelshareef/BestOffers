-- ADR-006 — Instagram ingestion: `tracked_accounts` curated allow-list — POSTGRES (Supabase) port of
-- src/db/migrations/0005_tracked_accounts.sql.
--
-- The IG ingestion lane queries this table for the curated allow-list (sector + matched category,
-- status='verified') instead of a hardcoded in-code dict. We keep GROWING it (append good accounts;
-- auto-stage hashtag-discovered handles as status='confirm'). See the local migration for full rationale.
--
-- SQLite→Postgres port notes:
--   * TEXT PK → uuid PK DEFAULT gen_random_uuid() (the import upserts by `handle`, which is UNIQUE).
--   * TEXT ISO timestamps → timestamptz DEFAULT now().
--   * CHECK constraints preserved verbatim (valid in both engines).
-- Idempotent.

CREATE TABLE IF NOT EXISTS tracked_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        text NOT NULL UNIQUE,            -- IG handle WITHOUT '@'
  sector        text NOT NULL CHECK (sector IN ('food','realestate')),
  category      text NOT NULL,                   -- food: rice|home_meal|grill|meal_prep|dessert|cloud ; realestate: rent|sale|agency
  follower_tier text,                            -- micro | mid | large
  recency       text,                            -- active | very-active
  posts_prices  text,                            -- yes | dm | image
  lang          text,                            -- ar | en | both
  status        text NOT NULL DEFAULT 'confirm'
                  CHECK (status IN ('verified','confirm','disabled')),
  note          text,
  added_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tracked_accounts_lookup
  ON tracked_accounts(sector, category, status);
