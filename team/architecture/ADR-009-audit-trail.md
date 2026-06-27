# ADR-009 — Audit Trail (every API call recorded to DB)

> Status: ACCEPTED (owner directive). Date: 2026-06-27. Author: bo-tech-architect.
> Supersedes nothing. Reuses: ADR-001 (NestJS + Db port), events fire-and-forget pipeline,
> privacy wall (ADR-004: phone PII never leaves `auth.users`; only `pseudo_id` crosses into analytics).

## Context
Owner directive: record **every** API call in a DB table for audit + analytics. We already have an
**anonymized, fire-and-forget** event sink (`events/events.service.ts`) that is opt-in per call site.
The audit trail is different: it must be **automatic and total** (every HTTP request, no per-controller
opt-in), include request/response **metadata** (status, latency, route, errors), and feed search analytics
(sector + query). It must never slow or break a request, and must obey the privacy wall.

Two recording layers already exist and stay distinct:
- **`events`** = anonymized *product* analytics, opt-in via `logEvent(type,payload)`, bucketed payloads.
- **`audit_trail` (NEW)** = total *operational* record of every HTTP request, auto-captured globally.

We deliberately keep them separate (different cardinality, retention, query patterns, and consumers).

---

## Decision 1 — `audit_trail` table

Append-only operational log. One row per inbound HTTP request (recorded once, on response/error).
Money/PII rules below are **enforced in the recorder, not trusted from callers**.

### Column spec (engine-neutral)

| Column            | SQLite type | Postgres type | Notes |
|-------------------|-------------|---------------|-------|
| `id`              | TEXT PK     | uuid PK DEFAULT gen_random_uuid() | request-scoped uuid (== `request_id`) |
| `ts`              | TEXT (ISO)  | timestamptz DEFAULT now() | request start time |
| `method`          | TEXT        | text | GET/POST/… |
| `path`            | TEXT        | text | concrete URL path, query string STRIPPED (PII) |
| `route`           | TEXT        | text | matched route template, e.g. `/search/intent`, `/offers/:id` — low-cardinality, the analytics key |
| `status_code`     | INTEGER     | int  | HTTP status (5xx/4xx from exception filter too) |
| `duration_ms`     | INTEGER     | int  | wall-clock handler time |
| `actor`           | TEXT        | text | `pseudo_id` if authed, else `'anon'`. NEVER phone/email/user_id-from-phone |
| `ip_hash`         | TEXT        | text | salted SHA-256 of client IP (`HMAC(ip, AUDIT_IP_SALT)`), NOT raw IP. NULL if disabled |
| `user_agent`      | TEXT        | text | UA string, truncated 256 chars |
| `sector`          | TEXT        | text | search analytics: `electronics`/`food`/`realestate`/NULL |
| `query`           | TEXT        | text | NORMALIZED search query for `/search/*` only, truncated 200 chars, PII-scrubbed; NULL elsewhere |
| `request_summary` | TEXT (JSON) | jsonb | SANITIZED, allow-listed body fields only (see redaction). NULL if nothing safe |
| `request_bytes`   | INTEGER     | int  | content-length of request body |
| `response_summary`| TEXT (JSON) | jsonb | SANITIZED result shape (e.g. `{cards:7,state:"answer"}`), NOT full payload |
| `response_bytes`  | INTEGER     | int  | serialized response size |
| `error_code`      | TEXT        | text | app error code / exception name on failure; NULL on success |
| `error_message`   | TEXT        | text | SANITIZED, truncated 500 chars; NULL on success |
| `request_id`      | TEXT        | text | correlation id (== `id`; surfaced in response header `x-request-id`) |

### Indexes
- `idx_audit_ts` on `(ts)` — time-range scans, pruning.
- `idx_audit_route` on `(route)` — per-endpoint volume/latency/error analytics.
- `idx_audit_actor` on `(actor)` — per-user activity / abuse investigation.
- (Postgres only, optional) partial `idx_audit_errors` on `(ts) WHERE status_code >= 500` — fast error review.

### Volume / retention / rotation
- **Volume estimate (ASSUMED):** MVP ~ low thousands of req/day → tens of MB/mo; an audit row is small
  (no full bodies). Comfortable on Supabase well past launch.
- **Retention:** default **90 days** hot (`AUDIT_RETENTION_DAYS=90`, configurable). After that, prune.
- **Prune strategy:** a scheduled job (BullMQ repeatable, reuse ADR-008 Redis scheduler) runs daily:
  `DELETE FROM audit_trail WHERE ts < now() - INTERVAL '90 days'` (pg) / `ts < ?` cutoff (sqlite).
  Delete in **batches** (`LIMIT 5000` loop) to avoid long locks. No manual ops.
- **Rotation/scale escape hatch (ASSUMED, not built now — YAGNI):** if volume grows, convert to a
  **monthly-partitioned** table in Postgres (`PARTITION BY RANGE (ts)`), and prune = `DROP PARTITION`
  (instant, no row-by-row delete). Documented so the recorder/queries don't change when we flip it.
- **Backups:** Supabase PITR covers it; audit is append-only so no special handling.

---

## Decision 2 — Global recording mechanism (interceptor + exception filter)

Mirror the **events fire-and-forget** contract exactly: recording happens off the request path; a failure
to record NEVER affects the response. Capture is **automatic** (global), not per-controller.

### Components
1. **`AuditRecorderService`** (new, `audit/` module, `@Global` so it's injectable everywhere)
   - Holds an **in-memory bounded queue** + a drain loop, identical philosophy to `EventsService`.
   - `enqueue(row: AuditRow): void` — synchronous, returns immediately, never throws.
   - Drains via `queueMicrotask`/`setImmediate` batch → single `INSERT` per batch through the `Db` port
     (works in both `sqlite` and `pg` because it goes through `db.run`, `?` placeholders).
   - **Backpressure guard:** if queue exceeds `AUDIT_QUEUE_MAX` (default 5000), drop oldest + increment a
     `dropped` counter and log a warn — protect memory, never block the request.
   - **Self-protection:** all DB writes wrapped in try/catch; a failed insert is logged, not propagated.
   - Test seam: `drain()` / `flush()` like `EventsService` for spec assertions.

2. **`AuditInterceptor implements NestInterceptor`** (registered global via `APP_INTERCEPTOR` provider)
   - On request in: capture `ts`, `method`, `path` (query stripped), `route` (from handler metadata /
     `RouterExplorer` pattern), `actor` (from auth context / `request.user?.pseudoId ?? 'anon'`),
     `ip_hash`, `user_agent`, `request_bytes`, sanitized `request_summary`, and for `/search/*` the
     `sector` + normalized `query`. Mint `request_id` (uuid), set `x-request-id` response header.
   - `tap`/`finalize` on the response stream: compute `duration_ms`, `status_code`, `response_bytes`,
     sanitized `response_summary` → `recorder.enqueue(row)`. Uses RxJS `tap({next, error})` +
     `finalize` so it records on **both** success and thrown errors.

3. **`AuditExceptionFilter implements ExceptionFilter`** (`@Catch()`, registered via `APP_FILTER`)
   - Catches anything the handler throws, fills `status_code`, `error_code` (exception name / app code),
     sanitized `error_message`, then **re-throws / delegates to the default Nest exception handling** so
     the client still gets the normal error response. It records the audit row for the failure path
     (covers errors that bypass the interceptor's `next`). De-dup by `request_id` so a request is
     recorded **once** (filter sets a flag on the request; interceptor's `finalize` skips if already
     recorded).

### Why interceptor + filter (not middleware)
Interceptors see the **matched route** and the response value (for `response_summary`); the filter
guarantees error paths are captured even when the response pipeline short-circuits. Middleware runs
before routing so it can't get `route` cleanly. (VERIFIED: this matches standard Nest semantics; the
exact route-extraction call is ASSUMED until the build slice spikes it — see Slice 3.)

### Both DB modes
The recorder only uses the `Db` port (`db.run(sql, params)` with `?` placeholders) — already dual-engine
(`rewritePlaceholders` handles pg). No engine-specific code in the recorder. (VERIFIED from `db.port.ts`.)

---

## Decision 3 — Privacy / Security redaction (HARD)

Reuse the privacy-wall discipline (ADR-004) and the `PII_FORBIDDEN_KEYS` list already enforced by
`EventsService`. Audit rows are **constructed by the recorder from an allow-list**, never by dumping the
raw request/response. Redaction is **deny-by-default**.

### Absolute NEVER-LOG list (dropped before any write)
- **Auth/secrets:** `Authorization` header, any bearer/JWT/refresh token, `Cookie`/`Set-Cookie`,
  API keys, Supabase service-role key, webhook signing secrets, `apify_token`, any `*_secret`/`*_key`.
- **Credentials/OTP:** `password`, `code`, `otp`, OTP codes, magic links.
- **Payment data:** card numbers, CVV, Stripe `client_secret`, full Stripe customer/payment tokens,
  raw webhook bodies from Stripe (store only event type + id, never card/PII fields).
- **Phone PII:** `phone`, `phone_e164`, `phoneE164` — NEVER. Identity in audit = `pseudo_id` only.
- **Other PII:** `email`, `name`, raw IP (store salted hash only), full free-text `intent_raw`.

This is the existing `PII_FORBIDDEN_KEYS` set + the secret/payment additions above. **Reuse and extend
the constant** so there's one source of truth.

### Positive rules (what we DO store)
- **Headers:** only `user-agent` (truncated). Authorization/Cookie never read into a row.
- **IP:** `ip_hash = HMAC-SHA256(client_ip, AUDIT_IP_SALT)` (salt from env, rotatable). Never raw IP.
  Set `AUDIT_IP=off` to drop IP entirely (privacy jurisdictions).
- **Body (`request_summary`):** allow-list per route family — e.g. `/search/*` → `{sector, hasQuery:true}`
  + normalized query stored in the dedicated `query` column (PII-scrubbed). Billing/auth routes →
  **no body** at all (`request_summary = NULL`), only `request_bytes`. Default for unknown routes = NULL
  body, bytes only.
- **`query` column:** the **normalized** search string (post `query-normalize.ts`), truncated 200 chars,
  run through the same forbidden-key/phone-regex scrub. Free-form text is the one PII risk in search, so
  it is scrubbed (strip anything matching a phone/email regex) before store. (ASSUMED acceptable for
  analytics; if counsel objects we drop `query` to a boolean `had_query` — single-column change.)
- **`response_summary`:** shape only (counts/state enum), never the offers payload or any echoed input.
- **`error_message`:** sanitized + truncated; run through the same redactor (stack traces / secrets in
  messages stripped). Never log raw exception with secrets.

### Defense in depth
1. Recorder builds rows from an **explicit field allow-list** (can't accidentally include a new secret).
2. Final scrub pass: every string field run through `redact()` (forbidden-key + secret-token + phone/email
   regex) before insert — same gate philosophy as `EventsService.findPii`, which **drops** on violation.
3. `AUDIT_IP_SALT` and retention configurable via env (in `.env.example`).

---

## Decision 4 — Build slices (for the Dev Lead)

All slices behind one new `audit/` module. No change to existing controllers (global wiring).

**Slice A — Migrations (table).**
- `db/migrations/0006_audit_trail.sql` (sqlite, idempotent, `CREATE TABLE IF NOT EXISTS` + 3 indexes).
- `db/postgres/0006_audit_trail.sql` (Postgres port: uuid PK, timestamptz, jsonb summaries, partial error
  index). Follow the 0005 pair convention exactly.
- DoD: `npm run migrate` shows `audit_trail` in the table list.

**Slice B — Recorder service + queue.**
- `audit/audit-recorder.service.ts` implementing the interface below; `audit/audit.module.ts` (`@Global`).
- Reuse + extend the forbidden-key constant; implement `redact()` scrub + `ipHash()`.
- Batched insert through `Db` port; backpressure drop; try/catch self-protection.
- Unit spec (mirror `events.service.spec` if present): enqueue → flush → row present; secret/phone payload
  → scrubbed/dropped; DB throw → does NOT propagate.
- DoD: spec green in **both** `DB_DRIVER=sqlite` and a `pg` smoke (or test-db) path.

**Slice C — Global interceptor + exception filter.**
- `audit/audit.interceptor.ts` (`APP_INTERCEPTOR`) + `audit/audit.exception-filter.ts` (`APP_FILTER`),
  provided in `audit.module.ts`. Route extraction spike (confirm the Nest API for the matched route
  template). De-dup so one request = one row.
- Spec: hitting a route enqueues exactly one row with correct `route`/`status_code`/`duration_ms`; a
  thrown error path enqueues one row with `error_code`. Auth route logs `actor=pseudo_id`, no body.

**Slice D — Wiring + prune job.**
- Import `AuditModule` into `AppModule`. Set `x-request-id` header.
- Add prune: BullMQ repeatable daily (reuse ADR-008 scheduler) OR a guarded `DELETE` runner; batch delete.
- Add env vars to `.env.example`: `AUDIT_ENABLED`, `AUDIT_IP` (on|off), `AUDIT_IP_SALT`,
  `AUDIT_RETENTION_DAYS`, `AUDIT_QUEUE_MAX`.
- DoD: end-to-end — call `/search/intent`, row appears; secret header never present in any row; prune
  deletes rows older than cutoff.

Parallelism: A → B (needs table) → C (needs recorder) → D (needs C). B's redactor is independently
testable. C is the only spike (route extraction).

### Interface (frozen for the slices)

```ts
// audit/audit.types.ts
export interface AuditRow {
  id: string;                 // == requestId (uuid)
  ts: string;                 // ISO-8601
  method: string;
  path: string;               // query string STRIPPED
  route: string;              // matched template, e.g. '/search/intent'
  statusCode: number;
  durationMs: number;
  actor: string;              // pseudoId | 'anon' — NEVER phone/email
  ipHash: string | null;      // HMAC(ip, salt) | null
  userAgent: string | null;   // truncated 256
  sector: string | null;      // search analytics
  query: string | null;       // normalized + scrubbed, /search/* only, ≤200
  requestSummary: Record<string, unknown> | null; // allow-listed, sanitized
  requestBytes: number | null;
  responseSummary: Record<string, unknown> | null; // shape only
  responseBytes: number | null;
  errorCode: string | null;
  errorMessage: string | null; // sanitized, ≤500
  requestId: string;          // == id
}

// audit/audit-recorder.service.ts
export interface AuditRecorder {
  /** Fire-and-forget. Returns immediately, NEVER throws into the caller. */
  enqueue(row: AuditRow): void;
  /** tests only — await pending writes */
  flush(): Promise<void>;
}
```

---

## Consequences
- **+** Total, automatic audit + per-route latency/error/volume analytics + search sector/query analytics,
  with zero per-controller code and zero added request latency (off-path, fire-and-forget).
- **+** Dual-engine free (rides the `Db` port). One privacy source of truth (extended forbidden-key set).
- **−** A new always-on write path → guarded by backpressure drop + retention prune + kill-switch
  (`AUDIT_ENABLED=false`). Worst case audit fails silently; product unaffected (by design).
- **Risk:** `query` column stores normalized search text → small PII surface; scrubbed, and droppable to a
  boolean via one column change if counsel objects. **Flag to PO/counsel.**
- **Risk (ASSUMED, spike in Slice C):** exact Nest route-template extraction API — verify before wiring.
```
