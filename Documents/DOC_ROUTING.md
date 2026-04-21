# Document Routing Guide

## Purpose
This document is the canonical task-to-doc router for AQL. Use it to decide what to read after the startup file and `Documents/MULTI_AGENT_PROTOCOL.md`.

## Core Routing Rule
- Read only the docs required for the current task.
- For large docs, read only the relevant section instead of the whole file whenever possible.
- Do not load `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, or backend-heavy docs unless the task actually needs them.

## Non-Negotiable Frontend Pre-Read
**Before touching ANY file under `FRONTENT/` — regardless of scope, size, or perceived simplicity — you MUST read:**
- `Documents/ARCHITECTURE RULES.md`

This applies to: bug fixes, one-line patches, component tweaks, composable changes, store edits, service changes, style adjustments — everything.
Small fixes are the most frequent source of layer violations (e.g. calling services directly in components, using `router.push()` instead of `useResourceNav`, placing business logic in pages).
**Do not skip this step even for trivial-seeming changes.**

## Task Routing

### Discussion Only
Use when the task is brainstorming, clarification, tradeoff analysis, or high-level thinking.
- Read:
  - `Documents/MULTI_AGENT_PROTOCOL.md`
- Read more only if the discussion needs specific evidence from a canonical doc.

### Planning Work
Use when the user asks for a plan or explicitly invokes Brain Agent behavior.
- Read:
  - `Documents/MULTI_AGENT_PROTOCOL.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `PLANS/_TEMPLATE.md`
- Also read only the docs directly relevant to the task area.

### Execute A Named Plan
Use when Build Agent is asked to execute a plan.
- Read:
  - `Documents/MULTI_AGENT_PROTOCOL.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - the specific named plan file only
- Do not read all files in `PLANS/`.

### Resume Or Continue Existing Work
Use when the task depends on current project state or recent unfinished work.
- Read:
  - `Documents/CONTEXT_HANDOFF.md`
- Also read only the specific plan or module docs needed for that continuation.

### Frontend Implementation
Use when editing files under `FRONTENT/`.
- Read:
  - `Documents/ARCHITECTURE RULES.md` — **mandatory, see Non-Negotiable Frontend Pre-Read above**
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
- If the task affects reusable building blocks, also read/update:
  - `FRONTENT/src/components/REGISTRY.md`
  - `FRONTENT/src/composables/REGISTRY.md`
- If the task affects a documented module, also read only the relevant section of:
  - `Documents/MODULE_WORKFLOWS.md`

### Frontend Architecture Review Or Planning
Use when reviewing frontend architecture, planning frontend refactors, or defining frontend implementation steps (even before code edits).
- Read:
  - `Documents/ARCHITECTURE RULES.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - task-specific module docs only when directly relevant

### Operations Resource Customization
Use when overriding or creating custom section or sub-components for an operations resource
(e.g. custom record card, custom parent display, custom child layout, custom loading/empty states).
- Read:
  - `Documents/OPERATION_CUSTOMIZATION.md`

### Masters Resource Customization
Use when overriding or creating custom section or sub-components for a masters resource
(e.g. custom record card, custom child layout, custom loading/empty states).
- Read:
  - `Documents/MASTER_CUSTOMIZATION.md`

### Backend Design
Use when designing new backend behavior, evaluating options, or checking whether existing GAS capabilities already support the request.
- Read:
  - `Documents/GAS_API_CAPABILITIES.md`
- Read `Documents/AI_COLLABORATION_PROTOCOL.md` only if the task is moving beyond discussion into planning/building.

### Backend Implementation
Use when editing GAS code.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/GAS_API_CAPABILITIES.md`
  - `Documents/GAS_PATTERNS.md`
- Prefer existing GAS files and patterns first.
- Create a new GAS file only when the current structure cannot support the task cleanly.

### Module-Specific Work
Use when a documented module such as Reports or Bulk Upload is involved.
- Read:
  - only the relevant section of `Documents/MODULE_WORKFLOWS.md`
- Also read task-specific docs from this router as needed.

### Resource Metadata Or Sheet Schema Changes
Use when changing `APP.Resources`, resource columns, sheet structure, or setup/sync behavior.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/RESOURCE_COLUMNS_GUIDE.md`
- Also read the relevant structure doc section if needed.

### Menu Action Changes
Use when adding, removing, renaming, or behavior-changing `AQL` menu actions.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/AQL_MENU_ADMIN_GUIDE.md`

### Login Payload Or Auth Response Changes
Use when changing `handleLogin()` response shape, field sources, or frontend storage of login data.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/LOGIN_RESPONSE.md`

## Maintenance Rule
Update this file when any of the following changes:
- a new recurring task type is introduced
- a canonical reference doc is added, removed, or renamed
- routing guidance changes for planning, build, backend, frontend, auth, menu, or resume workflows
- mandatory-read rules for specific task categories change
- the Non-Negotiable Frontend Pre-Read list changes (e.g. a new always-read doc is added for frontend work)
