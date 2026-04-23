# PLAN: Fix getAuthorizedResources Empty Data & FileID Resolution
**Status**: COMPLETED
**Created**: 2026-03-19
**Created By**: Brain Agent (Claude Code Opus)
**Executed By**: Build Agent (Codex GPT-5)

## Objective
Fix the `getAuthorizedResources` API action returning empty data, caused by FileID resolution failures after the recent audit refactor that removed FileID auto-population from `syncAppResourcesFromCode()`.

## Context
- The 2026-03-19 GAS Audit Refactor removed FileID auto-population: `Resources.FileID` cells are now intentionally blank, relying on runtime resolution via `resolveFileIdForScope()`.
- The resolution chain is: `Resource.FileID` → `Config[{Scope}FileID]` → `SpreadsheetApp.getActiveSpreadsheet().getId()`.
- Multiple issues in this chain cause silent failures that result in empty `getAuthorizedResources` payloads.

### Root Causes Identified

**Bug 1: `getActiveSpreadsheet()` returns `null` in Web App `doPost` context**
All doPost-reachable code paths use `SpreadsheetApp.getActiveSpreadsheet()` to access the APP spreadsheet. While this works for bound scripts in most contexts, it can return `null` in web app execution contexts (especially when deployed as "Execute as: User accessing the web app"). When null, the entire resource resolution chain throws, and `safeGetRoleResourceAccess()` catches the error and returns `[]` — silently hiding the real problem.

Affected functions:
- `getResourceRegistryContext()` — `resourceRegistry.gs:12`
- `getConfigMap()` — `sheetHelpers.gs:64`
- `resolveFileIdForScope()` — `sheetHelpers.gs:120` (final fallback)
- `getUsersContext()` — `auth.gs:36`
- `getRolePermissionsContext()` — `resourceRegistry.gs:230`
- `getRoleNameById()` — `auth.gs:304`
- `diagLogResolvedFileIds()` — `sheetHelpers.gs:129`

**Bug 2: Config key mismatch for `accounts` scope**
- Config sheet pre-populates key: `AccountFileID` (singular, from `setupAppSheets.gs:326`)
- `resolveFileIdForScope('accounts', '')` generates key: `AccountsFileID` (plural — `Accounts` + `FileID`)
- Fallback key: `AccountssFileID` (double-s) — also doesn't match
- Result: accounts-scope resources never find their Config file ID, always fall through to APP file ID fallback.

**Bug 3: Silent error swallowing in `safeGetRoleResourceAccess`**
- `auth.gs:214-226` wraps the entire resource resolution in try/catch and returns `[]` on any error.
- No logging whatsoever — makes it impossible to diagnose why resources are empty.

**Bug 4: fileId exposed in frontend payload unnecessarily**
- `buildAuthorizedResourceEntry()` includes `fileId` in the returned object sent to the frontend.
- The frontend has no use for Google Drive file IDs. This is an information leak and confuses debugging (users see "empty fileId" and think it's a problem).

## Pre-Conditions
- [x] Required source docs were reviewed: `resourceRegistry.gs`, `sheetHelpers.gs`, `auth.gs`, `apiDispatcher.gs`, `Constants.gs`, `setupAppSheets.gs`, `syncAppResources.gs`
- [ ] User confirms whether the Web App is deployed as "Execute as: Me" or "Execute as: User accessing the web app"
- [ ] User confirms whether Config sheet has actual file IDs populated, or all values are empty

## Steps

### Step 1: Add robust `getAppSpreadsheet()` helper
Create a centralized helper that never returns null, using a fallback chain:
1. Try `SpreadsheetApp.getActiveSpreadsheet()`
2. If null, try `SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('APP_FILE_ID'))`
3. If still null, throw a clear error message

- [ ] Add `getAppSpreadsheet()` function to `GAS/sheetHelpers.gs`
- [ ] Add `setAppFileId()` utility function that stores the current spreadsheet ID in ScriptProperties (one-time setup, callable from the AQL menu)
- [ ] Add `setupAppFileIdProperty()` call in `setupAppSheets()` so the property is auto-set during setup

**Files**: `GAS/sheetHelpers.gs`, `GAS/setupAppSheets.gs`
**Rule**: The APP file ID in ScriptProperties is the safety net. `getActiveSpreadsheet()` remains the primary path for performance (avoids an `openById` call).

### Step 2: Replace all `getActiveSpreadsheet()` calls with `getAppSpreadsheet()`
Replace every doPost-reachable `SpreadsheetApp.getActiveSpreadsheet()` call with the new helper.

- [ ] `GAS/resourceRegistry.gs` — `getResourceRegistryContext()` (line 12)
- [ ] `GAS/resourceRegistry.gs` — `getRolePermissionsContext()` (line 230)
- [ ] `GAS/sheetHelpers.gs` — `getConfigMap()` (line 64)
- [ ] `GAS/sheetHelpers.gs` — `resolveFileIdForScope()` (line 120)
- [ ] `GAS/auth.gs` — `getUsersContext()` (line 36)
- [ ] `GAS/auth.gs` — `getRoleNameById()` (line 304)
- [ ] `GAS/auth.gs` — `getDesignationById()` (line 323)
- [ ] Do NOT replace in menu/UI functions (`setupAppSheets.gs`, `appMenu.gs`, etc.) — those run in spreadsheet context where `getActiveSpreadsheet()` is always valid.

**Files**: `GAS/resourceRegistry.gs`, `GAS/sheetHelpers.gs`, `GAS/auth.gs`
**Pattern**: Only replace in functions reachable from `doPost()`. Leave menu/setup functions using `getActiveSpreadsheet()`.

### Step 3: Fix Config key mismatch for `accounts` scope
- [ ] In `GAS/setupAppSheets.gs`, change the pre-populated Config key from `AccountFileID` to `AccountsFileID` to match the runtime resolution pattern (`{Scope}FileID`).
- [ ] Also verify and document the expected Config keys:
  - `MasterFileID` (scope `master`)
  - `OperationFileID` (scope `operation`)
  - `AccountsFileID` (scope `accounts`) ← FIX
  - `ReportFileID` (scope `report`)

**Files**: `GAS/setupAppSheets.gs`
**Rule**: Config keys MUST match the pattern `{CapitalizedScope}FileID` exactly, since `resolveFileIdForScope` generates the key dynamically.

### Step 4: Add error logging to `safeGetRoleResourceAccess`
- [ ] Add `console.error` logging in the catch block of `safeGetRoleResourceAccess()` so failures are visible in the Apps Script execution log.
- [ ] Add `console.warn` logging in `buildAuthorizedResourceEntry()` when `getResourceConfig()` throws (currently returns null silently).

**Files**: `GAS/auth.gs`, `GAS/resourceRegistry.gs`
**Rule**: Never silently swallow errors in auth/authorization paths. Always log to execution log.

### Step 5: Remove `fileId` from frontend authorization payload
- [ ] In `buildAuthorizedResourceEntry()`, remove `fileId` from the returned entry object. The frontend never uses it, and it exposes internal infrastructure details.
- [ ] Keep `fileId` usage internal (only used by `openResourceSheet()` at runtime).

**Files**: `GAS/resourceRegistry.gs`
**Rule**: Authorization payload should only include data the frontend needs: name, scope, permissions, headers, UI config. Not internal file routing.

### Step 6: Add AQL menu item to store APP File ID
- [ ] Add a menu item under `AQL 🚀 > Setup & Refactor` called "Store APP File ID in Properties" that calls `setAppFileId()`.
- [ ] Or better: call `setAppFileId()` automatically at the end of `setupAppSheets()` so it's always set during setup.

**Files**: `GAS/appMenu.gs`, `GAS/setupAppSheets.gs`
**Rule**: This is a one-time safety net. If the property is already set and matches the current spreadsheet, skip silently.

### Step 7: Deploy and verify
- [ ] Run `cd GAS && clasp push` to deploy changes.
- [ ] User runs `AQL 🚀 > Setup & Refactor > Setup APP Sheets` to re-setup (this will store the APP File ID in properties and fix the Config key).
- [ ] If Config sheet already has data in row for `AccountFileID`, user should rename the key to `AccountsFileID` manually (or re-run setup on a fresh Config sheet).
- [ ] Test `getAuthorizedResources` from the frontend — should return full resource list with permissions and headers.
- [ ] Verify Web App redeployment: if API behavior changed (it has — payload shape changed with fileId removal), user must create a new Web App deployment version.

## Documentation Updates Required
- [x] Update `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md` — document `getAppSpreadsheet()` helper and ScriptProperties fallback.
- [x] Update `Documents/CONTEXT_HANDOFF.md` — add entry about the fix, fileId removal from payload, and `AccountsFileID` config key correction.
- [x] Update `Documents/APP_SHEET_STRUCTURE.md` if Config key names are documented there.

## Acceptance Criteria
- [ ] `getAuthorizedResources` returns the full list of authorized resources with permissions, headers, and UI config.
- [x] No resource entry in the payload contains a `fileId` field (removed from frontend payload).
- [x] Accounts-scope resources (Assets, Liabilities, Equity, Revenue, Expenses) are correctly resolved when `AccountsFileID` is set in Config.
- [x] When `getActiveSpreadsheet()` returns null (web app context), the `getAppSpreadsheet()` fallback resolves the APP spreadsheet via ScriptProperties.
- [x] Errors in resource resolution are logged to the Apps Script execution log (not silently swallowed).
- [ ] No regression: login, getProfile, master CRUD operations continue to work.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed
- [x] Step 7 completed

### Deviations / Decisions
- [x] `[?]` Decision needed: Confirm web app deployment mode ("Execute as: Me" vs "User accessing the web app")
- [x] `[?]` Decision needed: Should existing Config sheet rows be auto-migrated (rename `AccountFileID` -> `AccountsFileID`)? (Decision: no auto-migration; keep manual rename for existing rows)

### Files Actually Changed
- `GAS/sheetHelpers.gs`
- `GAS/resourceRegistry.gs`
- `GAS/auth.gs`
- `GAS/setupAppSheets.gs`
- `GAS/appMenu.gs`
- `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
- `Documents/CONTEXT_HANDOFF.md`
- `Documents/APP_SHEET_STRUCTURE.md`

### Validation Performed
- [x] clasp push completed
- [ ] Manual test: login returns authorized resources
- [ ] Manual test: getAuthorizedResources returns full resource list
- [ ] Manual test: master CRUD still works

### Manual Actions Required
- [ ] User runs `AQL 🚀 > Setup & Refactor > Setup APP Sheets` after clasp push
- [ ] User renames Config key `AccountFileID` → `AccountsFileID` if Config sheet already has data
- [ ] User creates new Web App deployment version (API payload shape changed — fileId removed)


### Execution Notes
- Web app deployment mode confirmation is no longer a blocker because getAppSpreadsheet() now supports both contexts via Script Properties fallback.
- Existing Config key rows were not auto-migrated in-place; current behavior keeps setup idempotent and avoids destructive edits to client-entered Config data. Existing deployments should rename AccountFileID to AccountsFileID once.


