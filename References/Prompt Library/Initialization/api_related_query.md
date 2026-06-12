# Initialization: API Related Queries & Custom Integrations

Use this document to initialize an AI agent session when the user asks an investigatory, architectural, or implementation question about the AQL API framework. This includes backend request routing in GAS, request/response envelopes, batching requests, composite saves, workflow action execution, and backend post-write hooks.

---

## 1. Scope Detection

Determine which aspects of the API are involved:
- **API Request/Response Envelope**: Enforcing canonical request/response shapes, validation of strict nested payloads.
- **Generic CRUD & Batch Operations**: GET/CREATE/UPDATE/BULK actions, using the batch endpoint to chain actions, or record-level fetches.
- **Workflow Actions (`executeAction`)**: Transitions in state with auto-filled metadata.
- **Atomic Composite Saves (`compositeSave`)**: Parent-child multi-resource writes.
- **Post-Write Hooks (`PostAction`)**: Triggering secondary, non-blocking side effects after specific write actions.
- **Frontend Sync & Ingestion**: Local IndexedDB and Pinia store updates triggered by incoming `data.resources` payloads.

---

## 2. Mandatory Pre-Reads (With Line-Level Links)

Read only the files relevant to the query or task at hand:
- **Backend API dispatcher & routing**: [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs#L10-L49)
- **Protected Action Router**: [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs#L393-L443)
- **Batch Action Handler**: [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs#L471-L500)
- **Generic CRUD handlers**: [resourceApi.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L7-L82)
- **Record Fetch handler**: [resourceApi.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L84-L125)
- **Composite Save handler**: [resourceApi.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L1296-L1320)
- **Post-Write Hook dispatcher**: [resourceApi.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L301-L323)
- **Frontend services & HTTP configuration**:
  - Environment Variables: [.env](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/.env) (defines `VITE_GAS_URL`)
  - Config Loader: [api.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/config/api.js) (exports `GAS_URL`)
  - Core API HTTP Client: [ApiClientService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ApiClientService.js)
  - Quasar Axios Bootstrapper: [axios.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/boot/axios.js) (attaches `$api` instance)
  - GAS API Service: [GasApiService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/GasApiService.js#L205-L257)
  - Resource Input/Output & Sync Service: [ResourceIoService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/ResourceIoService.js#L209-L300)
  - IndexedDB Persistence: [IndexedDbService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/IndexedDbService.js)
  - IndexedDB Cache Layer: [IndexedDbCacheService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/IndexedDbCacheService.js)
- **Frontend Pinia Stores (`FRONTENT/src/stores`)**:
  - Generic Data Store: [data.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/data.js) (owns memory caching and synchronization events)
  - Resource Status Store: [resourceStatus.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/resourceStatus.js) (tracks loading, syncing, error, and hydration states)
- **GAS API Capabilities Guide**: [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md)
- **GAS Backend Patterns Guide**: [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md)

---

## 3. Data Flow & Schema Matrix

### A. Canonical Request Envelope
```json
{
  "requestId": "uuid",
  "action": "get" | "create" | "update" | "bulk" | "record" | "compositeSave" | "executeAction" | "batch",
  "resource": "ResourceName" | ["Resource1", "Resource2"],
  "token": "auth-token",
  "payload": {}
}
```
- **Strict Payload Nesting**: For write actions (`create`, `update`, `bulk`, `record`, `compositeSave`, `executeAction`), fields must reside under nested keys (e.g. `payload.record`, `payload.data`, or `payload.records`). Direct top-level payload properties will be rejected by `validateStrictNestedPayload` in [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs#L148-L169).

### B. Canonical Response Envelope
```json
{
  "success": true | false,
  "requestId": "uuid",
  "action": "actionName",
  "error": "error message or null",
  "message": "success or warning message",
  "data": {
    "resources": {
      "ResourceName": {
        "rows": [[]],
        "meta": { "resource": "ResourceName", "lastSyncAt": 1713400000999 }
      }
    },
    "result": {},
    "artifacts": {}
  },
  "meta": { "serverTime": 1713400000999, "version": "v1" }
}
```
- All standard API writes return delta resource snapshots under `data.resources` which are ingested automatically on the frontend to keep IndexedDB and Pinia stores in sync.

### C. Sequential Batch API Actions
- Enables chaining multiple CRUD or custom actions in a single HTTP request.
- Sub-responses are accumulated sequentially. Later sub-requests can access generated codes from previous ones via `$ref` objects (e.g., `{ "$ref": "PurchaseRequisitions.latest.code" }`).
- Reference resolution is managed completely by [handleBatchActions](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs#L471-L500) on the backend. No stringification of `$ref` is allowed on the frontend.

### D. PostAction Side-Effect Hooks
- Mapped in `APP.Resources` config via `PostAction` column (managed in `GAS/syncAppResources.gs`).
- Dispatched after `create`, `update`, `bulk`, `executeAction`, and `compositeSave`.
- Resolved dynamically: checks `{postAction}_after{ActionName}` first (e.g. `linkProcurementCodeToPurchaseRequisition_afterCreate`), falling back to base `{postAction}`.
- Triggered safely: hook execution failures are logged but do not block or fail the primary write transaction.

### E. Frontend State & Ingestion Flow
- **Ingestion**: When `executeGasApi` resolves a successful request, it captures the resource delta map in `data.resources` and runs [ingestResourcePayloads](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/GasApiService.js#L128-L190).
- **Persistence**: `ingestResourcePayloads` invokes `upsertResourceRows` in [IndexedDbService.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/services/IndexedDbService.js), writing new/modified records directly to IndexedDB.
- **Pinia Hydration**: `IndexedDbCacheService.js` publishes row upsert events. The Pinia data store [data.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/data.js#L130-L132) listens to these via `onRowsUpserted` and reactively keeps the in-memory `rows` array in sync.
- **Sync Status**: The resource status store [resourceStatus.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/stores/resourceStatus.js) tracks the synchronization state (`syncing`, `hydrated`, `lastSyncAt`, `lastError`) to drive UI loaders and empty states.

---

## 4. Step-by-Step Implementation & Investigation Checklist

1. **Verify Action Capabilities**: Before writing custom endpoints, check if standard CRUD, `compositeSave`, `executeAction`, or `batch` can handle the requirement.
2. **Examine Resource Registry Config**: View resource properties in `syncAppResources.gs` (e.g. write/read permissions, `PostAction` configuration).
3. **Trace Frontend Request Generation**: Inspect the calling page or composable (e.g., `useCompositeForm.js`) to see how it builds payload structures. Ensure same-batch generated fields use `batchRef` or `textOrRef` from `batchRefs.js`.
4. **Trace Backend Dispatching**: Ensure the action runs through `apiDispatcher.gs` and is authenticated.
5. **Inspect PostAction Hooks**: Locate the hook function in its specific GAS module file (e.g., `procurement.gs`, `stockMovements.gs`). Verify arguments map precisely to `(payload, result, auth, action, meta, resourceName)`.
6. **Ingestion & Store Verification**: Verify that the returned response contains standard `data.resources` which are fed to `ingestResourcePayloads` in `GasApiService.js`.

---

## 5. Explicit Guardrails (DOs and DO NOTs)

- **DO NOT** bypass the generic API dispatcher to create custom `doGet` or `doPost` action branches.
- **DO NOT** stringify, concatenate, or format `$ref` objects on the frontend. They must be sent as raw JSON objects `{ "$ref": "..." }`.
- **DO NOT** make consecutive, separate API requests when transactional ordering or quick readbacks are needed; use the `batch` action instead.
- **DO NOT** hardcode resource-specific business side effects directly inside `resourceApi.gs`; always use `PostAction` hooks inside target modules.
- **DO** verify that the response payload structure matches the canonical envelope so frontend IndexedDB/Pinia state updates trigger seamlessly.

---

## 6. Targeted Verification Plan

### Automated Checks & Builds
- Run `npm run gas:push` from the root or `clasp push` inside the `GAS/` directory to sync backend scripts.
- Run `npm --prefix FRONTENT run build` to ensure the frontend compiles without type or layout errors after API integrations.

### Manual Verification Flow
1. **Network Payload Trace**: Use browser dev tools (Network tab) to inspect the outgoing request payload and incoming JSON envelope. Verify structure matches `requestId`, `action`, `payload`, etc.
2. **Local DB Verification**: Verify IndexedDB contains the correct rows by checking the Application tab (IndexedDB storage) after resource synchronization.
3. **Log Check**: Check execution logs in Google Apps Script editor or Google Cloud Logging to verify post-write hooks (`PostAction`) are resolved and executed without silent failures.

---

## 7. Maintenance Rule

Update this instruction file and related API documentation (such as [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md) and [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md)) when:
- Any new backend API action is introduced or an existing action's payload contract is altered.
- The structure or required properties of the canonical request/response envelopes change.
- New frontend services, Pinia stores, configuration files, or boot files handling API/server communication are introduced, deprecated, or renamed.
- Suffix resolution patterns or trigger behaviors for `PostAction` hooks are modified.
