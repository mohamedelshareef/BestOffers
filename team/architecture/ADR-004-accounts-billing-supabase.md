# ADR-004 — Accounts, Profile, WhatsApp OTP, Stripe Billing & Freemium Gate (Supabase)

> Owner: bo-tech-architect · Status: accepted · 2026-06-26
> Scope: F-B1 (Supabase backend), F-C1 (WhatsApp OTP auth), F-A1/A2/A3 (profile, biometric, notifications), F-D1 (Stripe $1/mo), F-D2 (5-free-searches freemium gate).
> Builds on: ADR-001 (NestJS+Postgres+Redis), ADR-002 (Claude), ADR-003 (live AI-fetch pipeline), `system-design.md` (privacy wall: phone PII only in `users`, only `pseudo_id` enters `events`).
> Principle: simplest design meeting AC (YAGNI). The app MUST run fully in dev/mock mode with **no real external keys** — all three externals (WhatsApp, Stripe, and even Supabase) sit behind mockable interfaces.

---

## Context

The PO added Accounts, WhatsApp OTP, $1/mo Stripe, and a freemium gate. F-B1 asks the big question: adopt **Supabase** as the managed backend, or keep self-hosted NestJS+Postgres (ADR-001)? Everything else hangs off that answer. Two hard constraints shape it:

1. **The live AI-fetch pipeline (ADR-003) is the product's core IP and is NestJS-resident** — Playwright/BullMQ render workers, Redis scrape-locks, per-adapter kill-switches, the Claude orchestration (Opus clarify+rank, Haiku extract), the `resolveOffers` contract, `offer_history` append. None of that is a fit for Supabase Edge Functions (Deno, 2s/CPU limits, no long-lived browser pool, no BullMQ).
2. **The privacy wall must survive.** Phone PII lives only in the user row; only `pseudo_id` crosses into `events`. Whatever owns auth must preserve that wall.

---

## Decision 0 (the big one): Adopt Supabase as the **identity + user-data plane**, keep NestJS as the **product/AI plane**. Split-plane, not replace.

**We do NOT replace NestJS with Supabase. We do NOT run two Postgres clusters.** We make Supabase the **single managed Postgres** (it *is* Postgres) and let NestJS connect to it as its database. Supabase additionally provides Auth, Storage, and RLS on top of that same DB.

```
                    ┌──────────────────────── Supabase project (managed) ────────────────────────┐
                    │  Supabase Auth (phone identities, JWT issuer, JWKS)                         │
   Expo app ──────► │  Postgres  ── auth.users (Supabase) ── public.* (our tables, ADR-001/003)   │
   (supabase-js)    │  Storage (avatars bucket)                                                   │
                    │  RLS policies (user-owned rows)                                             │
                    │  Edge Function: otp-send (WhatsApp/SMS) · stripe-webhook (optional host)    │
                    └────────────────────────────────────────────────────────────────────────────┘
                              ▲ same Postgres (service-role conn)                ▲ verifies Supabase JWT (JWKS)
                              │                                                  │
                    ┌─────────┴──────────────────────────────────────────────────┴───────┐
                    │  NestJS (ADR-001) — PRODUCT/AI PLANE (unchanged core)               │
                    │  live AI-fetch (ADR-003 Playwright/BullMQ/Redis) · Claude orchestr. │
                    │  /search/* · resolveOffers · events pipeline · freemium enforcement │
                    └────────────────────────────────────────────────────────────────────┘
```

### Plane split (frozen)
| Concern | Owner | Why |
|---|---|---|
| Phone identity, JWT issuance, OTP verification record, refresh tokens | **Supabase Auth** | Don't rebuild auth; offload token rotation, JWKS, session storage |
| User profile, notif prefs, biometric flag, subscription status | **Supabase Postgres** (`public.profiles`, `public.subscriptions`) + RLS | One DB; client can read its own profile directly via RLS |
| Avatar files | **Supabase Storage** (`avatars` bucket) | Managed CDN + signed URLs; no S3 wiring |
| **Live AI-fetch, Playwright/BullMQ, Redis, Claude, `resolveOffers`, `offer_history`** | **NestJS (unchanged)** | Core IP, long-running, needs browser pool — NOT an Edge-Function fit |
| `/search/*` orchestration, **freemium metering & enforcement**, `events` pipeline | **NestJS** | Must sit on the request path that already owns search + pseudo_id |
| OTP *send* (WhatsApp/SMS) | **`OtpSender` iface** — impl behind Supabase Edge Function OR NestJS (either host) | Pluggable provider; mockable |
| Stripe checkout + webhook → subscription status | **`BillingProvider` iface** in NestJS (webhook can also be a thin Edge Fn) | Status must reach the freemium gate, which is in NestJS |

### Why split-plane (trade-offs, explicit)
- **(+) Reuse, don't rebuild auth.** Supabase Auth gives phone identities, JWT+JWKS, refresh rotation, rate-limit — weeks saved vs the hand-rolled `auth_otps`/`app_sessions` in ADR-001. We delete that hand-rolled auth.
- **(+) One Postgres, one source of truth.** Supabase *is* managed Postgres — ADR-001/003 tables (`providers`, `skus`, `offers`, `offer_history`, `events`, `provider_url_cache`) live in the same DB under the `public` schema. NestJS connects with the **service-role** connection (bypasses RLS — it's trusted server code). No data sync, no second cluster.
- **(+) RLS for free on user data.** `profiles`, `subscriptions`, `notification_tokens` get row-level security so the Expo client can read its own rows directly (fewer NestJS endpoints).
- **(+) Storage + CDN for avatars** with zero S3/CloudFront wiring.
- **(−) Two control planes** (Supabase dashboard + NestJS deploy) and a small impedance cost: NestJS verifies a Supabase-issued JWT (JWKS) instead of minting its own. Accepted — standard JWT verification.
- **(−) Vendor coupling** to Supabase Auth/Storage. Mitigated: it's plain Postgres underneath; auth/storage are replaceable, and we keep them behind our own thin server boundary for the AI plane.
- **(−) Supabase free tier pauses on 7-day inactivity / has connection caps.** Use a pooled connection (Supavisor/PgBouncer) from NestJS; Pro tier ($25/mo) before launch.
- **Rejected — "all-in Supabase, drop NestJS":** Edge Functions cannot host Playwright render workers, a BullMQ queue, Redis scrape-locks, or multi-second Claude orchestration. Would gut ADR-003. **No.**
- **Rejected — "keep self-hosted PG, ignore Supabase":** then we hand-build auth + storage + RLS for marginal benefit. The PO explicitly wants Supabase; the managed identity plane is genuinely cheaper to operate. **No.**

### Migration path (from current ADR-001 self-hosted PG)
1. **Provision Supabase project** → it is the new managed Postgres for *all* environments.
2. **Run existing ADR-001/003 migrations** (`providers`, `skus`, `offers`, `offer_history`, `events`, `search_sessions` rollup, `provider_url_cache`) into the `public` schema **unchanged** — they're standard Postgres. NestJS points its `DATABASE_URL` at the Supabase pooled connection.
3. **Retire hand-rolled auth:** drop `auth_otps` and `app_sessions` from ADR-001 (superseded by Supabase Auth). **Keep `users`** but slim it to a `public.profiles` table keyed by `auth.users.id`; the **phone PII now lives in `auth.users` (Supabase-managed)** and the privacy wall holds (see Decision 3). `pseudo_id` moves to `profiles`.
4. **Add new tables:** `profiles`, `subscriptions`, `notification_tokens` (Decision 3/4) with RLS.
5. **MVP data is seeded/mock** (S2.5) — there is **no production user data to migrate**. This is a greenfield cutover, not a live migration. Low risk.

> Net: ADR-001's stack decision stands except its *auth sub-system* and its *DB hosting*, both now Supabase. ADR-002/003 are fully intact.

---

## Decision 1 — Auth: Supabase phone identity + **pluggable WhatsApp OTP** (F-C1, F-A2)

Supabase Auth supports **phone sign-in with a custom OTP delivery hook**. We use that: Supabase owns the identity, JWT, and OTP *verification*; we own the OTP *delivery channel* (WhatsApp-first, SMS fallback) behind an interface.

### Flow
```
1. App → request OTP for +965XXXXXXXX
2. Server generates 6-digit code, stores HASH+TTL (Supabase auth OR our otp record), and calls OtpSender.send()
3. OtpSender: try WhatsApp template → on fail/timeout → SMS fallback (dev: stub logs fixed code 000000)
4. App → verify(phone, code) → Supabase verifies → returns { access_jwt, refresh_token }
5. Biometric opt-in (F-A2): after first successful verify, app stores ONLY the refresh_token in the
   device secure enclave (Expo SecureStore / iOS Keychain / Android Keystore). Subsequent app opens:
   Face/Touch ID unlocks SecureStore → refresh_token → new access_jwt. No OTP re-prompt, no password.
```

### `OtpSender` interface (FROZEN — mockable offline)
```ts
interface OtpSender {
  // returns provider message id; throws on hard failure so caller can fall back
  send(input: {
    phoneE164: string;        // +965…
    code: string;             // plaintext code to deliver (never logged)
    locale: 'ar' | 'en';
    channel: 'whatsapp' | 'sms';
  }): Promise<{ messageId: string; channel: 'whatsapp' | 'sms' }>;
  health(): Promise<{ ok: boolean }>;
}

// Selection by env: OTP_PROVIDER = 'mock' | 'meta_whatsapp' | 'twilio' | '360dialog'
// MockOtpSender: logs "DEV OTP for +965… = <code>", returns fixed messageId, never calls network.
//   In dev, verify also accepts the universal code OTP_DEV_CODE (default 000000).
// Real impls: send a pre-approved WhatsApp template; on throw, orchestrator retries via channel:'sms'.
```
**WhatsApp provider choice:** lead with **Meta WhatsApp Cloud API** (lowest per-message cost, direct) for the live impl; **Twilio** as the drop-in alt (simplest SMS fallback in the same SDK). Either satisfies the interface — the decision is deferred to the spike/owner-account step; the *interface* is what's frozen now. WhatsApp **authentication-template** messages are required (free-form session messages won't deliver OTP reliably).

### Security
- OTP: 6 digits, **hashed at rest**, **5-min TTL**, **attempt-locked** (≤5 tries), per-phone request rate-limit (Redis bucket / Supabase rate-limit). Plaintext code never logged.
- Access JWT short-lived (~1h), refresh rotating. Refresh token on device lives **only** in SecureStore, gated by biometric when F-A2 enabled.
- NestJS verifies the Supabase JWT via **JWKS** (`SUPABASE_JWT_*`); extracts `sub` (auth user id) → maps to `profiles.pseudo_id` for all downstream/events.

---

## Decision 2 — Profile + Storage + RLS (F-A1/A3)

### Schema (new `public` tables; phone PII NOT here — see privacy wall)
```sql
-- profiles: 1:1 with Supabase auth.users. NO phone here (phone PII stays in auth.users).
profiles (
  id            uuid PK REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo_id     uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),  -- ONLY id that enters events
  display_name  text,
  email         text,              -- optional; change → re-verify (F-A1 note)
  email_verified boolean DEFAULT false,
  avatar_url    text,              -- points into Storage avatars bucket
  locale_pref   text DEFAULT 'ar', -- 'ar' | 'en'
  notif_enabled boolean DEFAULT true,        -- F-A3 master toggle
  notif_prefs   jsonb DEFAULT '{}'::jsonb,   -- per-channel: {price_drop:true, ...}
  biometric_enabled boolean DEFAULT false,   -- F-A2 (informational; secret is device-side)
  created_at    timestamptz DEFAULT now()
)

notification_tokens (              -- push tokens (Expo/FCM/APNs); F-A3
  id         uuid PK DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token text NOT NULL,
  platform   text,                 -- ios | android
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, expo_token)
)
```

### Storage
- Bucket **`avatars`**, private. Path convention **`{auth_user_id}/avatar.<ext>`**. Client uploads via supabase-js; `avatar_url` stores the path; UI renders via a signed URL (or public-read if owner-prefixed policy). Max ~2MB, image MIME only (enforced by Storage policy).

### RLS (FROZEN policy intent — users touch only their own rows)
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- profiles: owner can select/update own row; insert handled by trigger on auth.users create
CREATE POLICY profiles_self ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- notification_tokens / subscriptions: owner-scoped read; writes from server (service role) bypass RLS
CREATE POLICY notif_self_select ON notification_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sub_self_select   ON subscriptions      FOR SELECT USING (auth.uid() = user_id);

-- Storage: avatars policy → object name must be prefixed with the caller's uid
--   USING ( bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text )
```
- **subscription writes are server-only** (Stripe webhook → service role) — clients can READ their status but never WRITE it. Same for metering. This is the security crux of the paywall.
- NestJS uses the **service-role key** → bypasses RLS for trusted server operations (it already authorizes the request via JWT).

---

## Decision 3 — Privacy wall under Supabase (carry-over from system-design)

- **Phone (PII) lives only in `auth.users.phone` (Supabase-managed)** — never copied into `profiles`, never into `events`. This *strengthens* the wall: PII sits in the auth schema, isolated from our `public` product tables.
- **`pseudo_id` (on `profiles`) is the only identifier that crosses into `events`** — unchanged from system-design. NestJS resolves `auth.uid → pseudo_id` once per request and uses pseudo_id everywhere downstream.
- Stripe `customer_id` is NOT PII-by-phone; it lives in `subscriptions` (server-only) and never enters `events`. Webhook payloads are not logged to `events`.

---

## Decision 4 — Stripe billing $1/mo (F-D1), webhook-driven, mockable

### Schema
```sql
subscriptions (
  user_id              uuid PK REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id   text UNIQUE,
  stripe_subscription_id text UNIQUE,
  status               text NOT NULL DEFAULT 'none',   -- none|active|trialing|past_due|canceled
  current_period_end   timestamptz,
  updated_at           timestamptz DEFAULT now()
)
```

### Flow (webhook is the source of truth — never trust the client)
```
1. Paywall hit → app asks NestJS POST /billing/checkout
2. NestJS (BillingProvider) creates/looks-up Stripe Customer (keyed by user_id) + Checkout Session
   for the $1/mo price → returns checkout URL (Stripe-hosted; PCI offloaded)
3. User pays in Stripe-hosted page → returns to app deep link
4. Stripe → POST /billing/webhook (signature-verified). NestJS updates subscriptions.status.
   Status from the WEBHOOK is authoritative; the app polls/realtimes its own subscriptions row.
```

### Webhook events handled (minimal set, YAGNI)
| Event | Action |
|---|---|
| `checkout.session.completed` | link `stripe_customer_id` + `stripe_subscription_id` to user_id |
| `customer.subscription.updated` | set status (`active`/`past_due`/`trialing`) + `current_period_end` |
| `customer.subscription.deleted` | status → `canceled` |
| `invoice.payment_failed` | status → `past_due` (grace, still gated as non-premium until active) |

Premium = `status IN ('active','trialing')`. `past_due`/`canceled`/`none` → freemium gate applies.

### `BillingProvider` interface (FROZEN — mockable offline)
```ts
interface BillingProvider {
  getOrCreateCustomer(userId: string): Promise<{ customerId: string }>;
  createCheckoutSession(userId: string, customerId: string): Promise<{ url: string }>;
  // verifies signature, returns a normalized status change for our subscriptions table
  handleWebhook(rawBody: Buffer, signature: string):
    Promise<{ userId: string; status: SubStatus; currentPeriodEnd?: Date } | null>;
  isPremium(userId: string): Promise<boolean>;  // reads subscriptions.status
}

// BILLING_PROVIDER = 'mock' | 'stripe'
// MockBillingProvider: createCheckoutSession returns a dev URL that, when "confirmed", flips the
//   user's subscriptions.status to 'active' locally. BILLING_DEV_GRANT=true → isPremium() always true
//   (test premium paths); =false → always freemium (test the paywall). No Stripe network calls.
```

### Currency (KWD vs USD)
- **Charge in USD** ($1.00) via Stripe — Stripe does not settle KWD, and $1 is the product price point.
- **Display:** show "$1.00 / month" with a KWD approximation ("≈ X.XXX KWD") computed for *display only* (static/periodic FX, not live conversion at charge). Never imply a KWD charge. This is a UI/i18n note for the FE; billing math stays USD.

---

## Decision 5 — Freemium gate: 5 free searches (F-D2)

**Counter lives server-side in NestJS, on the search request path, keyed by `user_id` (not pseudo_id — enforcement needs the real account; the *event* still logs pseudo_id only).** It is NOT client-side (trivially bypassable) and NOT in `events` (events are anonymized/append-only analytics, wrong tool for a quota).

### Schema (server-only, RLS read-self)
```sql
search_quota (
  user_id     uuid PK REFERENCES auth.users(id) ON DELETE CASCADE,
  used_count  int NOT NULL DEFAULT 0,
  -- reset rule TBD by PO: lifetime (no reset) vs monthly. Default = LIFETIME 5 for MVP (simplest).
  updated_at  timestamptz DEFAULT now()
)
```

### Enforcement point (in the search flow, ADR-002/003)
- A search "counts" at **`/search/intent` when a real result-producing search executes** (i.e., the clarifier loop resolves and `resolveOffers` is about to run) — NOT on every clarifier turn, NOT on empty/aborted intents. One user-perceived search = one decrement of free quota.
- Order of checks at that enforcement point:
  ```
  if BillingProvider.isPremium(userId): proceed (unlimited)        // subscribers bypass
  else:
    atomically: UPDATE search_quota SET used_count = used_count + 1
                WHERE user_id=$1 AND used_count < 5 RETURNING used_count;
    if no row updated (already ≥5): return 402 PAYWALL  → app shows Stripe paywall
    else: proceed
  ```
- **Atomic increment** via the single conditional `UPDATE … WHERE used_count < 5 RETURNING` (no read-then-write race; DB enforces the cap). Optional Redis fast-path counter, but Postgres is the source of truth.
- **Premium check is first and authoritative** → subscribed users never touch the counter.
- `events.search_executed` is still emitted (pseudo_id) for analytics — independent of the quota.

---

## Decision 6 — Config & secrets (every env var; app RUNS with none of the real ones)

> **Dev/mock mode is the default.** With `OTP_PROVIDER=mock`, `BILLING_PROVIDER=mock`, and Supabase pointed at a **local Supabase (`supabase start`) or the seeded dev project**, the app runs end-to-end with **zero real third-party keys**. Real keys are opt-in per provider.

```bash
# ── Supabase (identity + DB + storage) ──
SUPABASE_URL=                      # https://<ref>.supabase.co   (local: http://localhost:54321)
SUPABASE_ANON_KEY=                 # client (Expo) — safe to ship, RLS-guarded
SUPABASE_SERVICE_ROLE_KEY=         # NestJS server only — bypasses RLS — NEVER ship to client
SUPABASE_JWT_ISSUER=               # for NestJS JWKS verification of Supabase access tokens
SUPABASE_JWKS_URL=                 # <SUPABASE_URL>/auth/v1/.well-known/jwks.json
DATABASE_URL=                      # pooled (Supavisor/PgBouncer) Postgres conn for NestJS

# ── WhatsApp / SMS OTP (pluggable; mock needs none) ──
OTP_PROVIDER=mock                  # mock | meta_whatsapp | twilio | 360dialog
OTP_DEV_CODE=000000                # dev-only universal verify code (mock mode)
# meta_whatsapp:
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_OTP_TEMPLATE_NAME=        # pre-approved authentication template
# twilio (also the SMS fallback for Meta path):
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_SMS_FROM=

# ── Stripe billing (mock needs none) ──
BILLING_PROVIDER=mock              # mock | stripe
BILLING_DEV_GRANT=false            # mock only: true→always premium, false→always freemium
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=            # client (Expo) checkout
STRIPE_WEBHOOK_SECRET=             # verify webhook signatures
STRIPE_PRICE_ID=                   # the $1/month recurring price
```

---

## Build slices (for Dev Lead) — frozen contracts, sequenced to minimize conflict

> All four are additive to the running mock app. **Slice A is the prerequisite** (everyone needs profiles + JWT verify); B/C/D then parallelize cleanly (different tables, different interfaces).

### Slice A — Supabase + profile + RLS (foundation; do FIRST)
- Provision Supabase; run ADR-001/003 migrations into `public`; add `profiles`, `notification_tokens`, RLS, `avatars` bucket policy; auto-insert `profiles` row on `auth.users` create (trigger).
- NestJS: point `DATABASE_URL` at Supabase pooled conn; add **JWT (JWKS) verification middleware** → resolves `auth.uid → profiles.pseudo_id`; **delete hand-rolled `auth_otps`/`app_sessions`**.
- **Contract:** `GET /me`, `PATCH /me {display_name,email,locale_pref,notif_enabled,notif_prefs,biometric_enabled}`; avatar upload direct via supabase-js + `PATCH /me {avatar_url}`. Every authed request carries Supabase access JWT.

### Slice B — WhatsApp OTP auth (mockable) — parallel after A
- Implement `OtpSender` (mock default) + Supabase phone sign-in wiring + SMS fallback orchestration + biometric refresh-token-in-SecureStore on the Expo side.
- **Contract:** `POST /auth/otp/request {phoneE164,locale}` → `{sent:true, channel}`; verify via supabase-js `verifyOtp` (or `POST /auth/otp/verify`) → `{access, refresh, pseudo_id, locale_pref}`. Mock: code = `OTP_DEV_CODE`.

### Slice C — Stripe subscription (mockable) — parallel after A
- Implement `BillingProvider` (mock default) + `subscriptions` table + `/billing/checkout` + signature-verified `/billing/webhook` + status read.
- **Contract:** `POST /billing/checkout` → `{url}`; `POST /billing/webhook` (raw body); `GET /billing/status` → `{status, premium:boolean, current_period_end?}`. App may also read its `subscriptions` row directly via RLS/Realtime.

### Slice D — Freemium gate — depends on C's `isPremium` + A's profiles (do after C interface frozen)
- `search_quota` table + atomic conditional UPDATE + enforcement hook in `/search/intent` (premium-bypass first).
- **Contract:** search endpoints return `402 {error:'PAYWALL', used:5, limit:5}` when over quota; app routes to Slice-C checkout. `GET /me/quota` → `{used, limit, premium}`.

**Sequence:** A → (B ∥ C) → D. A touches DB/auth foundation (serialize it). B (auth tables/iface) and C (`subscriptions`/iface) never collide. D consumes C's `isPremium` and the search path (owned by the search dev) — land C's interface first, then wire D's one-line gate.

---

## Non-functional notes
- **Cost (monthly):** Supabase Free → Pro **$25/mo** at launch (connection caps, no-pause, daily backups). Stripe **2.9%+30¢/txn** → on $1 that's ~$0.33/sub (~33% — acceptable at this price point; bundling/annual later if it matters). WhatsApp auth-template: **Meta ~$0.01–0.04/conversation** (KW region) or Twilio markup; OTP volume = sign-ins only, low. SMS fallback only when WhatsApp fails. Net adds < ~$30/mo fixed + tiny per-OTP — within the < $150/mo MVP envelope (ADR-001).
- **Security/privacy:** phone PII isolated in `auth.users`; only `pseudo_id` in `events`; subscription/quota writes server-only (RLS read-self, never client-write); service-role key server-only; OTP hashed+TTL+locked, plaintext never logged; refresh token only in device secure enclave under biometric; Stripe checkout/webhook = no card data touches us (PCI offloaded); webhook signature-verified.
- **Scalability:** identity/auth/storage offloaded to Supabase managed infra; metering is a single indexed-PK atomic UPDATE; the AI plane (the only heavy path) is unchanged from ADR-003.

---

## Consequences
- ADR-001 **amended**: DB hosting = Supabase managed Postgres; hand-rolled OTP/session auth **superseded** by Supabase Auth (`auth_otps`/`app_sessions` removed). ADR-002/003 **unchanged**.
- New tables: `profiles`, `notification_tokens`, `subscriptions`, `search_quota` (+ RLS, `avatars` bucket). `users` table collapses into `profiles` (phone moves to `auth.users`).
- Three external integrations, all behind mockable interfaces (`OtpSender`, `BillingProvider`, Supabase via local/dev project) → **CI and dev run with no real keys**.
- New ToS/cost items for the PO (WhatsApp Business, Stripe, Supabase Pro accounts).

---

## Handoff
- **Done:** ADR-004 — split-plane decision (Supabase = identity+DB+storage+RLS; NestJS = product/AI plane, ADR-003 intact); schemas for profiles/notification_tokens/subscriptions/search_quota; RLS intent; WhatsApp OTP design + `OtpSender` iface; biometric = device-side refresh token; Stripe webhook-driven billing + `BillingProvider` iface + KWD/USD note; server-side atomic freemium gate + enforcement point; full env-var list; mock-mode default; 4 build slices with frozen contracts; `.env.example` updated; memory updated.
- **Next (Dev Lead):** Build **Slice A first** (Supabase provision + migrations into `public` + profiles/RLS + JWKS verify + drop old auth), then **B ∥ C**, then **D**. Default `OTP_PROVIDER=mock`, `BILLING_PROVIDER=mock` so the app runs offline. BA to write full AC per F-* story against these contracts.
- **Owner (PO) — external accounts/keys to create (cost):**
  1. **Supabase** project → Pro tier ~**$25/mo** at launch (free for dev). Provides URL + anon + service-role + JWT keys.
  2. **WhatsApp Business** — Meta Cloud API (Business verification + a pre-approved **authentication template**) *or* Twilio. ~**$0.01–0.04 per OTP conversation**; SMS fallback per-message. Owner picks Meta-direct (cheaper) vs Twilio (simpler).
  3. **Stripe** account → one **$1/month recurring price** (USD); secret + publishable + webhook secret + price id. Fee ~**2.9%+30¢/txn** (~$0.33 on $1).
  - None of these block development — all three run mocked until keys exist.
- **Owner/PO — decisions still needed:** (a) WhatsApp provider Meta vs Twilio; (b) freemium reset rule — **lifetime 5** (default, simplest) vs monthly; (c) KWD-display approximation source (static FX vs periodic).
- **Blockers/risks:** WhatsApp authentication-template approval can take days (Meta) — start early; SMS fallback de-risks launch. Stripe fee % is high relative to $1 price (flagged, accept for MVP). Supabase free-tier pause/conn-caps → Pro before launch + pooled connection. ADR-003 live-fetch ToS gate is unaffected by this ADR.
```
