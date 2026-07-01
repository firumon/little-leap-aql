# AQL Frontend Architecture Rules (STRICT)

---

## 1. SERVICES LAYER
* **Role**: Pure data providers (API/IDB gateway). No business logic. Standardized response: `{ success: boolean, data: any, error: any }`.
* **APIs & IDB**: All API requests, IndexedDB operations, offline sync, queueing, and persistence logic MUST exist ONLY inside services.
* **Logging**: Inside services only, controlled via environment variable `process.env.ENABLE_LOGS`.

---

## 2. UTILITIES (appHelpers)
* **Role**: Reusable stateless helper functions in `src/utils/appHelpers.js` (e.g. `toPascalCase`, `mapHeaderAndArray`).
* **Rules**: Must be stateless, pure, side-effect free. Used in services, stores, composables, and components.
* **Restrictions**: No API calls, IDB access, business workflows, or UI logic.

---

## 3. STORES (Pinia)
* **Role**: State managers, API command orchestrators, and IDB state hydrators. No business logic, validations, or UI logic.
* **Single Source of Truth**: All reactive resource-record state flows through Pinia stores.
* **Mandatory Store Primitives**:
  * `useDataStore` (`src/stores/data.js`): Default owner of reactive resource rows.
  * `useResourceIoStore` (`src/stores/resourceIo.js`): Single command surface for API/fetch/sync/mutations. Hydrates `useDataStore`.
  * `useResourceStatusStore` (`src/stores/resourceStatus.js`): Fetch/sync status registry only. No API commands.
* **Resource/Scope Specificity**: Stores must be fully generic. No store or service function may reference specific resource names (e.g. `StockMovements`) or scopes (e.g. `Master`). Resource-specific orchestration must live in composables.
* **API Transport Contract**: One canonical envelope for frontend-to-GAS requests/responses. All resource data in responses must persist via IDB/data flow. Batch dependencies must use `$ref` payload objects resolved by GAS; do not stringify/concatenate `$ref` values or put them in comments.

---

## 4. COMPOSABLES
* **Role**: Contains all business logic, validation, workflow handling, and payload preparation.
* **Rules**: Can use stores and other composables. Must NOT use services directly, perform API/IDB operations, or exceed ~400 lines.
* **Navigation**: Must use `useResourceNav` for routing. Direct `router.push()` is forbidden.
* **Component Resolution**: Must respect the decentralized page resolver (`usePageResolver`), section resolver (`useSectionResolver`), and common section wrapper (`useCommonSection`). Do not bypass them to perform ad-hoc template loading or layout overrides.
* **Dynamic Currency**: Always use the `useCurrency` `_C(value, showSymbol, target, source)` helper. Do not hardcode currency symbols (e.g. `₹`, `AED`).

---

## 5. COMPONENTS & PAGES
* **Role**: UI rendering only. Invokes composables. No business logic, stores, services, API calls, or IDB operations.
* **UI/Workflow Permission Gating**: All interactive elements and state-changing workflows must be gated using `allowed()` from `useResourceConfig`. For multi-resource actions, gate must verify ALL permissions (AND logic).

---

## 6. VUE REACTIVITY & STATE COMPOSITION (STRICT)
* **Single Source of Truth**: Every UI state domain has one reactive source of truth.
* **Resource Aggregation**: Combine related resources (e.g., Products, SKUs, Storage locations) in a composable `computed()` property to form an array of unified aggregate objects. Derive all filter conditions (e.g. warehouse filter) from this single composed state.
* **Forbidden**: No parallel arrays, mirror objects, duplicate caches, watcher chains, or manual synchronization code to mimic reactivity. Fix stale UI by modifying the canonical reactive source.
* **Thin Page Orchestration**: Vue page files must act strictly as orchestrators:
  * *Templates*: No nested raw HTML layouts (like `div > div > ul > li`). Compose using child components and conditional flags (`v-if`/`v-else`).
  * *Scripts*: Mostly imports and thin binding logic to feed child components.

---

## 7. MOBILE-FIRST & LAYOUT CONTRACT
* **Mobile-First (95%+ target)**: Prioritize vertical fluid layouts and touch target sizes.
* **NO `QTable`**: Do not use `QTable` for listing records due to horizontal scrolling on mobile. Use stacked lists of `QCard` or `QList`/`QItem` instead.
* **Aesthetic Freedom**: Style cards (using elevation, shadows, borders, or flat designs) as appropriate for a premium experience. Do not restrict to "flat/bordered only."
* **Quasar-First**: All frontend layouts must use Quasar components/flex classes. Custom CSS in `custom.scss` is allowed only if Quasar options are completely insufficient.

---

## 8. COMPONENT/COMPOSABLE SCOPING & REGISTRY
To support thin page design, organize components/composables strictly by scope:
* **Global Shared (`src/components/shared/` & `src/composables/shared/`)**: Stateless, universally reusable blocks. Log in [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).
* **Module Shared (`src/components/Operations/` / `src/composables/operations/`)**: Shared across the module. Log in local module registry.
* **Feature Shared (`src/components/Operations/Outlets/` / `src/composables/operations/outlets/`)**: Shared across the feature. Log in feature registry.
* **Page-Private (nested subfolders)**: Unique to a page. Do NOT log in any registry.
* **Registry Check & Reuse**: Before implementing any UI requirement, always check registries and existing shared components/composables first — for example, use `AqlList.vue` for lists rather than raw `div` nesting. If no shared component fits and the need is trivial, use only Quasar components with Quasar helper classes (no raw HTML elements, no custom CSS). If neither approach works and a new component/composable must be created, design it to be reusable for future similar requirements and expose customization via props or arguments.

---

## 9. GENERAL STANDARDS
* **Naming**: Stores → `useXStore`, Composables → `useX`, Services → `XService`.
* **File Size**: Max ~400 lines per file; split logically if exceeded.
* **Refactor Freedom**: Feel free to move, split, merge, or delete files to optimize for clarity, maintainability, and architectural compliance.
