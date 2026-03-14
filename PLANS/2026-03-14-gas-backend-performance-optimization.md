# PLAN: Optimize GAS Backend Master Sync Performance

**Status**: COMPLETED
**Created**: 2026-03-14
**Created By**: Brain Agent
**Executed By**: Execution Agent

## Objective
Drastically reduce the time taken to fetch master data (Sync All Master Resources) from ~2 minutes to under 10 seconds. This will be achieved by implementing request-level memory caching for Spreadsheet files, Sheet objects, and User/AccessRegion contexts, while eliminating redundant service calls.

## Context
- Current `getMulti` requests for master data open the same Spreadsheet files multiple times (e.g., MASTERS file).
- `SpreadsheetApp.openById()` is expensive (1-3s per call).
- Row-level permission checks (`canAccessRowByPolicy`) potentially trigger full sheet reads for `Users` and `Designations` for every single master record being synced.
- Redundant header fetching happens after the data has already been loaded into memory.

## Pre-Conditions
- [x] Backend code is stable and functional.
- [x] `Documents/AI_COLLABORATION_PROTOCOL.md` was reviewed.

## Steps

### Step 1: Implement File and Sheet Caching in `resourceRegistry.gs`
- Introduce global memory variables `_resource_file_cache` and `_resource_sheet_cache` at the top of the file.
- Modify `openResourceSheet(resourceName)` to check this cache before calling `SpreadsheetApp.openById()` and `file.getSheetByName()`.
- **Files**: `GAS/resourceRegistry.gs`
- **Pattern**: Singleton/Request-level cache.

### Step 2: Optimize User and Designation Contexts in `auth.gs`
- Introduce `_users_context_cache` and `_designations_cache` global variables.
- Optimize `getUsersContext()` to return cached context if available.
- Optimize `getUserById(userId)` and `getDesignationById(id)` to use memory maps instead of searching the sheet repeatedly.
- Pre-load `Users` and `Designations` into memory maps on the first call within an execution.
- **Files**: `GAS/auth.gs`, `GAS/masterApi.gs`
- **Rule**: Single sheet read per execution for administrative tables.

### Step 3: Eliminate Redundant Header Fetching in `masterApi.gs`
- Modify `handleMasterGetRecords` to extract headers from the already loaded `values[0]`.
- Update `buildMasterRowsResponse` to accept `headers` as an argument instead of calling `getSheetHeaders(resource.sheet)`.
- **Files**: `GAS/masterApi.gs`

### Step 4: Optimize Row-Level Permission Performance
- Ensure `canAccessRowByPolicy` uses the cached memory maps for User and Designation lookups.
- Add "short-circuits" to avoid complex loops if the policy is `ALL` and no region check is required.
- **Files**: `GAS/masterApi.gs`

## Documentation Updates Required
- [x] Update `Documents/TECHNICAL_SPECIFICATIONS.md` to document the GAS backend caching strategy.
- [x] Update `Documents/CONTEXT_HANDOFF.md` with the new performance benchmarks and architecture notes.

## Acceptance Criteria
- [!] `getMulti` request for multiple master resources (e.g., 5-7 resources) completes in < 15 seconds (ideally < 10s). (Pending live benchmark in deployed GAS environment)
- [x] No regression in row-level security or access region enforcement. (Code-path review completed for policy + region checks)
- [x] All master CRUD operations remain functional. (Create/Update/Get flows preserved in code)

## Post-Execution Notes (Execution Agent fills this)
- [x] Step 1 complete: Added request-level caches in `GAS/resourceRegistry.gs` (`_resource_file_cache`, `_resource_sheet_cache`) and applied cache-first lookup in `openResourceSheet`.
- [x] Step 2 complete: Added request-level user/designation caches in `GAS/auth.gs` (`_users_context_cache`, `_designations_cache`) with map-based lookups for `Users` and `Designations`.
- [x] Step 3 complete: Removed redundant header fetch path in `GAS/masterApi.gs` by passing already-loaded headers to `buildMasterRowsResponse`.
- [x] Step 4 complete: Optimized record policy path in `GAS/masterApi.gs` via early short-circuit when `RecordAccessPolicy=ALL` and no access-region check is required; `getUserById` now uses cached user map.
- [!] Runtime benchmark is not executable from local repo; live `getMulti` timing must be measured after copying updated GAS files to APP script and redeploying.
