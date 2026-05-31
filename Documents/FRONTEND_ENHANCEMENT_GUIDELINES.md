# AQL Frontend Enhancement & Refactoring Guidelines

This document serves as the master reference for the upcoming frontend enhancements, design consistency alignment, and refactoring work inside the AQL codebase. It consolidates all requirements, design decisions, and architectural rules discussed for the Solo Agent.

---

## 1. Core Operating Principles

### 1.1 Solo Agent Execution Mode
* **Direct Implementation**: Implement code modifications directly in real-time. No written implementation plans (`implementation_plan.md`) are required unless explicitly requested.
* **Concise Briefs**: All responses and completion summaries must be brief, precise, and professional. Avoid long explanations, overly polite phrasing, or superlatives.
* **Architecture Compliance**: Strictest adherence to [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) (especially **Section 9** and **Section 5B**).

### 1.2 Custom CSS Constraint (STRICT)
* **Check Existing CSS First**: Before adding any new custom CSS rule, you MUST check for existing CSS rules. Creating new custom CSS is only allowed if existing global styles, custom styles, or Quasar utility classes are completely insufficient.
* **Update Architecture Rules**: This rule has been codified in Section 9.1 of [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

### 1.3 Registry Integration
* Every new reusable component created (e.g., `DataAddFAB`, `ResourceActionButton`) must be added to the frontend registry file:
  * `FRONTENT/src/components/REGISTRY.md` (and other registries if applicable).

---

## 2. Architectural Guidelines & Gating

### 2.1 Navigation Standard
* **Strict Router Gate**: All navigation transitions must be routed using the generic `goTo(target, params)` helper from `useResourceNav.js`.
* **No Direct Routing**: Direct calls to `router.push()` in feature pages are strictly prohibited.

### 2.2 UI & Workflow Permission Gating (Section 5B)
* **Reactive Verification**: Use the `allowed()` helper from `useResourceConfig` to check permissions before rendering interactive elements or running workflow logic.
* **Transactional Operations**: If an operation affects multiple resources, verify permissions for all involved resources.
  * *Example*: `{ outletPayment: 'create', outletConsumptionInvoice: 'update' }`.
* **Strict AND Fail-safe**: If any permission in a multi-resource check is false, the entire gate evaluates to false (fail-safe).

### 2.3 Vue Reactivity Contract (Section 5A)
* **Single Source of Truth**: All UI and component layouts must reactively derive from a single canonical state source (Pinia data store).
* **Computed Derivations**: Any filters, searches, maps, or views must preserve the reactive dependency chain. Use `computed()` variables so changes instantly propagate.
* **Anti-Patterns Forbidden**: Never duplicate business state in local component data or use manual watchers, force-refresh flags, or key-re-renders to sync UI sections.

---

## 3. Standardized Page Structures (Index, View, and Add/Edit Pages)

Consistent structure, layout hierarchy, and visual weight must be maintained not only across all `IndexPages` but also in `ViewPages`, `AddPages`, and their sub-components.

### 3.1 Non-Blocking Loading Pattern (Index & View Pages)
* **No Full-Page Blocks**: Avoid blocking the entire UI with `v-if="loading"` card wrappers during reloads when data headers are already available.
* **Reactive Dual-Loader**:
  * Use a global spinner (`shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)`) strictly when metadata or dependencies have not been initialized at all.
  * Use `<q-linear-progress indeterminate />` at the top of the page for all background syncing or reloading, keeping the active list fully visible and interactive.

### 3.2 Standard Layout Sections (Index & View Pages)
* **Branded Header**: Unified title, description, and status indicator chips.
* **Reload & Search Combo**: A top-aligned Search Input (`q-input` with prepend icon) and a standard `ReloadButton` component.
* **View Switcher / Category Groupings**: Consistent list view options or tabbed categorizations (e.g., Today, Overdue, Upcoming, History) with unified shadow card designs.
* **Subsequent Sub-Components**: Apply the same visual styling, margins, cards, borders, and shadows to nested view panels and child components.

### 3.3 Add/Edit Page Refinement (`AddPage.vue` / `EditPage.vue`)
* **Spacious and Clean Controls**: Review use of the `dense` attribute across form inputs, select dropdowns, and buttons. 
* **Pruning Redundant Denseness**: Remove unnecessary `dense` attributes where not visually required to ensure forms look clean, comfortable, and consistent, rather than overly cramped.

---

## 4. Reusable Shared Components

To achieve maximum reusability and maintain the absolute minimum file size, the following new components will be designed and distributed.

### 4.1 `DataAddFAB.vue`
* **Purpose**: A self-contained floating action button for record creation.
* **Premium Styling**: Elevated shadow design modeled after `Masters/Products/IndexPage.vue` (gradient background and high elevation).
* **Internal Logic**:
  * Identifies active resource slug/scope reactively.
  * Programmatically verifies `allowed('create')` or `allowed('write')`.
  * Renders dynamically (auto-hides if unauthorized) and routes navigation internally via `useResourceNav`.

### 4.2 `ResourceActionButton.vue`
* **Purpose**: A unified button element that automatically handles action-level permissions and dynamic rendering.
* **Configuration Props**: Accepts normal Quasar styling props (flat, push, glossy, round, icon, label, loading state).
* **Permission Gating**:
  * Accepts a target action string or multi-resource permission mapping.
  * Integrates with `allowed(...)` internally to decide whether to disable, hide, or render the button.

### 4.3 `ActionCommentDialog.vue` (Or Action Executer Component)
* **Purpose**: Encapsulate the recurring workflow pattern: asking the user for a comment (optional/mandatory) followed by an action submission.
* **Refactored Execution**:
  * Centralizes input validation and loading spinners inside a common dialog structure.
  * Utilizes `ResourceActionButton` internally to submit the workflow securely.

### 4.4 Continuous Discovery of Reusable Components
* **Open Extraction**: Reusable component creation is not limited to the items above.
* **Active Surfing**: As we surf through the codebase and analyze pages or composables, whenever an opportunity arises to extract common logic or UI blocks into a new component, we will implement it, register it in `FRONTENT/src/components/REGISTRY.md`, and refactor dependent pages to use it.
* **Adaptive Evolution**: All new components will be designed slim initially and extended incrementally with optional props or toggle slots rather than duplicating logic across layers.

---

## 5. Refactoring & Code Quality Controls

* **Orphan Cleanup**: Unused helper functions or orphan logic identified during the enhancement process must be deleted.
* **Deduplication**: Identical/redundant helper operations will be centralized in `src/utils/appHelpers.js` or shared composables, with dependent pages refactored to consume them.
* **Consolidation & Merge**:
  * Seek explicit user approval prior to executing a merge for functions that have highly similar logic or can be consolidated with minor parameter changes.
  * Maintain target file sizes at a absolute minimum (under ~400 lines per file).
