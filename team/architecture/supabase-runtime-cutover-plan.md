# Supabase Runtime Cutover Plan (NestJS: better-sqlite3 → pg/Supabase)

> Owner: bo-dev-lead · Status: **EXECUTED + REAL-PROVEN 2026-06-26** (driver-selectable; SQLite stays
>   default → 102/102 api green; `DB_DRIVER=pg`+`AUTH_MODE=supabase`+`STORAGE_PROVIDER=supabase` verified
>   against the live project — real profile upsert, freemium quota row, JWKS ES256 token accept/reject, and
>   avatar object all landed in Supabase. See bo-dev-lead memory + `apps/api/scripts/verify-supabase-*.mjs`,
>   `http-authed-check.mjs`.) · 2026-06-26
> Companion to ADR-004. The Supabase **schema is now provisioned and verified** (see this task's
> handoff). What remains is switching the NestJS RUNTIME to talk to Supabase Postgres instead of the
> local SQLite file. We deliberately did NOT do this now — the app stays stable (63 API + 18 mobile
> tests green on SQLite). This doc is the scoped backlog for that cutover.

## What is ALREADY done (live in Supabase, proof in the task handoff)
- 9 `public` tables (catalog 5 + accounts/billing 4) via `npm run db:supabase:push` (idempotent).
- RLS enabled + self-access policies on profiles/notification_tokens/subscriptions/search_quota;
  `avatars` Storage bucket (private, image-only, 2MB) + per-uid object policies.
- `on_auth_user_created` trigger auto-provisions a profile + quota row per Supabase auth user.
- Privacy wall, cross-user RLS denial, server-only sub writes, atomic 5-cap all DB-verified.

## Why the runtime is NOT cut over yet (the real work)
The NestJS data layer is **synchronous** (`better-sqlite3`): `DbService` returns a `Database` whose
`.prepare(...).get()/.all()/.run()` are blocking calls, used synchronously throughout
auth/accounts/billing/quota/search services. `pg` is **async** (`Promise`). Swapping the driver is
not a config change — it's an async refactor of every query call site. Plus identity moves from the
local HS256 JWT to Supabase-issued JWTs (JWKS verification). Both are multi-file, regression-prone,
and orthogonal to "is the schema real" — so they're sequenced after provisioning.

## Workstreams (scoped, sequenced)

### 1. Data-access async refactor (largest)
- Introduce a thin `Db` port with async methods (`get<T>`, `all<T>`, `run`, `tx`) and TWO adapters:
  - `SqliteDb` (wraps better-sqlite3, returns resolved Promises) — keeps tests/offline mode.
  - `PgDb` (wraps a `pg.Pool`) — Supabase pooled conn.
- Selection by env: `DB_DRIVER=sqlite|pg` (default `sqlite` so CI/offline is unchanged).
- Convert every `this.db.prepare(...).X()` call site to `await this.db.X(sql, params)`. Affected:
  `auth/auth.service.ts`, `accounts/*.service.ts`, `billing/billing.service.ts` +
  `mock-billing-provider.ts`, `quota/quota.service.ts`, `search/*` (where it reads offers/skus),
  `events/events.service.ts`. Most service methods are already in async controllers, so the ripple
  is mechanical (add `await`, make helpers `async`).
- **Param placeholders differ:** SQLite uses `?`; pg uses `$1,$2…`. Either (a) write the port to
  rewrite `?`→`$n`, or (b) standardize on `$n` and have SqliteDb map them. Prefer (a) for minimal
  query churn.
- **RETURNING:** the atomic quota UPDATE already uses `RETURNING` (works in both). Keep as-is.
- **Booleans/json/timestamps:** SQLite stored 0/1, JSON-as-TEXT, ISO strings. Postgres returns
  real `boolean`, `jsonb` (parsed object), `timestamptz` (Date). Add a row-normalization layer OR
  adjust models to accept both. The Postgres DDL already uses boolean/jsonb/timestamptz, so the
  normalization lives in `PgDb` (e.g. coerce booleans, `JSON.stringify` on write isn't needed for
  jsonb — pass objects). Audit each model's read expectations.

### 2. Identity: HS256 → Supabase JWKS verification
- `JwtService.verifyAccess` currently verifies a locally-minted HS256 token. Replace with JWKS
  verification of Supabase access tokens: fetch `SUPABASE_JWKS_URL`
  (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`), cache keys, verify RS256/ES256, check
  `iss`==`SUPABASE_JWT_ISSUER`, `aud`, `exp`. Extract `sub` (auth user uuid).
- `AuthGuard` then resolves `sub → profiles.pseudo_id` (one query, cache per-request). Downstream is
  unchanged (it already consumes `{userId, pseudoId}`).
- OTP request/verify: in prod, delegate to Supabase phone sign-in (`auth/v1/otp` + `verify`) with
  the custom WhatsApp delivery hook (`OtpSender`). Keep the mock path for offline (`OTP_PROVIDER=mock`).
- `auth_users`/`auth_otps`/`auth_sessions` local tables are NOT created in Postgres (Supabase
  `auth.users` owns identity) — the Pg adapter must NOT reference them; auth flows route to Supabase.

### 3. Connection pooling & lifecycle
- Use the **Supavisor transaction pooler** (port 6543) for the app `pg.Pool` (already the verified
  `DATABASE_URL`). Transaction-pooling caveat: **no session-level state** — never rely on
  `SET`/session GUCs across statements; wrap any `SET LOCAL` + query in one transaction (the verify
  script already does this). Prepared-statement caching: set `statement_timeout` and avoid named
  prepared statements that outlive a txn, or use the session pooler (5432) for migrations only.
- Pool sizing: small (free/Pro conn caps). `max: 5–10`, `idleTimeoutMillis`, `connectionTimeoutMillis`.
- Migrations run via the existing `db:supabase:push` (direct DDL); app uses the pool.

### 4. Storage cutover (avatars)
- `accounts/storage.interface.ts` has a config-ready Supabase Storage impl slot. Implement it against
  the now-existing `avatars` bucket (service-role upload to `{uid}/avatar.<ext>`; client renders via
  signed URL). Swap `STORAGE=local|supabase`. Bucket + policies are already live.

### 5. Billing webhook raw body (prod Stripe)
- For real Stripe set `main.ts` `rawBody: true` so signature verification sees exact bytes (noted in
  memory tech-debt). Webhook writes `subscriptions` via the service role (bypasses RLS) — correct.

## Sequencing & risk
1. Land the `Db` port + `SqliteDb` adapter with tests still on SQLite (no behavior change). Low risk.
2. Add `PgDb` + `DB_DRIVER=pg`; run the SAME e2e specs against a Supabase test schema in CI. Med risk
   (type normalization). Gate behind the env so default stays SQLite.
3. JWKS verify behind `AUTH_MODE=local|supabase`. Med risk; mock path preserved.
4. Storage + Stripe raw-body. Low risk (isolated).
5. Flip prod env to `DB_DRIVER=pg`, `AUTH_MODE=supabase`, `STORAGE=supabase`. Keep SQLite for offline/CI.

**Estimate:** ~2–3 focused days (refactor #1 dominates). **Do NOT** start until there's a green
SQLite baseline and a Supabase CI schema, so both paths stay testable.

## QA verification targets after cutover
- Same 63 API specs pass with `DB_DRIVER=pg` against a Supabase test schema (type-normalization parity).
- A real Supabase-issued JWT is accepted; an HS256/forged token is rejected (JWKS path).
- Quota cap holds under concurrency against Postgres (the `WHERE used_count<5 RETURNING` race test).
- Avatar upload lands at `{uid}/avatar.<ext>` and a non-owner cannot read it (Storage RLS).
- Offline mode (`DB_DRIVER=sqlite`, `OTP_PROVIDER=mock`, `BILLING_PROVIDER=mock`) still boots keyless.
