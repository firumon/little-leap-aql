# Context Handoff - AQL

## Purpose
This file is a brief current-state snapshot for sessions that need continuation context. It is not a universal startup read.

## When To Read This File
Read this file only when:
- continuing unfinished work
- the task depends on current implementation state
- the user asks for resume context or latest project status

## Project Snapshot
- Project: AQL
- Domain: UAE baby product distribution operations
- Frontend: Quasar, Vue 3, Pinia, Vite
- Backend: Google Apps Script Web App with a single `doPost` entry
- Data model: Google Sheets split across APP, MASTERS, OPERATIONS, and REPORTS

## Current Operating Model
- `APP.Resources` is the main source of truth for resource metadata, routing, and permissions.
- A single APP Apps Script project is preferred for runtime behavior.
- `Config` in APP stores deployment-specific settings such as file IDs.
- GAS deployment is done with `clasp push`; manual Apps Script copy-paste is not part of the workflow.
- **Frontend Architecture**: Pinia remains the unified reactive state layer (record state via `useDataStore`, orchestration via dedicated workflow/cache/sync stores). IDB is the persistence layer, and sync cursors live in IDB `resource-meta` (not `localStorage`). Page shells are thin and consume composable view-models instead of importing stores/services directly.
- **Frontend Service/Boundary Layer**: Frontend now enforces pages -> composables -> stores/services boundaries. Reusable boundaries include app/resource navigation helpers (`useAppNav`, `useResourceNav`), action/page orchestration composables, and sync orchestration (`useResourceSync`). Service contracts are standardized around `{ success, data, error }`, with env-controlled logging via `src/services/_logger.js`.
- **Composable Structure (2026-04-20)**: `FRONTENT/src/composables/` is now purpose-grouped into `layout/`, `core/`, `resources/`, `operations/`, `masters/products/`, `reports/`, and `upload/`. Purchase Requisition flow composables remain separate entry points under `operations/purchaseRequisitions/`, with shared local helpers extracted for metadata, SKU option shaping, and payload construction.

## Current Important Constraints
- Use `Documents/DOC_ROUTING.md` to decide which docs to read for the task.
- Do not read all plans by default; read only the named or clearly relevant plan.
- For backend implementation, prefer existing GAS files and patterns first.
- For frontend implementation, keep pages thin when the task materially changes page structure.

## Current Functional State
- Resource-driven auth, menu, and master runtime are active.
- Login payload includes authorization/resource context and profile identity context.
- Master pages use cache-first IndexedDB sync with incremental updates.
- The project uses documented module workflows and canonical docs for menu and login payload behavior.
- Scope infrastructure is now data-driven via App.Config "Scopes" key, supporting dynamic scope addition without code changes.
- Procurement module schema initiated with PurchaseRequisitions, PurchaseRequisitionItems, and UOM master resources.
- Operation-scope resources use year-scoped code generation (e.g., PR26000001).
- PR frontend flow implemented (initiation, draft editing, and read-only views).
- `procurement.gs` handler created for cross-resource progress sync (e.g., auto-creating Procurement on PR submission).
- Operations 3-tier UI architecture implemented, mirroring Masters but customized for operations context (ViewParent instead of ViewAudit, filtered details).
- Frontend refactor execution completed for the service/store/page migration plan: pages and composables now consume store actions or new service modules, and the legacy `src/services/apiClient.js`, `src/services/gasApi.js`, `src/services/resourceRecords.js`, and `src/utils/db.js` files were removed.
- Frontend architecture remediation completed on 2026-04-19: reviewed pages no longer import `src/stores/*` or `src/services/*`, direct page-level `router.push`/`$router.back` usage is removed, frontend source files are under 400 lines, and `npm run build` succeeds.
- PR/composable reorg plan executed on 2026-04-20: the PR initiate page keeps a direct `formatSkuVariants` import, hero Sass `lighten()` usage has been removed from the targeted hero token/card files, and the current build output shows only separate `darken()` deprecation warnings in other hero partials outside that targeted migration.
- API contract update executed on 2026-04-21: write actions (`create`, `update`, `bulk`, `executeAction`, `compositeSave`) now require nested payload objects and return write-delta resource payloads under canonical `data.resources` using `lastUpdatedAtByResource` cursors.
- Batch contract now returns ordered per-request envelopes in `data.result.responses` and an aggregated `data.resources` map for generic frontend ingestion.
- Generic service naming enforced on 2026-04-21: `createMasterRecord→createRecord`, `updateMasterRecord→updateRecord`, `bulkMasterRecords→bulkRecords`; all `*Master*` transitional aliases removed. `submitStockMovementsBatch` removed from `workflow.js`; `useStockMovements.js` composable now owns full dispatch logic via `runBatchRequests`.

## Deep-Dive References
- Role boundaries: `Documents/MULTI_AGENT_PROTOCOL.md`
- Task-based doc loading: `Documents/DOC_ROUTING.md`
- Implementation alignment: `Documents/AI_COLLABORATION_PROTOCOL.md`
- Module workflows: `Documents/MODULE_WORKFLOWS.md`

## Maintenance Rule
Update this file when current-state assumptions materially change, for example:
- a major architecture/runtime decision changes
- current operating constraints change
- a major module or platform capability changes enough that continuation context would be misleading

Keep this file summarized and current. Replace outdated state instead of appending dated history.
