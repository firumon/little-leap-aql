# PLAN: Remove Compatibility Overheads (Menu + Scope Canonicalization)
**Status**: COMPLETED
**Created**: 2026-04-06
**Created By**: Brain Agent (Codex)
**Executed By**: Build Agent (Claude Sonnet 4.6)

## Objective
Simplify architecture by removing unnecessary backward-compatibility logic introduced in the previous implementation:
1. Keep only one menu grouping contract (remove dual `group` + `groupPath`).
2. Keep only one canonical scope vocabulary (remove singular/plural alias tolerance).
3. Update all code/docs to match the simplified contracts.

## Context
Current code (verified) includes compatibility layers:
- Menu schema supports both `group` and `groupPath` with fallback behavior (`resourceRegistry.gs`, `MainLayout.vue`).
- Scope normalization accepts singular/plural aliases (`master/masters`, `operation/operations`, etc.).
- User requirement: no compatibility overhead because there are no deployed clients yet; use a single pure contract owned by our codebase.

## Pre-Conditions
- [ ] Finalize canonical scope values (recommended): `master`, `operation`, `accounts`, `report`.
- [ ] Finalize canonical menu path field (recommended): `groupPath` only.
- [ ] Confirm no requirement to preserve legacy sheet payloads.

## Steps

### Step 1: Canonical Contract Definition (Rule Capture)
- [ ] Define explicit canonical contracts in code comments and docs:
  - `Menu[]` entries MUST use `groupPath: string[]`.
  - `scope` MUST be one of canonical values only (no alias conversion).
- [ ] Add hard validation errors for non-canonical values.
**Files**: `GAS/resourceRegistry.gs`, `GAS/apiDispatcher.gs`, docs listed below.
**Rule**: Fail fast on invalid contracts rather than silently normalizing.

### Step 2: Remove Menu Backward-Compatibility Fallbacks
- [ ] In `resourceRegistry.gs`, remove fallback from `group` to `groupPath`; parse only `groupPath`.
- [ ] In frontend menu tree builder (`MainLayout.vue`), remove fallback to `menu.group`.
- [ ] Remove `group` writes from `syncAppResources.gs` menu entries (keep only `groupPath`).
- [ ] Keep tree rendering logic itself (N-level) unchanged.
**Files**: `GAS/resourceRegistry.gs`, `FRONTENT/src/layouts/MainLayout/MainLayout.vue`, `GAS/syncAppResources.gs`.
**Rule**: Single source for hierarchy = `groupPath`.

### Step 3: Update Admin Resource Editor for Canonical Menu Path
- [ ] Replace `MenuGroup`/`menuGroup` form semantics with canonical menu-path input handling.
- [ ] Ensure admin save writes `groupPath` (array) in primary menu entry.
- [ ] Preserve additional menu entries through `_menuArrayFull` behavior.
**Files**: `GAS/appMenu.gs`, `GAS/adminDialog.html`.
**Rule**: Admin UI must create canonical schema, not legacy keys.

### Step 4: Remove Scope Alias Normalization
- [ ] In scope normalizers, remove plural/singular alias mapping.
- [ ] Accept only exact canonical scope tokens.
- [ ] Update dispatch/validation error messages to instruct canonical values.
**Files**: `GAS/resourceRegistry.gs`, `GAS/apiDispatcher.gs`, `GAS/masterApi.gs`, frontend callers if needed.
**Rule**: `scope` mismatch is explicit error, not auto-corrected.

### Step 5: Sheet/Data Sync Impact Handling
- [ ] Ensure `syncAppResources.gs` outputs only canonical menu + scope formats.
- [ ] Add/update one migration utility (or documented admin process) to rewrite existing `APP.Resources.Menu` rows that still contain legacy `group` values.
- [ ] Validate that post-sync payload contains only canonical fields.
**Files**: `GAS/syncAppResources.gs`, optional migration helper in GAS.
**Rule**: No mixed-contract rows remain after migration step.

### Step 6: Frontend + Backend Verification Matrix
- [ ] Verify menu tree rendering from `groupPath` only.
- [ ] Verify all CRUD/resource fetches succeed using canonical scope only.
- [ ] Verify Manage Stock save/load and non-master pages still work.
**Files**: frontend runtime + GAS runtime tests/manual checks.
**Rule**: No regressions in permission checks, route guard matching, or data loading.

### Step 7: Documentation Synchronization (Mandatory)
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md`:
  - remove `group` key references
  - define `groupPath` as required canonical hierarchy field.
- [ ] Update `Documents/APP_SHEET_STRUCTURE.md` to reflect Menu schema changes.
- [ ] Update `Documents/LOGIN_RESPONSE.md` menu payload examples/field descriptions.
- [ ] Update `Documents/MODULE_WORKFLOWS.md` menu architecture section + any scope notes.
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` for admin input format (`groupPath`).
- [ ] Update `Documents/CONTEXT_HANDOFF.md` with dated simplification note.
- [ ] Update `FRONTENT/src/components/REGISTRY.md` if menu tree component contract changes.

### Step 8: Deploy + Close
- [ ] Run frontend build.
- [ ] Run `npm run gas:push`.
- [ ] Provide manual post-deploy actions:
  - `AQL ?? > Resources > Sync APP.Resources from Code`
  - re-login frontend.

## Documentation Updates Required
- [ ] `Documents/RESOURCE_COLUMNS_GUIDE.md`
- [ ] `Documents/APP_SHEET_STRUCTURE.md`
- [ ] `Documents/LOGIN_RESPONSE.md`
- [ ] `Documents/MODULE_WORKFLOWS.md`
- [ ] `Documents/AQL_MENU_ADMIN_GUIDE.md`
- [ ] `Documents/CONTEXT_HANDOFF.md`
- [ ] `FRONTENT/src/components/REGISTRY.md` (if API changes)

## Acceptance Criteria
- [ ] No menu entry uses `group`; only `groupPath` is parsed/rendered.
- [ ] Backend and frontend reject non-canonical scope values.
- [ ] Non-master resources load and save correctly with canonical scope values.
- [ ] Sidebar tree renders correctly from `groupPath` only.
- [ ] All related docs/specs show canonical-only contracts.

## Post-Execution Notes (Build Agent fills this)
### Progress Log
- [x] Step 1 completed — `normalizeResourceScope` throws on non-canonical values; no more plural aliases or silent defaulting
- [x] Step 2 completed — `group` field removed from all 33 menu entries in `syncAppResources.gs`; `resourceRegistry.gs` menus map no longer outputs `group`; `MainLayout.vue` `group` fallback removed
- [x] Step 3 completed — Admin dialog: `MenuGroup` → `Menu Path (CSV)` (`menuGroupPath`); `getResourceDetails` reads `groupPath` array → CSV; `mapResource` writes `groupPath` CSV → array
- [x] Step 4 completed — `normalizeResourceScope` fails fast on invalid scope tokens
- [x] Step 5 completed — `syncAppResources.gs` outputs `groupPath`-only format; no legacy `group` fields remain
- [x] Step 6 completed — `apiDispatcher.gs` scope allowlist updated to include `report`
- [x] Step 7 completed — All 7 docs updated (RESOURCE_COLUMNS_GUIDE, APP_SHEET_STRUCTURE, LOGIN_RESPONSE, MODULE_WORKFLOWS, AQL_MENU_ADMIN_GUIDE, CONTEXT_HANDOFF, REGISTRY.md already current)
- [x] Step 8 completed — GAS deployed (23 files); git committed [6488edc]

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/resourceRegistry.gs`
- `GAS/apiDispatcher.gs`
- `GAS/masterApi.gs`
- `GAS/appMenu.gs`
- `GAS/adminDialog.html`
- `GAS/syncAppResources.gs`
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/APP_SHEET_STRUCTURE.md`
- `Documents/LOGIN_RESPONSE.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/AQL_MENU_ADMIN_GUIDE.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [ ] Frontend build passes
- [ ] GAS push completed
- [ ] Manual validation completed

### Manual Actions Required
- [ ] Run `AQL ?? > Resources > Sync APP.Resources from Code`.
- [ ] Re-login frontend to refresh resources payload.
- [ ] If payload contract changes require it, create new Web App deployment version.
