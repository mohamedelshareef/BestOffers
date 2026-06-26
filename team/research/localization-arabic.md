# S0-3 — Arabic / Dialect & Cross-Region Localization Scan

> Owner: bo-researcher · Date: 2026-06-25 · Decision informed: conversational design, prompt strategy (BA/UX/Architect), localization positioning.
> Legend: ✅ verified · 🟡 assumption/inference · 🔸 directional.

## TL;DR (lead with the answer)
- **Strategy: accept Kuwaiti/Gulf colloquial INPUT, reply in clean MSA + English, RTL-first.** Kuwaitis type in dialect (and code-switch with English); a bot that only understands MSA fails on real messages. ✅
- **Claude is a good fit but with a caveat:** Anthropic positions Claude on **Modern Standard Arabic** (strong MSA; dialect support "still developing"), yet head-to-head tests give **Claude a slight edge on Gulf/Egyptian dialect understanding** vs GPT. ✅ → Lean on Claude's strength (MSA output, dialect *comprehension*), and **de-risk dialect understanding with few-shot dialect examples in the system prompt + a Kuwaiti-phrase glossary.** 🟡
- **How to win in Kuwait:** be the one that *truly gets Kuwaiti phrasing* (not translated MSA), handle code-switching, and stay RTL-native. Generic MENA chatbots are MSA-default; that's the beatable seam. ✅

---

## A. Dialect input vs MSA output — the core design rule

| Layer | Choice | Why |
|---|---|---|
| **Input understanding** | Kuwaiti/Gulf colloquial **+ code-switching (AR/EN mixed)** | Real users type "شنو أرخص..." and "أبغى أكنسل أوردر number 12345" — MSA-only NLP misses these ✅ |
| **Output / responses** | **MSA** (clear, neutral, universally understood) + English mirror | Claude's strongest Arabic register; safe and professional ✅ |
| **Direction** | **RTL-first**, AR/EN toggle | Concept mandates Arabic-first/RTL ✅ |
| **Clarifying questions** | Short, MSA, dialect-friendly vocabulary | Matches the "AI interrogates intent" concept |

### Real phrasing examples (dialect → intent → MSA reply)

| User types (Kuwaiti colloquial) | Literal intent | Bot understands | MSA clarifying reply |
|---|---|---|---|
| `شنو أرخص آيفون ١٧ برو ماكس؟` | "What's the cheapest iPhone 17 Pro Max?" | cheapest, iPhone 17 Pro Max | `ما السعة التخزينية واللون اللذان تفضّلهما؟` (which storage/color?) ✅ |
| `أبي لابتوب زين للألعاب وميزانيتي محدودة` | "I want a good gaming laptop, limited budget" | gaming laptop, budget-constrained | `كم ميزانيتك التقريبية بالدينار؟` (approx budget in KWD?) |
| `عندكم عروض على تلفزيونات سامسونج؟` | "Any offers on Samsung TVs?" | offers, Samsung TVs | `أي حجم شاشة تبحث عنه؟` (what screen size?) |
| `ابي دجاج مشوي مو مقلي وياه بطاطس` (Food) | "grilled not fried chicken with fries" | grilled chicken + sides | `كم عدد الحصص التي تريدها؟` (how many portions?) |
| `شكو أوفرات اليوم؟` | "what offers today?" | today's deals | (browse-mode prompt) |

**Glossary the prompt must know (dialect → MSA):** شنو→ما / ما هو · أبي/أبغى→أريد · زين→جيد · كم/بكم→ما السعر · شكو/شكو ماكو→ما الأخبار/ماذا يوجد · وايد→كثير · رخيص/أرخص→ال أرخص. 🟡 (verify with a native QA pass)

**Implementation note for Architect/BA:** put **few-shot Kuwaiti-dialect examples + the glossary in Claude's system prompt** to harden dialect comprehension (mitigates Anthropic's "MSA-focused" caveat). Detect language at sentence level to handle code-switching; mirror the user's language choice. 🟡

---

## B. Cross-region scan — similar AI shopping-concierge ideas

| Where / Who | What it does | What works | Lesson for Best Offers |
|---|---|---|---|
| **Google Shopping AI agent** ✅ | Multimodal concierge: text/voice/image, reasons, builds carts, can act | Conversational + multimodal intent capture is the direction of travel | Validate the conversational model; but we stay neutral aggregator (no cart/checkout) — that *neutrality* is our differentiator |
| **Eshal (MENA)** ✅ | Arabic chatbot; **natively supports Gulf (incl. Kuwait), Egyptian, Levantine; code-switch handled at sentence level** | Proves dialect-native + code-switch is achievable and valued | Bar to clear: be dialect-native, not MSA-only |
| **Brightcall / Teammates.ai (UAE/KSA)** ✅ | Gulf-Arabic voice/chat AI agents for CX | Gulf-Arabic-native CX is a funded, proven category | Confirms demand for Gulf-Arabic conversational UX |
| **Verloop.io / Searj (MENA NLP)** ✅ | Arabic NLP guidance: MSA-only models fail on dialect; LLMs needed | "Don't keyword-match; use dialect-capable LLMs" | Reinforces LLM (Claude) + dialect few-shot approach |
| **WaffarX / ShopCash (regional)** ✅ | Cashback/coupons across MENA incl. Kuwait | Save-money hook scales | Different job (codes/cashback) — not conversational discovery; complementary, not competitive |

**Pattern:** Globally, conversational + multimodal shopping concierges are emerging (Google). Regionally, **Gulf-Arabic-native conversational AI is a validated, funded category** — but applied to CX/support, not to **neutral cross-provider offer discovery**. That combination (Gulf-Arabic-native × neutral aggregator × intent-first) is unoccupied in Kuwait.

## C. How to win in Kuwait (so what)
1. **Be unmistakably Kuwaiti in input handling** — understand شنو/أبي/وايد and AR-EN code-switch out of the box; this is where MSA-default competitors lose users. ✅
2. **MSA + English for output** — clean, trustworthy, professional; plays to Claude's strength. ✅
3. **RTL-first, not RTL-retrofitted** — design AR as the primary direction.
4. **Neutrality as brand** — no carts, no sponsored bias; "honest best offer" is the trust wedge vs marketplaces.
5. **Harden dialect with prompt engineering + native QA**, since Claude's dialect support is "still developing" per Anthropic. 🟡

---

## Sources (accessed 2026-06-25)
- Anthropic multilingual support (MSA focus; dialect developing) — https://platform.claude.com/docs/en/build-with-claude/multilingual-support
- Claude vs GPT Arabic / Gulf-dialect edge — https://arabie.ai/en/blog/2025-10-24-chatgpt-vs-claude-for-arabic-which-ai-is-better-in-2025 , https://truescho.com/en/blog/claude-vs-chatgpt-arabic-content-2026
- Claude 3 multilingual accuracy — https://medium.com/@venugopal.adep/96-accuracy-in-12-languages-the-secret-behind-claude-3s-multilingual-mastery-699b0b2f84df
- Dialect-vs-MSA chatbot examples (شنو vs ما هي; code-switch cancel-order) — https://searj.com/en/blog/building-arabic-first-chatbot , https://www.verloop.io/blog/arabic-nlp-for-middle-east-markets/
- Eshal (Gulf/Kuwait dialect-native, code-switch) — https://eshal.ai/blog/arabic-ai-chatbot-guide
- Brightcall / Teammates.ai (Gulf-Arabic AI) — https://brightcall.ai/blog/how-to-find-arabic-speaking-ai----and-why-brightcall-is-your-best-option , https://teammates.ai/ai-agents-dubai
- Google agentic shopping — https://cloud.google.com/transform/a-new-era-agentic-commerce-retail-ai
