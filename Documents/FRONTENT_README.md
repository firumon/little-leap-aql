# Quasar Application Setup Documentation

This document serves as a guide for AI agents and developers to understand the setup and configuration of the Quasar application in this project.

## Project Overview
- **Framework:** Quasar Framework v2
- **Build Tool:** Vite (@quasar/app-vite)
- **Language:** JavaScript (Vanilla)
- **API:** Vue 3 Composition API
- **State Management:** Pinia
- **Routing:** Vue Router (History mode)
- **HTTP Client:** Axios

## Frontend Engineering Standards (Mandatory)
### 1. Quasar-First UI Policy
- **Rule:** Default to Quasar components (`q-input`, `q-table`, `q-dialog`, etc.) for all UI structure, forms, tables, actions, and dialogs.
- **Exception Protocol:** Use native/custom HTML only when a Quasar component cannot satisfy a requirement. When this exception is applied, document the reason in the PR or plan notes and ensure custom styling rigorously aligns with Quasar theme tokens.

### 2. Single API Channel & Request UX Contract
- **Rule:** No direct ad-hoc API `post` flows or inconsistent loading/notify handling inside page components.
- **Contract:** All API calls must route through the centralized transport (`callGasApi` / `apiClient.js`), which handles the full request lifecycle: request dispatch, uniform loading state management, normalized error mapping, and standardized success/error notifications (`$q.notify`).

### 3. PWA-SW-IDB-Pinia Data Contract
- **Rule:** All modules (Masters, Operations, Warehouse) must follow a strict IndexedDB-first sync pipeline:
  1. Pinia stores read cached records from IndexedDB first for an instant UI paint.
  2. Incremental refresh is triggered from the server.
  3. Delta updates are upserted into both IndexedDB and Pinia state.
- **Service Worker Boundary:** The SW is strictly responsible for network/cache/sync mediation, while application modules retain all UI state and business logic.

## Setup Steps Taken

### 1. Project Initialization
The project was initialized using the Quasar CLI with:
- Project Name: `aql`
- Quasar v2 (Vue 3)
- Composition API
- Vite
- JavaScript

### 2. Dependency Configuration
Key dependencies:
- `axios`
- `pinia`
- `vue-router`

### 3. Theme & Branding
Configured colors from `Colors.txt`:
- **Primary:** `#E44072`
- **Secondary:** `#61ACC3`
- **Background:** `#F1F1F3`

Configured at:
- `f:\LITTLE LEAP\AQL\FRONTENT\src\css\quasar.variables.scss`

### 4. Boot Files
`src/boot/axios.js` is configured via `quasar.config.js`.
- It now exposes a centralized API client (`$api`) backed by `src/services/apiClient.js`.

### 5. Project Structure (Frontend)
Frontend source is in `FRONTENT/src`:
- `boot/`
- `config/`
- `services/`
- `css/`
- `layouts/`
- `pages/`
- `stores/`
- `utils/`

### 6. API Architecture (Centralized)
Frontend API calls are organized in one place under the Single API Channel Contract:
- `src/config/api.js`: GAS endpoint and API constants.
- `src/services/apiClient.js`: shared Axios instance handling common headers.
- `src/services/gasApi.js`: shared request utility (`callGasApi`) enforcing the standardized UX lifecycle (loading state, token injection, shared `$q.notify` success/error alerts, and normalized error mapping).

## Layout & Navigation
Main shell is in `MainLayout.vue` with grouped ERP navigation and profile menu.

## Profile Feature Progress (2026-02-18)
`src/pages/ProfilePage/ProfilePage.vue` supports:
- Avatar update
- Name update
- Email update
- Password update
- Displays user `Access Region` scope from login/profile payload

Store/API wiring:
- `src/stores/auth.js` uses shared `callGasApi(...)` through `callAuthApi(...)` wrapper.
- Profile update actions call GAS: `updateAvatar`, `updateName`, `updateEmail`, `updatePassword`.

## Master Module Progress (2026-03-11)
Implemented reusable frontend module for all configured masters:
- `src/pages/Masters/MasterEntityPage.vue` (generic page for configured masters)
- `src/services/masterRecords.js` (shared sync + CRUD service)
- `src/stores/products.js` (aligned to shared service)

Configured route:
- `/masters/:resourceSlug` (Dynamically routed via `MasterIndexPage.vue`)

### Discovery Pattern (Custom vs. Generic UI)
The master module supports **Implicit Global Resolution** for UI:
- **Generic Fallback**: `MasterEntityPage.vue` provides a metadata-driven UI for any resource.
- **Custom Overrides**: By creating a file named `{EntityName}Page.vue` in `src/pages/Masters/`, the system automatically bypasses the generic page and loads the custom implementation.
- **Benefits**: This allows starting with zero-code generic management and progressively adding custom interfaces (grids, charts, etc.) only where needed.
- **Note**: Custom pages are encouraged to import and embed `MasterEntityPage` for standard CRUD capabilities.

Backend actions consumed:
- Preferred generic verbs with scope:
  - `action=get`, `scope=master`
  - `action=create`, `scope=master`
  - `action=update`, `scope=master`
- Product wrappers remain backward-compatible in GAS.

Transport note:
- Master flows use shared `src/services/masterRecords.js` so stores/pages avoid duplicated API+sync logic.
- Access note: `src/router/index.js` checks matched resource via authorized `resources[].ui.routePath` (with optional `meta.requiredResource` fallback).

## PWA, Service Worker, and IDB Sync (2026-02-19)
- Service Worker uses `InjectManifest` and intercepts GAS API requests for network strategy/background sync where applicable.
- Login response includes role-authorized resources with resource headers; frontend persists this catalog for schema-aware rendering.
- Master list sync flow (common):
  1. Read headers + last sync cursor from IDB (`resource-meta`).
  2. Load cached rows from IDB (`resource-records`) for instant UI.
  3. If user clicks refresh (or cache is empty), call `action=get` with `scope=master`, `resource`, and `lastUpdatedAt` when cursor exists.
  4. Merge returned `rows` (array of arrays) into IDB.
  5. Convert rows to objects inside frontend service/store and render.

Delta strategy notes:
- Re-opening master pages uses IDB cache and does not call Apps Script when cache exists.
- Manual refresh forces sync.
- Sync requests include `lastUpdatedAt` when `resource-meta.lastSyncAt` exists.
- If `UpdatedAt` is unavailable for a resource, server returns full rows (no delta optimization).

Pinia data note:
- Product master results are also hydrated into `src/stores/products.js` so other screens can resolve product code/id to product name locally.

## Operation Module Progress (2026-03-11)
- Operations test pages were pruned to establish a hardened production baseline. The active production UI modules restored are Auth (Landing/Login), Dashboard (Index with widgets), Profile, and the generic Master list (`MasterEntityPage`).
- Unused operation test pages were deleted to ensure the build only bundles finalized, approved application flows.

## Development Workflow
- Run `npm run dev` in `FRONTENT` (port 9000).
- Keep routes synced with pages.
- Keep docs updated for onboarding continuity.
