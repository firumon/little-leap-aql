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
* `useResourceIoStore` (`FRONTENT/src/stores/resourceIo.js`)
  * MUST be the only store command surface for resource API, fetch, sync, mutation, workflow action, composite, report, batch, queue, draft, and client-cache operations.
  * Composables MUST call this store for API/fetch/sync/mutation/cache commands instead of service files or older split stores.
  * This store may coordinate `useDataStore` and `useResourceStatusStore`, but resource-specific business orchestration MUST remain in composables.
  * Resource row data returned from API/cache/sync MUST hydrate `useDataStore` so UI reads stay provider-independent and reactive.
* `useResourceStatusStore` (`FRONTENT/src/stores/resourceStatus.js`)
  * MUST be the default resource fetch/sync status registry.
  * It tracks resource status only; it MUST NOT initiate resource API/sync commands.
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
* `record` action responses MUST hydrate frontend state through canonical `data.resources`; frontend code MUST NOT special-case request actions for state updates.
* Batch dependencies MUST use explicit `$ref` payload objects resolved by GAS; frontend code MUST NOT patch response placeholders such as legacy pending codes.
* Frontend batch builders MUST preserve `$ref` objects with shared helpers from `FRONTENT/src/composables/batchRefs.js`; use `textOrRef()` for possible ref/code values and do not pass refs through `text()`, `String()`, template literals, or concatenation.
* `$ref` values MUST NOT be embedded inside comments or sentence strings; omit the generated code from the comment or defer comment generation until the code is known unless an explicit backend template feature exists.
* Resource responses MUST be header-light by default; header refresh MUST use an explicit fallback request.

---

### DATA STORE RESPONSIBILITY (CRITICAL)

A central store, stores/data.js (e.g., `useDataStore`) is allowed.

#### MUST:

* Update in-memory state

* Hydrate resource rows returned by `useResourceIoStore` or IDB upsert callbacks

* Persist through services only when an explicit local optimistic update is required

* Maintain normalized structure (e.g., headers + rows)

#### MUST NOT:

* Contain business logic
* Perform validations
* Implement workflows
* Contain UI logic

#### ROLE:

Store acts as:

* State manager
* Provider-independent reactive resource-record cache

---

### GENERAL STORE RULES

* Stores manage:

    * State population from API
    * State hydration from IDB
    * API command orchestration through `useResourceIoStore`

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

### DYNAMIC CURRENCY SYSTEM (`useCurrency` & `_C` HELPER)

* **Purpose**: To handle all currency formatting, symbol resolution, and live conversion dynamically across the application without hardcoded Rupees (`₹`), Dirhams (`AED`), or region codes like `en-IN`.
* **Dynamic Config**: Configured currency is defined dynamically via `APP.Config.Currency` on the sheets backend and loaded into memory on login.
* **Master Records**: Master currency configurations (symbols, decimal rules, and exchange factors relative to base) are registered in the `Currencies` resource.

#### Usage of the `_C` helper:
The `useCurrency` composable exposes `_C` as a compact polyvalent currency helper:
```javascript
const { _C, defaultCurrency } = useCurrency()
```

* **Signature**:
  `_C(value, showSymbolOrCode, targetCode, sourceCode)`

* **Examples**:
  1. **Format with Default Currency Decimals (No Symbol):**
     `_C(100)` => `'100.00'`
  2. **Format with Default Currency Symbol and Decimals:**
     `_C(100, true)` => `'د.إ100.00'` (or `'₹ 100.00'` depending on default config)
  3. **Convert from Default Currency to Target Currency (No Symbol):**
     `_C(100, "INR")` => `'1000.00'` (if default is AED, 1 INR = 0.1 AED factor)
  4. **Convert from Default Currency to Target Currency with Target Symbol:**
     `_C(100, true, "INR")` => `'₹ 1000.00'`
  5. **No-Conversion Format for a Specific Currency (e.g. PO is already in INR):**
     `_C(100, true, "INR", "INR")` => `'₹ 100.00'`

* **Guidelines**:
  * ALWAYS use `_C` for formatting currencies. Do NOT hardcode currency symbols (e.g. `₹`, `AED`) in templates.
  * For input prefixes, use `:prefix="defaultCurrency.Symbol"`.
  * For interactive shortcut buttons, use dynamic attributes (e.g., `:label="\`+ \${defaultCurrency.Symbol}100\`"`).
  * Do NOT manually invoke any dynamic loading of master records in pages; master currencies are pre-loaded at login.

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

## 5A. VUE REACTIVITY CONTRACT (CRITICAL, NON-NEGOTIABLE)

Vue reactivity is a core architecture primitive in this frontend. It MUST be used directly and correctly. Code that manually imitates Vue reactivity is an architecture violation, not an acceptable workaround.

### SINGLE REACTIVE SOURCE OF TRUTH

* Every UI state domain MUST have one canonical reactive source of truth.
* Derived UI state MUST be expressed with Vue reactive primitives such as `computed()`, store state, composable state, props-derived computation, or direct template derivation.
* Multiple UI sections that depend on the same domain state MUST derive from the same canonical reactive source.
* A state transition MUST be applied to the canonical source. All dependent UI sections must update because their reactive dependencies changed.

### STRICTLY FORBIDDEN

* DO NOT maintain parallel arrays, mirror objects, duplicate caches, or local copies to manually keep the UI synchronized.
* DO NOT patch one displayed section independently from another section that represents the same state domain.
* DO NOT add watcher chains, event relays, timers, force-refresh flags, re-render keys, or manual synchronization code to mimic reactivity.
* DO NOT fix stale UI by duplicating business state in a component.
* DO NOT mutate response snapshots or derived lists as if they are the source of truth.

### REQUIRED FIX WHEN UI DOES NOT REACT

* Identify the broken reactive dependency chain.
* Move the state transition to the canonical reactive source.
* Rebuild every visible derivation from that source using `computed()` or an equivalent Vue reactive primitive.
* If an optimistic update is needed, update only the canonical reactive source or the approved store/composable state that owns it.
* Boundary synchronization is allowed only when integrating with an external non-reactive system, and the same change MUST document why it is a boundary bridge rather than an internal reactivity workaround.

---

## 5B. UI & WORKFLOW PERMISSION GATING CONTRACT (STRICT)

All interactive UI elements (buttons, links, action menus, redirect targets, etc.) that trigger operations or navigate to state-changing pages, as well as the underlying workflow and business logic in composables, MUST be strictly permission-gated using the `allowed()` helper from `useResourceConfig`.

### RULES:

* **No Naked Actions or Workflows:** Never render an interactive element or execute a state-changing workflow in a composable without a reactive or programmatic permission check (using `allowed(...)`).
* **Multi-Resource/Transactional Actions:** When a single UI action or composable workflow initiates operations touching or modifying multiple resources, the gating expression MUST verify permission for **all** involved resources and actions.
  * *Example:* Adding an invoice payment creates a row in `outletPayment` and updates the progress of an `outletConsumptionInvoice` to "Paid" or "Partially Paid". Therefore, both the rendering of the button and the execution of the payment submission logic in the composable MUST only proceed if the user has permissions for **both** operations.
  * *Code Pattern (Template):* 
    ```html
    <q-btn v-if="allowed({ outletPayment: 'create', outletConsumptionInvoice: 'update' })" ... />
    ```
  * *Code Pattern (Composable/Method):*
    ```javascript
    if (!allowed({ outletPayment: 'create', outletConsumptionInvoice: 'update' })) {
      notifyError('You do not have permission to execute this transactional action.');
      return;
    }
    ```
* **Strict Fail-Safe (AND Logic):** For multiple actions or multi-resource checks, if even a single permission check fails, the gate MUST evaluate to `false`.

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

## 9. FRONTEND COMPONENT & STYLING CONTRACT (STRICT)

All frontend layout, design, and styling MUST be achieved using Quasar's native ecosystem. Custom markup and CSS are considered architectural violations unless they strictly follow the exception hierarchy defined below.

### 9.1 CORE PRINCIPLES

* **Quasar-First Component Standard:** All frontend layouts and user interface structures MUST use Quasar's built-in components and layout elements.
  * Hand-rolled grid layouts (e.g., custom `div.row` structures or custom CSS flex grids) are forbidden.
  * Prefer native Quasar layout components over custom manual wrappers.
* **Custom Markup Fallback:** Plain `div` elements styled with Quasar CSS utility classes are ONLY permitted when no native Quasar component exists or is capable of achieving the specific design/functional requirement.
* **Custom CSS Restriction:** Custom CSS is strictly prohibited unless both built-in Quasar components and Quasar utility classes are incapable of achieving the required layout or design. Before adding any new custom CSS, you MUST check for existing CSS rules. A new custom CSS rule is only allowed if existing styles or utility classes are completely insufficient.
* **Custom CSS Location:**
  * When custom CSS is necessary, it MUST be structured for maximum generality and reusability, and added to the globally shared stylesheet: **[custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss)**.
  * Component-specific `<style>` blocks are permitted ONLY as a last resort, and ONLY if the styles are strictly component-specific and have zero potential for reuse elsewhere.

---

### 9.2 LAYOUT & STYLING PRIORITY ORDER

Developers MUST adhere to the following sequence of preference when styling or building UI:

1. **Quasar Built-in & Layout Components**
   * *Primary choice for all page structures, cards, grids, forms, and widgets.*
2. **Custom `div` with Quasar CSS Utility Classes**
   * *Used only as a fallback when no native Quasar component can satisfy the layout requirement.*
3. **Globally Shared Custom Styles (`custom.scss`)**
   * *Used only when Quasar components and utility classes are insufficient. Must be written to be highly generic and reusable.*
4. **Scoped/Local Component Styles**
   * *An absolute last resort. Used only if the style is 100% component-specific and will never be reused.*

---

### 9.3 SHARED STYLE STRATEGY

* Common, reusable custom styles MUST be defined in:
  `src/css/custom.scss`
* `custom.scss` MUST be globally imported via:
  `app.scss`
* DO NOT duplicate styles across different components.

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

# FINAL GOAL

A strictly layered, scalable, maintainable architecture with:

* Clear separation of concerns
* Consistent data flow
* Zero ambiguity
