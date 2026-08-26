# AQL Backend GAS Implementation

> **Scope boundary**: This document covers GAS backend changes only — hooks, API handlers, batch operations, resource config. Its blast-radius steps tell you to SEARCH frontend files and sheet structures — do NOT load frontend_modification.md or database_schema_alteration.md unless the task explicitly requires modifying that code. Read referenced files directly by path.

Use this document to initialize an AI agent session when the task involves creating, modifying, or debugging Google Apps Script (GAS) backend logic — hooks, API handlers, batch operations, or resource configuration.

---

## 1. System Architecture & Coordination

AQL's backend is a Google Apps Script (GAS) project that provides a generic, metadata-driven API. All CRUD operations, workflow transitions, and batch saves are handled through a single dispatcher that routes requests to the generic resource API.

### A. Core File Coordinates
* **API Dispatcher**: [apiDispatcher.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/apiDispatcher.gs) — routes `doPost` requests to action handlers
* **Session Proof & Cryptography**: [sessionProof.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/sessionProof.gs) — verifies dynamic rolling sessionKey proofs, manages unified `AQL_SESSION_...` cache
* **Generic Resource API**: [resourceApi.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs) — handles get, create, update, bulk, compositeSave, executeAction, batch, record
* **Resource Registry**: [resourceRegistry.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs) — resolves resource metadata, permissions, and sheet coordinates
* **Resource Config (Code → Sheet Sync)**: [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs) — defines UIFields, RequiredHeaders, validation rules, PostAction hooks
* **Constants & Options**: [Constants.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/Constants.gs) — app-wide constants and `appOptions`
* **Auth & Login**: [auth.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/auth.gs) — handles `handleLogin`, session state seeding, profile mutations
* **PostAction Hook Files**: Domain-specific hook scripts:
  - [stockMovements.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/stockMovements.gs) — warehouse stock balance updates
  - [procurement.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/procurement.gs) — procurement workflow linking
  - [outletMovements.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/outletMovements.gs) — outlet stock balance updates
* **Sheet Utilities**: [sheetHelpers.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs) — low-level spreadsheet read/write helpers

---

## 2. Mandatory Pre-Reads

Before writing any GAS code:
* API capabilities: [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md)
* Implementation patterns: [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md)
* Resource config semantics: [SCHEMA_RESOURCE_COLUMNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md)

---

## 3. Pattern Selection Guide

Always prefer existing patterns in this priority order:

| Priority | Pattern | When to Use |
|---|---|---|
| 1 | **Pure CRUD via metadata** | Standard create/read/update on a single resource |
| 2 | **PostAction hook** | Non-blocking side-effects after write actions |
| 3 | **Bulk array write** | Multi-record create/update in one call |
| 4 | **Additional actions** (`executeAction`) | Workflow transitions (Approve, Reject, Submit) |
| 5 | **Composite save** (`compositeSave`) | Atomic parent + children write |
| 6 | **Record fetch** (`record`) | Exact multi-resource, multi-code lookup |
| 7 | **Batch envelope** (`batch`) | Multiple sequential actions in one HTTP call |
| 8 | **Propose new pattern** | Only if none of the above fit |

### PostAction Hook Contract
Hook function signature:
```js
function myPostAction(payload, result, auth, action, meta, resourceName) {
  if (!result || result.success !== true) return result;
  // Side-effect logic here
  return result;
}
```
Rules:
- Keep hooks in dedicated domain files (e.g., `stockMovements.gs`)
- Config stores only the base name; dispatch suffixing (`_afterCreate`, `_afterBulk`, etc.) is resolved by GAS
- Hook failures are logged but never fail the write response

---

## 4. Step-by-Step Implementation Checklist

### Step 1: Discovery & Blast Radius
1. **Check existing capabilities**: Verify in [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md) whether a generic pattern already supports the requirement.
2. **Search existing hooks**: Use `grep_search` in `GAS/` to find if a PostAction hook already exists for the target resource.
3. **Identify dependencies**: Search for frontend composables, pages, or stores that call the backend action being modified.

### Step 2: Implementation
1. **Prefer extending existing files**: Add new functions to existing hook files rather than creating new `.gs` files.
2. **Follow hook naming conventions**: `handleResourceName` for base hooks, `handleResourceName_afterCreate` for action-specific hooks.
3. **Update resource config**: If adding a PostAction, set it in `initAppResourcesCodeConfig()` within [syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs).
4. **Use sheet helpers**: Use `updateResourceRecordFieldsByCode()`, `getSheetDataAsObjects()` from [sheetHelpers.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/sheetHelpers.gs) rather than raw SpreadsheetApp calls.

### Step 3: Documentation
1. Update [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md) if a new pattern was introduced.
2. Update [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md) if a new capability was added.
3. **Multi-Tenant Wrapper Sync**: If changes involve spreadsheet triggers, custom menu callbacks, or HTML dialog callbacks, update the forwarding functions in [tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs).

---

## 5. Explicit Guardrails (DOs and DO NOTs)

- **DO NOT** hardcode resource names, scope names, or sheet names in `resourceApi.gs`. Use PostAction hooks or config.
- **DO NOT** create a new `.gs` file unless the current structure cannot support the task.
- **DO NOT** use two separate HTTP calls (write then read) when `batch` can combine them.
- **DO NOT** add custom action shapes when existing `bulk`, `compositeSave`, or `executeAction` patterns fit.
- **DO** use the generic resource API for all CRUD operations.
- **DO** keep hook functions in domain-specific files (e.g., `stockMovements.gs`, `procurement.gs`).
- **DO** verify that `payload.record` / `payload.data` nesting is correct — top-level write fields are rejected.

---

## 6. Targeted Verification Plan

### A. Push & Deploy GAS Changes
1. **Push Changes**: Run `npm run gas:push` (or `cd GAS && clasp push`) when explicitly requested by user.
2. **Deployment Restriction (CRITICAL)**:
   - **DO NOT run automated `clasp deploy` or deployment scripts by default.** 
   - Deploying via `clasp deploy` automatically resets the Web App access permission to *"Anyone with Google account"*, which breaks the web application API.
   - **Warn the user & provide manual steps**:
     1. Open the Google Apps Script editor online.
     2. Click **Deploy** > **Manage deployments**.
     3. Click the **Edit** (pencil) icon on the active Web App deployment.
     4. Select **Version: New version**.
     5. Verify **Execute as**: *Me (admin email)* and **Who has access**: *Anyone*.
     6. Click **Deploy**.
   - If the user explicitly asks for CLI deployment after being warned, the agent may proceed.

### B. Sheets Propagation (If Config Changed)
Instruct the user to run:
1. `AQL 🚀 > 🔄 Sync & Cache > Sync APP.Resources from Code`
2. `AQL 🚀 > 🔄 Sync & Cache > Regenerate App Cache`
3. Log out and re-login to the web application.

### C. Functional Testing
1. Trigger the modified action from the frontend and verify the response.
2. Check the target sheet for expected data changes.
3. Verify PostAction side-effects executed correctly (e.g., stock balances updated).
