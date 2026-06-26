# Memory — Business Analyst Lead (bo-business-analyst)

> Persistent memory for the BestOffers Business Analyst Lead.
> READ at task start. UPDATE at task end with durable facts only.
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state
- S0-4 & S0-5 delivered (2026-06-25):
  - `team/analysis/mvp-scope-and-stories.md` — 3 personas, MVP in/out scope, Electronics thin slice + Food delta, epics A–H w/ INVEST stories + numbered AC, MoSCoW, KPIs.
  - `team/analysis/feature-monetization-proposal.md` — feature backlog, 3-phase monetization, day-one anonymized logging schema.
- Owner-feature AC delivered (2026-06-26):
  - `team/analysis/feature-acceptance-criteria.md` — full build-ready AC for F-A1/A2/A3, F-B1, F-C1, F-D1, F-D2 + 9-metric conversion-funnel KPIs + 16 open-PO questions.
- Smart no-match fallback delivered (2026-06-26):
  - `team/analysis/no-match-fallback-ac.md` — F-SR1, 20 AC + AR/EN UX copy + 7 KPIs + 7 open-PO questions. Handoff to bo-dev-lead + bo-ux-lead.

## MVP boundary (durable)
- IN: mobile+OTP auth (biometric opt-in), sector pick (Electronics + Food), AR/EN RTL conversational intent, ≤3 clarifiers, provider search, ranked cards (image/why/price/provider/deep link), deep-link hand-off, light admin web (sources/moderation/analytics), day-one anonymized logging.
- OUT (non-goals, locked): no payments/cart/checkout, no inventory/fulfilment, no marketplace, no sponsored ranking at MVP. Saved searches + price-drop alerts = FAST-FOLLOW not day-one. Furniture/Cars = roadmap.
- Food gated on S0-2 provider-data feasibility. Electronics is the day-one demoable spine.

## KPI definitions (durable)
- Activation: % new sign-ins completing ≥1 search w/ ≥1 result in first session.
- Search-to-result rate: % intents reaching non-empty ranked set (empty-rate = inverse).
- Time-to-result: median secs intent→cards (track p90).
- Clarifier efficiency: avg clarifiers before successful search (target ≤3).
- Click-through (hand-off): % result sessions with ≥1 deep-link tap (primary monetization proxy).
- Retention: D7/D30 return of activated users.
- All KPIs from anonymized logs, no PII.

## Key decisions
- Discovery-first monetization; B2B demand + price-intelligence = strongest near-term, Phase 3; never sponsored ranking at MVP (neutrality = trust = CTR).
- Highest-value B2B assets logged day one: `offer_returned` (price history) + `empty_result` (unmet demand).
- Owner-feature decisions (2026-06-26):
  - Freemium: free counter is **lifetime 5, NEVER resets** (not daily/monthly); subscribed = unlimited (counter not checked). Counter is **per phone-identity, server-authoritative** (reinstall does not reset). "Search" counts at provider-search-reached/result-produced moment; clarifiers & refinements don't count.
  - Identity = OTP-verified phone (F-C1); email is optional editable attribute; email change → re-verify (24h expiry, pending state).
  - Biometric: only after first OTP sign-in, per-device, OS-secure-storage token (no plaintext secret), always falls back to OTP.
  - Stripe $1/mo webhook-driven status; restore-on-reinstall via customer↔identity link.
- Smart no-match fallback (F-SR1) decisions (2026-06-26):
  - NEVER a dead "no results" state. Triggers: zero exact / fewer than N (recommend N=3) / hard constraints (storage/color/budget) unsatisfiable.
  - Surfaces RANKED real-only alternatives in labeled classes: (i) same-model variant `closest`, (ii) adjacent model/gen `alternative`, (iii) same-category near budget `within_budget`, (iv) separated complementary `related`. Closed tag vocab.
  - TRUTHFULNESS RULE (non-negotiable): every alternative = a REAL fetched offer; "why this" only from real attributes; no invented products/prices. Enforce in code + tests.
  - Empty-empty only when truly nothing relevant → helpful state with broaden-and-rerun suggestions (≥1 actionable control), never bare "0 results".
  - Fallback-augmented result = 1 search for F-D2 metering (no extra free search). Empty-empty counts; provider-failure empty does not.
  - Unratified placeholders: N=3, near-budget band ±15%, display cap 10, over-budget surfacing (recommend yes, delta-tagged).

## Open questions / handoffs (need PO/research)
- [R? S0-2] Food provider data feasibility & repeat price-read reliability (gates Food + price-drop alerts + price-intelligence).
- [R? S0-3] Kuwaiti/Gulf dialect coverage, numeral/locale preferences for RTL.
- [R? S0-1] Kuwait affiliate/referral program availability (gates Phase 1 affiliate revenue).
- [R?] Privacy/consent rules for anonymized logging (legal).
- [R?] Supported auth country codes beyond +965.
- Ranking algorithm rationale + deep-link reliability per provider — unverified; needs architect.
- [Q-PO BLOCKER] App-store IAP policy: Stripe web-checkout vs native IAP/RevenueCat — could invalidate Stripe-in-app; blocks F-D1/F-D2 build.
- [Q-PO] Charge currency USD-vs-KWD; lapsed-paid re-gated immediately; anonymous-search model (recommend sign-in required); refinements/provider-failure-empty not counted; email uniqueness.
- [Architect] Supabase vs current stack (F-B1, may revise ADR-001); WhatsApp OTP provider (template approval = schedule risk); search-metering location; biometric token model.
