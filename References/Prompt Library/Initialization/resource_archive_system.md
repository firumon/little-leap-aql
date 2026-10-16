# AQL Resource Archive System

> **Scope boundary**: This document covers the AQL Resource Archive System only. This includes archive JSON policies in `APP.Resources.Archive`, idle polling trigger points, the frontend archive evaluator and store, backend GAS archive copying and bottom-up deletion, and local eviction from IndexedDB and Pinia dataStore.

Use this document to initialize an AI agent session when the task involves inspecting, creating, modifying, or debugging any part of the Resource Archive System.

---

## 1. System Architecture & Coordination

The Archive System automatically moves old business records into archive Google Spreadsheets in Google Drive.
It removes archived records from active sheets and client cache to keep the app fast.

### Core File Coordinates

* **Canonical Specification**: [FEATURE_ARCHIVE_SYSTEM.md](file:///f:/AQL/Documents/FEATURE_ARCHIVE_SYSTEM.md)
* **Frontend Archive Store**: [archive.js](file:///f:/AQL/FRONTENT/src/stores/archive.js)
* **Frontend Archive Evaluator**: [archiveEvaluator.js](file:///f:/AQL/FRONTENT/src/utils/archiveEvaluator.js)
* **Frontend Archive Service**: [ArchiveService.js](file:///f:/AQL/FRONTENT/src/services/ArchiveService.js)
* **Frontend Polling Integration**: [polling.js](file:///f:/AQL/FRONTENT/src/stores/polling.js)
* **IndexedDB Eviction Helper**: [IndexedDbService.js](file:///f:/AQL/FRONTENT/src/services/IndexedDbService.js) (`deleteResourceRowsByCodes`)
* **Pinia Eviction Helper**: [state.js](file:///f:/AQL/FRONTENT/src/stores/data/state.js) (`removeRows`)
* **Backend GAS Engine**: [archiveEngine.gs](file:///f:/AQL/GAS/archiveEngine.gs)
* **Backend API Dispatcher**: [apiDispatcher.gs](file:///f:/AQL/GAS/apiDispatcher.gs)
* **Backend Registry & Sync**: [resourceRegistry.gs](file:///f:/AQL/GAS/resourceRegistry.gs), [syncAppResources.gs](file:///f:/AQL/GAS/syncAppResources.gs), [setupAppSheets.gs](file:///f:/AQL/GAS/setupAppSheets.gs)

---

## 2. Mandatory Pre-Reads

Before modifying archive code:
* Canonical Specification: [FEATURE_ARCHIVE_SYSTEM.md](file:///f:/AQL/Documents/FEATURE_ARCHIVE_SYSTEM.md)
* Architecture Rules: [CORE_ARCHITECTURE_RULES.md](file:///f:/AQL/Documents/CORE_ARCHITECTURE_RULES.md)

---

## 3. Archive Configuration Schema

The `Archive` column in `APP.Resources` holds a JSON object:

```json
{
  "frequency": "MONTHLY",
  "filename": "ARCHIVE_{{YEAR}}_{{FREQ}}",
  "limit": 30,
  "condition": {
    "logic": "AND",
    "items": [
      { "column": "Status", "operator": "eq", "value": "Completed" },
      { "column": "CreatedAt", "operator": "lte", "value": "$daysAgo:90" },
      {
        "relation": "OrderItems",
        "condition": { "column": "Status", "operator": "eq", "value": "Delivered" }
      }
    ]
  }
}
```

---

## 4. Key Implementation Rules

1. **Idle Trigger Protection**:
   - Archive requests MUST pass `{ background: true }`.
   - Polling store must NOT reset the escalation tier when an archive request settles.
2. **Decoupled Relation Access**:
   - The archive evaluator reads relations ONLY via `useRecord(resource).enrich(resource, code)`.
   - Never read `APP.Resources.Relations` directly in the archive evaluator.
   - If relation returns a child list, `[].every(...) === true` (0 child rows passes).
3. **Bottom-Up Deletion**:
   - In GAS, rows MUST be sorted in descending order before deleting (`b.rowIndex - a.rowIndex`).
   - Child rows MUST be deleted before parent rows.
4. **Complete Local Eviction**:
   - When archive succeeds, delete records from IndexedDB (`deleteResourceRowsByCodes`).
   - Delete records from Pinia store (`dataStore.removeRows`).
5. **Sync Cursor Update**:
   - GAS must call `updateResourceSyncCursor()` for parent and all affected child resources.

---

## 5. Coordination with Depended Systems

When updating related features, always check these rules:
- **Polling Ladder Updates**: Any changes to `polling.js` or `POLLING_CONFIG` must preserve the archive trigger on tier transitions (`0->1`, `1->2`, etc.) and the Tier 5 periodic check.
- **Resource Setup Updates**: `setupAppSheets.gs` and `syncAppResources.gs` must keep the `Archive` column protected.
- **Token System Updates**: Any token added to `tokenEvaluator.js` is automatically available to archive conditions.
