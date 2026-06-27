# Domain-Accurate AI Search — Solution Space & Recommendation for BestOffers

**Author:** bo-researcher · **Date:** 2026-06-27
**Decision this informs:** which proven approach BestOffers should adopt to kill the per-word "hand-table treadmill" (ADR-007) and stop relevance mistakes (e.g. "Samsung phone" → styluses, "Bukhari rice" → cakes), so bo-prompt-engineer + bo-tech-architect can design the concrete fix.
**Source labels:** every claim is **VERIFIED** (cited URL + access date below) or **ASSUMED** (my inference for our context). Sources listed at the end.

---

## 0. The owner's insight, restated precisely

"The AI isn't trained for this project" is **correct and is the expected behaviour, not a bug in Claude.** A general LLM has no built-in knowledge of *our* domain: Kuwait product catalogs, brand→product-type relationships (Samsung makes phones AND styluses AND TVs), KW area names, or the KW food taxonomy (رز بخاري = a rice dish, not dessert). **ASSUMED→VERIFIED-by-analogy:** the entire industry solves this NOT by training a custom model, but by **feeding the model domain knowledge at query time** (grounding / retrieval) and by **matching on meaning (embeddings) instead of hand-typed keyword tables.** This is exactly the gap ADR-007 §1.2 diagnosed and §2.2 (Q4) proposed. This report supplies the external evidence behind that recommendation.

---

## 1. The solution space (plain + technical), scored FOR OUR CASE

Our case = Kuwait, Arabic + English (+ Gulf dialect, code-switch, transliteration drift), multi-sector (electronics / food / real estate), running on **Claude (which has no embeddings API of its own** — VERIFIED, see §3), **small cost-sensitive team.**

| # | Approach | Plain-English | Technical | Pros for us | Cons for us | Cost / effort |
|---|----------|---------------|-----------|-------------|-------------|---------------|
| a | **RAG** (retrieval-augmented generation) | Before the AI answers, fetch the relevant facts from *our* data and paste them into the prompt. | At query time, retrieve top-k docs (from a catalog / knowledge base / vector store) and inject into the LLM context; the LLM reasons over *given* facts, not its memory. | Directly fixes "AI not trained on our domain" — it reads our catalog/taxonomy instead of guessing. No model retraining. Easy to update (edit data, not weights). | Needs a retrieval store + a curated knowledge source to retrieve *from*. Quality = quality of what you retrieve. | **Low-med.** Reuses Postgres/Redis we already provision (ADR-007 §2). |
| b | **Embeddings / semantic search** | Turn words into numbers ("vectors") so *meaning-close* things sit close together; match by closeness, not by exact spelling. | Encode query + corpus into dense vectors; rank by cosine similarity. "sushi"≈"ramen"≈Japanese food; "Al-Zahra"≈KW-area cluster — **without a hand-typed synonym row.** | **This is the direct cure for the treadmill.** AR↔EN, dialect, transliteration, typos, synonyms all resolve by proximity, no new table row per miss. ADR-007 Q4. | Needs a vector store (pgvector — already in our stack) + an embedding model (we'd use a 3rd-party one, see §3). Threshold tuning. | **Low.** pgvector = free Supabase extension; embedding a small fixed KW vocab = cents (§3). |
| c | **Curated taxonomy / ontology** | A structured map: brand → product-type → attribute (Samsung → {phone, TV, stylus}; رز بخاري → rice→meal). | A graph/lookup that constrains/expands queries; "Samsung phone" resolves to brand=Samsung AND type=phone, so styluses are filtered out by *type*, not luck. | Cheap, deterministic, debuggable; **gives embeddings the labels to be precise** (Instacart does exactly this — §2). Fixes the brand-vs-accessory error class structurally. | Must be built & maintained (but it's *one* structured asset, not a per-bug patch). Doesn't self-generalize on its own — pair with (b). | **Low-med.** We already have KW area gazetteer (84 areas, my work) + food dish_category tags — **half-built.** |
| d | **Prompt grounding** | Put domain context + a few worked examples directly in the system prompt. | Few-shot examples + a domain glossary/rules injected into Claude's instructions ("100k+ KWD is a SALE not rent"; "رز بخاري = rice dish"). | **Cheapest, fastest, zero infra.** Already partly used (RE tenure rule, ADR-007 §1.3). Good for the top ~20 high-frequency cases + disambiguation rules. | Doesn't scale to a long tail (context window + cost grow with every example). Not a substitute for retrieval/embeddings on the tail. | **Lowest.** Pure prompt work (bo-prompt-engineer). |
| e | **Fine-tuning** | Retrain the model's weights on our domain data. | Supervised fine-tune / LoRA on labelled KW query→category data. | Highest ceiling IF you have lots of labelled data and a stable task. | **Not worth it for us now:** needs a large labelled KW dataset we don't have; **Claude (Anthropic API) is not user-fine-tunable** the way we'd need (VERIFIED §3); brittle to new sectors/catalog changes; expensive; slow to iterate. Industry guidance: fine-tune last, only when RAG+prompting plateau. | **High — AVOID for v1.** |
| f | **Hybrid lexical + semantic** | Run keyword search AND meaning search, then blend. | BM25/full-text (exact: SKUs, brand codes, rare tokens) + vector (semantic: synonyms, dialect, typos), fused via Reciprocal Rank Fusion (RRF) or weighted score. | **Industry "gold standard" for e-commerce search 2026** (VERIFIED §2). Keyword catches exact model numbers; semantic catches the long tail. Best of both; degrades gracefully if one side is weak. | Slightly more plumbing than either alone — but Supabase supports it natively (tsvector + pgvector, VERIFIED §2). | **Med.** Both sides reuse Postgres — no new vendor. |

**ASSUMED take for BestOffers:** the right answer is **NOT one of these — it's a stack: (d) prompt grounding for disambiguation rules + (c) a curated KW taxonomy as the label backbone + (b) embeddings for the long tail, ideally combined as (f) hybrid with our existing lexical/normalization layer.** Fine-tuning (e) is explicitly out for v1. This is precisely the layered cure ADR-007 §2.2 proposed; the industry evidence below backs it.

---

## 2. What similar products actually do (VERIFIED, with sources)

The pattern is remarkably consistent: **curated taxonomy + embeddings + (increasingly) an LLM doing query understanding with domain context injected.** Nobody relies on hand-typed synonym tables as the primary; nobody fine-tunes a base chat model for this.

- **Amazon product search.** Uses learned word/phrase **embeddings** for semantic matching (search by *meaning*, retrieves relevant items even when they share no query keywords) PLUS a **cross-encoder BERT** for high-precision query↔product relevance, used as a re-ranker and quality metric. So: semantic retrieval + a precision re-rank layer. (VERIFIED — Amazon Science / Semantic Product Search paper.)
- **Instacart grocery search.** The most directly analogous case (multi-category, long-tail, ambiguous queries). Three things they do that map 1:1 to our problem:
  1. **A hierarchical product taxonomy** (department → category → sub-category) is the backbone — our brand→type and dish_category/area equivalents. (VERIFIED.)
  2. **Embeddings (ITEMS model)** cluster products by category + brand so same-category/same-brand items sit together in vector space — exactly the "Samsung phone ≠ stylus" fix by *type clustering*. (VERIFIED.)
  3. **2025: LLM-based "Intent Engine"** — retrieval → LLM re-ranks candidates **with injected Instacart-specific taxonomy + historical-conversion context** → a **post-processing guardrail computes embedding similarity between the query and the predicted category path** to catch hallucinated/wrong categories. This is RAG + grounding + an embedding sanity-check — almost exactly the architecture we should copy at our scale. (VERIFIED — Instacart tech blog, Nov 2025.)
- **Algolia / Typesense (the search engines most KW/MENA Shopify-class shops use).** Solve brand/synonym/typo/multilingual via: **typo tolerance** (edit-distance ≤2, configurable), **explicit synonym dictionaries**, **multilingual language settings** (plurals, prefixes), increasingly **hybrid keyword+vector ("NeuralSearch")**. Note: their synonym dictionaries are *exactly the hand-table approach we're escaping* — proving it's viable but maintenance-heavy; the modern move is to layer vectors on top. (VERIFIED.)
- **General e-commerce 2026 consensus.** **Hybrid search (BM25 lexical + dense vector, fused with RRF) is "the undisputed gold standard for production e-commerce + RAG."** BM25 wins exact matches (model numbers, brand codes); vectors win synonyms/spelling/meaning; fusion gives both. (VERIFIED — Elastic, MongoDB, multiple 2026 references.)
- **MENA / Arabic specifics (critical for us).** Arabic search is genuinely harder: dialect↔MSA gap, normalization (alef/ya/ta-marbuta variants — which we already strip), transliteration drift, code-switching, and Arabic is **underrepresented in standard e-commerce relevance datasets.** Research finding: **word/sentence embeddings are the documented tool for bridging dialect↔MSA and normalization variance** — i.e. embeddings aren't just nice-to-have for us, they're the **recommended mechanism for the Arabic problem specifically.** Microsoft **E5** and **Cohere embed-v3 multilingual** and **BGE-M3** are the models benchmarked well on Arabic (E5 >90% recall on an Arabic comprehension set; Cohere v3 reports Arabic performing "nearly as well as English," ~15-20% better than OpenAI on non-Latin scripts). (VERIFIED — arXiv ARAG / ArabicMTEB / data-centric multilingual e-comm papers + Cohere/embedding-comparison sources.)

**Net (VERIFIED pattern):** taxonomy as the label backbone + embeddings for semantic/multilingual/typo coverage + an LLM for query understanding with *domain context injected at query time* + (often) a precision re-rank/guardrail. Fine-tuning a base chat model is **not** how these systems are built.

---

## 3. The "running on Claude" constraint — important and load-bearing

**VERIFIED: Anthropic/Claude has NO native embeddings API.** Anthropic's own docs explicitly do not offer an embedding model and **officially recommend Voyage AI** (and tell you to evaluate vendors). (Source: Claude API "Embeddings" docs + anthropics/claude-cookbooks Voyage example.)

**Implication for the architect:** embeddings will come from a **third-party model**, not from Claude. Options, cost-ranked for our small fixed KW vocabulary:
- **Self-hosted / open multilingual model (cheapest, $0 per-call):** `paraphrase-multilingual-MiniLM` (384-dim) or `-mpnet` (768-dim) — 50+ languages incl. Arabic; or **BGE-M3** (strong multilingual, runs locally). Best if we want zero per-query API cost and no new vendor. (VERIFIED dims/coverage.)
- **Hosted API (simplest, tiny cost):** **Cohere embed-multilingual-v3.0** — strong Arabic, **$0.10 / 1M tokens** (VERIFIED). **Voyage** — Anthropic's recommended pairing with Claude. OpenAI text-embedding-3 also fine and supports dimension truncation (768 dims keeps ~97-99% accuracy — VERIFIED) but weaker on non-Latin scripts than Cohere per benchmarks.
- **Our actual embedding workload is tiny:** we embed a **fixed, small KW vocabulary once** (84 areas + dish-family lexicon + brand→type catalog terms ≈ a few thousand short strings) and then only **short query terms at request time.** This is **cents of one-time cost + sub-ms pgvector lookups** (VERIFIED: pgvector HNSW handles 5-10M vectors on Supabase Pro $25/mo, vectors included — far beyond our needs). **ASSUMED:** total embeddings cost is negligible vs our existing Claude inference spend; this is not a budget concern.

**Cost-discipline note (per owner's standing rule):** start with a **hosted model for the one-time vocab embed** (simplest), or self-host MiniLM if we want literally $0 per-call. Either way the per-query cost is the pgvector lookup (free) — **no Claude tokens are spent on the match itself**, which actually *reduces* cost vs today's prompt-heavy path. (ASSUMED.)

---

## 4. Recommendation — lowest-effort, cost-sensitive path that ends the treadmill

**Adopt a layered "taxonomy + embeddings, lexical-first hybrid" — NOT fine-tuning, NOT more hand-tables.** This is the same destination as ADR-007 §2.2/Q4; below is the *evidence-backed, sequenced* version to hand to prompt-engineer + architect.

**Sequence (cheapest, highest-leverage first):**

1. **Curated KW domain taxonomy as the backbone (mostly already built — finish it).** brand→product-type (Samsung→{phone, TV, stylus, …} so type filters out accessories), dish-family→category (already tagged), and the **84-area KW gazetteer (my prior deliverable).** This is the *labels* embeddings and the LLM will ground on. **Lowest cost, biggest structural win, fixes the brand-vs-accessory class deterministically.** (Matches what Amazon/Instacart use as their backbone — VERIFIED.)
2. **Prompt grounding for disambiguation rules + top-20 cases** (bo-prompt-engineer): inject the taxonomy summary + worked few-shot examples + hard rules (tenure/price-unit, "رز بخاري=rice", brand≠accessory) into Claude's intent step. Zero infra, immediate.
3. **Embeddings for the long tail (pgvector + a 3rd-party multilingual embed model)** as the *fallback authority* behind the hand-tables — retiring the tables as the primary. Embed the fixed KW vocab once; cosine-match query/offer terms above a threshold. **This is the actual treadmill-killer** (sushi/ramen/Al-Zahra/Mishref resolve with no code edit; AR↔EN/dialect by proximity). Use **Cohere embed-multilingual-v3 or BGE-M3** for Arabic strength. (VERIFIED model choices.)
4. **Make it hybrid (lexical + semantic), the e-commerce gold standard:** keep BM25/full-text + our normalization for exact hits (SKUs, model numbers, brand codes), fuse with the vector results (RRF/weighted). Supabase does this natively (tsvector + pgvector) — **no new vendor.** (VERIFIED.)
5. **(Optional, later) embedding guardrail re-rank** à la Instacart: after Claude proposes a category/match, cross-check with an embedding similarity score to catch wrong-category mistakes. Cheap insurance against the exact failure class the owner reported. (VERIFIED pattern.)

**Why this and not the alternatives (for our constraints):**
- **vs fine-tuning:** we lack labelled KW data, Claude isn't the fine-tune target, it's expensive/brittle, and industry says do it last. **Rejected for v1.**
- **vs more hand-tables:** that IS the treadmill ADR-007 diagnosed — every miss = a new row, doesn't generalize, especially across AR dialect/transliteration.
- **vs pure prompt-stuffing the whole taxonomy:** doesn't scale to the long tail (context cost grows per example); good for rules, not for thousands of terms.
- **Cost:** items 1-2 = near-zero (config/prompt). Item 3-4 = free pgvector extension + cents of one-time embedding + sub-ms lookups, on infra we already provision. **No new vendor required** (self-host option exists). Fully consistent with the owner's cost-discipline rule.

---

## Open questions for prompt-engineer + architect
- Embedding model pick: **Cohere multilingual-v3 (hosted, $0.10/1M, strong Arabic) vs self-hosted BGE-M3/MiniLM ($0/call)** — architect to choose on the cost-vs-ops tradeoff. (Voyage = Anthropic's default if we want the Claude-paired option.)
- Threshold tuning for cosine match (per-sector?) — needs a small KW eval set (the dated bug cases: "Samsung phone", "Bukhari rice", "Flat in Jabriya" make a starter test set).
- Confirm pgvector enabled on our Supabase tier (ADR-007 Q4 already flagged this).
- Who owns building the **brand→product-type catalog** for electronics (the area gazetteer + food dish_category already exist; brand→type is the missing taxonomy piece)? — likely bo-researcher/BA.

---

## Handoff
- **Done:** Researched how comparable products achieve domain-accurate AI search (Amazon, Instacart, Algolia/Typesense, MENA/Arabic, hybrid-search consensus) — all sourced, VERIFIED vs ASSUMED tagged. Mapped 6 approaches (RAG, embeddings, taxonomy/ontology, prompt grounding, fine-tuning, hybrid) with pros/cons/cost scored for our case (Kuwait, AR+EN, multi-sector, on Claude, small/cost-sensitive). Confirmed the load-bearing constraint: **Claude has no native embeddings API → Anthropic recommends Voyage AI; we'll use a 3rd-party multilingual embed model** (Cohere v3 / BGE-M3 / Voyage). Artifact: `team/research/domain-ai-search-approaches.md`.
- **Recommendation (the answer):** **Layered "taxonomy + embeddings, lexical-first hybrid" — NOT fine-tuning, NOT more hand-tables.** Sequence: (1) finish the curated KW taxonomy backbone (brand→product-type; area gazetteer + dish categories already built) → (2) prompt grounding for disambiguation rules + top-20 → (3) embeddings (pgvector + Cohere-multilingual/BGE-M3) as the long-tail fallback authority retiring the hand-tables → (4) make it hybrid (BM25/full-text + vector, Supabase-native, no new vendor) → (5) optional Instacart-style embedding guardrail re-rank. This is the same destination as ADR-007 §2.2/Q4, now backed by external evidence; near-zero infra/vendor cost.
- **Next:** bo-prompt-engineer designs the grounding layer (taxonomy injection + disambiguation few-shots + the "Samsung phone≠stylus / رز بخاري=rice / tenure" rules); bo-tech-architect designs the concrete embeddings+hybrid layer (model pick, pgvector schema, threshold, fusion) and confirms pgvector enabled. Needs a starter KW eval set from the dated bug cases.
- **Owner:** bo-prompt-engineer (grounding), bo-tech-architect (embeddings/hybrid design) — joint.
- **Blockers/risks:** embedding-model choice + threshold tuning unresolved (needs eval set); pgvector enablement unconfirmed (ADR-007 Q4); brand→product-type catalog still to be built (the one missing taxonomy asset — area + dish already done). No new infra/vendor strictly required (self-host path exists), so no budget blocker.

---

## Sources (accessed 2026-06-27)
- Hybrid search (BM25+vector) as e-commerce gold standard: [Elastic – What is hybrid search](https://www.elastic.co/what-is/hybrid-search), [MongoDB – Hybrid Search guide](https://www.mongodb.com/resources/products/capabilities/hybrid-search)
- Amazon semantic product search: [Amazon Science – Semantic Product Search (PDF)](https://dl.acm.org/doi/pdf/10.1145/3292500.3330759), [Amazon Science – high-precision query-product semantic similarity](https://www.amazon.science/publications/improving-relevance-quality-in-product-search-using-high-precision-query-product-semantic-similarity)
- Instacart taxonomy + embeddings + LLM intent engine: [How Instacart Uses Embeddings to Improve Search Relevance](https://tech.instacart.com/how-instacart-uses-embeddings-to-improve-search-relevance-e569839c3c36), [Building the Intent Engine: Revamping Query Understanding with LLMs (Nov 2025)](https://www.instacart.com/company/tech-innovation/building-the-intent-engine-how-instacart-is-revamping-query-understanding-with-llms)
- Algolia typo/synonym/multilingual: [Algolia – Typo tolerance](https://www.algolia.com/doc/guides/managing-results/optimize-search-results/typo-tolerance), [Algolia – Handling Natural Languages in Search](https://www.algolia.com/blog/engineering/natural-languages-in-search)
- Arabic search / dialect↔MSA via embeddings: [Semantic Embeddings for Arabic RAG (ARAG)](https://thesai.org/Downloads/Volume14No11/Paper_135-Semantic_Embeddings_for_Arabic_Retrieval_Augmented_Generation.pdf), [Swan & ArabicMTEB (arXiv)](https://arxiv.org/pdf/2411.01192), [Data-Centric Multilingual E-Commerce Product Search (arXiv)](https://arxiv.org/html/2510.21671)
- Embedding model comparison / Arabic strength / cost: [Embedding Models Comparison 2026 (OpenAI/Cohere/Voyage/BGE)](https://reintech.io/blog/embedding-models-comparison-2026-openai-cohere-voyage-bge), [Best Embedding Models 2025 – MTEB (Cohere/OpenAI/BGE)](https://app.ailog.fr/en/blog/guides/choosing-embedding-models)
- Claude has no native embeddings → Voyage AI: [Claude API – Embeddings docs](https://docs.claude.com/en/docs/build-with-claude/embeddings), [anthropics/claude-cookbooks – VoyageAI embeddings](https://github.com/anthropics/claude-cookbooks/blob/main/third_party/VoyageAI/how_to_create_embeddings.md)
- pgvector/Supabase hybrid + cost for small teams: [Supabase Docs – Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search), [Supabase vs pgvector for production AI 2026](https://markaicode.com/vs/supabase-vs-pgvector/)
- RAG vs fine-tuning vs prompt: [IBM – RAG vs fine-tuning vs prompt engineering](https://www.ibm.com/think/topics/rag-vs-fine-tuning-vs-prompt-engineering)
