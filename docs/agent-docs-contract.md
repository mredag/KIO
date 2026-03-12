# Agent Docs Contract

This file defines which KIO document owns which kind of fact. The goal is one canonical home per fact, with mirrors pointing back instead of copying long state blocks.

## Source-of-Truth Hierarchy
1. `AGENTS.md`
   - Stable repo rules, structure, guardrails, and read order.
2. `docs/agent-runtime-memory.md`
   - Canonical current-state document for live behavior, deployment state, architecture split, and critical runbooks.
3. `docs/project-progress.md`
   - Canonical recent-change ledger for milestones, open work, and known drift.
4. Feature-specific guides under `docs/`
   - Canonical operating guides for scoped areas such as KB edits, conduct controls, and response-cache behavior.
5. Workspace mirrors under `openclaw-config/`
   - Short pointers plus tiny runtime-specific notes only.
6. `README.md`
   - Human-facing overview only. Helpful for onboarding, not canonical for live operational truth.

## Mandatory Read Order
Every repo-aware or workspace-aware agent should start with:
1. `AGENTS.md`
2. `docs/agent-runtime-memory.md`
3. `docs/project-progress.md`
4. Relevant feature guide only if the task touches that area

For multi-file coding work, read `openclaw-config/workspace/PROJECT_MAP.md` after the required docs above.

## Update Rules
- Stable policy, repo instruction, or coding guardrail change -> update `AGENTS.md`
- Behavior, runtime, deployment, architecture-split, or runbook change -> update `docs/agent-runtime-memory.md`
- Milestone, shipped progress, open work, or drift note -> update `docs/project-progress.md`
- Area-specific workflow or operator runbook change -> update the relevant feature guide in `docs/`
- Workspace-only phrasing or bootstrap reminder -> update the relevant workspace file, but keep it short and link back to repo docs

## Duplication Rule
- A fact must have one canonical owner.
- Other docs may summarize or link to that fact, but should not restate it as a long independent block.
- If the same fact appears in multiple places, the canonical doc wins and the mirrors should be trimmed.
- Workspace `MEMORY.md` files should stay short enough to scan in seconds, not minutes.

## Mirror Limits
- Workspace `DEVELOPER_MEMORY.md` and `MEMORY.md` files are mirrors, not canon.
- Preferred mirror style:
  - one-line purpose
  - pointers to canonical repo docs
  - tiny workspace-specific reminders only when they are not useful in the repo-level docs

## Mapping Examples
- DM pipeline routing changed -> update `docs/agent-runtime-memory.md`
- Pi deployment process changed -> update `docs/agent-runtime-memory.md`
- New Mission Control surface shipped -> update `docs/project-progress.md`, then any feature guide if needed
- New KB approval rule shipped -> update `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md` and add a short milestone note in `docs/project-progress.md`
- Jarvis bootstrap wording changed -> update workspace `AGENTS.md` or `BOOTSTRAP.md`, not the runtime memory doc unless behavior also changed

## Quick Self-Check
Before finishing any docs-sensitive task, confirm:
- Can a new agent answer "What is live right now?" from `docs/agent-runtime-memory.md`?
- Can a new agent answer "What changed recently?" from `docs/project-progress.md`?
- Can a new agent answer "Which doc owns this fact?" from this contract?
