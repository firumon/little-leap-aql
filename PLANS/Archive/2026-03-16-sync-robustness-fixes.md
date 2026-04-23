# PLAN: Sync & Setup Robustness Fixes
**Status**: COMPLETED
**Created**: 2026-03-16
**Created By**: Brain Agent
**Executed By**: Build Agent

## Objective
Fix the robustness issues reported in the `setupAppSheets` and `syncAppResources` scripts:
1.  Ensure `setupAppSheets` includes the new `Functional`, `PreAction`, and `PostAction` headers so they aren't wiped during normalization.
2.  Fix `syncAppResourcesFromCode` to prevent crashes when the `Resources` sheet is empty or has fewer columns than required.
3.  Ensure all resources are populated correctly during setup.

## Context
- The user reported that "Refactor App Sheet" wipes the new metadata columns because they aren't in the hardcoded header list.
- `syncAppResourcesFromCode` crashes with "range outside dimensions" on empty sheets because it doesn't check if `getLastColumn()` is 0 before calling `getRange()`.

## Pre-Conditions
- [x] Root causes identified in `setupAppSheets.gs` and `syncAppResources.gs`.
- [x] Required source files reviewed.

## Steps

### Step 1: Update setupAppSheets.gs Headers
- [x] Add `Functional`, `PreAction`, and `PostAction` to the `headers` list in the `APP.Resources` config within `setupAppSheets()`.
- [x] Add corresponding `columnWidths` entries.
- [x] Add TRUE/FALSE validation rule for the `Functional` column.
**Files**: `GAS/setupAppSheets.gs`

### Step 2: Robust Header Detection in syncAppResources.gs
- [x] Update `syncAppResourcesFromCode` to check if `sheet.getLastColumn() > 0` before reading headers.
- [x] Use `Math.max(sheet.getLastColumn(), 1)` for robustness.
**Files**: `GAS/syncAppResources.gs`

### Step 3: Robust Column Expansion in syncAppResources.gs
- [x] Before writing a row in `syncAppResourcesFromCode`, check if `newRow.length` exceeds `sheet.getMaxColumns()`.
- [x] If so, use `sheet.insertColumnsAfter(sheet.getMaxColumns(), needed)` to expand the sheet.
**Files**: `GAS/syncAppResources.gs`

## Documentation Updates Required
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` is already done, but ensure it's up to date.
- [x] Update `Documents/CONTEXT_HANDOFF.md` with notes on the code-driven metadata sync process.

## Acceptance Criteria
- [ ] "Refactor App Sheets" runs successfully on an empty sheet and creates all headers.
- [ ] `syncAppResourcesFromCode` runs successfully on an empty or minimal sheet and populates all resources.
- [ ] New columns (`Functional`, etc.) persist after running setup and sync.
- [ ] No regression in other setup scripts.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed

### Deviations / Decisions
- [x] [None]

### Files Actually Changed
- `GAS/setupAppSheets.gs`
- `GAS/syncAppResources.gs`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/2026-03-16-sync-robustness-fixes.md`

### Validation Performed
- [x] Local static verification (`git diff`, targeted code-path inspection).
- [ ] Manual verification via GAS editor execution simulations.

### Manual Actions Required
- [ ] User to run "Setup > Refactor App Sheet" to verify fix.
- [ ] User to run "AQL > Resources > Sync Resources from code" to verify fix.
