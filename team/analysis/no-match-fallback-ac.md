# Smart No-Match Fallback — Acceptance Criteria (2026-06-26)

> Owner: bo-business-analyst · Status: draft for PO review · 2026-06-26
> Source: owner requirement — "when a search has no exact match, AI brings relevant things around it; never a dead no-results state."
> Style/conventions inherit from `team/analysis/feature-acceptance-criteria.md` and `team/analysis/mvp-scope-and-stories.md`.
> AC are the QA oracle: each is a single observable, testable assertion. **[Q-PO]** = open product question for the PO.
> Cross-cutting constraints (RTL/AR-EN everywhere, no PII in analytics, graceful degradation, real-fetched offers only) apply throughout.

---

## Conventions used in this doc
- **Exact match:** a real fetched offer satisfying ALL of the user's hard constraints (model/product + storage + color + budget, where each was specified).
- **Alternative:** a real fetched offer that satisfies the request *partially* or *adjacently*, surfaced with a tag explaining the relation. Never an invented product/price.
- **N (relevance floor):** the minimum count of exact matches below which fallback augmentation triggers. Recommend **N = 3**. **[Q-PO]** ratify N.
- **Money:** integer fils, KWD = 3 decimals (per S2-2); display per active locale.
- A counted "search" (F-D2 AC-1) is unchanged: fallback results are still a produced result set, so a fallback search **counts** the same as any non-empty result. The empty-empty state (AC-12) is a "no matching offers" empty and **counts** (value = the honest answer + broaden suggestions); a provider-failure empty does **not** count (F-D2 edge).

---

## EPIC-SR — Search Results & Relevance

### F-SR1 — Smart no-match fallback ("bring relevant things around it") · *Must*
*As a shopper whose exact item isn't available (or is barely available), I want the app to show me the closest real alternatives clearly labeled, so that I always have something useful to act on instead of a dead "no results" screen.*

**Acceptance Criteria**

**A. Trigger conditions (when fallback augmentation runs)**
1. Fallback augmentation triggers when **any** of these is true after provider search returns:
   - (a) **Zero exact matches** for the resolved intent; OR
   - (b) **Fewer than N exact matches** (N per convention; recommend 3) — exact matches are shown first, then augmented with alternatives to reach a useful set; OR
   - (c) The user's **hard constraints cannot be fully satisfied** by any real offer — e.g., requested storage/color/budget combination returns nothing, but the same model exists in another storage/color or just above budget.
2. When exact matches ≥ N exist, fallback augmentation does **NOT** run; the normal exact ranked set is shown unchanged (no alternatives injected). *(Observable: an exact-rich query shows zero alternative-tagged cards.)*
3. The trigger decision is computed **server-side** from the real fetched offer set, not guessed by the client.

**B. What the AI surfaces (ranked, clearly labeled) — only real offers**
4. Every surfaced alternative is a **REAL fetched offer** present in the provider result set — with a real provider, real price, real deep link. No product, price, spec, or availability is invented, inferred, or hallucinated. *(QA oracle: every alternative card's offer ID/price/provider must trace to a fetched offer record; zero synthesized entries.)*
5. Exact matches (if any) are shown **first**, in their own group above alternatives, and are visually distinct from alternatives.
6. Alternatives are produced from these relation classes, surfaced when genuinely present in real offers, in this default ranked priority:
   - (i) **Nearest variant of the SAME model** — different storage and/or color of the exact model the user asked for.
   - (ii) **Adjacent model, same line** — e.g., iPhone 16 → 16 Plus / 16 Pro, or previous/next generation (iPhone 15 / 17) of the same brand line.
   - (iii) **Same category near budget** — other products in the same category within or just outside the stated budget (recommend within ±15% of budget for "near"; **[Q-PO]** confirm band).
   - (iv) **Related / complementary** — clearly-separated companion items (e.g., case, charger, AirPods for a phone) — shown only in a separate section, never mixed into the primary alternatives.
7. Each alternative card carries a **machine-set relation tag** drawn from a closed vocabulary (UX copy in §UX): `closest`, `alternative`, `within_budget`, `related`. The tag is always visible on the card so the user knows it is **not** an exact match.
8. Each alternative card includes a **"why this"** explanation that states, truthfully, **how the offer relates to the request** and **how it differs from what was asked** (e.g., "Same model, 256GB instead of 128GB", "Same line, the Pro version", "iPhone 15 — previous generation, within your budget"). The explanation references only real attributes of the fetched offer.
9. Relation classes (i)–(iv) are rendered in **clearly separated, labeled sections** (or visually distinct groups); the user can always tell which section an offer belongs to. Complementary/related items (iv) are never presented as if they answer the original request.
10. The total surfaced set is bounded (recommend show up to the top alternatives that meet a minimum relevance threshold; **[Q-PO]** confirm cap, recommend 10) and ranked so that more-relevant relations (closest variant) outrank weaker ones (related/complementary). Within a relation class, normal ranking (price/relevance per existing ranking logic) applies.

**C. Truthfulness & traceability**
11. The "why this" copy never claims an attribute the offer does not have; if the offer's color/storage is unknown in the data, the explanation omits that dimension rather than asserting it. *(Oracle: explanation tokens must be derivable from the offer record's fields.)*
12. No alternative is tagged `closest`/`within_budget` unless it factually qualifies (closest = minimal attribute distance from request; within_budget = price ≤ stated budget). A `within_budget` tag on an over-budget offer is a defect.
13. If budget was specified, any alternative **above** budget is tagged with its delta context (e.g., "+8 KWD over budget") and is **never** tagged `within_budget`. **[Q-PO]** confirm we surface just-over-budget items at all (recommend: yes, clearly labeled, ranked below within-budget).

**D. Empty-empty case (truly nothing relevant)**
14. Only when **no exact match AND no relevant alternative of any class** exists does the app show a **helpful empty state** (not a dead "0 results"): it explains nothing was found and offers **actionable broadening suggestions** — e.g., remove the color filter, raise the budget, try the category, or a near-spelling/category suggestion. *(Oracle: empty-empty screen always contains ≥1 actionable suggestion control; never a bare "no results".)*
15. Each broadening suggestion, when tapped, **re-runs the search with the relaxed constraint** (e.g., drops color, widens budget) and shows the new result set; suggestions reflect which constraint(s) were the binding ones.
16. The empty-empty state does **not** fabricate suggestions for products known not to exist in the data; suggestions are constraint-relaxations or category pivots, not invented SKUs.

**E. Behavioral & cross-cutting**
17. Fallback adds bounded latency: alternatives are derived from the same fetched offer set / adjacency lookups; the augmented set respects the time-to-result KPI (target p90 unchanged; **[Q-PO]/architect** confirm latency budget).
18. A fallback-augmented result still counts as exactly one search for F-D2 metering (no extra free-search consumed for receiving alternatives).
19. All section headers, relation tags, "why this" copy, and the empty-empty state render correctly in **AR (RTL) and EN**, AR-first.
20. The result set logs an anonymized **`fallback_served`** event (relation classes present, counts per class, whether exact matches existed) and **`empty_empty`** event when AC-14 fires — **no PII, no raw query text with identifiers** — to power the KPIs below.

---

## UX copy (AR-first + EN)

**Section headers**
| Section | AR | EN |
|---|---|---|
| Exact matches group | نتائج مطابقة | Exact matches |
| Closest variants (same model) | الأقرب لطلبك | Closest to your request |
| Adjacent models | موديلات قريبة | Similar models |
| Same category near budget | ضمن ميزانيتك | Within your budget |
| Related / complementary | منتجات مكمّلة | Related products |
| Empty-empty | لم نجد تطابقًا — جرّب توسيع البحث | No exact match — try widening your search |

**Relation tags (on card)**
| Tag key | AR | EN |
|---|---|---|
| `closest` | أقرب نتيجة | Closest |
| `alternative` | بديل | Alternative |
| `within_budget` | ضمن ميزانيتك | Within budget |
| `related` | منتج مكمّل | Related |
| over-budget context | أعلى من ميزانيتك بـ {delta} | {delta} over budget |

**"Why this" pattern (truthful, attribute-based)**
- AR: «نفس الموديل، {سعة/لون} بدل {المطلوب}» · «نفس السلسلة، إصدار {Pro/Plus}» · «الجيل السابق، ضمن ميزانيتك»
- EN: "Same model, {storage/color} instead of {requested}" · "Same line, the {Pro/Plus} version" · "Previous generation, within your budget"

**Broadening suggestions (empty-empty)**
- AR: «أزل فلتر اللون» · «ارفع الميزانية» · «تصفّح الفئة كاملة»
- EN: "Remove color filter" · "Raise the budget" · "Browse the whole category"

> **[Q-PO]** review/approve Kuwaiti-dialect phrasing; ties to open S0-3 dialect-coverage question.

---

## Edge cases
- **Exact + few:** 1 exact match exists but < N — exact shown first, alternatives fill below; the single exact is NOT mislabeled as an alternative.
- **Budget-only failure:** model+storage+color all exist but every offer is over budget → surface the same configs over-budget with delta tags + within-budget category alternatives; not an empty state.
- **Color-only failure:** requested color unavailable but other colors exist → those are `closest` (same model, different color), color is the only differing dimension in "why this".
- **Ambiguous/typo intent:** unresolved or misspelled model → resolve via clarifier (≤3, existing flow) BEFORE declaring no-match; fallback is not a substitute for clarification.
- **Discontinued / future model:** requested model not in any provider catalog → adjacent-generation offers become the primary alternatives (`alternative`), "why this" states it's a newer/older generation.
- **Provider failure (not true empty):** if zero results are due to all providers erroring, show the provider-error/degraded state (and do NOT count the search per F-D2 edge) — do NOT present it as empty-empty or fabricate alternatives.
- **Related-only result:** if only complementary items (iv) exist and no closer relation → treat as empty-empty for the *primary* request (AC-14) but may still show the related section clearly separated; do not imply the accessory answers the query.
- **Over-cap relevance:** more qualifying alternatives than the display cap → keep the highest-ranked per AC-10; never drop all of one class silently if higher classes overflow (**[Q-PO]** confirm whether to guarantee ≥1 of each present class).

---

## KPIs
> From anonymized `fallback_served` / `empty_empty` / existing offer-tap events. Extend the S0-4 search KPIs.

| # | KPI | Definition | Why it matters |
|---|-----|------------|----------------|
| 1 | **Dead-end avoidance rate** | % of searches that would have been zero/weak that instead served ≥1 relevant alternative (1 − empty_empty rate among triggered searches) | The headline goal — "never a dead no-results state." Target high (e.g. ≥90% of weak searches augmented). |
| 2 | **Fallback trigger rate** | % of all searches that hit a fallback trigger (A: zero / <N / constraint-unsatisfiable) | Sizes how often exact supply fails; informs catalog/provider gaps. |
| 3 | **Alternative click-through** | % of fallback-served result sessions with ≥1 tap on an alternative card (and on a deep link) | Proves alternatives are genuinely useful, not noise; primary monetization proxy for the fallback path. |
| 4 | **CTR by relation class** | Tap rate split by `closest` / `alternative` / `within_budget` / `related` | Tells which relation types are worth surfacing; prune low-value classes. |
| 5 | **Empty-empty rate** | % of searches reaching the true empty state (AC-14) | Should trend down; spikes flag catalog/coverage gaps or over-tight triggers. |
| 6 | **Broaden-suggestion uptake** | % of empty-empty states where a broadening suggestion is tapped, and % of those that then yield results | Validates the empty state is actionable, not a soft dead-end. |
| 7 | **Post-fallback satisfaction proxy** | Deep-link hand-off rate on fallback sessions vs exact-match sessions | Detects if fallback hand-offs convert materially worse (quality guardrail). |

> **[Q-PO]** ratify N, budget band (±15%), display cap (10), and KPI targets after a first cohort baseline.

---

## Open product questions for the PO
1. **N (relevance floor)** — recommend 3 (AC convention / AC-1b).
2. **Near-budget band** — recommend ±15% (AC-6 iii).
3. **Surface over-budget items?** — recommend yes, delta-tagged, ranked below within-budget (AC-13).
4. **Display cap** for total alternatives — recommend 10 (AC-10).
5. **Guarantee ≥1 of each present relation class** vs pure ranking (edge "over-cap").
6. **Kuwaiti-dialect phrasing** approval for headers/tags (ties to S0-3).
7. **Latency budget** for the augmentation step (with architect, AC-17).

---

## Handoff
- **Done:** New story F-SR1 "Smart no-match fallback" with 20 numbered testable AC (triggers, real-only alternatives + relation classes + tags, truthful "why this", empty-empty broadening state, AR/EN UX copy, edge cases, 7 KPIs, 7 open PO questions).
- **Next:**
  - **bo-dev-lead (implementation):** build server-side trigger logic (zero / <N / constraint-unsatisfiable), adjacency/variant derivation over the REAL fetched offer set only, closed-vocab relation tagging, ranked grouping, broaden-and-rerun on empty-empty, and the `fallback_served`/`empty_empty` anonymized events. Hard rule: every alternative traces to a fetched offer record — no synthesized products/prices. Confirm latency budget with architect.
  - **bo-ux-lead (alternative-card tags/section):** design the grouped result layout (exact group + separated relation sections), the on-card relation tag chips (`closest`/`alternative`/`within_budget`/over-budget delta/`related`), the "why this" line, and the actionable empty-empty state with broadening controls — AR-first RTL + EN per the UX copy table.
  - **bo-qa-lead-frontend:** convert AC to tests; mandatory oracles: (a) every alternative offer ID traces to a real fetched offer (no fabrication, AC-4/11), (b) exact-rich query shows zero alternative cards (AC-2), (c) `within_budget` never on over-budget offer (AC-12/13), (d) empty-empty always has ≥1 actionable broaden control (AC-14).
- **Owner:** PO (ratify the 7 open questions, esp. N, budget band, over-budget surfacing); bo-dev-lead + bo-ux-lead (implementation/design); bo-business-analyst (revisions post-answers).
- **Blockers/risks:** Fallback quality depends on real catalog breadth — sparse provider data (Food, S0-2) may force frequent empty-empty; truthfulness rule (real offers only) is non-negotiable and must be enforced in code + tests, not just prompt. N / budget-band / cap are unratified placeholders that affect behavior.
