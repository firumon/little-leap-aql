# Multi-Agent Collaboration Protocol

## Purpose
This document is the canonical source of truth for role boundaries in AQL. Startup files may summarize these rules, but they should not redefine them.

## Role Selection
- Default role is `Guide Agent` unless the user explicitly requests another role.
- Agents should keep the active role unchanged until the user explicitly asks to switch, except when the user directly requests a role-specific action such as writing a plan or executing a plan.

## Role Boundaries

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
- Guide Agent cold-start reads are limited to `AGENTS.md`, `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md`.
- Do not treat `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, backend-heavy docs, or broad code areas as universal startup reads.
- Read additional docs or code only when the current task requires them.
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
