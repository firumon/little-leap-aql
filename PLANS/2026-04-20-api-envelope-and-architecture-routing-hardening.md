# PLAN: API Envelope + Architecture Routing Hardening
**Status**: COMPLETED
**Created**: 2026-04-20
**Created By**: Solo Agent (Codex)
**Executed By**: Solo Agent (Codex)

## Objective
Enforce strict frontend architecture reading/routing rules and cut over GAS/frontend transport to one canonical request/response envelope with request correlation and generic resource ingestion.

## Context
- User confirmed: `Documents/ARCHITECTURE RULES.md` must be mandatory for all `FRONTENT/` edits.
- User confirmed: core primitives must be documented as must-use defaults, including `useDataStore`.
- User confirmed: hard cutover is allowed (no backward compatibility requirement).
- User confirmed: request should avoid `scope`; resource should support string or array.
- User confirmed: default no headers in data responses; use fallback refresh when needed.

## Steps

### Step 1: Update governance/docs for routing + architecture defaults
- [x] Update `Documents/DOC_ROUTING.md` to require `Documents/ARCHITECTURE RULES.md` for all frontend implementation/review/planning work.
- [x] Update `Documents/ARCHITECTURE RULES.md` with a must-use defaults section including `useDataStore` and other core primitives.
- [x] Update `Documents/MODULE_WORKFLOWS.md` with cross-reference to strict architecture rules + core primitives and current composable paths.
- [x] Update `Documents/TECHNICAL_SPECIFICATIONS.md` and `Documents/GAS_API_CAPABILITIES.md` for canonical envelope rules.
- [x] Update `Documents/LOGIN_RESPONSE.md` so login follows common transport envelope while preserving auth-specific payload semantics.

**Files**: `Documents/DOC_ROUTING.md`, `Documents/ARCHITECTURE RULES.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/LOGIN_RESPONSE.md`

### Step 2: Implement GAS canonical envelope + request normalization
- [x] Implement request parser normalization in `GAS/apiDispatcher.gs` (`requestId`, `action`, `resource` string/array, `payload` merge).
- [x] Wrap all responses in a canonical envelope with `requestId` echo and standardized `{ resources, result, artifacts }` sections.
- [x] Keep login/profile/bulk-upload as payload-level variations, not transport-level exceptions.
- [x] Preserve default header-light resource responses.

**Files**: `GAS/apiDispatcher.gs`

### Step 3: Implement frontend canonical transport + generic ingestion
- [x] Update `FRONTENT/src/services/GasApiService.js` to emit canonical requests and consume canonical envelopes.
- [x] Add requestId generation and strict envelope validation in frontend service.
- [x] Add generic resource ingestion into IDB (rows + cursor meta) with header resolution: IDB/local storage first, fallback authorized-resources fetch.
- [x] Remove request `scope` dependence from key frontend services.

**Files**: `FRONTENT/src/services/GasApiService.js`, `FRONTENT/src/services/ResourceFetchService.js`, `FRONTENT/src/services/ResourceCrudService.js`

### Step 4: Validate and finalize
- [x] Run targeted static error checks on changed frontend files.
- [x] Update plan status and changed-file log.

## Acceptance Criteria
- [x] Frontend routing docs explicitly require architecture rules for all `FRONTENT/` edits.
- [x] Core primitives documented as must-use defaults with `useDataStore` explicitly included.
- [x] GAS and frontend use one canonical envelope with `requestId` correlation.
- [x] Requests support resource string/array without requiring `scope`.
- [x] Resource responses are header-light by default, with fallback header refresh path available.

## Post-Execution Notes
### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed

### Files Actually Changed
- `PLANS/2026-04-20-api-envelope-and-architecture-routing-hardening.md`
- `Documents/DOC_ROUTING.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/TECHNICAL_SPECIFICATIONS.md`
- `Documents/GAS_API_CAPABILITIES.md`
- `Documents/LOGIN_RESPONSE.md`
- `GAS/apiDispatcher.gs`
- `GAS/masterApi.gs`
- `FRONTENT/src/services/GasApiService.js`
- `FRONTENT/src/services/ResourceFetchService.js`
- `FRONTENT/src/services/ResourceCrudService.js`
- `FRONTENT/src/stores/workflow.js`
- `FRONTENT/src/stores/auth.js`
- `FRONTENT/src/composables/operations/purchaseRequisitions/usePurchaseRequisitionCreateFlow.js`
- `FRONTENT/src/composables/upload/useBulkUpload.js`

### Validation Performed
- [x] Targeted IDE error checks completed

### Manual Actions Required
- [ ] If GAS files changed: run `npm run gas:push` or `cd GAS && clasp push`


