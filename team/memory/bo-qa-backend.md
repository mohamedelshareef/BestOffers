# Memory — QA Engineer — Backend (bo-qa-backend)

> Persistent memory for the BestOffers QA Engineer — Backend.
> READ at task start. UPDATE at task end with durable facts only (decisions, current state, open items, handoffs).
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state (2026-06-26)

Phase 2a backend (F-A1/A2/A3, F-B1, F-C1, F-D1, F-D2) is built in mock mode.
Full QA run completed. Report: `team/qa/qa-backend-report.md`.

Test suite: 11 suites / 60 tests — ALL PASS (1.3 s, --runInBand, offline).

## API Coverage Map

| Endpoint | Covered By | Status |
|---|---|---|
| POST /auth/otp/request | auth.spec.ts, accounts.e2e.spec.ts | PASS |
| POST /auth/otp/verify | auth.spec.ts, accounts.e2e.spec.ts | PASS |
| POST /auth/refresh | auth.spec.ts | PASS |
| GET /me | accounts.e2e.spec.ts | PASS |
| PATCH /me | profile.spec.ts | PASS |
| POST /me/avatar | storage.interface (code-only); no automated test | GAP |
| POST /me/email-verify | profile.spec.ts | PASS |
| GET /me/quota | accounts.e2e.spec.ts | PASS |
| POST /billing/checkout | billing.spec.ts, accounts.e2e.spec.ts | PASS |
| POST /billing/webhook | billing.spec.ts, accounts.e2e.spec.ts | PASS |
| GET /billing/status | billing.spec.ts, accounts.e2e.spec.ts | PASS |
| POST /search/intent | search.e2e.spec.ts, accounts.e2e.spec.ts | PASS |
| POST /search/answer | search.e2e.spec.ts, clarifier-bound.spec.ts | PASS |
| GET /health | search.e2e.spec.ts | PASS |

## Known Backend Defects + Status

| ID | Severity | Area | Status | Summary |
|---|---|---|---|---|
| D1-1 | HIGH | Billing / F-D1 AC-7 | OPEN | canceled-within-period users immediately lose premium; `isPremium()` ignores `current_period_end`. Fix: add `(status='canceled' AND current_period_end > now)` to isPremium logic. |
| D1-2 | MEDIUM | Billing / F-D1 AC-4 | OPEN | `incomplete`/`incomplete_expired` Stripe states and `invoice.payment_succeeded` event not handled. |
| D2-1 | MEDIUM | Freemium / F-D2 AC-8 | OPEN | No server-side TTL guard on `current_period_end`; lapsed premium relies entirely on Stripe webhook delivery. |
| D2-2 | LOW | Freemium / F-D2 AC-9 | OPEN/DESIGN | Anonymous search bypasses gate; AC-9 has open [Q-PO]; acceptable until PO decides. |
| D-MISS-1 | LOW | OTP / F-C1 AC-8 | OPEN | SMS fallback code path not covered by any automated test. |
| D-MISS-2 | LOW | F-A1 AC-7/8 | OPEN | Avatar MIME/size enforcement not covered by automated test. |

## Performance / Security Notes

- Freemium atomic gate: single conditional `UPDATE … WHERE used_count < 5 RETURNING` — race-safe in both SQLite (serial write) and Postgres (row-level UPDATE). 25-concurrent proof test passes.
- JWT: HS256, dev secret; swap to JWKS in prod (Supabase Auth issues tokens, NestJS verifies via JWKS).
- OTP code: SHA-256 hashed at rest, 5-min TTL, attempt-locked after 5 tries, 5-req/hr rate limit, 30 s resend cooldown. Plaintext never persisted or logged.
- Refresh tokens: 64-char random hex, hashed in DB, 30-day TTL, rotation on use (old revoked).
- Billing: webhook is the only writer of subscriptions.status; clients cannot write their own status. Stripe signature verification in StripeBillingProvider (live path).
- Privacy: phone PII only in `auth_users`; only `pseudo_id` in events; forbidden PII keys dropped at sink.

## Unverifiable Offline (Require Live Keys / Supabase)

- Real Stripe webhook signatures (HMAC-SHA256)
- WhatsApp / SMS actual delivery
- Supabase RLS policies applied at DB layer (mandatory cross-user denial test in CI — F-B1 AC-4)
- Supabase Storage bucket owner-prefix policy
- canceled-within-period premium (D1-1 fix + period-end server check)

## Key Decisions Observed

- Freemium counter = lifetime, never resets (search_quota.used_count, no reset field).
- premium = `status IN ('active','trialing')` — past_due/canceled/none = freemium (correct per ADR-004).
- Enforcement point: `runSearch()`, after clarifiers resolve, guarded by `session.quotaConsumed` flag for idempotency.
- Anonymous search (no JWT) = unmetered (Q-PO open).

## Open Questions / Handoffs

- D1-1 fix for dev lead: `isPremium()` must check `(status='canceled' AND current_period_end > now())` too.
- Supabase RLS integration test must be added before live-key deployment (F-B1 AC-4).
- PO must ratify AC-9 anonymous search behavior.
- D1-2: Stripe `incomplete` states and `invoice.payment_succeeded` need implementation if Stripe's first-payment flow is used.
