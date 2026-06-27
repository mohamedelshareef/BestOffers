# Domain-Grounding Plan — Teaching Claude the BestOffers Domain

**Author:** bo-prompt-engineer · **Date:** 2026-06-27
**Owner ask:** "the AI isn't trained for this project." Correct — and the cure is **domain grounding at query time**, not fine-tuning (see `team/research/domain-ai-search-approaches.md`, approach **e rejected**; ADR-007 §2.2).
**Scope of THIS doc:** the **prompt + taxonomy (grounding) half** — the curated brand→product-type taxonomy asset, the grounding blocks to inject into Claude's clarify/extraction/intent steps, and the disambiguation rules. The **embeddings/pgvector half is the architect's** (ADR-007 Q4 / `domain-ai-search-approaches.md` §4.3) — referenced in §3, not designed here.
**Reuses the existing patterns:** the Kuwait area gazetteer (`team/research/kuwait-area-gazetteer.json`, ~100 areas, `{en, ar, aliases[], governorate}`) and the food synonym groups (`food-relevance.ts SYNONYM_GROUPS`). The electronics brand→type taxonomy is **the one missing backbone asset** (ADR-007 §1.2; researcher §4.1).
Tags: **VERIFIED** = read in the actual code/artifact · **ASSUMED** = my design judgment.

---

## 0. The failure class this fixes

| Live bug | Why it happened (VERIFIED, ADR-007) | What grounding adds |
|---|---|---|
| "Samsung phone" → stylus / case | No brand→product-type knowledge; Claude/relevance treats all Samsung-made things as equal. Accessory ≠ product is not encoded. | Taxonomy resolves brand=Samsung **AND** type=phone; accessories filtered by `kind=accessory`. |
| "Bukhari rice" (رز بخاري) → cakes | Dish-family not grounded; LLM/relevance had no "بخاري = rice meal" fact. | Disambiguation rule + dish-family ground line. |
| "Flat in Jabriya" → Al-Zahra, wrong area | 12-area hand-list couldn't adjudicate a ~60-area city. | Full gazetteer (already built, ~100 areas) + area rule. |
| "Dish washing Machine" → 0 results | Catalog-bound lane (architect's Q1 fix) + no appliance type in any taxonomy. | Taxonomy includes `dishwasher` as a real product-type so intent extracts a valid type. |

**Division of labor (the mental model):**
- **Taxonomy (deterministic, §1)** = the structural backbone. Fixes the **brand-vs-accessory** and **valid-product-type** classes *with certainty*, no model call. **Do this first.**
- **Grounding prompts (§2)** = inject the taxonomy summary + hard rules + worked examples into Claude so its *intent extraction* emits the right `category/brand/type/kind` slots and obeys the KW-specific facts (tenure, dish families, areas).
- **Embeddings (§3, architect)** = the long-tail fallback for terms not in the taxonomy/gazetteer (unseen dish, dialect drift, transliteration). Grounding handles the head + rules; embeddings handle the tail.

---

## 1. The missing asset — KW electronics brand→product-type taxonomy

### 1.1 Data shape (mirror the area gazetteer — JSON, dev-loadable)

Ship as **`apps/api/src/offers/data/kw-electronics-taxonomy.json`** (sibling pattern to the gazetteer the dev already loads). Two top-level arrays: `productTypes` (the controlled vocabulary of what a thing IS) and `brands` (who makes which types). Disambiguation lives in `productTypes[].kind`.

```jsonc
{
  "productTypes": [
    // kind: "product" = a primary device the user shops for;
    //       "accessory" = an add-on that is NOT the product unless asked for by name.
    {
      "key": "phone",
      "kind": "product",
      "en": "Phone",            "ar": "هاتف",
      "aliases": ["phone", "smartphone", "mobile", "cell", "cellphone",
                  "جوال", "هاتف", "موبايل", "تلفون", "ايفون-class"],
      "category": "electronics"
    },
    { "key": "laptop", "kind": "product", "en": "Laptop", "ar": "لابتوب",
      "aliases": ["laptop", "notebook", "ultrabook", "macbook", "لابتوب", "لاب توب", "كمبيوتر محمول"],
      "category": "electronics" },
    { "key": "tablet", "kind": "product", "en": "Tablet", "ar": "تابلت",
      "aliases": ["tablet", "ipad", "تابلت", "ايباد", "لوحي"], "category": "electronics" },
    { "key": "tv", "kind": "product", "en": "TV", "ar": "تلفزيون",
      "aliases": ["tv", "television", "smart tv", "led tv", "oled", "تلفزيون", "تلفاز", "شاشة"],
      "category": "electronics" },
    { "key": "fridge", "kind": "product", "en": "Fridge", "ar": "ثلاجة",
      "aliases": ["fridge", "refrigerator", "ثلاجة", "براد"], "category": "appliances" },
    { "key": "washer", "kind": "product", "en": "Washing Machine", "ar": "غسالة",
      "aliases": ["washer", "washing machine", "غسالة", "غسالة ملابس"], "category": "appliances" },
    { "key": "dryer", "kind": "product", "en": "Dryer", "ar": "نشافة",
      "aliases": ["dryer", "tumble dryer", "نشافة", "مجفف"], "category": "appliances" },
    { "key": "dishwasher", "kind": "product", "en": "Dishwasher", "ar": "غسالة صحون",
      "aliases": ["dishwasher", "dish washer", "dish washing machine", "غسالة صحون", "جلاية"],
      "category": "appliances" },
    { "key": "ac", "kind": "product", "en": "Air Conditioner", "ar": "مكيف",
      "aliases": ["ac", "air conditioner", "split ac", "مكيف", "تكييف", "اسبليت"], "category": "appliances" },
    { "key": "microwave", "kind": "product", "en": "Microwave", "ar": "مايكروويف",
      "aliases": ["microwave", "مايكروويف", "ميكروويف"], "category": "appliances" },
    { "key": "oven", "kind": "product", "en": "Oven", "ar": "فرن",
      "aliases": ["oven", "فرن", "طباخ"], "category": "appliances" },
    { "key": "air_fryer", "kind": "product", "en": "Air Fryer", "ar": "قلاية هوائية",
      "aliases": ["air fryer", "airfryer", "قلاية هوائية", "قلاية"], "category": "appliances" },
    { "key": "vacuum", "kind": "product", "en": "Vacuum", "ar": "مكنسة",
      "aliases": ["vacuum", "vacuum cleaner", "hoover", "مكنسة", "مكنسة كهربائية"], "category": "appliances" },
    { "key": "headphones", "kind": "product", "en": "Headphones", "ar": "سماعات",
      "aliases": ["headphones", "earphones", "earbuds", "airpods", "buds", "سماعات", "سماعة"],
      "category": "electronics" },
    { "key": "watch", "kind": "product", "en": "Smartwatch", "ar": "ساعة ذكية",
      "aliases": ["watch", "smartwatch", "apple watch", "ساعة", "ساعة ذكية"], "category": "electronics" },
    { "key": "camera", "kind": "product", "en": "Camera", "ar": "كاميرا",
      "aliases": ["camera", "dslr", "mirrorless", "كاميرا"], "category": "electronics" },
    { "key": "console", "kind": "product", "en": "Game Console", "ar": "جهاز ألعاب",
      "aliases": ["console", "playstation", "ps5", "xbox", "nintendo", "switch", "بلايستيشن", "اكس بوكس"],
      "category": "electronics" },

    // ── ACCESSORIES — kind:"accessory". NEVER returned as "the product" unless the query
    //    names the accessory itself. `productFor` lists the product types they attach to. ──
    { "key": "stylus", "kind": "accessory", "en": "Stylus", "ar": "قلم",
      "aliases": ["stylus", "pen", "s-pen", "spen", "apple pencil", "pencil", "قلم", "قلم لمس"],
      "productFor": ["tablet", "phone"], "category": "electronics" },
    { "key": "case", "kind": "accessory", "en": "Case", "ar": "غطاء",
      "aliases": ["case", "cover", "غطاء", "كفر", "جراب"], "productFor": ["phone","tablet","laptop","watch"],
      "category": "electronics" },
    { "key": "charger", "kind": "accessory", "en": "Charger", "ar": "شاحن",
      "aliases": ["charger", "adapter", "cable", "شاحن", "كيبل", "وصلة"],
      "productFor": ["phone","tablet","laptop","watch"], "category": "electronics" },
    { "key": "screen_protector", "kind": "accessory", "en": "Screen Protector", "ar": "حماية شاشة",
      "aliases": ["screen protector", "tempered glass", "حماية شاشة", "ستيكر شاشة", "لزقة"],
      "productFor": ["phone","tablet","watch"], "category": "electronics" }
  ],

  "brands": [
    {
      "key": "samsung", "en": "Samsung", "ar": "سامسونج",
      "aliases": ["samsung", "سامسونج", "سامسونغ"],
      // the product-types this brand actually makes — constrains intent + filters relevance.
      "makes": ["phone","tablet","tv","fridge","washer","dryer","ac","microwave","watch","headphones"]
    },
    { "key": "apple", "en": "Apple", "ar": "ابل",
      "aliases": ["apple", "ابل", "أبل"], "makes": ["phone","tablet","laptop","watch","headphones"] },
    { "key": "lg", "en": "LG", "ar": "ال جي",
      "aliases": ["lg", "ال جي", "إل جي"], "makes": ["tv","fridge","washer","dryer","ac","microwave","headphones"] },
    { "key": "sony", "en": "Sony", "ar": "سوني",
      "aliases": ["sony", "سوني"], "makes": ["tv","headphones","camera","console"] },
    { "key": "xiaomi", "en": "Xiaomi", "ar": "شاومي",
      "aliases": ["xiaomi", "mi", "redmi", "شاومي", "مي"], "makes": ["phone","tablet","tv","watch","vacuum","headphones"] },
    { "key": "hp", "en": "HP", "ar": "اتش بي",
      "aliases": ["hp", "hewlett packard", "اتش بي"], "makes": ["laptop"] },
    { "key": "dell", "en": "Dell", "ar": "ديل",
      "aliases": ["dell", "ديل"], "makes": ["laptop"] },
    { "key": "bosch", "en": "Bosch", "ar": "بوش",
      "aliases": ["bosch", "بوش"], "makes": ["fridge","washer","dryer","dishwasher","oven","microwave"] },
    { "key": "philips", "en": "Philips", "ar": "فيليبس",
      "aliases": ["philips", "فيليبس"], "makes": ["air_fryer","vacuum","oven","microwave","headphones"] },
    { "key": "huawei", "en": "Huawei", "ar": "هواوي",
      "aliases": ["huawei", "هواوي"], "makes": ["phone","tablet","watch","laptop","headphones"] },
    { "key": "google", "en": "Google", "ar": "جوجل",
      "aliases": ["google", "pixel", "جوجل", "بكسل"], "makes": ["phone","tablet","watch","headphones"] },
    { "key": "lenovo", "en": "Lenovo", "ar": "لينوفو",
      "aliases": ["lenovo", "thinkpad", "لينوفو"], "makes": ["laptop","tablet"] },
    { "key": "asus", "en": "Asus", "ar": "اسوس",
      "aliases": ["asus", "rog", "اسوس"], "makes": ["laptop","phone"] },
    { "key": "dyson", "en": "Dyson", "ar": "دايسون",
      "aliases": ["dyson", "دايسون"], "makes": ["vacuum","air_fryer"] }
  ]
}
```

**Researcher/dev fill the full lists; I define the structure + rules above.** Field contract:
- `productTypes[].key` — stable lowercase id (the slot value Claude must emit and the relevance filter keys on).
- `kind` — **`"product"` | `"accessory"`**. The single most important field: it carries the disambiguation.
- `aliases[]` — AR+EN+transliteration surface forms (same idea as gazetteer aliases). Normalize with the existing `normalizeFoodText`/`normalizeAreaText` before matching.
- `category` — `electronics` | `appliances` (so the lane can route; matches ADR-007's covered-category list, Q5).
- `accessory.productFor[]` — which product types the accessory attaches to (powers "show me the product, not its accessory").
- `brands[].makes[]` — the brand×type matrix. `Samsung.makes` excludes nothing it sells, but the **type slot** is what disambiguates, not the brand.

### 1.2 Disambiguation rules (deterministic — the dev wires these in the relevance filter)

These are **code rules over the taxonomy**, not LLM rules. They fix the Samsung-phone class with certainty:

1. **Type dominates brand.** When intent has both `brand` and `type`, keep only offers whose resolved product-type == `type`. "Samsung phone" → drop every Samsung TV/stylus/case.
2. **Accessory exclusion.** If the query's resolved type is a `kind:"product"` (or no type, just a brand+nothing), **drop `kind:"accessory"` offers** unless the query text itself matches an accessory alias. "Samsung phone" never returns a stylus; "Samsung phone case" *does* (query named the accessory).
3. **Brand-only query → infer the headline type, don't dump accessories.** "Samsung" alone → products only (`kind:"product"`), accessories excluded; let ranking/clarifier narrow the type.
4. **Valid-type gate.** A query whose head noun matches a `productTypes` alias (e.g. "dish washing machine" → `dishwasher`) yields a valid `type` slot even with no brand — so the lane searches instead of 0-result. (Pairs with architect's Q1 catalog-free discovery.)
5. **Normalize before match** — run aliases and query through `normalizeFoodText` (AR diacritics/alef/ya unify) so AR/transliteration variants hit.

**Generalizes, not a per-row hand-table:** new brands/types are *data rows in one structured asset*, and the rules above (type-dominates, accessory-exclusion) apply to all of them without new code. This is the backbone, not a treadmill row.

---

## 2. Prompt grounding — inject the domain into Claude

### 2.1 Where it goes (3 injection points, cache-friendly)

| Prompt | File / fn | What to inject | Why |
|---|---|---|---|
| **Intent normalize** | `anthropic-claude-client.ts` `clarify()` system + add `productType`/`kind` to the `emit_clarifier` `intentNormalized` schema | the **GROUNDING BLOCK** (§2.2) + the brand/type vocabulary summary | makes Claude emit a correct `category/brand/productType/kind` slot, not raw text the hand-tables re-parse (closes ADR-007 §1.4) |
| **Clarifier set** | `anthropic-claude-client.ts` `clarifierSet()` system | the GROUNDING BLOCK (rules subset) | so generated questions stay on the right product-type (don't ask phone-storage for a fridge) |
| **RE / food extraction** | `anthropic-social-extractor.ts` RE_TOOL + food tool descriptions | the **KW-FACTS BLOCK** (§2.3) | tenure/price-unit + dish-family + area facts at extraction time |

**Cache discipline (important for cost):** the grounding text is **static** → put it in the **system prompt** (Anthropic prompt-caching caches the system block across calls). Do NOT inline the full taxonomy JSON — inject a **compact prose summary** (the brand/type *names*, the rules, ~6 worked examples). The full JSON stays in code for the deterministic filter; the LLM only needs the *rules + vocabulary outline*. Keep each block under ~250 tokens.

### 2.2 GROUNDING BLOCK — electronics (paste into `clarify()` + `clarifierSet()` system arrays)

> ```
> DOMAIN: Kuwait electronics & appliances price comparison. A brand makes MANY product
> types — resolve the user's request to BOTH a brand AND a product-type, and mark whether
> they want a PRODUCT or an ACCESSORY.
> PRODUCT TYPES (product): phone, laptop, tablet, tv, fridge, washer, dryer, dishwasher,
> ac, microwave, oven, air_fryer, vacuum, headphones, watch, camera, console.
> ACCESSORIES (accessory, NOT the product): stylus/pen, case/cover, charger/cable,
> screen_protector. Return these ONLY if the user names the accessory itself.
> RULES:
> 1. "Samsung phone" → brand=samsung, productType=phone, kind=product. NEVER a stylus, case,
>    or TV — a stylus is an ACCESSORY, not the phone.
> 2. If the user gives a brand only ("Samsung"), set kind=product and leave productType open
>    for a clarifier — do not assume an accessory.
> 3. Map appliance phrasings: "dish washing machine"→dishwasher, "split AC"→ac,
>    "air fryer"→air_fryer. Arabic: جوال/موبايل→phone, ثلاجة→fridge, غسالة→washer,
>    غسالة صحون/جلاية→dishwasher, مكيف→ac, سماعات→headphones, تلفزيون/شاشة→tv.
> 4. Preserve the user's exact model — never broaden "Galaxy S25" to "S25 Ultra".
> EXAMPLES (request → slots): "Samsung phone"→{brand:samsung,productType:phone,kind:product};
> "ايفون"→{brand:apple,productType:phone,kind:product}; "dish washing machine"→{productType:dishwasher,kind:product};
> "case for iphone"→{brand:apple,productType:case,kind:accessory}; "لابتوب اتش بي"→{brand:hp,productType:laptop,kind:product}.
> ```

Schema add for `emit_clarifier` (so the slots are captured): add to `intentNormalized.properties`:
`productType: { type: 'string' }`, `kind: { type: 'string', enum: ['product','accessory'] }`.

### 2.3 KW-FACTS BLOCK — food + real-estate (paste into the extractor tool descriptions / a shared system preamble)

> ```
> KUWAIT DOMAIN FACTS (ground every extraction in these):
> FOOD — these Arabic terms are DISHES, resolve to the right family, never to desserts/cakes:
>   رز بخاري / بخاري = a spiced RICE meal (rice family) — NOT a cake or dessert.
>   مجبوس/مكبوس/كبسة/برياني/مندي/منسف = rice meals. كرك = spiced milk TEA. حلى/كيك = dessert.
>   A rice query must route to rice sellers; a dessert term must route to dessert.
> REAL ESTATE — area + tenure are first-class:
>   AREA: match the asked Kuwait area (and ONLY it, plus tagged-nearby) against the area
>   gazetteer (~100 areas, AR+EN aliases). "Flat in Jabriya"/"شقة في الجابرية" returns Jabriya
>   only — never Al-Zahra/Al-Shuhada. Unknown spelling? normalize (alef/ya/ta-marbuta) first.
>   TENURE: rent (للإيجار/شهري/for rent) vs sale (للبيع/تمليك/for sale). A Kuwait monthly rent is
>   ~50–3000 KWD; 100,000+ KWD is a SALE price (tenure=sale, priceUnit=total), NEVER a monthly rent.
> EXAMPLES: "رز بخاري"→food, dish-family=rice; "Flat in Jabriya for 400,000"→RE, area=Jabriya,
>   tenure=sale (not rent — price too high for monthly); "كرك"→food, family=tea.
> ```

The RE_TOOL description already states the tenure/price rule (VERIFIED, `anthropic-social-extractor.ts:122-124`) — this block **extends** it with the area + dish facts that are currently missing. Keep the existing rule; add the area/dish lines.

### 2.4 Wording the whole team shares (consistency)

Reuse verbatim so dev/QA/architect all speak one language:
- **"type dominates brand"** — the disambiguation contract.
- **"accessory ≠ product unless the query names the accessory"** — the Samsung-phone rule.
- **"resolve to {brand, productType, kind} slots, not raw text"** — the intent-shape upgrade.
- **"ground on the taxonomy/gazetteer; fall through to embeddings for the tail"** — the §3 boundary.

---

## 3. How grounding connects to the embeddings layer (architect owns — ADR-007 Q4)

Grounding (§1–§2) is the **head + rules authority**; embeddings are the **tail authority**. Clear boundary so we don't rebuild each other's work:

| Concern | Handled by GROUNDING (this doc) | Handled by EMBEDDINGS (architect, ADR-007 Q4 / research §4.3) |
|---|---|---|
| Known brand/type, accessory-vs-product | ✅ deterministic taxonomy + rules | — |
| Top-~20 dish families, tenure/price rules, listed areas | ✅ prompt rules + hand groups (fast-path cache) | — |
| **Unseen** dish ("ramen","tacos"), **unlisted** spelling drift, AR↔EN dialect proximity | ❌ (would need a new alias row = the treadmill) | ✅ cosine match over the embedded KW vocab — no code edit |
| Cross-category sanity re-rank ("did Claude pick the right category?") | — | ✅ optional Instacart-style embedding guardrail (research §4.5) |

**The connection mechanism (architect to design):**
1. The **same canonical vocabulary** powers both: the taxonomy `aliases[]` + gazetteer + dish lexicon are **the strings the architect embeds once** into pgvector. So this doc's asset IS the embedding corpus — build it once, used by both layers.
2. **Lookup order at query time:** normalize → exact alias hit (taxonomy/gazetteer, free) → **else** pgvector cosine match above threshold (architect) → else honest empty. Grounding is the cache; embeddings are the fallback authority (ADR-007 §2.2).
3. **`kind` (product/accessory) and `productType` (the type cluster) are the labels** that make embeddings precise — Instacart's pattern (research §2): embeddings cluster *by type*, so "Samsung phone" stays near phones. Without the taxonomy labels, embeddings alone can still confuse accessory/product. **Taxonomy first is what makes embeddings reliable.**

**Architect owns:** embedding model pick (Cohere-multilingual-v3 / BGE-M3 / Voyage — research §3), pgvector schema + threshold tuning, lexical+vector fusion (RRF), the guardrail re-rank. **Not in this doc.**

---

## 4. Rollout (cheapest, highest-leverage first — matches ADR-007 slice order)

| Step | What | Owner | Cost / infra | Fixes |
|---|---|---|---|---|
| **1. Taxonomy (immediate, deterministic)** | Ship `kw-electronics-taxonomy.json` + wire the §1.2 rules (type-dominates, accessory-exclusion, valid-type gate) into the electronics relevance filter. | bo-dev-lead (filter) + bo-researcher/BA (fill brand/type lists) | zero infra, zero token | **Samsung-phone→stylus class, with certainty.** Valid product-types for Q1 discovery. |
| **2. Prompt grounding** | Inject §2.2 GROUNDING BLOCK into `clarify()`+`clarifierSet()` (+ schema `productType`/`kind`); inject §2.3 KW-FACTS BLOCK into the extractor. Static→system prompt (cached). | bo-dev-lead (wire) — text supplied here | ~negligible (cached system tokens) | rice≠cake, Jabriya area, tenure/price; intent emits real slots (ADR-007 §1.4). |
| **3. Embeddings (durable tail)** | pgvector + embed the §1 vocab once; cosine fallback behind the grounding cache; optional guardrail re-rank. | **bo-tech-architect** (ADR-007 Q4) | free pgvector + cents one-time embed | unseen dish/area/dialect — retires the hand-table treadmill. |

**Sequencing rationale:** Step 1 is deterministic and fixes the owner's headline bug class on its own with no model dependency. Step 2 makes Claude's *understanding* emit the right slots so the whole pipeline stops re-parsing raw text. Step 3 is the architect's generalization layer that ends the treadmill for good. Each step ships independently; **don't block Step 1 on Step 3.**

---

## Handoff
- **Done:** Wrote `team/architecture/domain-grounding-plan.md` — the prompt/grounding half of the domain-grounding cure (taxonomy half of researcher §4.1 + ADR-007 Q1/Q4). Delivered: (1) a curated **KW electronics brand→product-type taxonomy data shape** (`kw-electronics-taxonomy.json`, mirrors the area-gazetteer `{en,ar,aliases,...}` pattern) with `productTypes[]` (kind=product|accessory) × `brands[].makes[]`, the **accessory-vs-product `kind` field as the disambiguation backbone**, plus 5 deterministic relevance rules (type-dominates-brand, accessory-exclusion, valid-type gate). (2) The **actual grounding block text (AR+EN)** for `clarify()`/`clarifierSet()` (§2.2) + the **KW-FACTS block** for the extractor (§2.3), with the dated bug cases worked in (Samsung phone, رز بخاري≠cake, Jabriya area, tenure/price). (3) The grounding↔embeddings boundary (head+rules vs tail). (4) 3-step rollout: taxonomy→grounding→embeddings.
- **Next (bo-dev-lead to wire):** create `apps/api/src/offers/data/kw-electronics-taxonomy.json` (shape §1.1; researcher/BA fill full brand+type lists); wire §1.2 rules into the electronics relevance filter; add `productType` + `kind` to the `emit_clarifier` schema; paste the §2.2 GROUNDING BLOCK into `clarify()`+`clarifierSet()` system prompts and the §2.3 KW-FACTS BLOCK into `anthropic-social-extractor.ts` tool descriptions (static→system, cache-friendly). bo-researcher/BA: fill the full brand×type and accessory lists.
- **Owner split:** bo-prompt-engineer (this grounding plan — DONE) · bo-dev-lead (wire taxonomy + grounding blocks) · bo-researcher/BA (fill taxonomy lists) · **bo-tech-architect owns the embeddings/pgvector infra** (model pick, schema, threshold, fusion, guardrail re-rank — ADR-007 Q4; this doc's vocab IS the embedding corpus).
- **Blockers/risks:** taxonomy brand×type lists need a native KW-market reviewer (which brands sell which appliances locally) — researcher/BA. Embeddings step depends on pgvector enablement (ADR-007 Q4, still unconfirmed). Grounding blocks add ~static system tokens — must use prompt-caching to stay cost-neutral (owner cost-discipline). No git commit.
```