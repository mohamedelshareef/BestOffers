# Prompt Engineering Changelog — BestOffers Agent Team

**Author:** bo-prompt-engineer · **Date:** 2026-06-26 · **Scope:** 15 product agents in `.claude/agents/` (own file `bo-prompt-engineer.md` not touched).

## What changed (team-wide pattern)
Every agent got two structural changes:

1. **New `## Guardrails (non-negotiable)` block** placed right after the `# Role`/Mission intro (top of the prompt, where it's read first instead of buried at the end). Consistent shared wording across all 15, tuned per role.
2. **Trimmed the long `## Standard Task Workflow` tail** from a dense ~5-line paragraph that duplicated the workflow into a 2-line pointer to `team/WORKFLOW.md` + "the Guardrails block above is non-negotiable." Removes redundancy, saves tokens, single source of truth.

**Shared guardrail standard (base 6 points):** Truthfulness (REAL output, never fake green, never pass mock as real, label **VERIFIED** vs **ASSUMED**) · Follow WORKFLOW.md + mandatory Handoff · Read first / write memory last · Confirm AC, never invent requirements · Token discipline · Background + escalate to PO, no git commit unless asked.

**UI-producing agents** get an extra guardrail (`UI = prove it renders` — open the actual screen/asset, capture a REAL screenshot; building/tests ≠ rendering). Applied to: dev-lead, dev-2/3/4, ux-lead, ux-designer, qa-lead-frontend, brand-designer.

Frontmatter (name/description/tools/model), role identity, mission, responsibilities, collaboration, and Handoff template were preserved in every file.

## Per-agent

| Agent | UI? | What changed + why |
|-------|-----|--------------------|
| bo-researcher | No | Added guardrails; truthfulness tuned to "every finding traces to a real source (URL+date), no invented stats, VERIFIED vs ASSUMED." Closes the biggest research risk: fabricated market facts. |
| bo-business-analyst | No | Added guardrails; AC point sharpened to "numbered, testable, becomes QA's oracle; resolve ambiguity with PO, don't fill gaps." |
| bo-tech-architect | No | Added guardrails; truthfulness tuned to spikes — "report real spike output, never claim feasible unless verified, label decisions VERIFIED vs ASSUMED, flag cost/risk." |
| bo-dev-lead | **Yes** | Added guardrails incl. render-proof; truthfulness tuned to "real test/lint/build logs, don't accept a peer's slice as integrated on their word — verify it runs." |
| bo-dev-2 | **Yes** | Added guardrails incl. render-proof (screenshot the slice rendering before handoff); strongest gain — previous prompt only said "verify your slice runs," vague. |
| bo-dev-3 | **Yes** | Same as dev-2 (parallel clone), memory path corrected to bo-dev-3.md. |
| bo-dev-4 | **Yes** | Same as dev-2 (parallel clone), memory path corrected to bo-dev-4.md. |
| bo-ux-lead | **Yes** | Added guardrails incl. render-proof tuned to mockups — "render it for real, text spec alone is not a rendered mockup; flag if design tool unreachable." |
| bo-ux-designer | **Yes** | Same render-proof framing as ux-lead; reuse-system/no-invent-patterns kept in guardrail #5. |
| bo-qa-lead-frontend | **Yes** | Added guardrails incl. render-proof — "UI AC verified only by running the app + real screenshot; failing honestly beats a false green; never pass AC not demonstrably met." Critical anti-fake-green tuning. |
| bo-qa-backend | No | Added guardrails; truthfulness tuned hard — "real requests/responses/status codes, never sign off on an endpoint you didn't exercise, never pass mock/stub off as the real service." |
| bo-marketing-lead | No | Added guardrails; truthfulness tuned — "ground KPIs/positioning in real research, never invent benchmarks, VERIFIED vs ASSUMED (hypothesis to validate)." |
| bo-brand-designer | **Yes** | Added guardrails incl. render-proof for visual assets (logo/palette must render); kept "concrete hex/fonts, not vibes." |
| bo-content-creator | No | Added guardrails; truthfulness tuned — "no product claims you can't back, no invented stats/fake testimonials, flag ASSUMED for PO/legal review." |
| bo-social-media | No | Added guardrails; truthfulness tuned — "no fabricated engagement numbers/trends, report REAL metrics only, flag ASSUMED." |

## Notes
- No product code touched. No git commit.
- Agents needing the most work: **dev-2/3/4** and **ux-designer/brand-designer** (verification was vague — now have explicit screenshot + VERIFIED/ASSUMED), and **qa-backend / qa-lead-frontend** (added explicit anti-fake-green + never-sign-off-unverified).
- `team/WORKFLOW.md` already strong; left unchanged. Guardrails reference it rather than duplicate it.
