-- ADR-004 Decision 2 — Row Level Security on user-owned tables + Storage avatars policies.
-- The NestJS server uses the SERVICE-ROLE connection → bypasses RLS (trusted server code that has
-- already authorized the request by JWT). RLS exists so the Expo client (anon key + user JWT) can
-- read its OWN rows directly and can NEVER read another user's rows or write server-owned data
-- (subscriptions / search_quota writes are server-only — the paywall's security crux).
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE; ENABLE RLS is idempotent.

-- profiles: owner can SELECT/UPDATE own row. (INSERT handled by the on_auth_user_created trigger.)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self_select ON profiles;
DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_select ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- notification_tokens: owner-scoped READ. (Client may register its own push token → allow self insert.)
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_self_select ON notification_tokens;
DROP POLICY IF EXISTS notif_self_insert ON notification_tokens;
CREATE POLICY notif_self_select ON notification_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notif_self_insert ON notification_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- subscriptions: owner-scoped READ ONLY. NO insert/update/delete policy → clients can NEVER write
-- their status. Writes come exclusively from the Stripe webhook via the service role (bypasses RLS).
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sub_self_select ON subscriptions;
CREATE POLICY sub_self_select ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- search_quota: owner-scoped READ ONLY. Writes (the atomic conditional UPDATE) are server-only via
-- the service role. No client write policy → the freemium counter cannot be tampered with.
ALTER TABLE search_quota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quota_self_select ON search_quota;
CREATE POLICY quota_self_select ON search_quota
  FOR SELECT USING (auth.uid() = user_id);

-- ---------- Storage: avatars bucket policies (object name prefixed with caller uid) ----------
-- The bucket itself is created via the Storage API in the push runner (service role). These policies
-- gate client (anon + user JWT) access: a user touches only objects under their own {uid}/ prefix.
DROP POLICY IF EXISTS avatars_self_read   ON storage.objects;
DROP POLICY IF EXISTS avatars_self_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_self_update ON storage.objects;
DROP POLICY IF EXISTS avatars_self_delete ON storage.objects;
CREATE POLICY avatars_self_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY avatars_self_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY avatars_self_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY avatars_self_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
