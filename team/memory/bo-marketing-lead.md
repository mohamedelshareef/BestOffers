# Memory — Marketing Strategy Lead (bo-marketing-lead)

> Persistent memory for the BestOffers Marketing Strategy Lead.
> READ at task start. UPDATE at task end with durable facts only (decisions, current state, open items, handoffs).
> Keep lean; prune stale entries. Do not duplicate the backlog or repo content.

## Current state
- Authored design-revamp brief `ClaudCodeDesign.md` at REPO ROOT (for "Claude Design"). I wrote [MARKETING] §1–§6 + §11.1; bo-ux-lead completes §7–§10, §12, §11.2.

## Key decisions / durable facts
- **Positioning** (VERIFIED, brand §1.2): "The one place in Kuwait that finds the best deal for you — not for a retailer."
- **White space** (VERIFIED, research scan): no KW player combines conversational + cross-provider-neutral + Arabic-first. Closest analog = PriceScout (catalog, phone-narrow, English-leaning). Food = marketplace oligopoly, no neutral consumer comparison.
- **Brand promise (3-part):** Best deal · Smart AI (clarify before search) · Trusted/neutral (no cart/ads/checkout).
- **Personas (VERIFIED, BA):** P1 Reem (deliberate deal-buyer, electronics), P2 Abdullah (convenience/vague intent), P3 Noura (household food orderer, RTL-essential).
- **Brand v2 (single source `team/design/mockups/tokens.css`):** teal #0B6B5B, deal-gold #C8881C (price/verdict/spark ONLY), sand canvas #FBF8F3; fonts Rubik (display/price) + IBM Plex Sans Arabic (body); Inter retired.
- **Signature design moment:** the "best-price verdict" — gold ribbon + intent-grounded reason on the winning offer.
- **Design anti-patterns:** retailer storefronts, coupon/flyer feeds, generic-AI chat look, broken-RTL/MSA-bolted-on, fake-urgency dark patterns.

## Open questions / handoffs
- **CLARIFIER COUNT CONFLICT** — revamp goal says ≥5 clarifiers; mvp-scope AC C2 says 0–3 max. Flagged ASSUMED in brief §1. Needs PO/BA ruling before Claude Design builds the conversational flow.
- Instagram-as-provider UX surface undefined — bo-ux-lead to specify in §8.
