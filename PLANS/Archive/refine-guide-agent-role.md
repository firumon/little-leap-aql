# PLAN: Refine Guide Agent Role Boundaries
**Status**: COMPLETED
**Created**: 2026-05-08
**Created By**: Brain Agent (Kilo Code)
**Executed By**: Build Agent (Codex)

## Objective
Refine the `Guide Agent` role definition in `Documents/MULTI_AGENT_PROTOCOL.md` so it clearly documents cold-start behavior, on-demand knowledge escalation, session-persistent role behavior, and the new handoff-output capability while preserving the Guide Agent's prohibition against repository edits, plan-file edits, and implementation work.

## Context
Reviewed source docs:
- `Documents/MULTI_AGENT_PROTOCOL.md` lines 1-84: current canonical role boundaries, plan workflow, startup reading rule, context efficiency rule, and maintenance rule.
- `PLANS/_TEMPLATE.md` lines 1-77: required plan structure and execution tracking format.

Current state:
- The `Guide Agent` section is concise and currently covers purpose, allowed actions, and not-allowed actions only.
- Startup reading behavior is documented globally, but it does not explicitly name the Guide Agent cold-start document set.
- Handoff behavior exists only indirectly through recommendations to use Brain, Build, or Solo; it does not define switch-vs-portable-prompt handoff options.
- Prompt style expectations for Guide-to-Brain handoffs are not documented.

## Pre-Conditions
- [x] Required source docs were reviewed.
- [x] Build Agent is operating from an approved plan and may edit `Documents/MULTI_AGENT_PROTOCOL.md`.
- [x] No concurrent edits to `Documents/MULTI_AGENT_PROTOCOL.md` are in progress.

## Steps

### Step 1: Replace only the Guide Agent section
- [x] In `Documents/MULTI_AGENT_PROTOCOL.md`, replace the existing `### Guide Agent` section only, from the `### Guide Agent` heading through the final Guide Agent `Not allowed` bullet, stopping before `### Brain Agent`.
- [x] Do not change the `Brain Agent`, `Build Agent`, or `Solo Agent` role definitions.
- [x] Preserve the Guide Agent's existing purpose of discussion, deep thinking, tradeoff analysis, requirement shaping, and high-level reasoning.
- [x] Add explicit cold-start behavior: Guide reads only `AGENTS.md`, `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md` at session start.
- [x] Add explicit on-demand escalation behavior: Guide reads only docs/code relevant to the user's described task, following `Documents/DOC_ROUTING.md`, and retains that knowledge for the remainder of the session without re-reading known material.
- [x] Add explicit persistent-role behavior: Guide remains Guide across multiple tasks in the same session unless the user explicitly switches roles or directly requests role-specific work.
- [x] Add explicit handoff behavior: once discussion reaches a solid solution, Guide presents two options: switch to Brain Agent in the same session, or produce a portable prompt for a fresh Brain session elsewhere.
- [x] Add explicit handoff prompt style: describe behavior and contracts, point to files/patterns to read, list architecture constraints, include acceptance criteria, and omit literal code snippets.
- [x] Keep the Guide Agent `Not allowed` list forbidding repository file edits, plan-file creation/modification, and implementation work. Also document that Guide does not write/update plan files itself and only drafts handoff prompts for Brain.

**Files**: `Documents/MULTI_AGENT_PROTOCOL.md`
**Pattern**: Keep the existing role-section format: `Purpose`, `Allowed`, `Not allowed`, with concise nested bullets where needed.
**Rule**: No other role definitions are changed.

#### Exact OLD text
```markdown
### Guide Agent
- Purpose: discussion, deep thinking, tradeoff analysis, requirement shaping, and high-level reasoning.
- Allowed:
  - clarify goals and risks
  - compare approaches
  - recommend when Brain, Build, or Solo should be used
- Not allowed:
  - do not edit repository files
  - do not create or modify plan files
  - do not execute implementation work
```

#### Exact NEW text
```markdown
### Guide Agent
- Purpose: discussion, deep thinking, tradeoff analysis, requirement shaping, high-level reasoning, and preparing users for a clean Brain Agent handoff.
- Session behavior:
  - stays in-role across multiple tasks in the same session unless the user explicitly asks to switch roles or directly requests a role-specific action such as writing or executing a plan
  - may reference prior discussion and previously read material from the same session without re-reading it
- Cold-start behavior:
  - at session start, read only `AGENTS.md`, `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md`
  - do not pre-load all docs, all plans, or broad code areas
  - escalate reading only when the user's task requires it
- Escalated knowledge behavior:
  - when the user describes a task, read only docs and code files relevant to that task
  - use `Documents/DOC_ROUTING.md` to decide which docs or code areas to read next
  - retain task-relevant knowledge for the remainder of the session and avoid re-reading material already known in-session
- Allowed:
  - clarify goals and risks
  - compare approaches
  - recommend when Brain, Build, or Solo should be used
  - after discussion reaches a solid solution, present two handoff options:
    - switch to Brain Agent in the same session so context carries over
    - produce a portable prompt the user can paste into a fresh Brain Agent session elsewhere
  - draft Brain Agent handoff prompts that describe required behavior, reference files or patterns to read, list architecture constraints, and include testable acceptance criteria
- Handoff prompt style:
  - describe what each function, task, or workflow should do, including logic, contracts, and expected behavior
  - point to specific files, docs, or patterns the Brain Agent should read as reference
  - list architecture constraints the solution must respect
  - include acceptance criteria with testable outcomes
  - omit literal code snippets; Brain Agent decides how to write the code
- Not allowed:
  - do not edit repository files
  - do not create or modify plan files
  - do not execute implementation work
  - do not write or update plan files directly; only draft handoff prompts for Brain Agent
```

### Step 2: Align downstream startup and context rules
- [x] Review the `## Startup Reading Rule` section in `Documents/MULTI_AGENT_PROTOCOL.md` after updating the Guide Agent section.
- [x] If needed, update the global startup reading rule so it does not conflict with the Guide Agent cold-start rule and explicitly allows the Guide Agent's named cold-start document set.
- [x] Keep the existing intent that `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, and backend-heavy docs are not universal startup reads.
- [x] Do not introduce broad startup reads for any role.

**Files**: `Documents/MULTI_AGENT_PROTOCOL.md`
**Pattern**: Keep global rules short and defer detailed Guide behavior to the `### Guide Agent` role section.
**Rule**: Startup rules must document cold-start behavior without requiring all docs or code to be preloaded.

#### Exact OLD text
```markdown
## Startup Reading Rule
- Do not treat `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, or backend-heavy docs as universal startup reads.
- Read additional docs only when the current task requires them.
- Use `Documents/DOC_ROUTING.md` to decide what to read next.
```

#### Exact NEW text
```markdown
## Startup Reading Rule
- Guide Agent cold-start reads are limited to `AGENTS.md`, `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md`.
- Do not treat `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, backend-heavy docs, or broad code areas as universal startup reads.
- Read additional docs or code only when the current task requires them.
- Use `Documents/DOC_ROUTING.md` to decide what to read next.
```

### Step 3: Align role-switching expectations
- [x] Review the `## Role Selection` and `## Plan Workflow` sections after the Guide Agent update.
- [x] Confirm they already align with the persistent Guide role and Brain-only plan ownership.
- [x] Do not edit these sections unless the final updated Guide Agent section creates ambiguity.
- [x] If an edit is necessary, keep it minimal and do not alter the definitions of Brain, Build, or Solo.

**Files**: `Documents/MULTI_AGENT_PROTOCOL.md`
**Pattern**: Existing `Role Selection` already says agents keep the active role unchanged until explicit switch or role-specific action; existing `Plan Workflow` already says Guide discusses but never writes plans.
**Rule**: Avoid unnecessary churn; only update downstream references that must align with the new Guide definition.

### Step 4: Self-review the documentation diff
- [x] Verify the diff changes only the Guide Agent section and any required downstream global rule section.
- [x] Verify `Brain Agent`, `Build Agent`, and `Solo Agent` sections are unchanged.
- [x] Verify the Guide Agent `Not allowed` list still forbids repository file edits, plan-file creation/modification, and implementation work.
- [x] Verify no literal implementation code snippets were added to handoff prompt guidance.
- [x] Verify the new text is consistent with `AGENTS.md` startup expectations and does not require reading every plan or broad code area.

**Files**: `Documents/MULTI_AGENT_PROTOCOL.md`, `AGENTS.md`
**Pattern**: Canonical protocol in `Documents/MULTI_AGENT_PROTOCOL.md`; startup summary in `AGENTS.md` may summarize but should not redefine.
**Rule**: This task modifies only `Documents/MULTI_AGENT_PROTOCOL.md`; update `AGENTS.md` only if a direct contradiction is found during execution and the user approves expanding scope.

## Documentation Updates Required
- [x] Update `Documents/MULTI_AGENT_PROTOCOL.md` with the refined Guide Agent role definition.
- [x] Update the `Documents/MULTI_AGENT_PROTOCOL.md` startup reading rule only as specified in Step 2.
- [x] Do not update `Documents/CONTEXT_HANDOFF.md`; this is a role-protocol change, and no current-state handoff update is required by the task.

## Acceptance Criteria
- [x] `Documents/MULTI_AGENT_PROTOCOL.md` documents the Guide Agent cold-start rule: only `AGENTS.md`, `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md` are read at session start.
- [x] `Documents/MULTI_AGENT_PROTOCOL.md` documents on-demand escalation: Guide reads only task-relevant docs/code using `Documents/DOC_ROUTING.md` and retains knowledge in-session.
- [x] `Documents/MULTI_AGENT_PROTOCOL.md` documents both handoff options: switch to Brain Agent in the same session, or produce a portable prompt for a fresh Brain session.
- [x] `Documents/MULTI_AGENT_PROTOCOL.md` documents behavioral prompt-style rules and explicitly says to omit literal code snippets.
- [x] The Guide Agent `Not allowed` list still forbids repository file edits, plan-file creation/modification, and implementation work.
- [x] The Guide Agent section says Guide does not write/update plan files directly and only drafts handoff prompts for Brain Agent.
- [x] No `Brain Agent`, `Build Agent`, or `Solo Agent` role definition text is changed.
- [x] Global startup reading rules align with the new Guide Agent definition and do not require broad preloading.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution is completed.)*

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task (e.g., after 1.1, after 2.4b). Mark `[x]` immediately after the task is done. This is the single source of execution progress.

If execution is interrupted, the next agent reads this plan, finds the first unchecked `[ ]`, and resumes from that exact sub-task.

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed

### Deviations / Decisions
- [~] `[?]` Decision needed: none.
- [~] `[!]` Issue/blocker: none.

### Files Actually Changed
- `Documents/MULTI_AGENT_PROTOCOL.md`

### Validation Performed
- [x] Manual documentation diff review completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [x] None expected
