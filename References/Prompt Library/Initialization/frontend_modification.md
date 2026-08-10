# AQL Frontend Modification & Coding Workflow

> **Scope boundary**: This document covers FRONTENT/ changes only — Vue pages, composables, components, stores, services. Its blast-radius steps reference GAS backend files and sync config — read those files directly by path. Do NOT load backend_gas_implementation.md or database_schema_alteration.md unless the task explicitly requires modifying that code.

Use this document to initialize an AI agent session when the task involves modifying, refactoring, adding, or deleting frontend pages, components, composables, or styling under the `FRONTENT/` directory.

---

## 1. Role Boundaries (Mandatory)

Before proceeding, read and follow the role boundaries defined in [MULTI_AGENT_PROTOCOL.md](file:///f:/LITTLE%20LEAP/AQL/Documents/MULTI_AGENT_PROTOCOL.md). Your default role is `Guide Agent`. To execute frontend modifications, you must be in the `Solo Agent` or `Build Agent` role — state the role switch briefly to the user.

---

## 2. System Architecture & Coordination

AQL's frontend stack consists of Vue 3, Quasar Framework (v2), Pinia state management, Vite, and Axios. It utilizes a strict 3-tier custom UI architecture that allows resolving tenant-specific overrides dynamically.

* **View Layer (Thin Pages)**: Located in `FRONTENT/src/pages/`. They act strictly as orchestrators and render templates. They must not contain business logic, direct API calls, IndexedDB queries, or Pinia store actions.
* **Logic Layer (Composables)**: Located in `FRONTENT/src/composables/`. This is the single source of truth for business rules, calculations, currency formatting, validation, and layout workflows.
* **Generic State & Transport (Stores & Services)**: Located in `FRONTENT/src/stores/` and `FRONTENT/src/services/`. Generic wrappers orchestrate state hydration and server communication. They must be generic and never hardcode resource names or scope definitions.
* **Component Registry**: Reusable widgets and UI blocks reside under `FRONTENT/src/components/` and are registered in `FRONTENT/src/components/REGISTRY.md`.
* **File Size Limit**: All files under `FRONTENT/` are strictly capped at **400 lines**. Split components and composables that grow beyond this boundary.

---

## 3. Mandatory Pre-Reads (With Line-Level Links)

Before writing any code under `FRONTENT/`, you must read the following architectural rules:
* Core Architectural Boundaries: [AQL Frontend Architecture Rules in ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md#L1-L77)
* General Frontend Layout conventions: [FRONTENT_README.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FRONTENT_README.md)
* Login Payload Specification: [LOGIN_RESPONSE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/LOGIN_RESPONSE.md)

Depending on the widgets or workflows being modified, inspect the current registries:
* Reusable Components: [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
* Reusable Composables: [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md)
* If the task involves dashboard widgets: [DASHBOARD_DEVELOPMENT_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/DASHBOARD_DEVELOPMENT_GUIDE.md)

If backend metadata configuration, synced resources, or API options are required, refer to:
* [GAS/Constants.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/Constants.gs) (contains `appOptions` source of truth)
* [GAS/syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs) (source of truth for synced resources and columns)
* Backend API Capabilities: [Documents/GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md)

---

## 4. Data Flow & Schema Matrix

* **Initial Hydration**: Auth user payload (roles, permissions, access region, allowed resources) is retrieved via `handleLogin` API and stored in Pinia `authStore` and locally.
* **Reactive Cache Flow**:
  * Master/Config resources read cache-first from IndexedDB via the Pinia `useDataStore` store.
  * Writes (`create`, `update`, `bulk`, `executeAction`, `compositeSave`) send payloads containing update-delta checks and return updated structures to keep IndexedDB and state stores in sync.
* **Reactivity Composition**: Combine related store vectors (e.g., Products, SKUs) using `computed()` properties inside a shared composable. All filters, sort criteria, and data grids derive from this unified aggregate object.
* **Page-Level Context Sharing**: Page orchestrators (`IndexPage.vue`, `ViewPage.vue`, etc.) instantiate and `provide` their `resourceConfig` and `resourceRecord` contexts. Descendant components `inject` these instances, ensuring sibling components (e.g. search inputs and list views) share the exact same reactive state without redundant local instantiations.

---

## 5. Step-by-Step Implementation Checklist

### Step 1: Pre-requisite Discovery & Blast Radius Scan (DO NOT SKIP)
Before modifying code:
1. **Search Registry**: Check [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) and [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md) to see if a reusable block already exists that fulfills or can be extended for this task.
2. **Blast Radius Scan**: Search the codebase to identify all pages or parent layouts that consume the component or composable you plan to edit.
3. **Seek Clarification**: Propose your design changes, list impacted files, highlight how the single source of truth is preserved, and seek user confirmation before code implementation.

### Step 2: Component & Composable Implementation
1. Keep the Vue page file thin.
2. Write state properties, reactive calculations, and actions in a composable located under `FRONTENT/src/composables/`.
3. Wrap UI layouts inside children components if the template exceeds standard size or can be reused.
4. Integrate the dynamic currency helper `_C(value, showSymbol, target, source)` from `useCurrency` for money metrics.
5. Apply permission gates via `allowed(actionKey)` from `useResourceConfig` on all interactive links/buttons.

### Step 3: Registry & Documentation Updates
1. If a new reusable composable or component is created (or signature changes), log it in the corresponding registry:
   * [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
   * [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md)
2. Ensure that any page or layout files added conform to [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

---

## 6. Explicit Guardrails (DOs and DO NOTs)

* **DO NOT** use `QTable` for record lists. Use vertical fluid scroll lists with `q-card` or `AqlList` / `AqlGroupedList` for mobile compatibility.
* **DO NOT** import Pinia stores, services, or Axios wrappers directly into Vue page components.
* **DO NOT** instantiate `useResourceConfig()` or `useRecord()` inside common child components. Always inject the page-level provided `resourceConfig` and `resourceRecord` instances to preserve unified page state.
* **DO NOT** import `useRoute` from `vue-router` directly. Always use `useRouteConfig` from `src/composables/resources/useRouteConfig` to access route params, query, or path. It exposes `scope`, `resourceSlug`, `code`, `pageSlug` (the `resource`/`record` sub-route segment), `action` (the `_action/:action` segment — a signal of its own, never folded into `pageSlug`), `pageName` (`meta.page`), `level`, `query`, `path`.
* **DO NOT** write manual watcher chains, mirror states, or parallel arrays to keep data in sync. Keep a single reactive source.
* **DO NOT** call raw `router.push()` or `$router.back()` directly on elements. Always route using the generic helper `useResourceNav`.
* **DO NOT** hardcode currency symbols.
* **DO NOT** exceed the strict **400 lines limit** per file. Split components and composables if they grow beyond this boundary.
* **DO NOT** call backend APIs or custom endpoints directly. Route all backend communication through `callGasApi` or existing generic store wrappers.
* **DO NOT** use raw HTML when Quasar provides an appropriate component or class.
* **DO** use Quasar components (`q-page`, `q-card`, `q-form`, `q-input`, `q-select`, `q-btn`, `q-dialog`, `q-tabs`, `q-splitter`, `q-layout`) and spacing/flex utilities by default.
* **DO** verify layout spacing and responsiveness using Quasar flex grid classes.

---

## 7. Targeted Verification Plan

### A. Run Local Development Server
To test changes in real time:
1. Open the local dev environment: run `npm run dev` within the `FRONTENT` folder.
2. Test the specific modified page or dialog. Verify form validation errors, input bindings, loading states, and redirect navigations.

### B. Verify Layer Boundaries
1. Manually check the import statements of modified Vue files to ensure no store or service is directly imported.
2. Verify that all interactive buttons are correctly deactivated or hidden if permissions are unauthorized.

---

## 8. Communication Standards

* **Role Declaration**: Explicitly state that you are acting as a **Frontend Developer**.
* **Docs Declaration**: Explicitly list all required documents read (including [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md)) before proceeding with implementation.
* **Architecture Compliance**: If a user request conflicts with the project's architecture rules, explain the conflict clearly and propose the compliant approach.
