-- ADR-004 — Accounts, Profile, OTP, Stripe billing, Freemium gate — POSTGRES (Supabase) port of
-- src/db/migrations/0002_accounts_billing.sql.
--
-- PLANE SPLIT (ADR-004 Decision 0): in PRODUCTION the identity plane is Supabase Auth — phone PII,
-- JWT issuance and OTP verification live in the Supabase-managed `auth.users` schema. So unlike the
-- local migration (which keeps an `auth_users`/`auth_otps`/`auth_sessions` stand-in so the app boots
-- with zero keys), this Postgres port:
--   * does NOT recreate auth_users / auth_otps / auth_sessions — `auth.users` already exists (Supabase).
--   * keys the user-owned tables to auth.users(id) (uuid) per ADR-004 Decision 2/4/5.
--   * profiles.id IS the auth.users.id; pseudo_id is a fresh uuid (ONLY id that crosses into events).
--
-- SQLite→Postgres port notes:
--   * TEXT PK referencing auth_users → uuid PK REFERENCES auth.users(id) ON DELETE CASCADE.
--   * INTEGER boolean flags (email_verified/notif_enabled/biometric_enabled) → boolean.
--   * notif_prefs TEXT '{}' → jsonb DEFAULT '{}'::jsonb.
--   * TEXT ISO timestamps → timestamptz DEFAULT now() where the app didn't supply them.
--   * gen_random_uuid() for pseudo_id / notification_tokens.id defaults (pgcrypto, built-in on Supabase).
-- Privacy wall: phone (PII) is ONLY in auth.users; never copied into profiles/events. pseudo_id wall holds.
-- Idempotent.

-- ---------- Profile (ADR-004 Decision 2; NO phone here) ----------
CREATE TABLE IF NOT EXISTS profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo_id         uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),  -- ONLY id that enters events
  display_name      text,
  email             text,                              -- verified/effective email (lowercased+trimmed)
  email_verified    boolean NOT NULL DEFAULT false,
  email_pending     text,                              -- new email awaiting re-verification (F-A1 AC-4)
  email_verify_token_hash text,
  email_verify_expires_at timestamptz,                 -- 24h TTL (F-A1 AC-6)
  avatar_url        text,                              -- path into the avatars Storage bucket
  locale_pref       text NOT NULL DEFAULT 'ar' CHECK (locale_pref IN ('ar','en')),
  notif_enabled     boolean NOT NULL DEFAULT true,
  notif_prefs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  biometric_enabled boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE TABLE IF NOT EXISTS notification_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token text NOT NULL,
  platform   text,                                     -- ios | android
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, expo_token)
);

-- ---------- Billing (ADR-004 Decision 4) — webhook is source of truth ----------
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  status                 text NOT NULL DEFAULT 'none'
                          CHECK (status IN ('none','active','trialing','past_due','canceled')),
  current_period_end     timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ---------- Freemium gate (ADR-004 Decision 5) — server-authoritative counter ----------
-- Atomic conditional UPDATE … WHERE used_count < limit RETURNING enforces the cap race-safely.
CREATE TABLE IF NOT EXISTS search_quota (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_count  int NOT NULL DEFAULT 0,                  -- lifetime (never resets, BA F-D2 AC-6)
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Auto-provision a profile row on auth.users create (ADR-004 Slice A) ----------
-- Keeps profiles 1:1 with identities without a client round-trip. SECURITY DEFINER so the trigger
-- can write profiles regardless of the inserting role; pseudo_id defaults to a fresh uuid.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.search_quota (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
