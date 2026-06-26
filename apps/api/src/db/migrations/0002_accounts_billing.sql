-- ADR-004 — Accounts, Profile, WhatsApp OTP, Stripe billing, Freemium gate.
-- Postgres-compatible DDL; the SQLite local runner executes it as-is.
--
-- Plane split (ADR-004 Decision 0): in PRODUCTION, identity (auth.users, phone PII, JWT, OTP verify)
-- and `profiles`/`subscriptions`/RLS live in Supabase. For LOCAL/OFFLINE/CI we keep a self-hosted
-- identity plane behind the same interfaces (OtpSender, JWT issuer) so the app boots with ZERO keys.
-- These tables are the local stand-in for the Supabase-managed ones; column shapes match the ADR so
-- the cutover is a host swap, not a redesign.
--
-- Privacy wall: phone (PII) lives ONLY in `auth_users` here (== auth.users in Supabase). It is NEVER
-- copied into `profiles` or `events`. Only `pseudo_id` (on profiles) crosses into analytics.
-- RLS-equivalent ownership is enforced in SERVER code (the API authorizes every request by user id);
-- in Supabase prod the same intent is enforced by the RLS policies in ADR-004 Decision 2.
--
-- Postgres production notes: TEXT pk → uuid DEFAULT gen_random_uuid(); TEXT json → jsonb;
-- TEXT timestamps → timestamptz; drop `auth_users` (replaced by Supabase auth.users);
-- enable RLS + the policies in ADR-004 §Decision 2 on profiles/notification_tokens/subscriptions/search_quota.

-- Supersede the hand-rolled auth from 0001 (ADR-004 Decision 0 migration step 3): the old
-- auth_otps/app_sessions are replaced by the ADR-004 identity plane below. DROP is safe locally
-- (greenfield/seeded MVP — no production user data). In Postgres prod these never existed (Supabase
-- Auth owns identity). Order matters: drop before recreating auth_otps with the new shape.
DROP TABLE IF EXISTS app_sessions;
DROP TABLE IF EXISTS auth_otps;

-- ---------- Identity plane (local stand-in for Supabase auth.users) ----------
-- Phone PII isolated here. profiles.id references this id (== auth.users.id in prod).
CREATE TABLE IF NOT EXISTS auth_users (
  id           TEXT PRIMARY KEY,
  phone_e164   TEXT NOT NULL UNIQUE,        -- +965… PII — never copied into profiles/events
  created_at   TEXT NOT NULL,
  last_login_at TEXT
);

-- OTP records: hashed code + TTL + attempt lock (F-C1 AC-3/4/6/7/12). Plaintext code never stored.
CREATE TABLE IF NOT EXISTS auth_otps (
  id          TEXT PRIMARY KEY,
  phone_e164  TEXT NOT NULL,
  code_hash   TEXT NOT NULL,               -- only a hash is persisted (AC-12)
  channel     TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms')),
  expires_at  TEXT NOT NULL,               -- now + 5min (AC-4)
  attempts    INTEGER NOT NULL DEFAULT 0,  -- ≤5 verify attempts (AC-7)
  consumed_at TEXT,                        -- set on success; latest code only (AC-5)
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_otps_phone ON auth_otps(phone_e164, created_at);

-- Rotating refresh tokens (device SecureStore under biometric, F-A2). Hash at rest.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at         TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  revoked_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

-- ---------- Profile (ADR-004 Decision 2; NO phone here) ----------
CREATE TABLE IF NOT EXISTS profiles (
  id                TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  pseudo_id         TEXT NOT NULL UNIQUE,        -- ONLY id that enters events
  display_name      TEXT,
  email             TEXT,                         -- verified/effective email (lowercased+trimmed)
  email_verified    INTEGER NOT NULL DEFAULT 0,
  email_pending     TEXT,                         -- new email awaiting re-verification (F-A1 AC-4)
  email_verify_token_hash TEXT,
  email_verify_expires_at TEXT,                   -- 24h TTL (F-A1 AC-6)
  avatar_url        TEXT,                         -- path into the avatars store
  locale_pref       TEXT NOT NULL DEFAULT 'ar' CHECK (locale_pref IN ('ar','en')),
  notif_enabled     INTEGER NOT NULL DEFAULT 1,
  notif_prefs       TEXT NOT NULL DEFAULT '{}',   -- jsonb in Postgres
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE TABLE IF NOT EXISTS notification_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  platform   TEXT,                                -- ios | android
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, expo_token)
);

-- ---------- Billing (ADR-004 Decision 4) — webhook is source of truth ----------
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'none'
                          CHECK (status IN ('none','active','trialing','past_due','canceled')),
  current_period_end     TEXT,
  updated_at             TEXT NOT NULL
);

-- ---------- Freemium gate (ADR-004 Decision 5) — server-authoritative counter ----------
-- Atomic conditional UPDATE … WHERE used_count < limit RETURNING enforces the cap race-safely.
CREATE TABLE IF NOT EXISTS search_quota (
  user_id     TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  used_count  INTEGER NOT NULL DEFAULT 0,   -- lifetime (never resets, BA F-D2 AC-6)
  updated_at  TEXT NOT NULL
);
