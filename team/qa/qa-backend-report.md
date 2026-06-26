# QA Backend Report — BestOffers Phase 2a (Mock Mode)

> Author: bo-qa-backend · Date: 2026-06-26
> Scope: F-A1/A2/A3, F-B1, F-C1, F-D1, F-D2 — backend only; mock mode (offline, zero real keys).
> Oracle: `team/analysis/feature-acceptance-criteria.md` + `team/architecture/ADR-004-accounts-billing-supabase.md`.
> Test runner: `npm test` in `apps/api` (jest --runInBand).

---

## 1. Test Suite Results (Raw)

```
Test Suites: 11 passed, 11 total
Tests:       60 passed, 60 total
Snapshots:   0 total
Time:        1.287 s
```

All 60 tests pass with zero failures, zero skips. No snapshot regressions.

---

## 2. Pass / Fail Table per AC Area

| AC Area | Key ACs Covered | Test File(s) | Verdict | Notes |
|---|---|---|---|---|
| **F-D2 — Freemium gate: 5 free, 6th = 402** | AC-1 (value-delivery moment), AC-4 (5 allowed), AC-5 (6th → PAYWALL/402), AC-6 (never reset), AC-7 (premium bypass) | `quota.spec.ts`, `accounts.e2e.spec.ts` | PASS | See D2-1 below for one gap |
| **F-D2 — Race safety (no 6th slips through)** | AC-3 (atomic increment, no double-count) | `quota.spec.ts` (25 concurrent at 4/5) | PASS | SQLite serial write + conditional UPDATE WHERE < 5; Postgres will be the same or stronger |
| **F-D2 — Premium bypass (counter untouched)** | AC-7 | `quota.spec.ts`, `accounts.e2e.spec.ts` | PASS | counter stays at 5 after 3 post-subscribe searches |
| **F-D2 — Counting moment** | AC-1 (after clarifiers resolve, before results; NOT on clarifying turns) | `search.service.ts` (code review), `accounts.e2e.spec.ts` (5-search loop includes clarifiers) | PASS | `quotaConsumed` flag on session makes refinements/duplicate submits of same session free |
| **F-D1 — Webhook-driven status: active** | AC-5, AC-6 | `billing.spec.ts` | PASS | `checkout.session.completed` → active → premium |
| **F-D1 — Webhook-driven status: past_due** | AC-9 | `billing.spec.ts` | PASS | `invoice.payment_failed` → past_due → NOT premium |
| **F-D1 — Webhook-driven status: canceled** | AC-7 | `billing.spec.ts` | PASS | `customer.subscription.deleted` → canceled → NOT premium |
| **F-D1 — Trialing = premium** | AC-4 | `billing.spec.ts` | PASS | `trialing` treated as active for bypass |
| **F-D1 — Unactionable events ignored** | AC-5 | `billing.spec.ts` | PASS | unknown event type returns `{applied:false}`, no status change |
| **F-D1 — Checkout returns URL (no Stripe call in mock)** | AC-1 | `billing.spec.ts`, `accounts.e2e.spec.ts` | PASS | `mock-checkout://confirm?user=…` URL returned |
| **F-D1 — canceled-within-period bypass** | AC-7 ("access continues until end of paid period") | Code review: `isPremium()` checks `status IN (active,trialing)` ONLY | **DEFECT D1-1** | See defect table below |
| **F-D1 — incomplete/incomplete_expired status** | AC-4 | Not in SubStatus type or DB CHECK constraint | DEFECT D1-2 | See defect table below |
| **F-C1 — OTP expiry (5 min)** | AC-4 | `auth.spec.ts` | PASS | code_hash stored, force-expire via DB, rejected |
| **F-C1 — Attempt lock (5 wrong → locked)** | AC-7 | `auth.spec.ts` | PASS | 6th attempt rejected even with correct code |
| **F-C1 — Rate limit (5 req/hr/phone)** | AC-6 | `auth.spec.ts` | PASS | 429 thrown on 6th request within window |
| **F-C1 — Resend cooldown (30 s)** | AC-5 | `auth.spec.ts` (constant check), code review | PASS | 429 on re-request within 30 s |
| **F-C1 — Resend invalidates prior code** | AC-5 | `auth.service.ts` (consumed_at update) | PASS | old code consumed before new code inserted |
| **F-C1 — Refresh token rotation** | (F-A2 dependency) | `auth.spec.ts` | PASS | old refresh revoked, new issued; reuse → 401 |
| **F-C1 — No plaintext code stored** | AC-12 | `auth.spec.ts` | PASS | DB row has 64-char SHA-256 hex, not 6-digit code |
| **F-C1 — SMS fallback path** | AC-8 | Code review (`deliver()` catches throw, retries with `channel:'sms'`) | PASS (code-only) | Not tested with a throwing sender; MockOtpSender never throws |
| **F-C1 — Invalid phone format rejected** | AC-1 | `auth.spec.ts` | PASS | E164 regex enforced |
| **F-A1/F-B1 — Profile ownership (no cross-user read/write)** | F-B1 AC-4 | `profile.spec.ts` (alice/bob isolation) | PASS | SQL always scoped to `WHERE id = <callerId>` from JWT |
| **F-A1/F-B1 — Avatar path ownership** | F-B1 AC-5 | `profile.spec.ts` | PASS | path must be prefixed with caller's userId |
| **F-A1 — Name validation** | AC-2 | `profile.spec.ts` | PASS | Arabic, Latin, 1–60 chars, trim; empty/long rejected |
| **F-A1 — Email validation + lowercasing** | AC-3 | `profile.spec.ts` | PASS | RFC-practical regex; stored lowercase+trimmed |
| **F-A1 — Email change → pending, not effective** | AC-4 | `profile.spec.ts` | PASS | `email` unchanged, `email_pending` set |
| **F-A1 — Email re-verify: expiry 24h** | AC-6 | `profile.spec.ts` | PASS | force-expire via DB, rejected with "expired" |
| **F-A1 — Clearing email cancels pending** | AC-3 edge | `profile.spec.ts` | PASS | null patch clears pending + token |
| **F-A1 — Email uniqueness across accounts** | AC-3 edge | `profile.spec.ts` | PASS | ConflictException, does not leak account |
| **F-A1 — Avatar MIME type enforcement** | AC-7 | `storage.interface.ts` (`assertAvatarUpload`) | PASS (code-only) | JPEG/PNG/WebP allowed; others throw; not covered by an automated test |
| **F-A1 — Avatar 5 MB size cap** | AC-7 | `storage.interface.ts` (`assertAvatarUpload`) | PASS (code-only) | Validated in `assertAvatarUpload`; not covered by an automated test |
| **F-A1 — Avatar remove GC** | AC-10 | `profile.spec.ts` + `profile.service.ts` | PASS | `storage.remove()` called on null avatarUrl patch |
| **F-A1 — Notif prefs + biometric flag persistence** | AC-11 | `profile.spec.ts` | PASS | JSON prefs round-trip; biometric flag saved |
| **F-B1 — Auth guard: 401 without token** | AC-1 | `accounts.e2e.spec.ts` | PASS | `GET /me` without Bearer → 401 |
| **F-B1 — No PII in events (phone, email, intentRaw)** | AC-7 | `events.spec.ts` | PASS | Forbidden keys dropped (top-level + 1 level nested); fire-and-forget |
| **F-B1 — pseudo_id only ID in events** | AC-7 | `events.spec.ts`, `search.service.ts` review | PASS | only `pseudoId` used in all `events.log()` calls |
| **F-B1 — phone PII isolated in auth_users** | AC-6 / privacy wall | `auth.spec.ts` (profiles table has no phone_e164 key) | PASS | SQL schema verified: profiles has no phone column |
| **F-B1 — RLS as DB policies** | AC-4 | NOT verifiable offline | MOCK ONLY | See explicit mock-only item below |
| **F-A3 — Notification prefs storage** | AC-5 | `profile.spec.ts` | PASS | notif_enabled + notif_prefs (JSONB) persisted |
| **F-A3 — Push token table** | AC-3 | Schema review (`notification_tokens`) | PASS (schema-only) | No controller/service test covers push-token register/update |
| **E2E — Full flow: sign-in → 5 searches → paywall → subscribe → unlimited** | All D2+C1+B1 | `accounts.e2e.spec.ts` | PASS | 4 E2E tests, real HTTP surface, mock providers |

---

## 3. Defect Table

| ID | Severity | Area | AC | Description | Repro | Expected | Actual |
|---|---|---|---|---|---|---|---|
| **D1-1** | **High** | F-D1 Billing / F-D2 gate | F-D1 AC-7 | **Canceled-within-period users are immediately gated, not bypassed until period end.** `isPremium()` in both `MockBillingProvider` and `StripeBillingProvider` returns `status === 'active' || status === 'trialing'` only. When Stripe sends `customer.subscription.deleted`, status is set to `canceled` immediately, and `isPremium()` returns false even if `current_period_end` is still in the future. | Call `handleWebhook('customer.subscription.deleted')` while `current_period_end = now + 15 days`; then call `isPremium()`. | `isPremium() = true` until `current_period_end` passes. | `isPremium() = false` immediately on cancel. |
| **D1-2** | **Medium** | F-D1 Billing | F-D1 AC-4 | **`incomplete` and `incomplete_expired` Stripe subscription states not tracked.** AC-4 lists these as observable states; they are absent from `SubStatus` type and the DB CHECK constraint. An `invoice.payment_succeeded` webhook is also unhandled (AC lists it). | Stripe emits `incomplete` on first-payment pending. | Status updates to `incomplete`; app shows correct state. | Webhook not handled; status stays `none`. |
| **D2-1** | **Medium** | F-D2 Freemium | F-D2 AC-8 | **Lapsed premium (paid period ends) reverts to free gate, but `current_period_end` expiry is not enforced server-side.** The `isPremium()` check reads `status` from DB only (written by webhook). If Stripe sends `customer.subscription.updated` (status=canceled) at the correct time, this works. But if the webhook is delayed or missed, the status stays `active` in our DB and the user gets free access indefinitely. No server-side time-check of `current_period_end` as a defense. | Set `status=active`, `current_period_end = past date`, no webhook arrives. | `isPremium() = false` (period expired). | `isPremium() = true` (webhook-only, no TTL guard). |
| **D2-2** | **Low** | F-D2 / Search | F-D2 AC-9 | **Anonymous (no Bearer token) search requests bypass the freemium gate entirely.** The search controller treats missing/invalid JWT as anonymous and sets `userId = undefined`. `SearchService.runSearch` only calls `quota.tryConsume` when `session.userId` is set. This matches the AC recommendation ("search requires sign-in"), but AC-9 has an open `[Q-PO]` placeholder. If anonymous search is ever enabled, there is no meter. | POST `/search/intent` without Authorization header. | Metered against device/anonymous quota (per AC-9 recommendation). | Gate skipped entirely (zero friction for anonymous). |
| **D-MISS-1** | **Low** | F-C1 OTP | F-C1 AC-8 | **SMS fallback path is not exercised by an automated test.** `MockOtpSender.send()` never throws; the catch-and-retry-via-SMS path in `AuthService.deliver()` is dead code in tests. | Inject a WhatsApp sender that always throws; verify fallback to SMS. | Test exists and passes. | No test for this branch. |
| **D-MISS-2** | **Low** | F-A1 Avatar | F-A1 AC-7/8/9 | **Avatar MIME-type and size enforcement (`assertAvatarUpload`) is not covered by an automated test.** The function exists and is correct; it is not exercised in any spec file. | POST `/me/avatar` with `contentType: 'image/gif'` or `base64` > 5 MB. | 400 Bad Request. | Unverified in CI (no test). |

---

## 4. Mock-Only / Offline Limitations (Explicit)

The following items are architecturally correct in mock mode but **cannot be fully verified offline**:

| Item | Why Unverifiable Offline | What Is Needed |
|---|---|---|
| **Real Stripe webhook signatures** | `MockBillingProvider.handleWebhook()` accepts any body; real Stripe signs with HMAC-SHA256 using `STRIPE_WEBHOOK_SECRET`. The verification line exists in `StripeBillingProvider` but cannot be hit without a real secret. | Live Stripe account + CLI (`stripe listen`); test with `stripe trigger`. |
| **Real WhatsApp / SMS delivery** | `MockOtpSender` logs the code to console; it never calls Meta or Twilio. The `WhatsAppOtpSender` and `TwilioOtpSender` are config-ready but not exercised. | Real WhatsApp Business API keys + approved template; or Twilio trial account. |
| **Supabase RLS policies** | The server-code ownership check (SQL scoped by `WHERE id=?`) is verified. But the ADR-004 RLS SQL policies (Postgres `ENABLE ROW LEVEL SECURITY`, `profiles_self`, `sub_self_select`, Storage bucket policy) only exist in the migration DDL comment and ADR spec — they are not applied to the SQLite dev DB and have no automated test. A mobile client with the anon key bypassing NestJS could, in theory, query Supabase directly. | Supabase local (`supabase start`) with RLS applied; an automated cross-user denial test via the Supabase JS client (as recommended in F-B1 AC-4). |
| **Supabase Storage bucket policy** | The `avatars` bucket owner-prefix policy is documented in ADR-004 Decision 2 but not provisioned in any migration file we can run offline. | `supabase start` + bucket policy via Supabase dashboard or migration; integration test. |
| **`canceled`-within-period bypass (D1-1)** | Needs Stripe time-based events or a server clock-check against `current_period_end`. | Fix (see D1-1); then verify with real Stripe or with a mock that sets a future `current_period_end`. |
| **HEIC / animated image rejection** | AC-7 edge case; `assertAvatarUpload` checks MIME type only; a client could label a HEIC as `image/jpeg`. | Client-side or magic-byte validation (file signature check); out of scope for backend unit test scope here. |
| **Multi-device session concurrency** | Two simultaneous sessions from different devices. `auth_sessions` supports multiple rows per user; behavior is correct per schema; not tested with a multi-client scenario. | Integration test with two parallel auth flows. |
| **Stripe customer uniqueness constraint** | `subscriptions.stripe_customer_id TEXT UNIQUE` prevents duplicate customers at DB level. The code-path that would create a duplicate (race on `getOrCreateCustomer`) is not tested. | Concurrent checkout test or Stripe API mock. |

---

## 5. Release-Readiness Call — Backend in Mock Mode

**Verdict: CONDITIONAL PASS for mock-mode release gating (dev/demo). NOT ready for production without fixing D1-1 and verifying Supabase RLS.**

| Gate | Status |
|---|---|
| All 60 automated tests pass | PASS |
| Core freemium invariant: 5 free searches, race-safe, no 6th slip | PASS |
| Premium bypass (active/trialing): counter untouched | PASS |
| OTP security: expiry, attempt-lock, rate-limit, no plaintext, rotation | PASS |
| Profile ownership: no cross-user read/write (server-code enforcement) | PASS |
| Webhook-driven subscription status (mock transitions) | PASS |
| Privacy / no-PII in events, phone isolated | PASS |
| Canceled-within-period bypass | **FAIL — D1-1** |
| Supabase RLS policies enforced at DB layer | **UNVERIFIABLE OFFLINE** |
| SMS fallback automated test | **MISSING — D-MISS-1** |
| Avatar upload type/size automated test | **MISSING — D-MISS-2** |
| `incomplete`/`incomplete_expired` Stripe states | **NOT IMPLEMENTED — D1-2** |

The backend slices (A–D) deliver a coherent, secure, offline-runnable implementation. The freemium gate is the highest-risk invariant and is correctly implemented with atomic DB enforcement and race coverage. The two critical items before any live-key deployment are D1-1 (canceled-within-period logic) and a mandatory Supabase RLS integration test.

---

## 6. Files Audited

- `/apps/api/src/quota/quota.service.ts` + `quota.spec.ts`
- `/apps/api/src/auth/auth.service.ts` + `auth.spec.ts` + `auth.guard.ts` + `jwt.service.ts` + `otp-sender.interface.ts`
- `/apps/api/src/billing/billing.service.ts` + `billing.spec.ts` + `mock-billing-provider.ts` + `stripe-billing-provider.ts` + `billing-provider.interface.ts`
- `/apps/api/src/accounts/profile.service.ts` + `profile.spec.ts` + `accounts.controller.ts` + `accounts.e2e.spec.ts` + `storage.interface.ts`
- `/apps/api/src/events/events.service.ts` + `events.spec.ts`
- `/apps/api/src/search/search.service.ts` + `search.e2e.spec.ts` + `clarifier-bound.spec.ts` + `paywall.exception.ts` + `session.store.ts`
- `/apps/api/src/db/migrations/0002_accounts_billing.sql` + `test-db.ts`
- `/packages/shared/src/accounts.ts` + `events.ts`
- `team/analysis/feature-acceptance-criteria.md`
- `team/architecture/ADR-004-accounts-billing-supabase.md`
