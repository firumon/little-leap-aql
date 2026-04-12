# Frontend README

## Purpose
This is the canonical frontend guide for AQL. It covers setup, structure, frontend conventions, and the current runtime model for frontend work.

## Stack
- Quasar v2
- Vue 3
- Vite
- Pinia
- Axios

## Setup
- Frontend root: `FRONTENT/`
- Local dev: run `npm run dev` inside `FRONTENT`
- Production build: run `npm run build` inside `FRONTENT` when major or cross-cutting frontend changes warrant it

## Frontend Rules
- Prefer Quasar components by default.
- Route all backend communication through `callGasApi`.
- Keep pages thin when the task materially changes page structure.
- Move reusable logic into composables/components.
- Update frontend registries only when reusable interfaces change.

## Structure
- `src/pages/`
  - thin orchestration layers
- `src/components/`
  - reusable UI building blocks
- `src/composables/`
  - stateful reusable logic
- `src/services/`
  - transport and data-access helpers
- `src/stores/`
  - shared application state

## Runtime Notes
- Auth state is stored in Pinia and persisted locally.
- Authorized resources drive menu visibility and route availability.
- Cache-first master/resource flows read IndexedDB first where implemented.
- Service Worker is responsible for cache/network boundaries only.

## Canonical Detail Owners
- System boundaries: [ARCHITECTURE.md](F:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE.md)
- Technical contracts: [TECHNICAL_SPECIFICATIONS.md](F:/LITTLE%20LEAP/AQL/Documents/TECHNICAL_SPECIFICATIONS.md)
- Module-specific flows: [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md)

## Maintenance Rule
Update this file when:
- frontend setup or dev/build workflow changes
- frontend directory responsibilities change
- shared frontend conventions change
- canonical frontend reference ownership changes
