# Feature Acceptance Criteria — Owner-Requested Backlog (2026-06-26)

> Owner: bo-business-analyst · Status: draft for PO review · 2026-06-26
> Source: `team/backlog.md` → "Product Feature Backlog (owner-requested 2026-06-26)" (F-A1/A2/A3, F-B1, F-C1, F-D1, F-D2).
> Style/conventions inherit from `team/analysis/mvp-scope-and-stories.md`.
> AC are the QA oracle: each is a single observable, testable assertion. **[Q-PO]** = open product question for the PO.
> Cross-cutting constraints from S0-4 §5 (RTL/AR-EN everywhere, no PII in analytics, graceful degradation) apply to every story below.

---

## Conventions used in this doc
- **Money:** stored as integer fils (per S2-2). KWD has 3 decimal places (1 KWD = 1000 fils). Display formatting per active locale.
- **User identity:** the OTP-verified phone number is the canonical identity key (see F-C1). Email is an editable, optional attribute (see F-A1).
- **"Search" (metering unit):** a user-submitted intent that reaches provider search and returns a result set (empty or non-empty). Defined precisely in F-D2 AC-1.
- **Backend:** assumes Supabase decision (F-B1) is ratified by the architect; AC are written backend-agnostic where possible and flag Supabase-specific items.

---

## EPIC-A — Accounts & User Profile

### F-A1 — Edit profile (name, email, avatar) · *Must*
*As a signed-in user, I want to edit my name, email, and avatar, so that my account reflects me and I can receive email-based communication.*

**Acceptance Criteria**
1. The profile screen displays current **name**, **email** (or "not set"), **avatar** (or initials/placeholder), and the verified **phone number** (read-only — phone is changed only via re-auth, out of scope here).
2. **Name validation:** 1–60 characters after trim; allows Arabic + Latin letters, spaces, hyphen, apostrophe; rejects empty/whitespace-only and strings >60 chars with an inline error.
3. **Email validation:** must match a standard RFC-5322-practical email regex; rejects malformed addresses inline; email is **optional** (may be cleared, returning to "not set"). Stored lowercased and trimmed.
4. **Email change → re-verification:** on saving a new/changed email, the email is stored as `email_pending` (NOT `email_verified`); a verification link/code is sent to the new address; the account's effective verified email remains the prior one until verification completes.
5. A new/changed email shows status **"Pending verification"** in the UI until verified; verified email shows a verified indicator.
6. Verification link/code **expires after 24 hours**; an expired or already-used link shows a clear error and a **"resend"** action.
7. **Avatar upload constraints:** accepts **JPEG, PNG, WebP** only; rejects other types inline. Max file size **5 MB** pre-processing; oversized files are rejected with an inline error (not a silent failure).
8. On upload, the image is stored in object storage (Supabase Storage bucket `avatars`, per F-B1); the stored avatar URL/path is persisted on the user record; old avatar object is deleted or orphaned-and-GC'd (no unbounded growth).
9. Avatar is downscaled/normalized to a max dimension (recommend **512×512**, center-cropped square) before or on storage; the served avatar loads on profile and any header that shows it.
10. **Remove avatar** action reverts to the initials/placeholder and removes the stored object reference.
11. **What persists:** name, email, `email_verified` flag, avatar reference survive sign-out, app restart, and reinstall (server-side record keyed to phone identity).
12. **Offline/error states:** if a save is attempted offline or the request fails, the prior values are retained (no partial/optimistic corruption), and the user sees a non-blocking "couldn't save, try again" message with retry; no field is lost.
13. **Concurrency:** if the same field is changed on two devices, last-write-wins server-side and the stale client refreshes to the server value on next load (no merge required at MVP).
14. All labels, validation messages, and statuses render correctly in AR (RTL) and EN.

**Edge cases**
- Email already used/verified by **another** account → reject with "email already in use" (do not leak which account). **[Q-PO]** confirm emails must be unique across accounts (recommend: yes).
- Avatar upload interrupted mid-transfer → no partial object persisted; prior avatar unchanged.
- User clears email while a verification was pending → pending verification is cancelled; email returns to "not set."
- Animated/HEIC images → rejected as unsupported type with guidance. **[Q-PO]** confirm HEIC handling (iOS default) — recommend client-side convert to JPEG before upload.

**Dependencies:** F-B1 (storage + user table + RLS); transactional email/verification provider (architect decision — could be Supabase Auth email, or a mail provider). Email-as-identity interplay with phone identity (F-C1).

---

### F-A2 — Biometric login toggle · *Must*
*As a returning user, I want to enable biometric login after I've signed in once, so that I can re-enter the app quickly without re-doing OTP.*

**Acceptance Criteria**
1. The biometric toggle is **only available after the user's first successful OTP sign-in** on that device; before that it is hidden or disabled with an explanatory hint.
2. The toggle is **only enabled/visible if the device hardware + OS report biometric capability** (Face ID / Touch ID / Android BiometricPrompt) AND the user has at least one biometric enrolled; otherwise it is hidden or shown disabled with "not available on this device."
3. Enabling biometrics triggers an OS biometric prompt to confirm; only a successful prompt activates the setting.
4. When enabled, on next app launch / session re-auth the app presents the biometric prompt; a successful match restores the session **without** an OTP round-trip.
5. **Fallback to OTP:** biometric failure, cancel, lockout (too many failed attempts), or unavailability always falls back to the standard WhatsApp-OTP login (F-C1) — the user is never locked out.
6. Disabling biometrics in settings takes effect immediately; the next launch requires OTP (or biometric is no longer offered).
7. **Security:** no OTP, password, or long-lived secret is stored in plaintext. Biometric unlock gates access to a **secure-enclave/Keychain/Keystore-stored** refresh token or session key only; the biometric itself never leaves the OS. **[Q-PO/Architect]** confirm token model (recommend: OS-secure-storage refresh token, biometric-gated).
8. If the OS biometric set changes (new fingerprint/face enrolled, or biometrics removed), the stored credential is **invalidated** and the user must re-authenticate via OTP and re-enable (prevents another person's biometric unlocking the session).
9. On sign-out, the biometric-gated credential is cleared; re-enabling requires a fresh OTP sign-in.
10. Setting is **per-device** (not synced across devices); a new device starts with biometrics off.
11. Toggle, prompts, and error states render in AR (RTL) and EN.

**Edge cases**
- Device with biometrics enabled in OS but later disabled by user in OS settings → app gracefully falls back to OTP and reflects "unavailable."
- App restored from backup on a new device → biometric credential does not transfer; user must OTP + re-enable.
- Jailbroken/rooted device → **[Q-PO]** do we block biometric (or app) on compromised devices? Recommend: warn, allow, but never weaken token storage.

**Dependencies:** F-C1 (OTP is the prerequisite first sign-in + the fallback); F-B1 (session/token issuance); device biometric APIs (Expo `LocalAuthentication` + secure store).

---

### F-A3 — Notifications toggle · *Should*
*As a user, I want to control which notifications I receive, so that I'm alerted to things I care about (like price drops) without being spammed.*

**Acceptance Criteria**
1. The notifications settings screen lists **per-type** preferences, each independently toggleable:
   - **Price-drop alerts** (ties to fast-follow price-drop feature)
   - **Account & security** (e.g., email verification, login on new device)
   - **[Q-PO]** confirm the full initial set (recommend the two above for MVP; "promotions/news" optional and **default OFF**).
2. The **first time** the user enables any push-requiring type, the app triggers the **OS push-permission prompt**; permission is only requested in context (not on cold launch).
3. If the OS permission is **granted**, the enabled per-type prefs take effect and the device registers a push token (stored against the user).
4. If the OS permission is **denied** (or later revoked in OS settings), the in-app toggles show a clear "notifications are turned off in system settings" state with a deep link/instructions to OS settings; toggles do not silently appear "on" while no push can be delivered.
5. Per-type preferences **persist** server-side against the user identity and survive restart, sign-out/in, and reinstall (re-registering the push token on the new install).
6. Disabling a type stops that notification category server-side (no further pushes of that type) within a defined propagation window.
7. **Account & security** notifications: **[Q-PO]** decide whether security-critical messages are user-disableable or always-on (recommend: in-app/email security messages always delivered; only the *push channel* for them is toggleable).
8. Toggling does not require a network round-trip to *show* the new toggle state, but the preference is reconciled server-side and reflects the server value on next load.
9. All toggle labels, the permission-rationale copy, and the OS-denied state render in AR (RTL) and EN.

**Edge cases**
- User grants permission, later revokes in OS → next app open reconciles UI to "system off."
- Multiple devices per user → push token list maintained; disabling a type applies to all the user's devices.
- Notification arrives for a type the user just disabled (in-flight) → acceptable within the propagation window; document the window.

**Dependencies:** F-B1 (preference persistence + token storage); a push service (Expo Notifications / FCM / APNs — architect decision); the price-drop alert pipeline (fast-follow) is the *producer* — toggle is the *consumer-side control* and can ship before producers exist (toggles simply have no events yet).

---

## EPIC-B — Backend Platform

### F-B1 — Connect app to Supabase (Auth, Postgres, Storage, RLS) · *Must*
*As the team, we want the app backed by Supabase (or the architect's ratified equivalent) with row-level security, so that user data is persisted securely and each user can only access their own data.*

> NOTE: Supabase-vs-current-stack is an **architect decision** (may revise ADR-001). These AC define the *required behavior* regardless of the chosen managed backend; "Supabase" below = "the chosen managed backend."

**Acceptance Criteria**
1. The app authenticates users against the backend and obtains a session/JWT tied to the canonical phone identity (issued via the F-C1 OTP flow).
2. **User data persistence:** profile (name, email, `email_verified`, avatar ref), notification prefs, biometric-enabled flag (per device), subscription status (F-D1), and free-search counter (F-D2) are persisted in backend tables and survive restart/reinstall.
3. **Avatar storage:** a storage bucket (`avatars`) holds avatar objects; objects are readable per the access policy and writable only by the owning user.
4. **Row-Level Security (RLS):** every user-scoped table has RLS enabled such that a user can `SELECT/UPDATE/DELETE` **only their own rows** (`auth.uid()` / identity match); cross-user reads are rejected at the database layer, not just the app layer. Verified by an automated test that attempts cross-user access and is denied.
5. Storage policies enforce the same: a user cannot read or overwrite another user's avatar object path.
6. **Service-role / admin** access (for the admin web, analytics) is separated from user RLS and never exposed to the mobile client.
7. **Anonymized analytics events** (S0-4/S0-5 pipeline) contain **no PII** and are written via a path that does not allow user-table joins to re-identify (preserve the no-PII invariant).
8. **Migration / coexistence with current schema:** the existing 8-table model (S2-2, money-as-fils) is preserved — either (a) migrated into Supabase Postgres with the same shape, or (b) the new user/auth/subscription tables coexist with the current NestJS+Postgres data layer. The chosen path is documented in an ADR. No existing seeded data (4 providers, 10 SKUs, 25 offers) is lost. **[Q-PO/Architect]** confirm full-migration vs hybrid.
9. **Secrets:** Supabase anon key only on client; service-role key only server-side; never shipped in the mobile bundle.
10. Connection failure / backend outage degrades gracefully: cached/last-known state where safe, clear error otherwise, no data corruption (consistent with F-A1 AC-12).

**Edge cases**
- RLS misconfig regression → covered by a mandatory cross-user-access denial test in CI.
- Schema drift between current Postgres and Supabase during coexistence → single source of truth per table must be documented; no table written from two systems.

**Dependencies:** Architect ADR (revises/augments ADR-001/-003); F-C1 issues the identity the JWT carries; everything in EPIC-A, F-D1, F-D2 persists here.

---

## EPIC-C — Authentication (WhatsApp OTP)

### F-C1 — OTP via WhatsApp (with SMS fallback) · *Must*
*As a Kuwait shopper, I want to receive my login code on WhatsApp, so that I can verify my number quickly using the app I already use daily.*

**Acceptance Criteria**
1. User enters a phone number (default country code **+965**; **[Q-PO]** confirm other supported codes — open since S0-4); invalid formats rejected inline.
2. On submit, a one-time code is sent to the number **via WhatsApp** (WhatsApp Business API — provider is an architect decision: Meta direct / Twilio / 360dialog).
3. **Code length:** 6 numeric digits.
4. **Expiry:** code is valid for **5 minutes**; after expiry, verification fails with an "expired, request a new code" message.
5. **Resend:** a resend action is **disabled by a 30-second cooldown** timer; resending invalidates the prior code (only the latest code is valid).
6. **Rate-limit (request):** max **5 code requests per phone number per 1 hour** (and a per-IP/device limit); exceeding shows "too many requests, try later" and blocks further sends until the window resets. **[Q-PO]** confirm exact thresholds.
7. **Verify attempts:** max **5 incorrect-code attempts** per issued code; on exceeding, the code is invalidated and the user must request a new one; a clear "too many attempts" message is shown.
8. **SMS fallback:** if WhatsApp delivery fails or is undeliverable (no WhatsApp on number / provider error / **[Q-PO]** time-to-fallback threshold, recommend ~20s with a manual "send via SMS instead" action), the user can receive the code via **SMS** to the same number; SMS path obeys the same length/expiry/attempt rules.
9. **Successful verification** issues a session/JWT (F-B1), creates the user record on first sign-in, and routes to the post-login destination (sector picker for new users; last screen or home for returning).
10. **First successful sign-in** unlocks the option to enable biometrics (F-A2 AC-1).
11. **Error states are explicit and distinct:** invalid format, code expired, code incorrect (with attempts remaining where useful), too many attempts, too many requests, delivery failure/fallback offered, network error.
12. No code is ever displayed in the app, logged in analytics, or stored in plaintext after issuance (store only a hash + metadata).
13. All flows and error copy render in AR (RTL) and EN; the OTP input supports paste and per-digit entry.

**Edge cases**
- Number with no WhatsApp account → WhatsApp send fails → SMS fallback offered.
- User requests code, switches to a different number before entering → prior code context cleared.
- Same number signing in on a new device → allowed; biometric is per-device (F-A2 AC-10); **[Q-PO]** confirm whether concurrent multi-device sessions are allowed (recommend: yes).
- WhatsApp template/provider outage → automatic or one-tap SMS fallback keeps login working (no hard dependency on a single channel).
- Number-porting / reused number → identity is the number; **[Q-PO]** note this is an accepted MVP limitation.

**Dependencies:** WhatsApp Business API provider (architect decision + Meta template approval lead time — flag as a schedule risk); SMS provider for fallback; F-B1 (identity + session issuance); replaces/augments S0-4 A1 mobile+OTP.

---

## EPIC-D — Monetization (Subscription & Freemium Gate)

### F-D1 — Stripe subscription, $1/month · *Must*
*As a power user, I want to subscribe for $1/month, so that I get unlimited searches.*

**Acceptance Criteria**
1. A subscribe entry point exists (from the paywall in F-D2 and from profile/settings); it opens a **Stripe Checkout** session (hosted) or a Stripe-backed in-app flow for the **$1/month** recurring plan.
2. **Currency display:** the price is shown clearly. **[Q-PO]** decide display currency — Stripe charges in a set currency; recommend show **USD $1.00/month** as the charge with an approximate **KWD** equivalent label, OR price natively in KWD if Stripe + the Kuwait entity supports it. Whatever is chosen, the **actual charge currency must match the displayed charge currency** (no hidden FX surprise).
3. **App-store policy note (critical):** **[Q-PO/Architect]** selling digital subscriptions inside iOS/Android apps generally requires Apple/Google in-app purchase, not Stripe. Confirm distribution model (web-checkout vs native IAP vs RevenueCat). This materially affects F-D1/F-D2 and must be resolved before build. *(Flagged risk.)*
4. **Subscription states** are tracked and reflected in the app: **active**, **canceled** (active-until-period-end), **past_due**, **incomplete/incomplete_expired**, **none/free**. The app's gating (F-D2) reads this status.
5. **Webhook-driven status:** subscription status is updated server-side via **Stripe webhooks** (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed/succeeded`), not by trusting the client; the client reflects the server-stored status.
6. **Active** users get **unlimited searches** (F-D2 bypass) immediately on successful first payment / webhook confirmation.
7. **Cancel:** user can cancel from settings (or via Stripe customer portal); on cancel, status → canceled, access continues until the **end of the paid period**, then reverts to free (and the free gate F-D2 reapplies).
8. **Renew / resubscribe:** a canceled or lapsed user can resubscribe; on success, access restores immediately.
9. **Past_due:** on a failed renewal payment, status → past_due; **[Q-PO]** grace policy (recommend a short grace window with retry before reverting to free).
10. **Receipts:** Stripe sends an email receipt per successful charge; the app shows current plan, price, renewal date, and a link to billing history / customer portal.
11. **Restore on reinstall:** after reinstalling and signing in (same phone identity → same Stripe customer), the active subscription is recognized automatically (server lookup by customer/identity); no re-purchase required.
12. The user's Stripe **customer ID** is linked to the canonical phone identity, persisted in F-B1, never exposed to other users (RLS).
13. No card/PAN data ever touches our servers or logs (Stripe-hosted handles PCI scope).
14. Subscribe/manage/cancel flows and all status copy render in AR (RTL) and EN.

**Edge cases**
- Payment succeeds but webhook is delayed → client shows "processing" and reconciles when webhook lands; never double-charges; never grants then revokes within the same session due to race (server status is source of truth).
- User subscribes on device A, opens device B → device B reflects active after status refresh.
- Chargeback / dispute / Stripe-side cancel → webhook reverts access.
- Same identity with two Stripe customers (data error) → must be prevented (one customer per identity); covered by a uniqueness constraint.

**Dependencies:** F-B1 (customer↔identity link, status persistence, webhook endpoint, RLS); F-D2 (consumes status); Stripe account + Kuwait/currency setup; **app-store IAP policy resolution (AC-3) is a hard prerequisite.**

---

### F-D2 — Freemium gate: 5 free searches, then subscribe · *Must*
*As the business, we want users to get 5 free searches and then subscribe, so that we convert engaged users to paid while letting everyone experience core value.*

**Acceptance Criteria**
1. **Definition of a counted "search":** a search counts when a user-submitted intent **reaches provider search and a ranked result set is produced (empty or non-empty)** — i.e., the value-delivery moment, *after* clarifiers resolve. The following do **NOT** count: typing intent without submitting, clarifier Q&A turns within one search, refinements of the same search ("make it cheaper" within the same session — **[Q-PO]** confirm refinements are free; recommend each *distinct new intent* = 1, refinements of the active search = 0), and failed searches that error before reaching providers. *(One AC, one observable counting moment.)*
2. **Per-user counter:** the free-search count is metered **per canonical user identity** (phone, F-C1), persisted server-side (F-B1), and is the authority — the client never self-reports the count for gating.
3. **Counter increments** by exactly 1 at the moment defined in AC-1; concurrent/duplicate submissions of the same search do not double-count (idempotent within the search session).
4. **Free allowance = 5.** Searches 1–5 proceed normally for a free (non-subscribed) user.
5. **Search #6 (free user) → paywall:** the 6th search attempt is blocked *before* delivering results and presents the **paywall** (value prop + "Subscribe $1/month" → F-D1). The blocked intent is preserved so it can run immediately after a successful subscribe (no re-typing). **[Q-PO]** confirm the blocked 6th search runs free-of-charge-against-quota once subscribed (recommend: yes, it runs as the user's first unlimited search).
6. **Counter reset policy — DECISION: the free counter NEVER resets.** Free tier = a lifetime allowance of 5 searches per identity; it does **not** reset daily/monthly. Subscribed users have **unlimited** searches (no counter). *(Documented decision per task; **[Q-PO]** ratify — alternative would be a monthly reset, which is more generous but weakens conversion.)*
7. **Subscribed users bypass the gate entirely:** if F-D1 status is **active** (or canceled-but-within-paid-period), searches are unlimited and the counter is neither checked nor incremented.
8. **On subscription lapse** (canceled period ends / past_due exhausted): the user reverts to free tier. Because the lifetime 5 were already consumed, a lapsed previously-paid user is immediately gated (no fresh 5). **[Q-PO]** confirm (recommend: yes — the 5 are lifetime, not per-subscription-cycle).
9. **Anonymous (not signed-in) handling:** **[Q-PO]** decide the model. Recommend: **search requires sign-in** (per S0-4 auth-first flow), so all 5 free searches are tied to a verified identity — preventing anonymous counter-reset abuse (reinstall, clear-cache). If a browse-before-login experience is desired, anonymous searches must still be metered (device-fingerprint, weaker) and converted to the user on sign-in.
10. **Counter integrity / anti-abuse:** because the counter is identity-bound and server-authoritative, reinstalling the app does NOT reset the count (identity = phone). Multiple identities (different numbers) legitimately get 5 each — accepted.
11. The remaining-free-searches state is visible to the user (e.g., "3 of 5 free searches left") so the paywall is not a surprise. **[Q-PO]** confirm we show the remaining count (recommend: yes — transparency improves conversion trust).
12. Paywall, counter UI, and gate messaging render in AR (RTL) and EN.

**Edge cases**
- Search reaches providers but all providers error (empty due to failure) → **[Q-PO]** does it count? Recommend: **does not count** a provider-failure empty (don't charge the user a free search for our outage); a legitimate "no matching offers" empty **does** count (value was the answer).
- User exhausts 5, subscribes, then cancels immediately → gated again at period end (AC-8).
- Clock/timezone irrelevant since counter never resets (a benefit of the never-reset decision).
- Race: user at 5/5 submits two searches simultaneously → at most one is served, the other hits the paywall; never serves a 6th free.

**Dependencies:** F-D1 (status = bypass authority); F-B1 (counter persistence + RLS); F-C1 (identity the counter binds to); ties into the anonymized events pipeline for the funnel KPIs below (metering event is **per-identity** and must stay separate from no-PII analytics — log the *funnel transitions* anonymized).

---

## Conversion-Funnel KPI Set (Freemium → Subscription)

> Measures the F-D2 → F-D1 path. Computed from anonymized event logs (no PII); each step is a distinct event so drop-off is measurable. These extend the S0-4 §4 KPIs (Activation, CTR, Retention remain the top-of-funnel context).

| # | KPI | Definition | Why it matters |
|---|-----|------------|----------------|
| 1 | **Free-search depth** | Distribution of free searches consumed per user before hitting (or not hitting) the gate (e.g., median searches used of 5) | Tells us if 5 is the right allowance — too low = churn before value, too high = weak monetization |
| 2 | **Gate-hit rate** | % of free users who reach search #6 (the paywall trigger) | Sizes the addressable conversion pool; low = users churn before exhausting free |
| 3 | **Paywall view rate** | % of gate-hits that actually render the paywall screen (catches technical drop) | Should be ~100%; a gap signals a bug between gate and paywall |
| 4 | **Checkout-start rate** | % of paywall views that tap "Subscribe" and open Stripe Checkout | First real intent signal; measures paywall persuasiveness |
| 5 | **Checkout-completion rate** | % of started checkouts that reach a successful payment (webhook-confirmed active) | Measures payment-flow friction (currency, IAP policy, card failures) |
| 6 | **Free→Paid conversion rate** | % of free users (or % of gate-hits) who become **active** subscribers | The headline monetization metric |
| 7 | **Time-to-convert** | Median time from first search → active subscription | Indicates whether conversion is impulse (at gate) or considered |
| 8 | **Trial/early churn** | % of new subscribers who cancel within their first paid period | Guards against the gate forcing low-quality conversions that immediately churn |
| 9 | **Involuntary churn (past_due)** | % of subscriptions lapsing via failed payment vs voluntary cancel | Separates payment friction from value dissatisfaction |

**Funnel chain (drop-off measurable at each arrow):**
`search consumed (1..5) → gate hit (#6) → paywall viewed → checkout started → checkout completed → subscription active → retained past period 1`

> **[Q-PO]** ratify targets per step in the first cohort (set baselines first; the task didn't fix numeric targets). All events anonymized — funnel transitions logged without phone/email/PAN.

---

## Consolidated Open Product Questions for the PO
1. **App-store IAP policy** (F-D1 AC-3): Stripe web-checkout vs native IAP/RevenueCat — *blocks monetization build.*
2. **Charge currency** (F-D1 AC-2): USD-with-KWD-label vs native KWD.
3. **Counter reset** (F-D2 AC-6): ratify **never-reset lifetime 5** (recommended) vs monthly reset.
4. **Lapsed-paid users** (F-D2 AC-8): re-gated immediately (no fresh 5) — confirm.
5. **Anonymous searches** (F-D2 AC-9): require sign-in to search (recommended) vs metered anonymous browse.
6. **Show remaining-free count** (F-D2 AC-11) — recommend yes.
7. **Provider-failure empty counts?** (F-D2 edge) — recommend no.
8. **Refinements count as searches?** (F-D2 AC-1) — recommend no.
9. **Email uniqueness across accounts** (F-A1) — recommend yes.
10. **HEIC avatar handling** (F-A1) — recommend client-convert to JPEG.
11. **Notification set + always-on security pushes** (F-A3 AC-1/7).
12. **WhatsApp→SMS fallback threshold & rate-limit thresholds** (F-C1 AC-6/8).
13. **Supported country codes beyond +965** (F-C1 AC-1) — carried over from S0-4.
14. **Concurrent multi-device sessions allowed?** (F-C1 edge).
15. **Full migration vs hybrid** to Supabase (F-B1 AC-8) — architect-led.
16. **Biometric token model & compromised-device policy** (F-A2 AC-7).

---

## Handoff
- **Done:** Build-ready INVEST stories + numbered, testable AC + edge cases + dependencies for all 7 owner-requested features (F-A1/A2/A3, F-B1, F-C1, F-D1, F-D2); freemium-counter reset DECISION (never-reset lifetime 5, unlimited when subscribed); 9-metric conversion-funnel KPI set; 16 consolidated open product questions.
- **Next:**
  - **PO** — ratify the 16 open questions (esp. #1 IAP policy = build blocker, #2 currency, #3 counter-reset decision) and funnel KPI targets.
  - **bo-tech-architect** — Supabase-vs-current decision (F-B1, may revise ADR-001/-003), WhatsApp OTP provider, Stripe + Kuwait currency + webhook design, where the search-metering counter lives (server-authoritative), biometric token storage model.
  - **bo-ux-lead** — flows/wireframes for: profile edit + email re-verify states, biometric enable/fallback, notification permission + OS-denied state, WhatsApp/SMS OTP + all error states, paywall + remaining-count UI, subscribe/manage/receipts.
  - **bo-dev-lead** — sequence after PO ratification + architect decisions; F-C1 + F-B1 are foundational (identity/session) and should precede F-A2/F-D1/F-D2.
  - **bo-qa-lead-frontend / bo-qa-backend** — convert AC to test cases; mandatory tests: RLS cross-user denial (F-B1 AC-4), no-6th-free-search race (F-D2 AC-3/race), webhook-driven status truth (F-D1 AC-5), no-PII-in-funnel-events.
- **Owner:** PO (ratification); bo-tech-architect (stack/provider/payment decisions); bo-business-analyst (revisions post-answers).
- **Blockers/risks:** **App-store IAP policy unresolved (could invalidate Stripe-in-app approach) — highest risk.** WhatsApp Business API template approval lead time (schedule risk). Supabase migration scope unconfirmed. Several AC carry **[Q-PO]** placeholders that must be answered before these stories are "ready" for build.
