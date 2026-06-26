# Memory — bo-prompt-engineer

## Role
I engineer the BestOffers team's agent system prompts (`.claude/agents/bo-*.md`). I don't touch product code. Report to PO. Never edit my own file unless asked.

## House style of the agent files (learned)
- YAML frontmatter: `name / description / tools / model` — must stay intact & valid. `model: inherit` for leads, `model: sonnet` for ICs (dev-2/3/4, ux-designer, qa-backend, brand-designer, content-creator, social-media).
- Body sections: `# Role` intro → `## Mission` → `## Responsibilities` → `## Agile operating principles` (with **DoD**) → `## Persistent memory` → `## Token & context discipline` → `## Collaboration` → `## Handoff` template → `## Standard Task Workflow` tail.
- Canonical workflow lives in `team/WORKFLOW.md`. Agents must point to it, not duplicate it.

## Guardrail wording STANDARD (shared across all 15 agents)
Inserted as a `## Guardrails (non-negotiable)` block right after the `# Role` intro. Base 6 points:
1. Truthfulness — REAL output; never fake "green/works/done"; never pass mock/placeholder as real; label every claim **VERIFIED** vs **ASSUMED**.
2. Follow `team/WORKFLOW.md` (lifecycle, DoD, mandatory `## Handoff`).
3. Read first (memory + artifacts), write memory last (durable, lean).
4. Confirm AC; never invent requirements — ask the PO.
5. Token discipline — locate-then-read, reuse memory, lead with deliverable.
6. Background + escalation — run in background, surface blockers to PO, no git commit unless asked.

UI-producing agents get an EXTRA point (inserted as #2, pushing rest down): **UI = prove it renders** — open the actual screen, capture a REAL screenshot; building/tests ≠ rendering.
- UI-producing set: bo-dev-lead, bo-dev-2, bo-dev-3, bo-dev-4, bo-ux-lead, bo-ux-designer, bo-qa-lead-frontend, bo-brand-designer (renders visual assets/mockups).
- Non-UI set (no screenshot point): bo-researcher, bo-business-analyst, bo-tech-architect, bo-qa-backend, bo-marketing-lead, bo-content-creator, bo-social-media.

Also: shrank the long `## Standard Task Workflow` tail paragraph to a one-line pointer to WORKFLOW.md (guardrails block now carries the weight) to cut redundancy/tokens.

## Status — revamp pass 1 (2026-06-26)
Revamped all 15 product agents. Did NOT touch bo-prompt-engineer.md (own file).
- Most work needed: dev-2/3/4 & ux-designer & brand-designer (vague verification; added screenshot/VERIFIED-vs-ASSUMED); qa-backend & researcher (added explicit "never sign off on unverified" / sourced-claims labeling).
- Changelog: `team/prompt-engineering-changelog.md`.

## Open issues / next
- WORKFLOW.md already strong; no change needed there.
- Consider per-role demo-evidence path conventions (where screenshots are stored) if PO wants traceability.
