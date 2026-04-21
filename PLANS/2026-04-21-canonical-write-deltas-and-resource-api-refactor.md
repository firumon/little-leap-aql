# PLAN: Canonical Write Deltas and Resource API Refactor
**Status**: COMPLETED
**Created**: 2026-04-21
**Created By**: Solo Agent (Codex)
**Executed By**: Solo Agent (Codex)

## Objective
Align AQL API contracts so all write actions use nested payloads and return delta resource payloads, while simplifying batch semantics and removing master-scoped naming/legacy compatibility paths.

## Context
- User confirmed no client deployments yet, so backward compatibility can be removed.
- Existing read-side delta sync already uses `lastUpdatedAtByResource`.
- Write handlers previously returned scalar data only for most actions.
- Batch previously returned sub-envelopes in `data.result.results` without aggregated outer `data.resources`.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Lock canonical contracts (request and response)
- [x] Enforce nested write payload shape (`record`/`data`) and reject top-level write fields.
- [x] Define batch canonical response as ordered `data.result.responses[]` plus aggregated `data.resources`.
- [x] Update backend capability documentation to match non-backward-compatible contract.
**Files**: `Documents/GAS_API_CAPABILITIES.md`
**Pattern**: Existing canonical envelope v1 in capabilities doc
**Rule**: One JSON-structure-driven response handling path on frontend

### Step 2: Refactor GAS action handlers to generic resource naming
- [x] Rename master-scoped handler names to generic resource names in API layer and routing.
- [x] Remove legacy `master.*` compatibility dispatch paths.
- [x] Keep action dispatch focused on canonical verbs only.
**Files**: `GAS/apiDispatcher.gs`, `GAS/resourceApi.gs`, `GAS/masterApi.gs`
**Pattern**: Current generic CRUD dispatch and resource-based resolver path
**Rule**: No backward compatibility retained

### Step 3: Implement delta-on-write for all write actions
- [x] Add shared helper to collect direct affected resources and fetch per-resource deltas using request cursors.
- [x] Update `create`, `update`, `compositeSave`, `executeAction`, and `bulk` to return delta payloads.
- [x] Force `includeInactive=true` for write-response deltas.
**Files**: `GAS/resourceApi.gs`, `GAS/apiDispatcher.gs`
**Pattern**: Existing get multi-resource delta cursor resolution
**Rule**: Delta only for directly written resources (and explicit children for composite)

### Step 4: Update frontend write calls and batch consumption
- [x] Build `lastUpdatedAtByResource` on write requests from IDB metadata.
- [x] Send only canonical nested payload shapes for writes.
- [x] Switch batch result consumption to `data.result.responses` while relying on generic `data.resources` ingestion.
**Files**: `FRONTENT/src/services/ResourceCrudService.js`, `FRONTENT/src/stores/workflow.js`, `FRONTENT/src/composables/operations/stock/useStockMovements.js`, `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionCreateFlow.js`
**Pattern**: `ResourceFetchService` cursor collection and `GasApiService` resource ingestion flow
**Rule**: No action-specific response parser; JSON structure-driven handling

### Step 5: Validate and finalize execution log
- [x] Run targeted error checks on changed frontend/GAS files.
- [x] Run targeted verification command(s) for changed behavior.
- [x] Update plan status, changed files, and validation notes.
**Files**: `PLANS/2026-04-21-canonical-write-deltas-and-resource-api-refactor.md`
**Pattern**: Existing plan execution logging format
**Rule**: Keep verification targeted (no broad build by default)

## Documentation Updates Required
- [x] Update `Documents/GAS_API_CAPABILITIES.md` with nested write request and write-delta response contracts.
- [x] Update `Documents/ARCHITECTURE.md` with generic resource API naming references if scope-specific names are mentioned.
- [x] Update `Documents/CONTEXT_HANDOFF.md` for major API contract/process shift context.

## Acceptance Criteria
- [x] All write actions reject top-level write fields and require nested payload objects.
- [x] All write actions return canonical envelope with `data.resources` deltas for directly affected resources.
- [x] Batch returns ordered `data.result.responses` and aggregated `data.resources` without extra fetch pass.
- [x] Frontend write flows send `lastUpdatedAtByResource` and consume response by structure, not action-specific handlers.
- [x] No legacy `master.*` action compatibility remains in request dispatch path.

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
- [ ] `[?]` Decision needed:
- [x] `[!]` Tooling limitation handled: file deletion is unavailable, so `GAS/masterApi.gs` was converted to a deprecated placeholder while runtime handlers moved to `GAS/resourceApi.gs`.

### Files Actually Changed
- `PLANS/2026-04-21-canonical-write-deltas-and-resource-api-refactor.md`
- `GAS/apiDispatcher.gs`
- `GAS/resourceApi.gs`
- `GAS/masterApi.gs`
- `GAS/syncAppResources.gs`
- `GAS/stockMovements.gs`
- `FRONTENT/src/services/ResourceCrudService.js`
- `FRONTENT/src/stores/workflow.js`
- `FRONTENT/src/composables/operations/stock/useStockMovements.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionCreateFlow.js`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/ARCHITECTURE.md`
- `Documents/GAS_PATTERNS.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] `get_errors` check on changed GAS/frontend files
- [x] `npm --prefix "F:\LITTLE LEAP\AQL\FRONTENT" run test` (project script is placeholder and exits successfully)
- [x] `npm --prefix "F:\LITTLE LEAP\AQL" run gas:push` executed after GAS changes

### Manual Actions Required
- [x] Create a new Apps Script Web App deployment version because API contract behavior changed.
