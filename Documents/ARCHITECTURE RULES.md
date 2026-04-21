# AQL Frontend Architecture Rules (STRICT)

---

## 1. SERVICES LAYER

* ALL API requests MUST exist ONLY inside services

* ALL IndexedDB (IDB) operations MUST exist ONLY inside services

* Services act as pure data providers (API/IDB gateway)

* Services MUST NOT contain business logic

* Services MUST implement data transformation (mapping) if needed

* Services MUST return standardized response:
  `{ success: boolean, data: any, error: any }`

* All offline/online sync, queue handling, and persistence logic MUST be handled ONLY inside services

* Ensure:

    * NO duplication of sync logic
    * Existing sync flow is preserved (NOT broken)

### Logging

* Logging MUST exist inside services for critical operations

* Logging MUST be controlled via environment variable:
  `process.env.ENABLE_LOGS`

* Must support enabling/disabling logs without code changes

---

## 2. UTILITIES (appHelpers)

* `src/utils/appHelpers.js` is the central place for all stateless reusable helper functions

### Examples

* `toPascalCase()`
* `mapHeaderAndArray()`

### Rules

* Helpers MUST be:

    * Stateless
    * Pure functions
    * Side-effect free

* Helpers CAN be used in:

    * services
    * stores
    * composables
    * components

* DO NOT duplicate helper logic

* If reusable logic is found → MUST move to `appHelpers`

### Restrictions

Helpers MUST NOT:

* Call APIs
* Access IDB
* Contain business workflows
* Contain UI logic

---

## 3. STORES (Pinia)

* Stores can use services

* Stores can use other stores

* Stores are the **SINGLE SOURCE OF TRUTH**

### CORE REQUIRED PRIMITIVES (MUST-USE DEFAULTS)

These are default contracts for all new frontend work. Do not bypass them unless the task explicitly introduces a new canonical replacement and updates docs in the same task.

* `useDataStore` (`FRONTENT/src/stores/data.js`)
  * MUST be the default in-memory resource-record state owner.
  * Resource row state MUST flow through this store (directly or via IDB upsert callbacks).
* `useWorkflowStore` (`FRONTENT/src/stores/workflow.js`)
  * MUST be the default orchestration boundary for action/composite/report/batch execution.
* `useSyncStore` (`FRONTENT/src/stores/sync.js`)
  * MUST be the default queue/sync orchestration surface.
* `useClientCacheStore` (`FRONTENT/src/stores/clientCache.js`)
  * MUST be the default app-level access point to client cache services.
* `useResourceNav` (`FRONTENT/src/composables/resources/useResourceNav.js`)
  * MUST be used for resource navigation (no direct `router.push()` in feature flows).
* `useSectionResolver` (`FRONTENT/src/composables/resources/useSectionResolver.js`)
  * MUST be used for 3-tier section resolution.
* `useActionResolver` (`FRONTENT/src/composables/resources/useActionResolver.js`)
  * MUST be used for action-page section resolution.

---

### API TRANSPORT CONTRACT (FRONTEND + GAS)

* All frontend-to-GAS requests MUST use one canonical request envelope with `requestId` correlation.
* Request scope MUST NOT be required in frontend payloads.
* Resource selector MUST support string or array.
* All GAS responses MUST use one canonical envelope.
* Any resource data in responses MUST be handled generically by frontend services and persisted via the approved IDB/data flow.
* Resource responses MUST be header-light by default; header refresh MUST use an explicit fallback request.

---

### DATA STORE RESPONSIBILITY (CRITICAL)

A central store, stores/data.js (e.g., `useDataStore`) is allowed.

#### MUST:

* Call services for ALL API operations:

    * GET
    * POST
    * UPDATE
    * BULK

* Update in-memory state

* Persist + hydrate via IDB (through services only)

* Maintain normalized structure (e.g., headers + rows)

#### MUST NOT:

* Contain business logic
* Perform validations
* Implement workflows
* Contain UI logic

#### ROLE:

Store acts as:

* Data transport coordinator
* State manager
* Persistence handler

---

### GENERAL STORE RULES

* Stores manage:

    * State population from API
    * State hydration from IDB

* No direct API/IDB logic outside services

---

## 4. COMPOSABLES

* Can use stores

* Can use other composables

* MUST NOT use services directly

* MUST NOT perform API/IDB operations

---

### RESPONSIBILITY

* ALL business logic MUST live here

Includes:

* Validation
* Workflow handling
* Payload preparation

---

### STRUCTURE

* Logic MUST be split into SMALL reusable composables
* Avoid monolithic composables

---

### NAVIGATION RULE (CRITICAL)

* ALL navigation MUST go through `useResourceNav`

* Direct `router.push()` usage is NOT allowed

* Navigation MUST respect:

    * `useSectionResolver`
    * `useActionResolver`

* Ensures:

    * Consistent routing
    * Correct scope/resourceSlug/code handling
    * Cross-resource navigation

---

## 5. COMPONENTS

* Can ONLY use composables

---

### RESTRICTIONS

Components MUST NOT use:

* services
* stores directly
* API calls
* IDB operations

---

### RESPONSIBILITY

* UI rendering only

* Connect composables

* MUST NOT contain business logic

---

## 6. SIDE EFFECT RULE

* Only stores and composables may contain side effects
* Components MUST remain side-effect free

---

## 7. LOGIC DISTRIBUTION

* ALL business logic MUST be in composables

* Ensure:

    * No duplication across layers
    * Clear separation of concerns

---

## 8. COMPONENT DESIGN

* Components MUST be minimal

* Responsible only for:

    * UI
    * invoking composables

* No heavy logic allowed

---

## 9. STYLING RULES

* Prefer Quasar utility classes first

---

### SHARED STYLE STRATEGY

* Common styles MUST be defined in:
  `src/css/custom.scss`

* `custom.scss` MUST be globally imported via:
  `app.scss`

---

### PRIORITY ORDER

1. Quasar utility classes
2. Shared styles (`custom.scss`)
3. Component styles (last resort)

---

### RESTRICTIONS

* DO NOT duplicate styles across components

* Component styles ONLY if:

    * strictly component-specific
    * not reusable

---

## 10. NAMING CONVENTIONS (STRICT)

* Stores → `useXStore`
* Composables → `useX`
* Services → `XService`

---

## 11. FILE SIZE RULE

* No file should exceed ~400 lines

* If exceeded:
  → MUST be split logically

---

## 12. REFACTOR FREEDOM

You are allowed to:

* Move code across layers
* Split files
* Merge files
* Create new files
* Delete unnecessary files

---

### OPTIMIZE FOR:

* clarity
* maintainability
* scalability
* strict architecture compliance

---

## 13. RESOURCE/SCOPE SPECIFICITY RULE (STRICT)

* Stores and services MUST be fully generic.
* No store function may reference a specific resource name (e.g., `StockMovements`, `PurchaseRequisitions`) or a specific scope name (e.g., `Master`, `Operations`).
* No service function or export may carry a scope-qualified name (e.g., `createMasterRecord`, `bulkMasterRecords`, `syncMasterResourcesBatch`).
* Resource-specific orchestration (e.g., building a StockMovements batch payload) MUST live in a dedicated composable.
* Generic verbs MUST be used: `createRecord`, `updateRecord`, `bulkRecords`, `syncResourcesBatch`, etc.
* If a transitional alias exists, it MUST be removed in the same task that introduces the canonical name.

---

## 14. MAINTENANCE ENFORCEMENT

When any required primitive, transport contract, or layer ownership rule changes, this file MUST be updated in the same task before completion.

---

# REVIEW INSTRUCTIONS

1. Analyze FULL codebase
2. Enforce ALL rules strictly

---

### Identify:

* Architecture violations
* Misplaced logic
* Direct API/IDB usage outside services
* Incorrect layer usage
* Sync/queue duplication
* Missing logging
* Missing standardized responses
* Naming violations
* Oversized files
* Styling violations

---

### RULES

* Be EXTREMELY STRICT
* Do NOT modify code
* Produce structured report only

---

# OUTPUT FORMAT

## 1. Overall Architecture Health

* Rating
* Key Problems
* Risk Level

---

## 2. Global Violations

---

## 3. File-by-File Action Plan

File: `<path>`

* Issue
* Action
* Refactor Type
* Target
* Priority

---

## 4. New Files

---

## 5. Files to Remove/Merge

---

## 6. Refactoring Plan

Step-by-step execution plan

---

# IMPORTANT RULES

* Mention EVERY affected file
* Do NOT skip
* No generic advice
* Output must be actionable
* Preserve current working flow
* DO NOT break sync/data flow

---

# FINAL GOAL

A strictly layered, scalable, maintainable architecture with:

* Clear separation of concerns
* Consistent data flow
* Zero ambiguity
