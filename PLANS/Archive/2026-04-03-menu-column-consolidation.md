# PLAN: Consolidate Menu Columns into Single JSON Column
**Status**: COMPLETED
**Created**: 2026-04-03
**Created By**: Solo Agent (Claude Code)
**Executed By**: Solo Agent (Claude Code)

## Objective
Replace 8 separate menu-related columns in APP.Resources (`MenuGroup`, `MenuOrder`, `MenuLabel`, `MenuIcon`, `RoutePath`, `PageTitle`, `PageDescription`, `ShowInMenu`) with a single `Menu` JSON column. The frontend auth payload shape (`entry.ui`) must remain identical so no frontend code changes are needed.

## Context
- Current state: 8 flat columns for menu config per resource.
- Problem: Column sprawl, makes future enhancements (tree hierarchy, role-based menus) harder.
- Strategy: Backend absorbs the change (parse JSON → same internal config props). Frontend sees no difference.

## Menu JSON Schema
```json
{
  "group": "Masters",
  "order": 1,
  "label": "Products",
  "icon": "inventory_2",
  "route": "/masters/products",
  "pageTitle": "Products",
  "pageDescription": "Manage product master records",
  "show": true
}
```

## Steps

### Step 1: Update `syncAppResources.gs`
- Remove 8 individual keys from each resource entry
- Add single `Menu` key with JSON string
- Keep `FileID` and `ListViews` in the preserve-on-sync list; add `Menu` to NOT preserve (code is source of truth)
**Files**: `GAS/syncAppResources.gs`

### Step 2: Update `setupAppSheets.gs`
- Replace 8 headers with single `Menu` header
- Update column widths
- Remove `ShowInMenu` from data validation targets
**Files**: `GAS/setupAppSheets.gs`

### Step 3: Update `resourceRegistry.gs`
- Parse `Menu` JSON column
- Extract into same internal config properties: `menuGroup`, `menuOrder`, `menuLabel`, `menuIcon`, `routePath`, `pageTitle`, `pageDescription`, `showInMenu`
- `buildAuthorizedResourceEntry()` stays unchanged → `entry.ui` payload is identical
**Files**: `GAS/resourceRegistry.gs`

### Step 4: Update `appMenu.gs`
- `mapResource()`: Combine 8 form fields into single `Menu` JSON
- `getResourceDetails()`: Parse `Menu` JSON and spread into individual form fields
- `toFormName()`: Remove 8 old mappings, add `Menu` → `menu`
- Admin dialog form HTML stays unchanged (individual form fields still shown)
**Files**: `GAS/appMenu.gs`

### Step 5: Documentation updates
- Update `Documents/RESOURCE_COLUMNS_GUIDE.md`
- Update `Documents/CONTEXT_HANDOFF.md`
- Update `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`

## Acceptance Criteria
- [ ] `syncAppResources.gs` uses single `Menu` JSON key
- [ ] `setupAppSheets.gs` creates `Menu` column instead of 8 separate columns
- [ ] `resourceRegistry.gs` parses `Menu` JSON → same config props
- [ ] `buildAuthorizedResourceEntry()` output shape unchanged
- [ ] `appMenu.gs` admin dialog still works (individual fields → JSON on save, JSON → fields on load)
- [ ] Frontend requires zero code changes
- [ ] All existing menu behavior preserved

## Post-Execution Notes
### Progress Log
- [x] Step 1 completed — syncAppResources.gs updated
- [x] Step 2 completed — setupAppSheets.gs updated
- [x] Step 3 completed — resourceRegistry.gs updated
- [x] Step 4 completed — appMenu.gs updated
- [x] Step 5 completed — Docs updated

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `GAS/setupAppSheets.gs`
- `GAS/resourceRegistry.gs`
- `GAS/appMenu.gs`
- `Documents/RESOURCE_COLUMNS_GUIDE.md`
- `Documents/CONTEXT_HANDOFF.md`

### Manual Actions Required
- [ ] Run `AQL > Setup & Refactor > Sync APP.Resources from Code` in the APP spreadsheet to apply new column schema
- [ ] Run `AQL > Setup & Refactor > Setup APP Sheets` to rebuild column structure
- [ ] Create new Web App deployment (API response shape unchanged, but GAS code changed)
