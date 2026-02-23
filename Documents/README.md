# Little Leap AQL Documentation

Welcome to the technical documentation for the Little Leap AQL project. This folder contains detailed guides on the system's logic, architecture, and setup.

## Latest Development Updates
- 2026-02-21: Master sync is now strict cache-first (IDB-first with no per-visit API call when cache exists), sync requests send `lastUpdatedAt` from local sync cursor, and Products master data hydrates into Pinia for cross-page code-to-name resolution.
- 2026-02-21: Added hierarchical `Access Region` architecture (`APP.AccessRegions` + `Users.AccessRegion`) with subtree-based data access enforcement in GAS master read/create/update flows; empty user region now means universe access.
- 2026-02-20: Business-priority docs corrected: project heartbeat is now explicitly documented as outlet distribution, periodic sales tracking, strict-cycle collection, approved refill, and low-stock purchase ordering (with inbound logistics as supporting enabler).
- 2026-02-20: Split API runtime concerns in Apps Script: `doPost` + action dispatch moved from `GAS/auth.gs` to `GAS/apiDispatcher.gs`; shared sheet helpers moved to `GAS/sheetHelpers.gs` so `auth.gs` now contains authentication/profile logic only.
- 2026-02-20: Master frontend sync now uses interval-gated IDB-first strategy (no per-visit server fetch), with forced refresh and `lastUpdatedAt` delta when `UpdatedAt` is available.
- 2026-02-20: `GAS/auth.gs` login payload contract standardized for frontend (`token` + enriched `user` + role-authorized `resources` object shape).
- 2026-02-20: Resource authorization assembly hardened so one misconfigured resource does not collapse the full login/getAuthorizedResources payload.
- 2026-02-20: `OVERVIEW.md` and `Architecture.md` refreshed to current resource-driven APP-centered architecture and generic master API conventions.
- 2026-02-19: Added `RESOURCE_COLUMNS_GUIDE.md` with per-column definitions, allowed values, and examples for `APP.Resources`.
- 2026-02-19: APP resource model expanded to metadata-driven control plane (backend schema + frontend menu/page/field config from `APP.Resources`).
- 2026-02-19: Auth identity model refactored for designation + multi-role (`Users.DesignationID` + `Users.Roles` CSV).
- 2026-02-19: Master API schema validation/defaults now resolve from `APP.Resources` (removed hardcoded master schema map).
- 2026-02-19: Frontend master menu and master pages now resolve from authorized resource metadata payload instead of hardcoded `masters.js`.
- 2026-02-19: Record-level authorization foundation added via `Resources.RecordAccessPolicy` and designation hierarchy.
- 2026-02-19: Master API now supports generic verb-style payloads (`action=get/create/update` with `scope=master` and `resource/resources`) to reduce action-specific switch cases.
- 2026-02-19: Role-based master UI filtering added: sidebar master menu and route access now enforce `authorizedResources.permissions.canRead`.
- 2026-02-19: Frontend masters UI refactored to one reusable page (`src/pages/Masters/MasterEntityPage.vue`) driven by `src/config/masters.js` for Products/Suppliers/Warehouses/WarehouseLocations/Carriers/Ports.
- 2026-02-19: Master API refactored to generic resource-based actions (`master.getRecords`, `master.createRecord`, `master.updateRecord`) shared across Products/Suppliers/Warehouses/WarehouseLocations/Carriers/Ports.
- 2026-02-19: Frontend master data sync refactored into reusable `src/services/masterRecords.js` (IDB-first + delta sync), with products store consuming the shared service.
- 2026-02-19: Login response now includes role-authorized resources with permissions and headers from APP `RolePermissions` + `Resources`.
- 2026-02-19: `master.getProducts` moved to compact sync payload (`rows` array-of-arrays) with incremental fetch support via `lastUpdatedAt` and `meta.lastSyncAt`.
- 2026-02-19: Frontend products module now uses IndexedDB incremental sync and converts row arrays to objects client-side for UI rendering.
- 2026-02-19: Frontend API transport centralized into shared `src/config/api.js`, `src/services/apiClient.js`, and `src/services/gasApi.js`; stores now consume common request handling instead of owning GAS URL logic.
- 2026-02-19: Added `CONTEXT_HANDOFF.md` to bootstrap new Codex context windows without losing project direction.
- 2026-02-19: Resources model extended with CodeSequenceLength for configurable code padding per resource.
- 2026-02-19: Master setup refactored to CodePrefix-driven AppScript code generation (no sheet code formulas).
- 2026-02-18: Profile management expanded to support `updateName`, `updateEmail`, and `updatePassword` from the frontend Profile page, with matching token-protected handlers in `GAS/auth.gs`.
- 2026-02-18: Auth API internals refactored to use row-based token validation context and centralized JSON request/response helpers.
- 2026-02-18: Ground-level inbound operations from China to Ajman warehouse documented for implementation alignment.
- 2026-02-18: AI collaboration protocol added for handling Sheet/App Script/code/doc synchronization.
- 2026-02-19: Step-1 foundation started: MASTER setup script, resources-driven cross-file architecture doc, and common API routing for auth+master.
- 2026-02-19: Product master implementation started: `master.getProducts`, `master.createProduct`, `master.updateProduct` and frontend `/masters/products` module.

## Documentation Index

### 1. [Overview](OVERVIEW.md)
*   **Context:** High-level introduction to the project goals, business model, and tech stack.
*   **Audience:** All stakeholders.

### 2. [Business Logic](BusinessLogic.md)
*   **Context:** Detailed explanation of entities and workflows centered on outlet distribution, sales/collections cycles, refill approvals, and purchase ordering, with inbound flow as enabler.
*   **Audience:** Developers, Project Managers.

### 3. [Technical Specifications](TechnicalSpecifications.md)
*   **Context:** Deep dive into the codebase, API contracts, JSON structures, and security implementation.
*   **Audience:** Backend/Frontend Developers.

### 4. [System Architecture](Architecture.md)
*   **Context:** Diagrams and component breakdown showing how Quasar, Apps Script, and Sheets interact.
*   **Audience:** System Architects, Lead Developers.

### 5. [Frontend Setup](QUASAR_SETUP.md)
*   **Context:** Step-by-step guide to setting up the Quasar development environment.
*   **Audience:** Frontend Developers.

### 6. [Database Structure](APP_SHEET_STRUCTURE.md)
*   **Context:** Schema definition for the Google Sheets used as the database.
*   **Audience:** DB Admins, Backend Developers.

### 7. [Ground Operations Workflow](GROUND_OPERATIONS_WORKFLOW.md)
*   **Context:** Real-world field workflow with commercial distribution heartbeat (outlet sales/collections/refill/PO) plus inbound logistics enabler flow.
*   **Audience:** Developers, Operations, Future joiners (AI/Person).

### 8. [AI Collaboration Protocol](AI_COLLABORATION_PROTOCOL.md)
*   **Context:** Rules for keeping Google Sheets, Apps Script, local code, and docs synchronized during implementation.
*   **Audience:** AI Agents, Developers, Project Owner.

### 9. [Resource Registry Architecture](RESOURCE_REGISTRY_ARCHITECTURE.md)
*   **Context:** How APP.Resources dynamically routes API access to MASTERS/TRANSACTIONS/REPORTS files.
*   **Audience:** Backend Developers, Architects.

### 10. [MASTER Sheet Structure](MASTER_SHEET_STRUCTURE.md)
*   **Context:** Current MASTER file schema used for inbound foundation (products, suppliers, warehouses, locations, carriers, ports).
*   **Audience:** DB Admins, Backend Developers, Operations.

### 11. [Context Handoff](CONTEXT_HANDOFF.md)
*   **Context:** Single-file bootstrapping brief for new Codex sessions to resume work with full project continuity.
*   **Audience:** AI Agents, Developers, Project Owner.

### 12. [Resources Columns Guide](RESOURCE_COLUMNS_GUIDE.md)
*   **Context:** Detailed meaning, valid values, and examples for every `APP.Resources` column.
*   **Audience:** DB Admins, Backend Developers, Frontend Developers, AI Agents.
