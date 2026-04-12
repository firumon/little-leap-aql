# Multi-Agent Collaboration Protocol

## Purpose
This document is the canonical source of truth for role boundaries in AQL. Startup files may summarize these rules, but they should not redefine them.

## Role Selection
- Default role is `Guide Agent` unless the user explicitly requests another role.
- Agents should keep the active role unchanged until the user explicitly asks to switch, except when the user directly requests a role-specific action such as writing a plan or executing a plan.

## Role Boundaries

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

### Brain Agent
- Purpose: convert approved direction into an executable implementation plan.
- Allowed:
  - create or update files in `PLANS/` only
  - use `PLANS/_TEMPLATE.md`
  - capture implementation steps, constraints, and acceptance criteria
- Not allowed:
  - do not edit production code
  - do not edit docs outside `PLANS/`
  - do not execute implementation work

### Build Agent
- Purpose: execute an approved plan end-to-end.
- Allowed:
  - read the assigned plan
  - edit implementation files and required docs
  - run verification steps appropriate to the task
  - update plan progress and completion status
- Rules:
  - read only the specific assigned plan, not all files in `PLANS/`
  - follow the plan literally unless a necessary correction is discovered
  - if a major deviation is needed, record it in the plan

### Solo Agent
- Purpose: direct execution when the user explicitly wants one agent to handle the task end-to-end.
- Allowed:
  - plan internally and implement directly
  - edit production files and docs without creating a plan by default
- Rules:
  - create a written plan only when the user explicitly asks for one
  - if a written plan is requested, create it with the same standard as Brain Agent

## Plan Workflow
- `Guide Agent` discusses but never writes plans.
- `Brain Agent` writes or updates plan files in `PLANS/`.
- `Build Agent` reads only the named or clearly identified plan and executes it.
- `Solo Agent` does not need a written plan unless the user asks for one.

## Plan Metadata
Plan files must use:
- `Created By: Brain Agent (AgentName)`
- `Executed By: Build Agent (AgentName | pending)`

Build Agent must replace `| pending` when execution is completed.

## Startup Reading Rule
- Do not treat `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, or backend-heavy docs as universal startup reads.
- Read additional docs only when the current task requires them.
- Use `Documents/DOC_ROUTING.md` to decide what to read next.

## Context Efficiency Rule
- Avoid loading broad docs by default.
- Prefer targeted reads and read only the relevant section of large docs whenever possible.
- Do not read all plan files in `PLANS/` unless the user explicitly asks for plan discovery.

## Maintenance Rule
Update this file when any of the following changes:
- role definitions or boundaries
- who may edit which file types
- plan ownership rules
- role-switching expectations
- default startup behavior related to role selection
