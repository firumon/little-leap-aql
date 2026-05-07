# PLAN: GAS Record Action and Batch Reference Framework
**Status**: COMPLETED
**Created**: 2026-05-07
**Created By**: Brain Agent (Kilo Code)
**Executed By**: Build Agent (Kilo Code)

## Objective
Implement one standard backend transport pattern for batch workflows: a multi-resource, multi-code `record` action and an automatic resource-name batch context with explicit `$ref` value resolution. The goal is to support complex workflows in one HTTP round trip without frontend-provided refs, without legacy `__PENDING__`, and without special frontend response handling.

## Context
- Current batch execution is in [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:457).
- Current batch dependency behavior uses a single `pendingReferenceCode` and `__PENDING__` replacement in [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:465) and [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:506).
- Frontend has legacy response-side `__PENDING__` patching in [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js:170).
- Current `get` behavior is resource/delta/list oriented in [GAS/resourceApi.gs](../GAS/resourceApi.gs:7), so `record` must be a separate record-level action.
- Canonical response shaping happens through [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:234).
- Write responses already return resource payloads through [GAS/resourceApi.gs](../GAS/resourceApi.gs:975) and [GAS/resourceApi.gs](../GAS/resourceApi.gs:990).
- Frontend ingestion must remain generic through the canonical `data.resources` response shape, not request-specific handling.

## Approved Standard

### Record action request shape
Use only one shape. No single-resource shortcut and no single-code shortcut.

```json
{
  "action": "record",
  "payload": {
    "resources": [
      { "resource": "Procurements", "codes": ["PR2600001", "PR2600002"] },
      { "resource": "GoodsReceipts", "codes": ["GRN2600001"] }
    ],
    "allowMissing": false
  }
}
```

Rules:
- `payload.resources` is required.
- Each entry requires `resource` and `codes`.
- `codes` must be an array, even for one code.
- `allowMissing` defaults to false.
- `record` must enforce normal read permission and record-level access.
- `record` must return canonical resource payloads under `data.resources` so IndexedDB and Pinia update through existing generic flow.

### Batch reference standard
Frontend does not send `ref` names. GAS automatically stores every successful action output by resource name.

Supported explicit references:

```json
{ "$ref": "OutletConsumptions.latest.code" }
{ "$ref": "OutletConsumptions.latest.record.Code" }
{ "$ref": "Procurements.byCode.PR2600001.Code" }
{ "$ref": "Procurements.records.0.Code" }
```

Rules:
- `$ref` must be explicit in payload values.
- GAS must not infer missing fields automatically.
- `latest` means the latest successful output for that resource in the current batch.
- `byCode` provides exact deterministic access for loaded or written records.
- `records` preserves ordered record objects from the latest output for that resource.
- Remove `__PENDING__` completely from GAS and frontend.

## Pre-Conditions
- [x] Required source docs were reviewed: [Documents/AI_COLLABORATION_PROTOCOL.md](../Documents/AI_COLLABORATION_PROTOCOL.md), [Documents/GAS_API_CAPABILITIES.md](../Documents/GAS_API_CAPABILITIES.md), [Documents/GAS_PATTERNS.md](../Documents/GAS_PATTERNS.md), [Documents/ARCHITECTURE RULES.md](../Documents/ARCHITECTURE%20RULES.md).
- [x] Build Agent understands this is an API contract change requiring GAS push and likely Web App redeployment.
- [x] Build Agent confirms there is no client deployment needing legacy `__PENDING__` compatibility per plan rule "No backwards compatibility required for `__PENDING__`."

## Steps

### Step 1: Implement generic record-level fetch handler
- [ ] Add a new handler in [GAS/resourceApi.gs](../GAS/resourceApi.gs) named `handleResourceRecordFetch` or equivalent.
- [ ] Accept only `payload.resources[]` with `{ resource, codes[] }` entries.
- [ ] For each resource, open the resource sheet, load headers, enforce `canRead`, and locate rows by `Code`.
- [ ] Enforce record-level access for each matched row using existing access enforcement patterns.
- [ ] Convert matched row arrays into record objects for `result` use.
- [ ] Return per-resource data containing `codes`, `records`, `byCode`, and canonical resource row payload.
- [ ] If `allowMissing` is false and any requested code is missing or inaccessible, return `success: false` with clear resource/code details.
- [ ] If `allowMissing` is true, return found records and include missing codes in result metadata.
**Files**: [GAS/resourceApi.gs](../GAS/resourceApi.gs)
**Pattern**: Existing resource read and write-delta helpers in [GAS/resourceApi.gs](../GAS/resourceApi.gs:7), [GAS/resourceApi.gs](../GAS/resourceApi.gs:975), and [GAS/resourceApi.gs](../GAS/resourceApi.gs:1025)
**Rule**: `record` is record-level fetch, not delta sync and not a list read.

### Step 2: Add record action to dispatcher
- [ ] Add `case 'record'` to [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:383).
- [ ] Ensure canonical request normalization passes `payload.resources[]` unchanged.
- [ ] Ensure `record` action is not treated as generic CRUD `get`.
**Files**: [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs)
**Pattern**: Existing `compositeSave` and `executeAction` dispatch in [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:411)
**Rule**: `record` is a protected action and must require auth.

### Step 3: Make record canonical response hydrate frontend state
- [ ] Update canonical response normalization in [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:234) if needed so `record` result resource payloads are merged into `data.resources`.
- [ ] Ensure `record` response `data.result` contains record objects and lookup maps, while `data.resources` contains normal row arrays.
- [ ] Confirm frontend generic ingestion in [FRONTENT/src/services/GasApiService.js](../FRONTENT/src/services/GasApiService.js) and [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js:176) needs no special request-dependent handling.
**Files**: [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs), [FRONTENT/src/services/GasApiService.js](../FRONTENT/src/services/GasApiService.js), [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js)
**Pattern**: Canonical envelope contract in [Documents/GAS_API_CAPABILITIES.md](../Documents/GAS_API_CAPABILITIES.md:33)
**Rule**: Every resource returned by `record` must update IDB and Pinia through the normal `data.resources` path.

### Step 4: Replace batch dependency system
- [ ] Remove `pendingReferenceCode`, `extractBatchResultCode`, `replacePendingReferencesInBatchRequest`, and `replacePendingReferencesDeep` legacy behavior from [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:457).
- [ ] Implement a batch context object that is created at the start of `handleBatchActions`.
- [ ] Before dispatching each subrequest, recursively resolve `{ "$ref": "ResourceName.path" }` objects against the current batch context.
- [ ] After each successful subrequest, inspect canonical resource payloads and scalar result data to update context by resource name.
- [ ] Store context entries as `latest`, `records`, `byCode`, and `latest.code` when a code is available.
- [ ] Fail the current subrequest with a clear error if a `$ref` path cannot be resolved.
- [ ] Preserve sequential execution and existing batch success aggregation.
**Files**: [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs)
**Pattern**: Existing sequential batch loop in [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:467)
**Rule**: Explicit `$ref` only; no automatic missing-field inference.

### Step 5: Remove frontend legacy pending reference patching
- [ ] Remove response-side `__PENDING__` patching from [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js:161).
- [ ] Keep generic resource ingestion and row merging in [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js:176).
- [ ] Search the repo for `__PENDING__` and remove remaining references.
**Files**: [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js), [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs)
**Pattern**: Search results currently show only [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js:170) and [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs:517)
**Rule**: No backwards compatibility required for `__PENDING__`.

### Step 6: Add frontend request helper conventions if needed
- [ ] If outlet or other composables need helper builders, add generic batch `$ref` helper functions in an appropriate composable/helper file.
- [ ] Keep services generic and do not place business logic in services.
- [ ] Keep components free of store/service calls.
**Files**: [FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js](../FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js), [FRONTENT/src/utils/appHelpers.js](../FRONTENT/src/utils/appHelpers.js)
**Pattern**: Current request builders in [FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js](../FRONTENT/src/composables/operations/outlets/outletOperationsBatch.js:4)
**Rule**: Business-specific payload construction belongs in composables.

## Documentation Updates Required
- [ ] Update [Documents/GAS_API_CAPABILITIES.md](../Documents/GAS_API_CAPABILITIES.md) with the `record` action, one accepted request shape, response shape, automatic batch resource context, `$ref` syntax, and examples.
- [ ] Update [Documents/GAS_PATTERNS.md](../Documents/GAS_PATTERNS.md) with the new standard batch dependency pattern and anti-patterns.
- [ ] Update [Documents/ARCHITECTURE RULES.md](../Documents/ARCHITECTURE%20RULES.md) API transport section to state that `record` responses hydrate through canonical `data.resources`, and that frontend must not special-case request actions for state updates.
- [ ] Update [Documents/AI_COLLABORATION_PROTOCOL.md](../Documents/AI_COLLABORATION_PROTOCOL.md) only if the Build Agent determines the API-contract documentation rule needs stronger wording.

## Acceptance Criteria
- [x] `action: record` accepts only `payload.resources[]` with `codes[]` arrays.
- [x] `record` returns requested rows in canonical `data.resources` and scalar lookup data in `data.result`.
- [x] Batch actions can reference previous results using `{ "$ref": "ResourceName.latest.code" }` and `{ "$ref": "ResourceName.byCode.CODE.Field" }`.
- [x] GAS automatically creates batch context entries after every successful subrequest without frontend `ref` names.
- [x] `__PENDING__` no longer exists in GAS or frontend production files.
- [x] Existing generic resource ingestion updates IDB and Pinia for `record` results.
- [x] Documentation clearly explains the standard with examples and no alternate request shapes.
- [x] GAS is pushed with `npm run gas:push` or equivalent after implementation.
- [x] User is told Web App redeployment is required because the API contract changed.

## Verification Guidance
- [ ] Use a targeted `record` API call for one resource with one code inside `payload.resources[]`.
- [ ] Use a targeted `record` API call for two resources with multiple codes.
- [ ] Use a batch where a later action references `ResourceName.latest.code` from a previous create/composite action.
- [ ] Use a batch where a later action references `ResourceName.byCode.CODE.Field` from a prior `record` action.
- [x] Confirm frontend IDB/Pinia receives returned record rows without special-case code by verifying `FRONTENT/src/services/GasApiService.js` generic `data.resources` ingestion and `FRONTENT/src/stores/workflow.js` generic resource merge path remain request-action independent.
- [x] Search for `__PENDING__` and confirm no production GAS/frontend results remain.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] 2026-05-07T12:20:31Z — Build Agent startup completed: read `AGENTS.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/DOC_ROUTING.md`, and assigned plan only.
- [x] 2026-05-07T12:20:42Z — Required implementation docs reviewed: `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`, and `Documents/ARCHITECTURE RULES.md`.
- [x] 2026-05-07T12:20:55Z — Plan marked `IN_PROGRESS`, executor set to Build Agent (Kilo Code), and preconditions checked.
- [x] 2026-05-07T12:21:13Z — Inspected `GAS/apiDispatcher.gs`, `GAS/resourceApi.gs`, `FRONTENT/src/stores/workflow.js`, and `FRONTENT/src/services/GasApiService.js` for existing canonical envelope, row access, write delta, batch, and legacy pending behavior.
- [x] 2026-05-07T12:21:59Z — Implemented initial `handleResourceRecordFetch`, added protected `record` dispatch, added nested-payload handling, and replaced legacy batch pending code with explicit `$ref` context functions.
- [x] 2026-05-07T12:22:31Z — Removed frontend response-side `__PENDING__` mutation from `FRONTENT/src/stores/workflow.js` while preserving generic resource ingestion and Pinia merge flow.
- [x] 2026-05-07T12:22:37Z — Searched repository for `__PENDING__`; production GAS/frontend references are removed, with remaining mentions only in plan/history documentation.
- [x] 2026-05-07T12:23:34Z — Updated `Documents/GAS_API_CAPABILITIES.md`, `Documents/GAS_PATTERNS.md`, and `Documents/ARCHITECTURE RULES.md` for `record`, automatic batch resource context, explicit `$ref`, and generic frontend hydration rules.
- [x] 2026-05-07T12:23:52Z — Targeted syntax checks passed for `FRONTENT/src/stores/workflow.js`, `GAS/apiDispatcher.gs`, and `GAS/resourceApi.gs`.
- [x] 2026-05-07T12:24:10Z — Ran `npm run gas:push`; clasp pushed 26 GAS files successfully.
- [x] 2026-05-07T12:24:13Z — Final `__PENDING__` search found no production GAS/frontend references; remaining mentions are in plans/history and new docs that declare the placeholder unsupported.
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- [GAS/resourceApi.gs](../GAS/resourceApi.gs)
- [GAS/apiDispatcher.gs](../GAS/apiDispatcher.gs)
- [FRONTENT/src/stores/workflow.js](../FRONTENT/src/stores/workflow.js)
- [Documents/GAS_API_CAPABILITIES.md](../Documents/GAS_API_CAPABILITIES.md)
- [Documents/GAS_PATTERNS.md](../Documents/GAS_PATTERNS.md)
- [Documents/ARCHITECTURE RULES.md](../Documents/ARCHITECTURE%20RULES.md)

### Validation Performed
- [ ] Targeted live GAS API validation completed
- [x] Static GAS syntax validation completed for `GAS/apiDispatcher.gs` and `GAS/resourceApi.gs` using Node parse check.
- [x] Frontend state hydration validation completed by code inspection of generic canonical `data.resources` ingestion and workflow-store row merging.
- [x] Frontend syntax validation completed for `FRONTENT/src/stores/workflow.js` using `node --check`.
- [x] Documentation reviewed for clarity

### Manual Actions Required
- [x] Web App redeployment after GAS push because the API contract changes.
