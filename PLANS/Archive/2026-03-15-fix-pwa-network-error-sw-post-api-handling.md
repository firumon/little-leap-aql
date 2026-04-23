# PLAN: Fix PWA Login Network Error by Hardening SW POST API Handling
**Status**: COMPLETED
**Created**: 2026-03-15
**Created By**: Brain Agent
**Executed By**: Execution Agent (Codex GPT-5)

## Objective
Resolve installed-PWA login `Network Error` by replacing Workbox strategy usage on cross-origin POST API route with direct fetch handling.

## Context
- API calls to GAS are POST requests.
- Current SW route applies `NetworkFirst` + cache plugins on POST route.
- Installed PWA context is controlled by SW; failure in this route appears as Axios `Network Error`.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Replace POST API strategy with direct fetch handler
- [x] Keep token injection behavior unchanged.
- [x] Use direct `fetch(newRequest)` for GAS POST requests.
- [x] Keep optional successful response mirror to IDB cache.
- [x] Remove `BackgroundSyncPlugin`/`NetworkFirst` usage for this POST path.
**Files**: `FRONTENT/src-pwa/custom-service-worker.js`
**Pattern**: Existing SW route matching `script.google.com/macros/s/`.
**Rule**: SW must not apply brittle runtime caching strategy to POST login transport.

### Step 2: Validate and close plan
- [x] Verify SW file no longer uses `NetworkFirst`/`bgSyncPlugin` for API POST route.
- [x] Mark plan completion.
**Files**: `PLANS/2026-03-15-fix-pwa-network-error-sw-post-api-handling.md`
**Pattern**: Keep change scoped to POST transport stability.
**Rule**: Preserve existing non-API caching routes.

## Documentation Updates Required
- [x] Update `PLANS/2026-03-15-fix-pwa-network-error-sw-post-api-handling.md` post-execution notes.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] SW API POST route uses direct fetch instead of `NetworkFirst`.
- [ ] Installed PWA login no longer fails with generic `Network Error` due to SW transport path.
- [x] Token injection and existing static caching behavior remain intact.

## Post-Execution Notes (Execution Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src-pwa/custom-service-worker.js`
- `PLANS/2026-03-15-fix-pwa-network-error-sw-post-api-handling.md`

### Validation Performed
- [x] Unit/manual validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] Rebuild/redeploy frontend, refresh SW, then retest installed PWA login.
