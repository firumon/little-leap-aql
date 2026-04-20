# PLAN: API Envelope + Architecture Routing Hardening
**Status**: IN_PROGRESS
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
- [ ] Update `Documents/DOC_ROUTING.md` to require `Documents/ARCHITECTURE RULES.md` for all frontend implementation/review/planning work.
- [ ] Update `Documents/ARCHITECTURE RULES.md` with a must-use defaults section including `useDataStore` and other core primitives.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` with cross-reference to strict architecture rules + core primitives and current composable paths.
- [ ] Update `Documents/TECHNICAL_SPECIFICATIONS.md` and `Documents/GAS_API_CAPABILITIES.md` for canonical envelope rules.
- [ ] Update `Documents/LOGIN_RESPONSE.md` so login follows common transport envelope while preserving auth-specific payload semantics.

**Files**: `Documents/DOC_ROUTING.md`, `Documents/ARCHITECTURE RULES.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/TECHNICAL_SPECIFICATIONS.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/LOGIN_RESPONSE.md`

### Step 2: Implement GAS canonical envelope + request normalization
- [ ] Implement request parser normalization in `GAS/apiDispatcher.gs` (`requestId`, `action`, `resource` string/array, `payload` merge).
- [ ] Wrap all responses in a canonical envelope with `requestId` echo and standardized `{ resources, result, artifacts }` sections.
- [ ] Keep login/profile/bulk-upload as payload-level variations, not transport-level exceptions.
- [ ] Preserve default header-light resource responses.

**Files**: `GAS/apiDispatcher.gs`

### Step 3: Implement frontend canonical transport + generic ingestion
- [ ] Update `FRONTENT/src/services/GasApiService.js` to emit canonical requests and consume canonical envelopes.
- [ ] Add requestId generation and strict envelope validation in frontend service.
- [ ] Add generic resource ingestion into IDB (rows + cursor meta) with header resolution: IDB/local storage first, fallback authorized-resources fetch.
- [ ] Remove request `scope` dependence from key frontend services.

**Files**: `FRONTENT/src/services/GasApiService.js`, `FRONTENT/src/services/ResourceFetchService.js`, `FRONTENT/src/services/ResourceCrudService.js`

### Step 4: Validate and finalize
- [ ] Run targeted static error checks on changed frontend files.
- [ ] Update plan status and changed-file log.

## Acceptance Criteria
- [ ] Frontend routing docs explicitly require architecture rules for all `FRONTENT/` edits.
- [ ] Core primitives documented as must-use defaults with `useDataStore` explicitly included.
- [ ] GAS and frontend use one canonical envelope with `requestId` correlation.
- [ ] Requests support resource string/array without requiring `scope`.
- [ ] Resource responses are header-light by default, with fallback header refresh path available.

## Post-Execution Notes
### Progress Log
- [ ] Step 1 completed
- [ ] Step 2 completed
- [ ] Step 3 completed
- [ ] Step 4 completed

### Files Actually Changed
- `TBD`

### Validation Performed
- [ ] Targeted IDE error checks completed

### Manual Actions Required
- [ ] If GAS files changed: run `npm run gas:push` or `cd GAS && clasp push`

