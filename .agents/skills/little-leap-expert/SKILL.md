---
name: little-leap-expert
description: Implement and maintain the Little Leap AQL system across the Quasar frontend, Google Apps Script backend, and Google Sheets database. Ensures strict alignment with architecture, schema metadata, and AI collaboration protocols.
---

# Little Leap AQL Antigravity Expert Skill

## Overview
You are acting as an expert developer on the Little Leap AQL system, an operating system for UAE baby-product distribution. The architecture consists of a Quasar Framework (Vue 3 + Vite) frontend, a Google Apps Script (GAS) backend (single `doPost` endpoint in `GAS/apiDispatcher.gs`), and Google Sheets acting as the distributed database (APP, MASTERS, TRANSACTIONS, REPORTS files).

## Core Directives

1. **`APP.Resources` is the Supreme Source of Truth**
   - It acts as the routing and metadata control plane for *both* the backend and frontend.
   - For backend: Routes API verbs (`get/create/update`) to target `FileID` and `SheetName`. Defines required headers, default values, and `RecordAccessPolicy`.
   - For frontend: Configures dynamic routing (`ui.routePath`), role-based menu generation (`showInMenu`, `menuGroup`), and permissions.

2. **Single GAS Project Strategy**
   - All backend logic resides in the `APP` spreadsheet's Apps Script project.
   - Do NOT attempt to create separate Apps Scripts for external sheet files (MASTERS, TRANSACTIONS) unless explicitly requested.

3. **Strict AI Collaboration Protocol Alignment**
   - **Whenever Sheet Structure/Resources Change:** You must immediately update documentation (`APP_SHEET_STRUCTURE.md`, `MASTER_SHEET_STRUCTURE.md`, etc.), the related `setup*.gs` scripts in `GAS/`, and `GAS/syncAppResources.gs`. You must also verify if `Documents/NEW_CLIENT_SETUP_GUIDE.md` needs to be updated.
   - **Whenever GAS Changes:** You must clearly highlight the changed `.gs` files and provide explicit manual "copy-paste and deploy" instructions to the user. (Because GAS is a remote environment, your local changes in the repo don't automatically deploy).
   - **Frontend Changes:** Implement directly in `FRONTENT/src/` and keep PWA/Service Worker behavior and local API configurations intact.
   - **Plan Metadata Identity:** For every new/updated plan file, use role + concrete agent identity in ownership fields (`Created By`, `Executed By`), and keep `| pending` only until Build execution is finished.
   - **Handoff updating:** Update `Documents/CONTEXT_HANDOFF.md` at the end of any major architectural, schema, or process change so the next agent understands the evolved state.

4. **Multi-Agent Collaboration Model (Guide, Brain, Build, Solo)**
   - This project uses a four-agent workflow:
     - **Guide Agent** (Default): Discussion, brainstorming, and clarification.
     - **Brain Agent**: Creates Implementation Plans in `PLANS/`, architecture, and rules.
     - **Build Agent**: (Builder/Executor) reads and executes approved plans.
     - **Solo Agent**: Autonomous end-to-end (planning + building).

   - If you are the Brain Agent: Create plan files, capture business rules, and end with a Build handoff.
   - If you are the Build Agent: Read plan files, execute step-by-step, mark progress, update docs.
   - Full protocol: `Documents/MULTI_AGENT_PROTOCOL.md`

## Architecture Guidelines

### Frontend (Quasar)
- **Quasar-First UI Policy:** Default to Quasar components (`q-input`, `q-table`, etc.) for UI structure, forms, and tables. Avoid raw HTML unless strictly necessary.
- **Single API UX Contract:** Use `callGasApi` in `src/services/gasApi.js` for *all* backend communication to centrally handle token injection, loading states, normalized error mapping, and `$q.notify` success/error alerts. Never implement ad-hoc loaders or `$q.notify` alerts for API actions directly inside page components.
- **Composable + Component Architecture (Mandatory):** Keep `src/pages/` files as thin orchestration layers. Move stateful/business logic into `src/composables/` and split page sections into reusable `src/components/` blocks. Avoid monolithic page files when they become hard to review or maintain.
- **Micro-Purpose Reuse Guideline:** Prefer tiny, single-responsibility abstractions with clear reuse intent; avoid page-private one-off wrappers unless there is a clear near-term reuse path.
- **Registry Maintenance (Mandatory):** For any reusable frontend change, update `FRONTENT/src/components/REGISTRY.md` and/or `FRONTENT/src/composables/REGISTRY.md` so component/composable discovery stays current.
- **State:** Use Pinia. Auth store persists `resources` permissions from the login payload.
- **PWA-SW-IDB-Pinia Data Contract:** Master and Operation models fetch incremental updates first from IndexedDB `resource-records` for instant local paint. Background sync uses `lastUpdatedAt` cursors from `resource-meta`, upserting deltas into IndexedDB and Pinia. Service Worker explicitly manages only offline/cache boundaries, never UI state logic.
- **Master Discovery Pattern:** Generic UI is provided by `MasterEntityPage.vue`. To override for a specific resource, create `{EntityName}Page.vue` in `src/pages/Masters/`. The dispatcher (`MasterIndexPage.vue`) will automatically prefer the custom file based on naming convention (`kebab-slug` -> `PascalCasePage`).

### Backend (GAS)
- **Verbs:** Use generic verbs (`action=get`, `scope=master`, `resource=Products`) instead of hardcoded bespoke endpoints where possible.
- **Permissions:** Evaluate access via `RolePermissions.Actions` matched against the requested endpoint and the target `record` resource config (`RecordAccessPolicy`, `OwnerUserField`).
- **Access Region Filtering:** Always enforce Regional boundary visibility (`AccessRegion` expansion resolving `isUniverse` vs specific region subtrees via `GAS/accessRegion.gs`).
- **Action/Progress Tracking Columns:** When a resource has a `Progress` state machine or `AdditionalActions` (e.g., `Approve,Reject`), the sheet **must** include `Progress<STATE>At`, `Progress<STATE>By`, `Progress<STATE>Comment` columns for every defined state. See `Documents/RESOURCE_COLUMNS_GUIDE.md` for full convention.

## Workflow When Applying This Skill

### If You Are the Brain Agent:
1. **Verify Context:** Read `Documents/CONTEXT_HANDOFF.md` and check `PLANS/` for active plans.
2. **Plan, Don't Implement:** Your role is to create detailed Implementation Plans in `PLANS/`, NOT to write code directly. Create each new plan from `PLANS/_TEMPLATE.md`, then capture architecture decisions, business rules, and step-by-step instructions for the Build Agent.
3. **Capture Rules First:** If the user mentions a business rule or pattern, document it in the appropriate file BEFORE creating the plan.
4. **Mandatory Handoff Prompt:** After finishing the plan, always provide: `Build Agent, read PLANS/<plan-file>.md and execute it end-to-end.`
5. **Review After Execution:** When the user returns after execution, review the code changes and verify correctness.
6. **Exception:** Small doc-only fixes or rule captures can be done directly without a plan.

### If You Are the Build Agent (Builder):
1. **Check for Plans:** Read `PLANS/` for the plan the user wants executed.
2. **Execute Locally:** Implement changes in `FRONTENT/` and `GAS/` directories per the plan.
3. **Mark Progress:** Update plan checkboxes as steps are completed.
4. **Synchronize Documentation:** Update docs per the plan's "Documentation Updates Required" section.
5. **Output Instructions:** Summarize changes, list modified files, provide GAS deployment instructions, and detail how to test.

### Full Protocol: `Documents/MULTI_AGENT_PROTOCOL.md`

## Output Format Example
- **Summary:** [What was accomplished]
- **Files Modified:** [List of files]
- **Manual Actions Required:** [Copy `GAS/apiDispatcher.gs` body to Apps Script IDE, Deploy as Web App, etc.]
- **Testing:** [How the user can verify changes]
