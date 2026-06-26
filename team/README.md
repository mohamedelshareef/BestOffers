# BestOffers — Team Operating Model

This project is staffed by a team of **persistent, project-scoped AI agents** defined in
`.claude/agents/`. They exist **for the BestOffers project only**. The **Product Owner (PO)**
orchestrates all work; agents do not self-dispatch — they are invoked by the PO with a scoped task.

## Org chart

```
Product Owner (orchestrator)  ── owns vision, backlog, priorities, sprint goals
│
├─ DISCOVERY
│   ├─ bo-researcher ............ Research & Market Intelligence (Lead)
│   └─ bo-business-analyst ...... Business Analysis & Requirements (Lead)
│
├─ ARCHITECTURE
│   └─ bo-tech-architect ........ Technical Architecture (Lead)
│
├─ ENGINEERING  (led by Dev Lead)
│   ├─ bo-dev-lead .............. Full-Stack Dev Lead
│   ├─ bo-dev-2 ................. Full-Stack Developer
│   ├─ bo-dev-3 ................. Full-Stack Developer
│   └─ bo-dev-4 ................. Full-Stack Developer
│
├─ DESIGN  (led by UX Lead)
│   ├─ bo-ux-lead ............... UX/UI Design Lead
│   └─ bo-ux-designer .......... UX/UI Designer
│
├─ QUALITY  (led by QA Lead)
│   ├─ bo-qa-lead-frontend ...... QA Lead — Frontend
│   └─ bo-qa-backend ........... QA Engineer — Backend
│
└─ GROWTH  (led by Marketing Lead)
    ├─ bo-marketing-lead ........ Marketing Strategy (Lead)
    ├─ bo-brand-designer ....... Branding & Visual Identity
    ├─ bo-content-creator ...... Content Creation
    └─ bo-social-media ......... Social Media Management
```

**Leaders** (each cluster has one): bo-researcher, bo-business-analyst, bo-tech-architect,
bo-dev-lead, bo-ux-lead, bo-qa-lead-frontend, bo-marketing-lead. Leaders own their cluster's
quality, break down work for peers, and report status to the PO.

## How the PO orchestrates (Agile)

1. **Backlog** lives in `team/backlog.md`. The PO maintains epics → user stories → tasks.
2. **Sprints** are short iterations toward a sprint goal. Each story has acceptance criteria.
3. **Dispatch**: PO invokes the right agent (usually the cluster **leader** first) with a single
   well-scoped task + acceptance criteria. Leaders may request peer agents be spun up for parallel work.
4. **Handoffs**: every agent ends with a `## Handoff` block (done / next / owner / blockers).
   The PO reads handoffs and routes the next step.
5. **Ceremonies** (lightweight): Planning (PO + leaders define sprint scope), Daily (status via
   memory files), Review (demo of increment), Retro (improvements logged to memory).

## Standard flow for a feature

```
Researcher → Business Analyst → UX Lead → Tech Architect → Dev Lead (+devs)
   → QA (FE + BE) → Marketing/Content/Social (launch)
```

Each arrow is a handoff. The PO can shortcut or parallelize when appropriate.

## Memory

Every agent owns one persistent memory file in `team/memory/<slug>.md`. Agents READ it at the
start of a task and UPDATE it at the end with durable facts only. Memory is the team's shared
long-term state between invocations. See each agent file for its protocol.

## Definition of Done (team-wide baseline)

- Acceptance criteria met and demonstrable.
- Output is concise, structured, and handed off clearly.
- Memory updated; no stale or duplicated state.
- Decisions and open risks surfaced to the PO.
