---
name: aql-expert
description: Work on the AQL system across Quasar frontend, Google Apps Script backend, Google Sheets metadata, APP.Resources, setup/sync scripts, module workflows, or cross-surface architecture alignment. Use when Codex is asked to implement, inspect, debug, review, or plan AQL-specific behavior that spans frontend, GAS, sheet structure, resource metadata, permissions, workflows, or deployment expectations.
---

# AQL Expert

## Role Of This Skill

Use this skill as an AQL domain adapter. It should not replace or duplicate repository policy.

Canonical authority order:
1. `AGENTS.md` / `CLAUDE.md` for startup and role behavior.
2. `Documents/MULTI_AGENT_PROTOCOL.md` for Guide, Brain, Build, and Solo boundaries.
3. `Documents/DOC_ROUTING.md` for task-specific reading.
4. Task-specific docs selected by `DOC_ROUTING.md`.
5. This skill for concise AQL orientation and reminders.

If this skill conflicts with canonical docs, follow the docs and note the mismatch.

## Current AQL Shape

- Frontend: Quasar Framework, Vue 3, Vite, Pinia, IndexedDB-backed local resource hydration, and PWA/offline boundaries.
- Backend: one Google Apps Script project attached to the APP spreadsheet, with `doPost` in `GAS/apiDispatcher.gs`.
- Database/control plane: Google Sheets across APP, MASTERS, TRANSACTIONS, REPORTS, and related files.
- Resource registry: `APP.Resources` is the runtime control plane for backend routing, frontend routing/menu behavior, authorization payloads, metadata, sheet targets, record access, defaults, actions, hooks, and list/view metadata.

## Required First Moves

1. Start from `AGENTS.md` / `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md`.
2. Identify the active role before deciding whether edits are allowed.
3. Use `DOC_ROUTING.md` to choose the exact docs to read. Do not preload broad docs.
4. For unfamiliar code, prefer GitNexus when available; otherwise use the local `npx gitnexus` CLI with an explicit repo path when needed.

## AQL Invariants

- Keep code, docs, setup scripts, sync scripts, and sheet metadata aligned only when the task changes them.
- Do not create a second Apps Script project for external sheet files unless explicitly requested.
- Prefer existing GAS files, generic resource APIs, hooks, composite saves, batch requests, and configured metadata before creating bespoke backend paths.
- Keep frontend pages thin. Put business/state orchestration in composables and reusable UI in components when the change is structurally meaningful.
- Before touching anything under `FRONTENT/`, read `Documents/ARCHITECTURE RULES.md`.
- When reusable frontend components or composables change, update the matching frontend registry if required by `DOC_ROUTING.md`.
- When GAS files change, run `npm run gas:push` from the repo root unless blocked.
- Ask for Web App redeployment only when the API contract changed.

## Common Routing Reminders

- Resource metadata or sheet schema changes: read `Documents/AI_COLLABORATION_PROTOCOL.md` and `Documents/RESOURCE_COLUMNS_GUIDE.md`.
- Backend implementation: read `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/GAS_API_CAPABILITIES.md`, and `Documents/GAS_PATTERNS.md`.
- Frontend implementation: read `Documents/ARCHITECTURE RULES.md` and `Documents/AI_COLLABORATION_PROTOCOL.md`.
- Module-specific behavior: read only the relevant `Documents/MODULE_WORKFLOWS.md` section.
- Continuation/current-state work: read `Documents/CONTEXT_HANDOFF.md` only when the task depends on recent unfinished work.

## Output Expectations

For implementation tasks, summarize:
- changed files
- verification performed
- GAS push or deployment status when relevant
- manual sheet/menu/Web App actions that cannot be done locally
