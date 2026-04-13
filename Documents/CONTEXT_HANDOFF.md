# Context Handoff - AQL

## Purpose
This file is a brief current-state snapshot for sessions that need continuation context. It is not a universal startup read.

## When To Read This File
Read this file only when:
- continuing unfinished work
- the task depends on current implementation state
- the user asks for resume context or latest project status

## Project Snapshot
- Project: AQL
- Domain: UAE baby product distribution operations
- Frontend: Quasar, Vue 3, Pinia, Vite
- Backend: Google Apps Script Web App with a single `doPost` entry
- Data model: Google Sheets split across APP, MASTERS, OPERATIONS, and REPORTS

## Current Operating Model
- `APP.Resources` is the main source of truth for resource metadata, routing, and permissions.
- A single APP Apps Script project is preferred for runtime behavior.
- `Config` in APP stores deployment-specific settings such as file IDs.
- GAS deployment is done with `clasp push`; manual Apps Script copy-paste is not part of the workflow.

## Current Important Constraints
- Use `Documents/DOC_ROUTING.md` to decide which docs to read for the task.
- Do not read all plans by default; read only the named or clearly relevant plan.
- For backend implementation, prefer existing GAS files and patterns first.
- For frontend implementation, keep pages thin when the task materially changes page structure.

## Current Functional State
- Resource-driven auth, menu, and master runtime are active.
- Login payload includes authorization/resource context and profile identity context.
- Master pages use cache-first IndexedDB sync with incremental updates.
- The project uses documented module workflows and canonical docs for menu and login payload behavior.
- Scope infrastructure is now data-driven via App.Config "Scopes" key, supporting dynamic scope addition without code changes.
- Procurement module schema initiated with PurchaseRequisitions, PurchaseRequisitionItems, and UOM master resources.
- Operation-scope resources use year-scoped code generation (e.g., PR26000001).

## Deep-Dive References
- Role boundaries: `Documents/MULTI_AGENT_PROTOCOL.md`
- Task-based doc loading: `Documents/DOC_ROUTING.md`
- Implementation alignment: `Documents/AI_COLLABORATION_PROTOCOL.md`
- Module workflows: `Documents/MODULE_WORKFLOWS.md`

## Maintenance Rule
Update this file when current-state assumptions materially change, for example:
- a major architecture/runtime decision changes
- current operating constraints change
- a major module or platform capability changes enough that continuation context would be misleading

Keep this file summarized and current. Replace outdated state instead of appending dated history.
