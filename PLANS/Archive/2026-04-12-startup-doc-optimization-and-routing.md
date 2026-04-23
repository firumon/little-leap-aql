# PLAN: Startup Doc Optimization and Routing Cleanup
**Status**: COMPLETED
**Created**: 2026-04-12
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Codex)

## Objective
Reduce unnecessary context loading across `CLAUDE.md` and `AGENTS.md` while preserving consistent agent behavior. Introduce a task-based doc-routing model so agents read only the docs required for the requested work, tighten role boundaries, and convert oversized current-state instructions into small, maintainable guidance.

## Context
- Current startup files are overloaded with detailed implementation rules, repeated policy, and broad startup reads that burn tokens even for short discussions.
- The user wants all agents to follow the same operating model:
  - `Guide Agent`: discussion only, no file edits, no plan writing.
  - `Brain Agent`: only writes plan files in `PLANS/`.
  - `Build Agent`: executes approved plans.
  - `Solo Agent`: edits directly by default and only writes a plan when explicitly requested.
- `Documents/MULTI_AGENT_PROTOCOL.md` should become the canonical source for role boundaries.
- `Documents/AI_COLLABORATION_PROTOCOL.md` should become optional and only apply when planning/building/modifying.
- `Documents/CONTEXT_HANDOFF.md` should be rewritten as a short current-state snapshot, not a long dated history.
- A new canonical doc router is needed so startup files can stay lean and still guide agents to the correct docs for each task.

## Pre-Conditions
- [x] Required source docs were reviewed.
- [x] The user-approved role model and lazy-loading approach are reflected in this plan.
- [x] No implementation starts before this plan is explicitly executed by Build Agent.

## Steps

### Step 1: Normalize role governance and startup philosophy
- [x] Rewrite `Documents/MULTI_AGENT_PROTOCOL.md` to be the single source of truth for role boundaries, including strict edit permissions for Guide/Brain/Build/Solo.
- [x] Remove assumptions that all sessions must read `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, or backend docs by default.
- [x] Update `Documents/AI_COLLABORATION_PROTOCOL.md` so it becomes an optional implementation/planning protocol rather than a universal startup read.
- [x] Add explicit maintenance rules to any modified protocol doc so future agents know when it must be updated.
**Files**: `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`
**Pattern**: Canonical-doc ownership with startup files referencing, not duplicating, detailed rules
**Rule**: Role boundaries must be unambiguous and shared across all agent entry files

### Step 2: Create canonical task-to-doc routing
- [x] Create `Documents/DOC_ROUTING.md` as the canonical lazy-load map from task type to required docs.
- [x] Route by work type rather than broad repo area, covering at minimum: discussion-only, planning, frontend implementation, backend design, backend implementation, module-specific work, menu changes, login payload changes, sheet/resource metadata changes, and resume/continuation work.
- [x] State "read only the relevant section" wherever a large document is involved.
- [x] Include a maintenance rule in the new doc so it is updated whenever new recurring task types or canonical reference docs are introduced.
**Files**: `Documents/DOC_ROUTING.md`
**Pattern**: Thin startup file + centralized doc router
**Rule**: Agents must not bulk-load unrelated docs; routing should enable targeted reads only

### Step 3: Slim startup files and align agent behavior
- [x] Rewrite `CLAUDE.md` into a compact entry file that references `Documents/MULTI_AGENT_PROTOCOL.md` and `Documents/DOC_ROUTING.md` instead of duplicating detailed rules.
- [x] Rewrite `AGENTS.md` to follow the same behavior model and task-routing logic as `CLAUDE.md`, with only minimal execution-oriented differences if truly needed.
- [x] Remove universal startup requirements to read `Documents/CONTEXT_HANDOFF.md`, `PLANS/`, `Documents/GAS_API_CAPABILITIES.md`, and `Documents/GAS_PATTERNS.md`.
- [x] Move backend file-creation guidance to task-scoped wording: prefer extending existing GAS files and patterns first; only create new files when the current structure cannot support the task cleanly.
- [x] Update testing guidance so full frontend build is not required by default and is only expected for major/cross-cutting frontend changes, roughly 10+ touched files or equivalent risk.
**Files**: `CLAUDE.md`, `AGENTS.md`
**Pattern**: Lean startup contract with task-triggered deep reads
**Rule**: Startup files must stay small, role-focused, and consistent across agents

### Step 4: Replace long handoff history with current-state snapshot
- [x] Rewrite `Documents/CONTEXT_HANDOFF.md` into a short, up-to-date snapshot focused on current system state, active constraints, and when the file should be read.
- [x] Remove long historical/date-wise implementation logs that are no longer necessary for startup understanding.
- [x] Add a maintenance rule stating that the file should be summarized and kept current after meaningful state changes, rather than appended as a changelog.
- [x] Ensure the shortened handoff doc points readers to canonical docs for deeper detail instead of duplicating them.
**Files**: `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Snapshot-over-history handoff
**Rule**: Handoff content should be current, brief, and continuation-oriented

### Step 5: Align documentation references and maintenance triggers
- [x] Review any affected references in startup/protocol docs so they point to canonical docs (`Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/CONTEXT_HANDOFF.md`) without duplicated instruction blocks.
- [x] Ensure each created or significantly rewritten guidance doc includes an explicit maintenance trigger section.
- [x] Keep edits scoped to instruction architecture and documentation behavior; do not change product code or functional implementation in this task.
**Files**: `CLAUDE.md`, `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Canonical ownership + trigger-based maintenance
**Rule**: Every maintained guidance doc must clearly state when future agents must update it

## Documentation Updates Required
- [x] Update `Documents/MULTI_AGENT_PROTOCOL.md` with the final role-boundary rules and startup-read expectations.
- [x] Update `Documents/AI_COLLABORATION_PROTOCOL.md` so it is clearly optional and task-triggered.
- [x] Create `Documents/DOC_ROUTING.md` with task-based doc-loading rules and its maintenance rule.
- [x] Update `Documents/CONTEXT_HANDOFF.md` into a brief current-state snapshot with its maintenance rule.
- [x] Update `CLAUDE.md` and `AGENTS.md` so both point to canonical docs instead of duplicating long policies.

## Acceptance Criteria
- [x] `CLAUDE.md` and `AGENTS.md` are significantly shorter and no longer require universal reading of `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, or backend-heavy docs.
- [x] `Documents/MULTI_AGENT_PROTOCOL.md` clearly defines the allowed behavior of Guide, Brain, Build, and Solo agents.
- [x] `Documents/DOC_ROUTING.md` exists and provides clear task-to-doc routing with "read only relevant section" guidance.
- [x] `Documents/AI_COLLABORATION_PROTOCOL.md` is optional and scoped to planning/building/change tasks.
- [x] `Documents/CONTEXT_HANDOFF.md` is brief, current, and maintained as a snapshot instead of a dated log.
- [x] Every created or rewritten guidance doc includes an explicit maintenance trigger.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed

### Deviations / Decisions
- [x] None

### Files Actually Changed
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/CONTEXT_HANDOFF.md`
- `CLAUDE.md`
- `AGENTS.md`

### Validation Performed
- [x] Manual review of role boundaries completed
- [x] Manual review of doc-routing completeness completed
- [x] Startup-read reduction verified in updated docs

### Manual Actions Required
- [x] None
