# PLAN: RolePermissions Wildcard Support
**Status**: COMPLETED
**Created**: 2026-03-12
**Created By**: Brain Agent
**Executed By**: Execution Agent

## Objective
Implement wildcard (`*`) support in role-permission resolution so RolePermissions rows like `Resource=*` and/or `Actions=*` grant expected access in login payload and runtime authorization checks.

## Context
- User-reported issue: wildcard rows exist in APP `RolePermissions` but are not being honored after login.
- Current logic resolves permissions in `GAS/resourceRegistry.gs`.
- Login authorized resource payload is generated via `auth.gs` -> `safeGetRoleResourceAccess(...)` -> `getRoleResourceAccess(...)`.

## Pre-Conditions
- [x] Required access/credentials are available.
- [x] Required source docs were reviewed.
- [x] Any dependent plan/task is completed.

## Steps

### Step 1: Implement wildcard matching in permission resolution
- [x] Update resource access aggregation to apply `Resource=*` rows across all active resources.
- [x] Update action parsing to treat `Actions=*` as full CRUD + resource additional actions.
**Files**: `GAS/resourceRegistry.gs`
**Pattern**: Existing centralized permission helpers (`getRoleResourceAccess`, `buildPermissionSetFromActions`).
**Rule**: RolePermissions wildcard entries must be equivalent to "all resources" and/or "all actions".

### Step 2: Align direct permission checks with wildcard behavior
- [x] Update per-resource permission checks to honor wildcard resource/action rows.
- [x] Verify no regression for explicit non-wildcard rows.
**Files**: `GAS/resourceRegistry.gs`
**Pattern**: `getRolePermissionForResource`, `hasRoleActionPermission`.
**Rule**: Runtime authorization must match login authorization behavior.

## Documentation Updates Required
- [x] Update `Documents/CONTEXT_HANDOFF.md` if architecture, process, or scope changed.

## Acceptance Criteria
- [x] Role row `Resource=*`, `Actions=*` returns all active `includeInAuthorizationPayload=true` resources in login payload with full CRUD permissions.
- [x] Role row `Resource=<specific>`, `Actions=*` grants full CRUD and all additional actions for that resource.
- [x] Existing explicit action rows (e.g. `Create,Read,Update`) remain functional.

## Post-Execution Notes (Execution Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `PLANS/2026-03-12-rolepermission-wildcard-support.md`
- `GAS/resourceRegistry.gs`

### Validation Performed
- [x] Unit/manual validation completed
- [x] Acceptance criteria verified

### Manual Actions Required
- [ ] Copy updated GAS file(s) into APP Apps Script project and redeploy Web App.
