# Winning-Feature & Monetization Proposal (S0-5)

> Owner: bo-business-analyst · Status: draft for PO review · 2026-06-25
> Source: `Concept.txt`, `team/backlog.md`. **[R?]** = awaits `bo-researcher`.
> Principle (locked): **discovery first now, B2B demand/price-intelligence later.** Neutrality is the product — no monetization that distorts ranking at MVP.

---

## 1. Feature backlog (beyond the MVP spine)

Priority: **P1** fast-follow (next after MVP) · **P2** growth · **P3** later. RICE-style reasoning noted inline.

### Fast-follow (P1) — retention engine

**FF1 — Saved searches** · *P1*
*As a user, I want to save a search, so that I can re-run it without re-typing intent.*
1. From any result set, user can save the search (intent + clarifier answers + sector).
2. Saved searches are listed and re-runnable with one tap, re-querying live providers.
3. User can rename and delete saved searches.
4. Bilingual + RTL; no PII beyond the user's own account scope.
> Why: cheap to build on existing flow; seeds price-drop alerts and the premium tier.

**FF2 — Price-drop alerts** · *P1*
*As a user, I want to be alerted when a saved item's price drops, so that I buy at the right moment.*
1. User can enable an alert on a saved search/specific offer with a threshold (any drop or ≥X%).
2. When monitored price falls below threshold, user gets a push notification.
3. Notification deep-links back to the refreshed result set.
4. User can pause/delete alerts; respects notification permissions.
5. Alert checks run on the freshness/cache cadence (architect-defined).
> Why: the single strongest retention + re-engagement lever; directly increases hand-off CTR. Depends on reliable repeat price reads per provider **[R?]**.

### Growth (P2)

**G-1 — Multi-sector watchlists** · *P2* — a saved set spanning sectors; foundation for premium tier.
**G-2 — Comparison view** · *P2* — side-by-side of 2–3 offers (price/spec deltas) before hand-off; lifts trust & CTR.
**G-3 — Personalized re-ask shortcuts** · *P2* — remember a user's common dimensions (budget band, preferred storage) to reduce clarifier count; improves clarifier-efficiency KPI. Anonymized/profile-scoped only.
**G-4 — Deal confidence signal** · *P2* — "this is X% below typical price" using our own historical price log; turns collected data into consumer value (and validates B2B price-intelligence quality).
**G-5 — Share an offer** · *P2* — share a result card/deep link; low-cost organic growth loop.

### Later (P3)

**L-1 — Premium tier** · *P3* — power features (unlimited alerts, history, multi-sector watchlists, faster refresh). Needs an active base first.
**L-2 — Furniture & Cars sectors** · *P3* — roadmap verticals, each gated on a provider-data plan.
**L-3 — Provider-side self-serve portal** · *P3* — providers manage their own feeds/listings (still no paid ranking).

---

## 2. Monetization roadmap

### Stance
Build trust and volume first. The asset we accumulate from day one — **anonymized intent + price-over-time data** — is the durable moat and the strongest near-term revenue path, without charging consumers or distorting ranking.

### Phase 1 — Now (MVP → fast-follow): Discovery-first, monetization-neutral
- **No paid ranking, no sponsored placement.** Protects neutrality = trust = CTR.
- **Affiliate / referral where it exists** (electronics retailers with programs) — passive, ranking-neutral; capture click-through attribution on hand-off. Coverage is limited in Kuwait **[R?]** (S0-1).
- **Instrument everything anonymized** (see §3) so Phase 3 has a rich dataset on day one.
- KPI focus: activation, search-to-result, click-through, retention.

### Phase 2 — Growth: Engagement & light direct revenue
- **Premium tier (L-1)** once an active base exists — alerts/history/watchlists/faster refresh.
- **Deal-confidence signal (G-4)** proves our price-history data is decision-grade — a live demo of B2B value.
- Optional: provider **co-marketing** that does not alter ranking (e.g., neutral "featured deals" clearly labeled, only if it survives a neutrality review).

### Phase 3 — B2B demand & price intelligence (strongest near-term per concept)
- **Demand intelligence:** sell anonymized, aggregated demand signals to retailers — what categories/specs/dishes Kuwait consumers are searching for, trending intents, unmet demand (searches with no good offer), seasonality.
- **Price intelligence:** competitive price tracking across providers over time, derived from our own captured offer history.
- Sold as dashboards/reports/API to retailers; monetizes data we already collect, with **no consumer-payment dependency** and **no ranking distortion**.
- Hard requirement: all B2B outputs are **aggregated and anonymized** — never individual-user-identifiable.

> Never adopted at MVP: sponsored ranking / pay-to-rank — it trades the product's core trust for short-term revenue.

---

## 3. Day-one anonymized data to log (no UX cost)

> Collect from MVP day one to power analytics (KPIs) and Phase-3 B2B. **Rules:** no PII in these events; pseudonymous IDs only; logging is async/non-blocking and never delays the user flow; consent/privacy copy per legal **[R?]**.

| Event | Captured fields (anonymized) | Powers |
|---|---|---|
| `intent_submitted` | pseudo-user id, sector, locale (AR/EN), normalized intent category/keywords (no free PII), timestamp | Demand intelligence; search-to-result; trending intents |
| `clarifier_answered` | session id, dimension (e.g., storage/budget/people), answer bucket, skip flag | Clarifier efficiency; demand specificity |
| `search_executed` | session id, sector, providers queried, result count, latency ms, freshness source (live/cache) | Time-to-result; coverage; empty-rate |
| `offer_returned` | session id, provider, category, price (KWD), rank position, "why" tag | **Price intelligence** (price over time); ranking quality |
| `empty_result` | session id, sector, normalized intent category | **Unmet-demand** signal (high B2B value) |
| `card_tapped` / `handoff` | session id, provider, sector, rank position of tapped card, query class | Click-through KPI; affiliate attribution; demand→conversion proxy |
| `result_refined` | session id, refinement type (cheaper/spec change) | Intent dynamics; UX tuning |
| `session_outcome` | session id, reached result (y/n), handoff (y/n), duration | Activation; funnel |
| `alert_triggered` (FF2) | pseudo-user id, category, price delta % | Retention; price-sensitivity demand |

> The two highest-value B2B assets — **`offer_returned` price history** and **`empty_result` unmet demand** — cost the user nothing and must be logged from the first release.

---

## Handoff
- **Done:** Feature backlog (fast-follow saved searches + price-drop alerts, growth, later) with AC where user-facing; 3-phase monetization roadmap (discovery-first → premium/engagement → B2B demand/price-intelligence); day-one anonymized logging schema with no-UX-cost rules.
- **Next:** PO to confirm Phase ordering & neutrality stance; bo-researcher to confirm Kuwait affiliate-program availability (S0-1) and privacy/consent constraints; bo-tech-architect to design the event pipeline + price-history store.
- **Owner:** PO (roadmap), bo-researcher (affiliate/legal), bo-tech-architect (logging/data store).
- **Blockers/risks:** Affiliate coverage in Kuwait uncertain; B2B data value depends on price-history fidelity (provider repeat-read reliability, S0-2); privacy/consent rules for anonymized logging unconfirmed.
