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

## Setup Steps Taken

### 1. Project Initialization
The project was initialized using the Quasar CLI with:
- Project Name: `little-leap-aql`
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
Frontend API calls are organized in one place:
- `src/config/api.js`: GAS endpoint and API constants.
- `src/services/apiClient.js`: shared Axios instance with common headers.
- `src/services/gasApi.js`: shared request utility (`callGasApi`) for action payload, token injection, and normalized errors.

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

## Master Module Progress (2026-02-19)
Implemented reusable frontend module:
- `src/pages/Masters/MasterEntityPage.vue` (generic page for all configured masters)
- `src/services/masterRecords.js` (shared sync + CRUD service)
- `src/stores/products.js` (aligned to shared service)

Configured route:
- `/masters/:resourceSlug` (resource resolved via authorized metadata + `ui.routePath`)

Capabilities:
- Shared list/create/update workflow for all configured master resources
- Include inactive toggle
- IDB-backed incremental sync with compact payloads (`rows` array format)
- Role-based master navigation visibility (read-permission driven)
- Route-level resource guard for unauthorized direct URL access

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

## Development Workflow
- Run `npm run dev` in `FRONTENT` (port 9000).
- Keep routes synced with pages.
- Keep docs updated for onboarding continuity.
