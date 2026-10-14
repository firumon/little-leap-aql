# Feature Archive System Specification

This document explains the AQL Archive System.
It shows how old data is moved to archive files to keep the main app fast and clean.

---

## 1. Overview

As time passes, business records grow very big.
Big sheets make the app slow.
The Archive System solves this problem.
It finds old records that meet clear rules.
It moves them into separate archive spreadsheets in Google Drive.
Then it removes them from the main active sheets and local storage.

```
+-------------------------------------------------------------+
|                      Frontend Client                        |
|                                                             |
|  1. Idle Polling Ladder (Tier changes or Tier 5 counter)   |
|  2. Archive Evaluator checks memory records via useRecord  |
|  3. Sends archive API request with background: true         |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|               Backend Google Apps Script (GAS)              |
|                                                             |
|  1. Finds or creates period folder: ARCHIVE/<Year>_<Period> |
|  2. Finds or creates archive spreadsheet                    |
|  3. Gathers parent and child rows                           |
|  4. Copies rows into archive sheets                         |
|  5. Deletes rows from main sheets (bottom to top)           |
|  6. Updates sync cursors for parent and child resources     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      Frontend Eviction                      |
|                                                             |
|  1. Removes archived codes from IndexedDB                   |
|  2. Removes archived codes from Pinia dataStore             |
|  3. Screen updates right away                               |
+-------------------------------------------------------------+
```

---

## 2. Configuration: `APP.Resources.Archive`

Every resource in `APP.Resources` can have an `Archive` setting.
The `Archive` column stores a JSON policy object.

### A. JSON Policy Structure

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

### B. Configuration Fields

| Field Name | Type | Default | Meaning |
| :--- | :--- | :--- | :--- |
| `frequency` | String or Number | `MONTHLY` (1) | How often new archive folders and files are created (`MONTHLY`, `QUARTERLY`, `ANNUAL`, or numbers 1 to 12). |
| `filename` | String | `ARCHIVE_{{YEAR}}_{{FREQ}}` | File name pattern for the archive spreadsheet. |
| `limit` | Number | `30` | Max number of records to archive in one run. Falls back to `APP.Config.archiveBatchLimit` if not set. |
| `condition` | Object | `{}` | The rule that a record must pass to be archived. |

---

## 3. When Does Archive Run? (Trigger System)

Archive runs quietly in the background on the frontend when the user is idle.
It never stops the user while they work.

### A. Polling Ladder Triggers

AQL uses an escalation ladder for polling:
- Tier 0: 30 seconds interval (active user).
- Tier 1: 60 seconds interval.
- Tier 2: 120 seconds interval.
- Tier 3: 240 seconds interval.
- Tier 4: 480 seconds interval.
- Tier 5: 960 seconds interval (idle floor).

Archive check runs at these exact moments:
1. **Tier switches**: Whenever polling escalates from one tier to the next (`0 -> 1`, `1 -> 2`, `2 -> 3`, `3 -> 4`, `4 -> 5`).
2. **Tier 5 repeat check**: While staying at Tier 5, every 5 polling cycles (`requestCountInTier % 5 === 0`).

### B. Polling Ladder Protection

- The archive API request passes `{ background: true }`.
- When `background: true` is set, `pollingStore.noteRequestSettled({ background: true })` does NOT reset the ladder to Tier 0.
- The idle tier is preserved.
- The user session stays quiet and saves server quota.

---

## 4. How Frontend Evaluates Conditions

The archive check uses `src/utils/archiveEvaluator.js`.

### A. Decoupled from Relation Internals

- The archive evaluator does NOT read `APP.Resources.Relations` directly.
- It only uses `useRecord(resource).enrich(resource, code)`.
- `useRecord` provides an enriched proxy object.
- If a condition names a relation (for example `"OrderItems"`), the evaluator reads `record.$orderitems`.

### B. Relation Evaluation Rules

1. **Child Relations (Lists)**:
   - When the relation is a child list, every item must pass the child condition.
   - **Empty List Rule**: If there are 0 child items, the test passes (`[].every(...) === true`).
2. **Parent or Link Relations (Single Objects)**:
   - Evaluates the condition directly on the parent or linked record.
   - If the parent does not exist (`null`), the check fails for non-empty tests.

### C. Dynamic Date Tokens

Conditions support all tokens from `src/utils/tokenEvaluator.js`:
- `$daysAgo:90` (records older than 90 days)
- `$today`
- `$now`
- `$startOfMonth`, `$endOfMonth`

---

## 5. Backend GAS Archive Engine

When the frontend finds matching codes, it calls GAS action `'archive'`.
The engine lives in `GAS/archiveEngine.gs`.

### A. Period Folder

GAS finds or creates the period folder in Google Drive:
- Folder path: `ARCHIVE/<Year>_<Period>`
- Example: `ARCHIVE/2026_0103` (for quarter 1).

### B. Archive Spreadsheet & Tabs

- GAS looks up or creates the archive spreadsheet file inside that folder.
- If the sheet tab does not exist, GAS creates it with the main sheet headers.
- If the sheet tab exists but headers do not match (schema change), GAS creates `<SheetName>_1`, `<SheetName>_2`, etc.

### C. Child Row Collection

- GAS checks all resources whose `ParentResource` equals the target resource.
- It finds all child rows whose parent code matches the archived parent codes.
- It copies child rows and parent rows to the archive tabs.

### D. Safe Row Deletion

- GAS sorts row indices in **descending order** (bottom to top).
- It deletes child rows first.
- Then it deletes parent rows.
- Deleting bottom to top prevents row index shift errors.

### E. Sync Cursor Update

- GAS calls `updateResourceSyncCursor(resourceName)` for the parent resource.
- GAS calls `updateResourceSyncCursor(childName)` for each affected child resource.
- This bumps `LastDataUpdatedAt` so other connected devices know rows changed.

---

## 6. Frontend Eviction & Cleanup

When GAS returns `{ success: true, archived: { [Resource]: [codes] } }`:
1. **IndexedDB Cleanup**:
   - `ArchiveService.js` calls `deleteResourceRowsByCodes(resourceName, codes)`.
   - The archived rows are removed from local browser database.
2. **Pinia Store Cleanup**:
   - `useArchiveStore()` calls `dataStore.removeRows(resourceName, codes)`.
   - The rows are removed from in-memory Maps.
   - Projections bump automatically.
   - Detail pages and list views update instantly.

---

## 7. Rules for Changes to Depended Systems

If you change any related system in the future, you must follow these rules:

1. **Polling Ladder Changes**:
   - If `POLLING_CONFIG` or `escalateTier()` in `FRONTENT/src/stores/polling.js` is modified, you must keep the archive trigger points.
2. **Resource Setup & Sync Changes**:
   - In `GAS/setupAppSheets.gs`, the `'Archive'` header must remain in `CONFIG.SHEETS.RESOURCES`.
   - In `GAS/syncAppResources.gs`, the `'Archive'` column must stay in `protectedColumns` so sync scripts never wipe user archive settings.
3. **useRecord or Token Changes**:
   - Any updates to `FRONTENT/src/composables/resources/useRecord.js` must preserve `$relation` accessor support.
   - Any updates to `FRONTENT/src/utils/tokenEvaluator.js` must maintain compatibility with `prepareCondition` and `evaluatePreparedFilter`.
