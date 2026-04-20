# Technical Specifications

## Purpose
This document owns technical contracts and implementation conventions that apply across the codebase. It should link to deeper canonical docs instead of duplicating them.

## Stack
- Frontend: Quasar, Vue 3, Vite, Pinia
- Backend: Google Apps Script
- Data layer: Google Sheets
- Local persistence: IndexedDB

## Identity and Access Model
- Users authenticate through `APP.Users`.
- Users have one designation, one or more roles, and optional region scope.
- Resource permissions are derived from `APP.RolePermissions`.
- Record-level and region-level access are enforced by backend runtime.

Detailed auth payload contract: [LOGIN_RESPONSE.md](F:/LITTLE%20LEAP/AQL/Documents/LOGIN_RESPONSE.md)

## Resource-Driven Runtime Contract
- `APP.Resources` is the runtime metadata source for:
  - resource discovery
  - file/sheet resolution
  - validation/default rules
  - UI metadata
  - hook/action/report metadata
- Resource column meanings are owned by [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Frontend Contracts
- All backend calls must go through `callGasApi`.
- Reusable logic should live in composables/services instead of page-local duplication.
- For meaningful frontend structural work, keep pages thin and move reusable logic into composables/components.
- Update frontend registries only when reusable interfaces change.

Canonical frontend guidance: [FRONTENT_README.md](F:/LITTLE%20LEAP/AQL/Documents/FRONTENT_README.md)

## Backend Contracts
- Prefer generic CRUD, bulk-array writes, additional actions, composite save, and hook-based extensions before proposing new backend patterns.
- Do not hardcode resource-specific runtime logic in generic core files when a metadata-driven pattern exists.
- All GAS actions must use one canonical transport envelope with `requestId` correlation.
- Requests must not require `scope`; resource selector supports string or array.
- Responses must expose one canonical `data` contract:
  - `data.resources` for resource row payloads
  - `data.result` for action-specific return data
  - `data.artifacts` for non-row outputs (e.g., report files)
- Resource payloads are header-light by default; header refresh uses explicit fallback retrieval from authorized resource metadata.
- Backend capability inventory and implementation patterns are owned by:
  - [GAS_API_CAPABILITIES.md](F:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md)
  - [GAS_PATTERNS.md](F:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md)

## Cache and Sync Conventions
- Cache-first flows should read IndexedDB first where implemented.
- Incremental sync should use stored cursors when available.
- Full refresh/build verification is not required for every change; targeted verification is preferred.

## Deployment Conventions
- GAS deployment uses `clasp push`.
- A new Apps Script Web App deployment version is needed only when the API contract changes.
- New client setup is documented in [NEW_CLIENT_SETUP_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/NEW_CLIENT_SETUP_GUIDE.md)

## Maintenance Rule
Update this file when:
- a cross-cutting technical contract changes
- a shared implementation convention changes
- canonical technical reference ownership changes
