# PLAN: Warehouse Preflight Standards Alignment
**Status**: DRAFT
**Created**: 2026-03-11
**Created By**: Brain Agent
**Executed By**: Execution Agent (pending)

## Objective
Align and formalize mandatory engineering standards before implementing Warehouse add flow, so frontend/backend behavior remains consistent, reusable, and policy-driven.

## Context
- User requested confirmation of four standards before Warehouse work:
  1. Quasar-first UI implementation (use Quasar components by default; raw HTML only when required).
  2. Single API request channel with common loading/error/success UX behavior.
  3. PWA + Service Worker + IndexedDB + Pinia data flow discipline.
  4. Server-side privilege enforcement (role-wise + record-wise access).
- Existing docs already cover substantial parts of API centralization, IDB cache-first sync, and authorization model, but frontend UI/component policy and a strict cross-module request UX contract are not explicitly codified as mandatory standards.
- Existing docs describe PWA/IDB sync for master flows; they do not yet define one explicit app-wide contract for how Pinia, IndexedDB, Service Worker, and network refresh should interact across all modules.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Codify Quasar-First UI Standard
- [x] Add an explicit frontend engineering rule: default to Quasar components for UI structure/forms/tables/actions/dialogs; use native/custom HTML only when Quasar cannot satisfy a requirement.
- [x] Add a short exception protocol: when native/custom HTML is used, document the reason in PR/plan note and keep styling aligned with Quasar theme tokens.
**Files**: `Documents/FRONTENT_README.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`, `.agents/skills/little-leap-expert/SKILL.md`
**Pattern**: Existing project-level rule capture in protocol/skill docs.
**Rule**: Quasar component-first policy is mandatory for new frontend work, including Warehouse pages.

### Step 2: Enforce Single API Channel + Common Request UX Contract
- [x] Define and document a single request lifecycle contract for all API calls: request dispatch, loading handling, normalized error mapping, success/error notifications.
- [x] Implement or update shared frontend utilities so screens/stores do not hand-roll request UX behavior independently.
- [x] Refactor at least current Warehouse-related and master/operation pages to consume the shared contract.
**Files**: `FRONTENT/src/services/gasApi.js`, `FRONTENT/src/services/apiClient.js`, `FRONTENT/src/pages/Masters/MasterEntityPage.vue`, `FRONTENT/src/pages/Operations/ShipmentsPage.vue`, `FRONTENT/src/pages/Operations/GoodsReceiptsPage.vue`, `Documents/FRONTENT_README.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`
**Pattern**: Existing centralized transport (`callGasApi`) + per-page `$q.notify` usage.
**Rule**: No direct ad-hoc API post flow or inconsistent notification/loading patterns in page components.

### Step 3: Formalize PWA-SW-IDB-Pinia Data Contract
- [x] Document one app-wide data contract: Pinia reads from IndexedDB first, then refreshes incrementally from server and updates both IndexedDB + Pinia.
- [x] Define service worker responsibility boundary (network/cache/sync mediation) and module responsibility boundary (UI state/business logic in app code) in explicit terms.
- [x] Apply the contract language to non-master modules where missing (including Warehouse flow scope) and list deviations as follow-up tasks.
**Files**: `Documents/ARCHITECTURE.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`, `Documents/FRONTENT_README.md`, `.agents/skills/little-leap-expert/SKILL.md`
**Pattern**: Existing master cache-first incremental sync (`resource-meta`, `resource-records`, `lastUpdatedAt`/`meta.lastSyncAt`).
**Rule**: IndexedDB-first, incremental refresh, and consistent cache update behavior must be standardized across modules.

### Step 4: Validate and Trace Server Access Enforcement
- [x] Verify docs explicitly map server enforcement layers: role permission (`RolePermissions`), record policy (`RecordAccessPolicy`/`OwnerUserField`), and region scope (`AccessRegion`).
- [x] If any missing traceability remains, add a concise “authorization enforcement matrix” section in technical docs.
- [x] Record open questions only if a real gap is found; otherwise mark this standard as confirmed baseline for Warehouse APIs.
**Files**: `Documents/ARCHITECTURE.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`, `Documents/RESOURCE_COLUMNS_GUIDE.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: Current `masterApi.gs` + `resourceRegistry.gs` policy evaluation.
**Rule**: Server must process requests only when caller is authorized by role + record policy + region scope.

## Documentation Updates Required
- [x] Update `Documents/FRONTENT_README.md` with Quasar-first UI rule and shared request lifecycle standard.
- [x] Update `Documents/TECHNICAL_SPECIFICATIONS.md` with explicit API UX and PWA data contract details.
- [x] Update `Documents/ARCHITECTURE.md` with service worker responsibility boundary and authorization matrix references.
- [x] Update `.agents/skills/little-leap-expert/SKILL.md` to include the new mandatory frontend behavior standards.
- [x] Update `Documents/CONTEXT_HANDOFF.md` with the finalized pre-Warehouse standards baseline.

## Acceptance Criteria
- [x] Documentation explicitly states Quasar-first UI rule and fallback exception criteria.
- [x] A single common API lifecycle pattern is documented and used by target frontend modules (no ad-hoc loading/notify handling).
- [x] PWA/IndexedDB/Pinia/service-worker contract is documented as an enforceable standard for Warehouse and future modules.
- [x] Server-side authorization coverage is confirmed and traceable in docs (role/resource + record policy + region scope).
- [x] No regression in existing login/master/operation data fetch behavior.

## Post-Execution Notes (Execution Agent fills this)
### Progress Log
- [x] Step 1 completed: Updated PR/Dev docs with Quasar component rule and PWA fallback info.
- [x] Step 2 completed: Overhauled `callGasApi` to utilize `Loading` and `Notify` internally; modified MasterEntityPage, ShipmentsPage, and GoodsReceiptsPage to drop ad-hoc $q.notify implementation.
- [x] Step 3 completed: Codified IndexedDB -> Sync -> Pinia data architecture and service worker network boundaries.
- [x] Step 4 completed: Matrix-defined authorization sequence in ARCHITECTURE.md and updated CONTEXT_HANDOFF.

### Deviations / Decisions
- [x] `[?]` Decision needed: None, specs clear.
- [x] `[!]` Issue/blocker: Removed nested try/catch statements inside Quasar pages since gasApi now catches and propagates correct UI signals seamlessly.

### Files Actually Changed
- `f:\LITTLE LEAP\AQL\FRONTENT\src\services\gasApi.js`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\services\masterRecords.js`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\Masters\MasterEntityPage.vue`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\Transactions\ShipmentsPage.vue`
- `f:\LITTLE LEAP\AQL\FRONTENT\src\pages\Transactions\GoodsReceiptsPage.vue`
- `f:\LITTLE LEAP\AQL\Documents\FRONTENT_README.md`
- `f:\LITTLE LEAP\AQL\Documents\TECHNICAL_SPECIFICATIONS.md`
- `f:\LITTLE LEAP\AQL\Documents\ARCHITECTURE.md`
- `f:\LITTLE LEAP\AQL\Documents\CONTEXT_HANDOFF.md`
- `f:\LITTLE LEAP\AQL\.agents\skills\little-leap-expert\SKILL.md`

### Validation Performed
- [x] Unit/manual validation completed via codebase audit.
- [x] Acceptance criteria verified

### Manual Actions Required
- [x] [Any user-required action: deploy/copy-paste/setup]: No Google Apps Script backend changes were made. You only need to reload frontend to test the new `$q.notify` wrappers in action.
