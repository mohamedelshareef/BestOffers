# BestOffers — Standard Task Workflow (canonical)

Every task follows this. The **Product Owner (PO) orchestrates**; agents **execute in the background**
so the conversation never freezes. No agent self-dispatches — the PO routes work.

## 1. Task lifecycle (the pipeline)

```
INTAKE → DEFINE → DESIGN / ARCHITECT → BUILD → TEST → FIX LOOP → DEMO/DEPLOY → DONE
 (PO)    (BA)     (UX) / (Architect)  (Dev)   (QA)   (Dev⇄QA)    (Dev/PO)     (PO)
```

- **Not every task needs every stage.** The PO picks the stages (a small bug skips Define/Design).
- Each stage **hands off** to the next via a Handoff block. The PO reads handoffs and routes.
- Default to **Develop → Test → Deploy** for anything that ships code.

## 2. Who owns each stage

| Stage | Owner | Output |
|-------|-------|--------|
| Intake | PO | Scoped task + acceptance criteria (AC) + chosen owner |
| Define | bo-business-analyst | User story + numbered, testable AC (the QA oracle) |
| Design | bo-ux-lead (+ bo-ux-designer) | Dev-ready screen specs / visual mockups |
| Architect | bo-tech-architect | ADR / interfaces / data + system design |
| Build | bo-dev-lead (slices to bo-dev-2/3/4) | Working, demoable vertical increment + tests |
| Test | bo-qa-lead-frontend + bo-qa-backend | Pass/fail per AC + defect list (severity+repro) |
| Fix loop | bo-dev-lead ⇄ QA | HIGH defects fixed first → re-test until pass |
| Growth | bo-marketing-lead cluster | Brand/content/social for launch |
| Done | PO | Ratify, update backlog |

## 3. Universal rules — every agent, every task

1. **Read first:** your own memory (`team/memory/<slug>.md`) + the relevant artifacts (backlog, AC, ADRs, designs).
2. **One scoped task at a time.** Confirm the AC. **Never invent requirements** — ask the PO.
3. **Small, vertical, demoable increments.** Match existing code/patterns. No scope creep.
4. **Truthfulness:** report **REAL output** (tests, prices, logs, screenshots). Never claim "green/works" if it isn't. Never pass mock results off as real. Mark assumptions vs verified.
5. **Update your memory** at the end — durable facts only; keep it lean.
6. **End with a Handoff block** (format below).
7. **Token discipline:** locate-then-read, reuse memory, lead with the deliverable, no filler.
8. **No git commit** unless the PO asks.
9. **Run in the background**; keep the session light. **Surface blockers to the PO immediately** — don't stall silently.

## 4. Definition of Done (team-wide)

- AC met and demonstrable · tests green (with real output) · memory updated · Handoff written · risks/blockers surfaced to PO.
- **UI tasks: building/passing tests is NOT done — you must PROVE it RENDERS** (open it, capture a real screenshot of the actual screen). Building ≠ rendering.

## 5. Handoff format (mandatory at the end of every task)

```
## Handoff
- Done:
- Next:
- Owner:
- Blockers/risks:
```

## 6. QA fix loop

QA tests against AC → logs defects (severity + repro) → **Dev fixes HIGH first** → re-test → repeat until pass → PO ratifies. QA never passes a feature whose AC isn't demonstrably met.
