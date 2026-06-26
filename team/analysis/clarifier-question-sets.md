# Clarifier Question Sets — Per-Sector ≥5 Clarifier Flow (2026-06-26)

> Owner: bo-business-analyst · Status: draft for PO review · 2026-06-26
> Source directive: **NEW OWNER DIRECTIVE (2026-06-26)** — "Irrespective of sector, the AI must ask AT LEAST 5 clarifying questions to narrow what the user actually needs BEFORE running the search and fetching results."
> **This OVERRIDES** the prior `0–3` clarifier cap and the prior "food/real-estate are discovery sectors with no clarifiers" rule (S0-4 C2, flows-and-ia §0.2). Those are now SUPERSEDED.
> Style/conventions inherit from `feature-acceptance-criteria.md` and `mvp-scope-and-stories.md`. AC are the QA oracle: each is a single observable, testable assertion. **[Q-PO]** = open product question.
> Cross-cutting locks that apply to every question below: **AR-first / RTL-native**, **Western 0-9 numerals everywhere** (locked 2026-06-26, flows-and-ia §4), no PII in analytics, never a dead end.

---

## 0. Conventions used in this doc
- **VERIFIED** = confirmed by this owner directive or an already-ratified decision. **ASSUMED** = this owner's draft pending PO confirmation (carries a recommended default).
- **Dimension** = the single attribute a question narrows (e.g. storage, budget). One question = one dimension (keeps each answer independently usable by the relevance filter).
- **Chip options** = tap-to-answer presets (fast path). **Free-text fallback** = the user may type instead, always available. **Skip** = an explicit per-question control that lets the user pass without answering (the AI still asks all ≥5).
- **Required vs Skippable** describes whether an UNANSWERED question blocks search. **No question blocks search** — "Required" here means "the AI must still ASK it and a skip leaves a low-confidence gap the relevance filter widens"; it does NOT mean the user is forced to answer (the directive demands a skip option per question). So all questions are *asked-mandatory* but *answer-skippable*; "Required/Skippable" below flags how heavily a skipped answer degrades relevance.
- **Numerals:** all budgets/quantities/counts display Western 0-9 (e.g. "150 KWD", "4 people"), in both AR and EN.
- **Order matters:** questions are ordered broad→narrow so each answer scopes the next (the funnel tightens). The AI MAY reorder/skip *asking* a dimension only if the user's free-text intent already stated it unambiguously (see RULE-7), but the count of distinct dimensions resolved must still be ≥5 before search.

---

## 1. ELECTRONICS — clarifier flow (≥5)

> Intent example: "good phone under 150 KWD". Spec-oriented narrowing.

| # | Dimension | AR (RTL, primary) | EN (mirror) | Chips (+ free-text fallback) | Skip | Required/Skippable |
|---|-----------|-------------------|-------------|------------------------------|------|--------------------|
| 1 | Exact model / variant | أي موديل أو فئة تحديدًا تبحث عنه؟ | Which exact model or variant are you after? | [iPhone 17 Pro Max] [iPhone 17] [Samsung S25] [أي موديل / Any] + free text | yes | Required (highest-signal) |
| 2 | Storage | كم سعة التخزين؟ | How much storage? | [128 GB] [256 GB] [512 GB] [1 TB] [غير مهم / Any] | yes | Required |
| 3 | Color | أي لون تفضل؟ | Which color? | [أسود/Black] [أبيض/White] [أزرق/Blue] [طبيعي/Natural] [أي لون / Any] | yes | Skippable |
| 4 | Budget range | كم ميزانيتك؟ | What's your budget? | [< 100 KWD] [100–150 KWD] [150–250 KWD] [250+ KWD] + free text | yes | Required |
| 5 | Condition (new / used) | جديد أو مستعمل؟ | New or used? | [جديد / New] [مستعمل / Used] [مجدّد / Refurbished] [لا يهم / Either] | yes | Required |
| 6 | Brand preference | هل لديك ماركة مفضلة؟ | Any preferred brand? | [Apple] [Samsung] [Xiaomi] [أي ماركة / Any] | yes | Skippable |
| 7 | Must-have specs | أي مواصفة لا غنى عنها؟ | Any must-have spec? | [كاميرا / Camera] [بطارية / Battery] [5G] [شاشة كبيرة / Big screen] [لا شيء / None] + free text | yes | Skippable |
| 8 | Accessories / bundle | تريد ملحقات مع الجهاز؟ | Want accessories with it? | [شاحن / Charger] [كفر / Case] [سماعات / Earbuds] [بدون / None] | yes | Skippable |

**Floor:** ask Q1–Q5 (the 5 highest-signal: model, storage, color, budget, condition) as the mandatory ≥5. Q6–Q8 are an OPTIONAL extension the AI may add when intent is broad. **[Q-PO]** confirm the canonical 5 are {model, storage, color, budget, condition} (recommend yes).

---

## 2. FOOD — clarifier flow (≥5)

> Intent example: "grilled chicken near me". Dish-oriented narrowing. This sector previously had NO clarifiers (discovery) — now ≥5 per directive.

| # | Dimension | AR (RTL, primary) | EN (mirror) | Chips (+ free-text fallback) | Skip | Required/Skippable |
|---|-----------|-------------------|-------------|------------------------------|------|--------------------|
| 1 | Dish / cuisine type | أي طبق أو مطبخ تريد؟ | Which dish or cuisine? | [دجاج مشوي / Grilled chicken] [برجر / Burger] [بيتزا / Pizza] [مندي / Mandi] + free text | yes | Required |
| 2 | For how many people | لكم شخص؟ | For how many people? | [1] [2] [3–4] [5+] + free text | yes | Required |
| 3 | Budget per order | كم ميزانية الطلب؟ | Budget for the order? | [< 5 KWD] [5–10 KWD] [10–20 KWD] [20+ KWD] + free text | yes | Required |
| 4 | Delivery vs pickup + area | توصيل أو استلام؟ ومن أي منطقة؟ | Delivery or pickup? Which area? | [توصيل / Delivery] [استلام / Pickup] + area free text (e.g. Salmiya, Hawally) | yes | Required |
| 5 | Dietary / restrictions | أي قيود غذائية؟ | Any dietary restrictions? | [حلال / Halal] [نباتي / Vegetarian] [بدون مكسرات / Nut-free] [لا يوجد / None] | yes | Required |
| 6 | Spice level | درجة الحرارة/البهارات؟ | Spice level? | [خفيف / Mild] [وسط / Medium] [حار / Hot] [لا يهم / Any] | yes | Skippable |
| 7 | Sides / extras | تريد أطباق جانبية؟ | Want sides or extras? | [بطاطس / Fries] [أرز / Rice] [سلطة / Salad] [مشروب / Drink] [بدون / None] | yes | Skippable |
| 8 | Occasion / timing | المناسبة أو الوقت؟ | Occasion or timing? | [الآن / Now] [غداء عائلي / Family lunch] [عزيمة / Gathering] + free text | yes | Skippable |

**Floor:** ask Q1–Q5 (dish, people, budget, delivery+area, dietary) as the mandatory ≥5. Q6–Q8 optional extension. **[Q-PO]** confirm Food's mandatory 5 (recommend the set above); confirm "area" is mandatory given delivery-zone relevance.

---

## 3. REAL ESTATE (FLATS) — clarifier flow (≥5)

> Intent example: "2-bedroom flat in Salmiya". Property-oriented narrowing. Previously discovery (no clarifiers) — now ≥5 per directive. Grounded in `team/research/real-estate-providers-feasibility.md`.

| # | Dimension | AR (RTL, primary) | EN (mirror) | Chips (+ free-text fallback) | Skip | Required/Skippable |
|---|-----------|-------------------|-------------|------------------------------|------|--------------------|
| 1 | Rent vs buy | إيجار أو تمليك؟ | Rent or buy? | [إيجار / Rent] [تمليك / Buy] | yes | Required (highest-signal) |
| 2 | Area(s) | أي منطقة أو مناطق؟ | Which area(s)? | [السالمية / Salmiya] [حولي / Hawally] [الجابرية / Jabriya] [المهبولة / Mahboula] + free text | yes | Required |
| 3 | Bedrooms | كم غرفة نوم؟ | How many bedrooms? | [استوديو / Studio] [1] [2] [3] [4+] | yes | Required |
| 4 | Budget range | كم الميزانية؟ (شهري للإيجار) | Budget range? (monthly for rent) | rent: [< 250] [250–400] [400–600] [600+ KWD] · buy: free text | yes | Required |
| 5 | Furnished / unfurnished | مفروشة أو غير مفروشة؟ | Furnished or unfurnished? | [مفروشة / Furnished] [غير مفروشة / Unfurnished] [شبه مفروشة / Semi] [لا يهم / Any] | yes | Required |
| 6 | Floor / parking / amenities | متطلبات: دور، موقف، مصعد، مسبح؟ | Floor / parking / amenities? | [موقف / Parking] [مصعد / Elevator] [مسبح / Pool] [بلكونة / Balcony] [لا شيء / None] | yes | Skippable |
| 7 | Move-in timing | متى تريد الانتقال؟ | Move-in timing? | [فورًا / Now] [خلال شهر / Within 1 month] [مرن / Flexible] | yes | Skippable |
| 8 | Family vs bachelor | للعائلة أو للعزّاب؟ | Family or bachelor? | [عائلة / Family] [عزّاب / Bachelor] [لا يهم / Any] | yes | Skippable (locally significant in Kuwait) |

**Floor:** ask Q1–Q5 (rent/buy, area, bedrooms, budget, furnished) as the mandatory ≥5. Q6–Q8 optional extension. **[Q-PO]** confirm; note family-vs-bachelor (Q8) is a real Kuwait listing filter and may warrant promotion into the mandatory 5.

---

## 4. GENERAL PATTERN — any future sector (the reusable template)

> When a new sector is added, the BA defines its clarifier set by filling this template. The ≥5 floor is sector-agnostic (VERIFIED by directive).

**Mandatory 5 dimensions (pick the 5 highest-relevance-signal for the sector), ordered broad→narrow:**
1. **WHAT exactly** — the specific item/model/dish/property-type (disambiguates the request).
2. **KEY VARIANT** — the one attribute that most splits the catalog (storage / size / bedrooms / quantity).
3. **BUDGET** — price range or band (every sector has a money axis; drives the relevance filter's price gate).
4. **CONSTRAINT / QUALIFIER** — a hard filter (new-vs-used / dietary / furnished / delivery-area).
5. **PREFERENCE** — a softer ranking signal (color / brand / spice / amenities).

**Optional extension (Q6+):** add when the user's intent is broad or the sector benefits from finer narrowing — but never reduce below the 5 floor.

**Per-question requirements (every sector, every question):**
- AR text first (RTL), EN mirror; Western 0-9 numerals.
- ≥2 chip presets covering the common cases + an "Any / لا يهم" chip + free-text fallback.
- An explicit Skip control.
- Maps to exactly ONE dimension consumed by the relevance filter.

---

## 5. RULES (testable AC — the QA oracle)

> Story: *As a user with a vague intent, I want the AI to ask a focused set of questions before searching, so that the results match what I actually need — not a generic guess.*
> Story (business): *As the business, we want ≥5 narrowing questions per request, so that every search reaches providers with enough signal to return relevant, conversion-worthy results.*

1. **Minimum-5 floor (VERIFIED).** For EVERY sector, the AI asks **at least 5** distinct clarifying questions before any provider search is dispatched. A search request to providers MUST NOT fire until ≥5 distinct dimensions have been *presented to the user* (answered or skipped). Testable: instrument the clarifier loop; assert `questions_presented >= 5` precedes the `provider_search_dispatched` event for 100% of searches, all sectors.
2. **No drift / same-item only (VERIFIED).** Every question must narrow the SAME requested item/category the user stated. A question MUST NOT introduce a different product, upsell a different category, or change the subject. Testable: each generated question references the active intent/dimension; an automated check (and review) rejects any question whose dimension is not in the active sector's defined set for the resolved item.
3. **Each answer tightens later relevance (VERIFIED).** Every collected answer (chip or free-text) is appended to the structured query passed to the relevance filter; a later question MAY adapt its chips based on earlier answers (e.g. budget chips shift after model is chosen) but MUST NOT contradict them. Testable: the query object sent to search contains one field per answered dimension; toggling an answer measurably changes the result set / ranking.
4. **Skip per question, but still ask all ≥5 (VERIFIED).** Each question exposes an explicit Skip control so the user is never fully blocked. A skip records "no preference" for that dimension (the relevance filter widens that axis) and the AI **proceeds to the next question** — a skip does NOT reduce the ≥5 count and does NOT short-circuit to search. Testable: skipping every one of the 5 still results in exactly ≥5 presented questions, then a search with all-widened axes (a valid, broad result set — never an error/dead end).
5. **Answers feed the relevance filter (VERIFIED).** Results MUST be filtered/ranked by the collected answers; a result that violates a hard constraint answered by the user (e.g. wrong storage, over budget, wrong area, non-halal) must not rank above conforming results, and hard-constraint violations are excluded or clearly de-prioritized (ties to no-match fallback `no-match-fallback-ac.md`: if constraints make the set empty, the fallback surfaces real ranked alternatives — never a dead "0 results"). Testable: for a fully-answered intent, every top result satisfies the hard constraints, or is labeled as a fallback alternative.
6. **AR-first / RTL + Western numerals (VERIFIED — inherited lock).** Every question, chip, skip control, and progress indicator renders AR-first RTL with EN mirror; all numbers (budgets, GB, bedrooms, counts) use Western 0-9 in both locales. Testable: render each sector's set in AR and EN; assert RTL layout and 0-9 numerals.
7. **Pre-answered dimensions still count, never re-asked redundantly (VERIFIED).** If the user's free-text intent already unambiguously states a dimension (e.g. "256GB iPhone 17 Pro Max"), the AI MAY treat that dimension as resolved and MUST NOT ask it as a redundant question — BUT the total distinct dimensions resolved before search must still be **≥5** (the AI asks additional in-scope narrowing questions to reach 5). Testable: a fully-specified 5-dimension intent still produces ≥5 *resolved* dimensions; a 2-dimension intent triggers ≥3 more asked questions. **[Q-PO]** confirm pre-stated dimensions count toward the 5 (recommend yes — re-asking what the user already said is the interrogation we want to avoid).
8. **Clarifier turns do NOT consume a free search (VERIFIED — inherited).** The ≥5 clarifier Q&A is part of ONE search; the freemium counter (F-D2 AC-1) increments only when the resolved intent reaches provider search and produces a result set — never per question. Testable: completing 5+ clarifiers + 1 search increments the free counter by exactly 1.
9. **Order is broad→narrow (ASSUMED).** Questions are presented most-disambiguating first (the "WHAT exactly" before "preference") so an early skip still leaves a usable scope. Testable: question order matches the sector's defined order. **[Q-PO]** confirm fixed order vs AI-adaptive order (recommend: fixed mandatory-5 order, adaptive only for the optional Q6+ extension).
10. **Speed budget (ASSUMED).** The ≥5 clarifier loop runs on the **fast model**, answers are chip-first (one tap), and the whole clarifier phase should target a **median ≤ 60s** to completion (≤ ~10–12s perceived per question with chips). Testable: instrument clarifier-phase duration; track median + p90. **[Q-PO]** ratify the time target.

---

## 6. UX trade-off & how to keep it fast

**The trade-off (stated honestly):** the prior model optimized for "ask 0–3, deliver fast" (P2 persona "Saud" explicitly *wins when the AI asks at most 1–3 questions*). The new ≥5 floor **deliberately trades brevity for precision** — more questions = a longer pre-search path = higher risk of mid-clarifier abandonment, especially for the impulsive/decisive persona. This is a real tension with the existing persona research and must be watched.

**Mitigations to keep ≥5 fast and low-friction:**
- **Chips-first, one-tap answers** — every question leads with tap-chips (incl. an "Any / لا يهم" chip) so the default path is 5 taps, not 5 typed sentences. Free-text is the fallback, not the primary.
- **Smart defaults / pre-fill from intent** — RULE-7: dimensions the user already stated are pre-resolved and not re-asked, so a specific intent reaches the 5 faster (fewer NEW questions).
- **Fast model for the clarifier loop** — the clarifier generation uses the fast/cheap model (RULE-10); the heavier reasoning is reserved for ranking/relevance after search.
- **Visible progress** — a "3 of 5 / ٣ من ٥" indicator (Western numerals) so users see a short, bounded end — reduces abandonment vs an open-ended interrogation.
- **Skip is always one tap** — no question is a wall; a user in a hurry can chip-skip through all 5 in seconds and still get a (broad) real result.
- **Bundle low-signal dimensions into the optional Q6+** — only the 5 highest-signal dimensions are mandatory; we don't pad to 8.

**New KPIs to instrument the trade-off (extend S0-4 KPI set):**
| KPI | Definition | Why |
|-----|------------|-----|
| **Clarifier completion rate** | % of started clarifier flows that reach search (vs abandoned mid-questions) | Direct measure of whether ≥5 causes drop-off |
| **Clarifier-phase duration** | Median + p90 seconds from Q1 shown → search dispatched | Guards the "keep it fast" promise (RULE-10) |
| **Skip rate per question** | % of each question that is skipped | High skip on a question = low-value dimension, candidate to demote/cut |
| **Relevance lift** | Search-to-result / CTR for ≥5-clarified searches vs the old ≤3 baseline | Proves the precision the extra questions buy is worth the friction |

> **Supersedes:** S0-4 "Clarifier efficiency: avg clarifiers ≤3" KPI is now **obsolete/inverted** — the target is no longer "fewer"; it is "≥5 asked, high completion, high relevance lift." **[Q-PO]** ratify replacing the ≤3 efficiency KPI with the four above.

---

## 7. Consolidated open product questions for the PO
1. **Is 5 a hard floor for EVERY sector, or can a sector justify more (or fewer) as its mandatory count?** (e.g. real estate may warrant 6 with family-vs-bachelor). Directive says "at least 5" → floor is 5; confirm whether some sectors get a higher mandatory floor.
2. Confirm the **canonical mandatory-5** per sector (Electronics §1, Food §2, Real estate §3 floors).
3. **RULE-7:** do pre-stated dimensions count toward the 5 (recommend yes), or must the AI always ask 5 NEW questions regardless?
4. **RULE-9:** fixed question order vs AI-adaptive order for the mandatory 5.
5. **RULE-10:** ratify the clarifier-phase median ≤60s speed target + fast-model use.
6. Confirm **Food "area" and "delivery vs pickup"** belong in the mandatory 5 (delivery-zone relevance).
7. Confirm **real-estate family-vs-bachelor** stays optional or is promoted into the 5 (Kuwait-significant).
8. Ratify **replacing the obsolete "≤3 clarifier efficiency" KPI** with the four trade-off KPIs in §6.
9. Persona conflict: P2 "Saud wins when asked ≤1–3 questions" now contradicts the ≥5 floor — **accept the persona-research tension** as a known trade-off, or carve a "specific intent → fewer asked via RULE-7" fast lane? (recommend: RULE-7 fast lane is the reconciliation).

---

## Handoff
- **Done:** Per-sector ≥5 clarifier flows (Electronics, Food, Real estate) + a reusable general template for future sectors; each question with dimension, AR-first/EN text (Gulf-friendly), chips + free-text fallback, skip control, required/skippable flag; 10 testable RULES/AC; UX trade-off analysis + 4 new KPIs; 9 open PO questions. This document **supersedes** the prior 0–3 clarifier cap (S0-4 C2, flows-and-ia §0.2) and the "food/real-estate = no clarifiers" rule.
- **Next:**
  - **bo-dev-lead** — implement the ≥5 per-sector clarifier LOOP: enforce RULE-1 (no provider search until ≥5 dimensions presented), RULE-3/5 (each answer appended to the structured query that feeds the relevance filter), RULE-4 (per-question skip that widens not blocks), RULE-7 (pre-resolved dimensions from free-text intent still count), RULE-8 (clarifier turns don't increment the F-D2 free counter), RULE-10 (fast model for clarifier generation). Config-drive the question sets per sector (data, not hardcoded) so adding a sector = adding a set via the §4 template.
  - **bo-ux-lead** — design the MULTI-question clarifier flow (now 5–8 questions, not 0–3): chip-first one-tap layout, "N of 5 / ٣ من ٥" progress indicator (Western numerals), per-question skip affordance, AR-first/RTL mirror, fast perceived pacing; update `flows-and-ia.md` §0.2 + the clarifier step in §2 flow + the `/search/clarify` screen to reflect ≥5; reconcile the P2 "Saud" impulse-buyer persona with the longer flow.
  - **bo-tech-architect** — confirm clarifier-loop enforcement contract (server-authoritative ≥5 gate before search dispatch), structured-query schema (one field per dimension) the relevance filter consumes, fast-model routing for the clarifier.
  - **bo-qa-lead-frontend / bo-qa-backend** — convert the 10 RULES to tests; mandatory: RULE-1 (≥5 before search, all sectors), RULE-2 (no-drift — questions stay on the same item), RULE-4 (skip-all-5 still searches, never dead-ends), RULE-5 (answers gate/rank results), RULE-8 (clarifier turns don't burn a free search).
- **Owner:** PO (ratify the 9 open questions, esp. #1 "is 5 a hard floor for every sector or can a sector justify more"); bo-dev-lead + bo-ux-lead (implementation); bo-business-analyst (revisions post-answers).
- **Blockers/risks:** **Persona-research conflict** — P2 "Saud" explicitly wins at ≤1–3 questions; ≥5 trades against that documented insight (mitigated by RULE-7 fast lane + chip-first, but real abandonment risk — must watch the clarifier completion-rate KPI). **Obsolete KPI** — the S0-4 "≤3 clarifier efficiency" target is now inverted and needs PO ratification to retire. Several mandatory-5 sets carry **[Q-PO]** placeholders that must be answered before "ready for build."
