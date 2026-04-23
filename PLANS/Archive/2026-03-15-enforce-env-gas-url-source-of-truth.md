# PLAN: Enforce VITE_GAS_URL as Single Source of Truth
**Status**: COMPLETED
**Created**: 2026-03-15
**Created By**: Brain Agent
**Executed By**: Execution Agent (Codex GPT-5)

## Objective
Ensure frontend always uses `.env` `VITE_GAS_URL` and never falls back to a hardcoded GAS URL.

## Context
- `FRONTENT/.env` has the intended final GAS deployment URL.
- `FRONTENT/src/config/api.js` contains a different hardcoded fallback URL.
- This mismatch can cause production/PWA login failures against the wrong backend.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Remove hardcoded fallback URL and enforce env URL
- [x] Delete `DEFAULT_GAS_URL` from `api.js`.
- [x] Resolve `GAS_URL` strictly from `import.meta.env.VITE_GAS_URL`.
- [x] Throw a clear error if `VITE_GAS_URL` is missing/empty.
**Files**: `FRONTENT/src/config/api.js`
**Pattern**: Centralized API config consumed by `apiClient`.
**Rule**: Env URL is final source of truth.

### Step 2: Validate and close plan
- [x] Verify no `DEFAULT_GAS_URL` references remain.
- [x] Mark plan completion.
**Files**: `PLANS/2026-03-15-enforce-env-gas-url-source-of-truth.md`
**Pattern**: Minimal configuration-only change.
**Rule**: Avoid silent fallback to wrong endpoint.

## Documentation Updates Required
- [x] Update `PLANS/2026-03-15-enforce-env-gas-url-source-of-truth.md` post-execution notes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] Frontend API base URL comes only from `VITE_GAS_URL`.
- [x] App fails fast with explicit message when env var is missing.
- [x] Hardcoded GAS fallback is removed.

## Post-Execution Notes (Execution Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/config/api.js`
- `PLANS/2026-03-15-enforce-env-gas-url-source-of-truth.md`

### Validation Performed
- [x] Unit/manual validation completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] Rebuild/redeploy frontend after confirming `.env` value.
