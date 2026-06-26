# AI Integration & Anonymized Data Pipeline (S1-4)

> Owner: bo-tech-architect · Status: draft for Dev Lead/QA · 2026-06-25
> Source: `Concept.txt`, locked decisions, `team/research/localization-arabic.md` (S0-3), `team/analysis/feature-monetization-proposal.md` (§3 logging schema).
> Companion: `system-design.md` (S1-3). Principle: simplest design meeting AC (YAGNI); cost explicit.

## Locked inputs
- LLM = **Claude (Anthropic)**. Model: **Claude Opus 4.8** (`claude-opus-4-8`) for the reasoning/clarify/rank path; **Claude Haiku 4.5** (`claude-haiku-4-5`) for cheap deterministic steps (language detect, glossary normalization). Anthropic **TypeScript SDK** (matches the Node BE).
- Strategy (S0-3): **accept Kuwaiti/Gulf colloquial + code-switch INPUT; reply MSA + English; RTL-first.**
- Clarifier loop **bounded 0–3 questions** (AC C2.1) with a loop guard (AC C2.6).
- **Day-one anonymized logging, no UX cost** (BA §3 schema).

---

## ADR-002 — Claude integration shape

**Context.** Conversational, intent-first search in dialect Arabic + English with a bounded clarifier loop, then ranking + "why this offer." Latency-sensitive ("real-time but fast"), cost-sensitive (tokens are the dominant variable cost), and trust-critical (no invented claims — AC D3.3).

**Decision — three bounded Claude calls, code-orchestrated (workflow, not an open-ended agent).** We control the loop; Claude does NL understanding, question selection, and explanation — not tool-driven autonomy. (Per claude-api guidance: stay at the workflow tier; an agent isn't justified here.)
1. **Intent + clarifier step** (Opus 4.8) — input: user message(s) + sector + conversation state. Output via **structured outputs** (`output_config.format`): `{intent_normalized{category,brand?,model?,constraints}, need_clarification: bool, questions?[{dimension, text_ar, text_en, chips[]}], assumptions?[]}`. Bounded to ≤3 total questions by passing `clarifier_state` (asked dimensions) back in and instructing skip-if-specific (AC C2.4) + never-re-ask (AC C2.6, enforced in code too).
2. **Ranking + "why"** (Opus 4.8) — input: normalized intent + the `Offer[]` from `resolveOffers` (price, attrs, provider). Output (structured): ordered `sku/offer ids` + per-offer `why_ar/why_en` grounded **only** in supplied fields. Code assembles final cards; **price/rank facts come from data, not the model** (model orders + explains, never invents a price).
3. **Language detect / dialect normalize** (Haiku 4.5, or rules-first) — sentence-level language tag for code-switching + dialect→MSA glossary normalization feeding step 1.

**Why structured outputs + Opus 4.8 adaptive thinking.** Structured outputs make responses machine-safe (no brittle parsing; AC determinism). Opus 4.8 uses `thinking: {type: "adaptive"}` (no `budget_tokens` — removed on 4.8) and `output_config: {effort: ...}` to tune depth: clarifier step can run `medium`; ranking `high`. Parse tool/JSON inputs with `JSON.parse` (never string-match).

**Consequences.**
- (+) Predictable, parseable, testable; cost controlled by model tiering + caching + bounded loop.
- (+) Truthfulness enforced structurally (facts from DB, model explains).
- (−) Two Opus calls per completed search (clarify + rank) — mitigated by caching the stable system prompt and using Haiku for the cheap step.
- **Cost lever:** stable system prompt (few-shot + glossary) is **prompt-cached** → cache reads are far cheaper than re-sending the few-shot block every call; the volatile per-request content goes after the cache breakpoint.

---

## Clarifying-question loop (bounded)

```
intent (raw) ──► [Haiku: sentence-level lang detect + dialect→MSA normalize]
                         │  emits clarifier-friendly normalized text + locale tags
                         ▼
            ┌──────────────────────────────────────────────┐
            │  [Opus: intent + clarifier step]               │
            │  reads clarifier_state (dimensions asked)      │
            │  • intent already specific? ─► skip to search  │ (AC C2.4)
            │  • else emit 1 question (≤3 total)             │ (AC C2.1)
            └───────────────┬──────────────────────────────┘
                            │ question (chips + free-text, AR+EN)   (AC C2.2)
                            ▼
                   user answers / skips                              (AC C2.3)
                            │  (code records dimension in clarifier_state)
                            ▼
              loop guard: dimension already asked? ─► never re-ask   (AC C2.6)
              count ≥ 3 OR confident? ─► proceed to search with
                                          best-effort assumptions     (AC C2.3)
                            ▼
                        SKU resolution ─► resolveOffers ─► [Opus rank+why]
```
- **Bound enforced in code, not just the prompt** (defense-in-depth): a counter + a set of asked dimensions in `search_sessions.clarifier_state`. Claude is *asked* to respect the bound; code *guarantees* it.
- **Refinement (AC C3.2):** "make it cheaper" / "بدون بصل" re-enters at the rank step with updated constraints without restarting the flow; context retained for the search session (AC C3.1), cleared on new search (AC C3.3).

---

## System-prompt strategy

A single **stable, prompt-cached** system prompt (per claude-api caching guidance — stable content first, volatile after the breakpoint):

1. **Role & rules:** neutral KW shopping concierge; never invent prices/specs; explain only from supplied offer fields; ask ≤3 clarifiers; output strictly in the given schema.
2. **Dialect comprehension few-shot (Kuwaiti):** the S0-3 examples as input→understanding pairs, e.g.
   - `شنو أرخص آيفون ١٧ برو ماكس؟` → {cheapest, iPhone 17 Pro Max} → ask storage/color.
   - `أبي لابتوب زين للألعاب وميزانيتي محدودة` → {gaming laptop, budget-constrained} → ask budget (KWD).
   - `عندكم عروض على تلفزيونات سامسونج؟` → {offers, Samsung TVs} → ask screen size.
3. **Dialect→MSA glossary** (S0-3, hardens comprehension despite Anthropic's "MSA-focused, dialect developing" caveat):
   `شنو→ما/ما هو · أبي/أبغى→أريد · زين→جيد · كم/بكم→ما السعر · شكو→ماذا يوجد · وايد→كثير · أرخص→الأرخص`. **[R?]** native-QA pass to verify (S0-3 flag).
4. **Output register rule:** understand dialect; **reply in MSA** + English mirror; mirror the user's language choice; RTL-first.
5. **Per-request (after cache breakpoint, volatile):** sector, locale tags, `clarifier_state`, the user turn, (for rank) the `Offer[]`.

> Few-shot + glossary live in the cached prefix → one-time token cost amortized across all requests (cost lever from ADR-002).

### Sentence-level language detection (code-switching)
- Real input mixes scripts: `أبغى أكنسل أوردر number 12345`. Detect language **per sentence/segment**, not per message (S0-3, Eshal precedent).
- **Implementation:** cheap script/lang classifier first (Unicode-range + lightweight detector; Haiku fallback for ambiguous segments). Tag segments → pass both the raw mixed text and segment tags to Opus so it understands the AR parts and preserves EN product tokens (e.g., "iPhone 17 Pro Max" stays verbatim — AC F1.4). **Mirror the user's dominant language** in replies.

---

## Result ranking & "why this offer"

- **Inputs:** `intent_normalized` constraints + `Offer[]` (price_fils, attrs, provider, in_stock) from the provider-data layer.
- **Ranking:** primarily price/spec-match against the user's stated constraints (AC D2.2). **Deterministic** for the same `(query, data snapshot)` — the TTL cache snapshot (S1-3) gives a stable data set, and structured output + low-variance prompting keep order stable. **No paid/sponsored boosting** (AC D2.6, neutrality).
- **"Why this offer" (AC D3):** one line per card, must reference ≥1 attribute the user asked for (e.g., "Cheapest 256GB in black" / «الأرخص بسعة ٢٥٦ والأسود») and be **truthful to supplied data** — model phrases, never fabricates. Bilingual (`why_ar`, `why_en`).
- **Guardrail:** price, rank position, provider on the card come from the DB record; Claude supplies only the explanation text. A "why" that cites an attribute not in the offer is a bug QA can assert against.

```
intent_normalized + Offer[]  ──►  [Opus rank+why, structured out]
        │                              └─► ordered offer_ids + {why_ar, why_en}
        ▼
  code assembles cards: price/provider/deeplink from DB,
  why-text from Claude, image from offer  ──►  ranked result cards
```

---

## Anonymized event-logging pipeline (per BA §3)

> Powers KPIs (activation, search-to-result, time-to-result, clarifier-efficiency, CTR, retention) **and** the B2B moat (price history, unmet demand). Highest-value B2B assets: `offer_returned` price history + `empty_result` unmet demand.

```
any slice ──► logEvent(type, payload)   (fire-and-forget, non-blocking)
                  │
                  ▼
           in-process async queue (BullMQ / Redis)   ── never on the request path
                  │
                  ▼
            consumer ──► validate (no-PII assertion) ──► INSERT events
                                                          │
                                              (later) ──► warehouse rollups for B2B
```

**Events (BA schema, anonymized):** `intent_submitted`, `clarifier_answered`, `search_executed` (incl. `freshness source live|cache`, `latency_ms`), `offer_returned` (provider, category, price_fils, rank, why-tag → **price history**), `empty_result` (→ **unmet demand**), `card_tapped`/`handoff` (CTR + affiliate attribution), `result_refined`, `session_outcome`, `alert_triggered` (FF2).

**No-UX-cost guarantees (cross-cutting AC #3):**
- **Fire-and-forget:** `logEvent` returns immediately; enqueue only. A failed/slow sink never blocks or slows search.
- **Only `pseudo_id`** enters events — the phone (PII) never leaves `users` (privacy wall, S1-3).
- **No free-text PII:** intent is logged as **normalized category/keywords + bucketed answers** (e.g., budget→band, not raw text), so the B2B asset is clean and privacy-safe by construction.
- **Aggregated + anonymized B2B only** — never individual-identifiable (S0-5 hard rule).
- **Validation gate:** the consumer drops/sanitizes any payload that fails the no-PII assertion (defense-in-depth).

---

## Non-functional (AI-specific)
- **Latency:** clarifier step on the user's turn (interactive — acceptable seconds); rank step overlaps with offer fetch where possible. Prompt caching cuts input-token latency. Time-to-result KPI tracked via `search_executed.latency_ms`.
- **Cost:** Opus only for clarify+rank; Haiku/rules for detect+normalize; cached few-shot prefix; bounded loop caps calls per search. Monitor token spend per search as a unit-economics metric.
- **Robustness:** Claude unavailable → graceful degradation (skip clarifier, search on normalized intent; generic "why" from data) rather than a dead-end (cross-cutting AC #4). Always check `stop_reason` before reading content (Opus 4.8 may refuse); on refusal, fall back to data-only path.
- **Truthfulness:** facts from DB, model explains only — structurally prevents invented claims (AC D3.3).

---

## Legal / ToS sign-off (HARD GATE — flag to PO)
- **S0-2 risk:** scraping Electronics sites (Eureka, Best Al-Yousifi, Blink) may violate robots/ToS. **Counsel sign-off is required before any scraping ships.** The **Xcite affiliate channel is ToS-blessed** and should lead; scraping providers stay behind `providers.tos_reviewed=true` + a kill-switch.
- **Privacy/consent copy [R?]** (S0-5): anonymized-logging consent text pending legal — does not block the pipeline build (logging is privacy-safe by construction) but gates external release.
- **Action:** PO to route the scraping-ToS question to counsel before Slice 2's scrape path; affiliate + the full app can proceed meanwhile.

## Handoff
- **Done (S1-4):** ADR-002 (3 bounded Claude calls: Opus clarify + Opus rank/why + Haiku/rules detect/normalize; structured outputs; adaptive thinking; prompt-cached few-shot); bounded clarifier loop with code-enforced guard; system-prompt strategy (Kuwaiti few-shot + dialect→MSA glossary); sentence-level code-switch detection; truthful data-grounded ranking + "why this offer"; anonymized fire-and-forget logging pipeline (BA schema) with no-PII privacy guarantees; legal/ToS gate flagged.
- **Next:** Dev C builds search-orchestrator against these contracts (mock `resolveOffers`); Dev D builds the event consumer + emit helper; native-QA pass on the dialect glossary **[R?]**; QA asserts: ≤3 questions, never-re-ask, why-cites-an-asked-attribute, no-PII-in-events, non-blocking logging. PO to clear scraping ToS with counsel.
- **Owner:** bo-tech-architect (design), bo-dev-lead (build), bo-qa-backend (verification), PO/legal (ToS + consent copy), bo-researcher (glossary native QA).
- **Blockers/risks:** Claude dialect comprehension caveat (mitigated by few-shot+glossary, needs native QA); scraping ToS gate; token cost monitoring; ranking determinism under cache-window edges.
