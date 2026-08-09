# Document Routing Guide

## Purpose
This document is the canonical task-to-doc router for AQL. Use it to decide what to read after the startup file and `Documents/MULTI_AGENT_PROTOCOL.md`.

## Core Routing Rule
- Read only the docs required for the current task.
- For large docs, read only the relevant section instead of the whole file whenever possible.
- Do not load `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, or backend-heavy docs unless the task actually needs them.
- **Init prompt routing is owned by AGENTS.md** — use its Query Classification table to decide which init prompt (if any) to load. This file covers canonical docs only, not init prompts.

## Non-Negotiable Frontend Pre-Read
**Before touching ANY file under `FRONTENT/` — regardless of scope, size, or perceived simplicity — you MUST read:**
- `Documents/ARCHITECTURE RULES.md`

This applies to: bug fixes, one-line patches, component tweaks, composable changes, store edits, service changes, style adjustments — everything.
Small fixes are the most frequent source of layer violations (e.g. calling services directly in components, using `router.push()` instead of `useResourceNav`, placing business logic in pages).
**Do not skip this step even for trivial-seeming changes.**

## Non-Negotiable Reusable-Component Pre-Read
**Before creating or materially restructuring ANY component under `FRONTENT/src/components/{abstract,app,contents,sections}/`, you MUST read:**
- `Documents/AQL_RENDERABLE_CONTRACT.md`

Every prop a caller might want to replace with their own markup has to route through `abstract/Renderable.js`. A prop interpolated directly into a template is closed to `_ui/` customization and forces tenants into a full `.vue` override — which swaps component identity, remounts the list, and kills row transitions. This applies to new components and to any change that adds a rendered cell to an existing one.

## Task Routing

### Discussion Only
Use when the task is brainstorming, clarification, tradeoff analysis, or high-level thinking.
- Read:
  - `Documents/MULTI_AGENT_PROTOCOL.md`
- Read more only if the discussion needs specific evidence from a canonical doc.

### Planning Work
Use when the user asks for a plan or explicitly invokes Brain Agent behavior.
- Read:
  - `Documents/MULTI_AGENT_PROTOCOL.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `PLANS/_TEMPLATE.md`
- Also read only the docs directly relevant to the task area.

### Execute A Named Plan
Use when Build Agent is asked to execute a plan.
- Read:
  - `Documents/MULTI_AGENT_PROTOCOL.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - the specific named plan file only
- Do not read all files in `PLANS/`.

### Resume Or Continue Existing Work
Use when the task depends on current project state or recent unfinished work.
- Read:
  - `Documents/CONTEXT_HANDOFF.md`
- Also read only the specific plan or module docs needed for that continuation.

### Frontend Implementation
Use when editing files under `FRONTENT/`.
- Read:
  - `Documents/ARCHITECTURE RULES.md` — **mandatory, see Non-Negotiable Frontend Pre-Read above**
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/PAGE_STATE.md` — **MUST be used for any resource page that collects input or submits data** (centralized form-state composable: API prep, Content/Action section contract, response handling).
- Frontend work MUST comply with the Vue Reactivity Contract in `Documents/ARCHITECTURE RULES.md`; manual synchronization that imitates Vue reactivity is a serious architecture violation.
- If the task affects reusable building blocks, also read/update:
  - `FRONTENT/src/components/REGISTRY.md`
  - `FRONTENT/src/composables/REGISTRY.md`
  - `FRONTENT/src/dashboard/REGISTRY.md` (if affecting dashboard widgets)
- If the task affects a documented module, also read only the relevant section of:
  - `Documents/MODULE_WORKFLOWS.md`

### Frontend Architecture Planning & Refactoring
Use when defining architectural steps, planning refactors, or preparing frontend implementation tasks.
- Read:
  - `Documents/ARCHITECTURE RULES.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - task-specific module docs only when directly relevant

### Formal Frontend Architecture Review
Use ONLY when explicitly asked to perform a comprehensive code review against architecture rules (e.g., "Review the whole frontend code against rules"). This task is for analysis and reporting only.
- Read:
  - `Documents/ARCHITECTURE RULES.md`
  - `Documents/REVIEW AGAINST ARCHITECTURE RULE - INSTRUCTIONS.md`
  - `Documents/AI_COLLABORATION_PROTOCOL.md`

### Frontend Resource Customization
Use when overriding or creating custom section or sub-components for any resource scope (master, operation, or Accounts)
(e.g., custom record card, custom details view, custom form, custom child layout, custom loading/empty states).
- Read:
  - `Documents/AQL_CUSTOM_UI_GUIDE.md` — **start here**: the operational guide to `src/_ui/` — folder layout, path-segment transformation, the shared 10-tier lookup, Vue override vs JS modifier, page contracts, `Props<Identity>` blocks, reactivity/styling contracts, and troubleshooting. The subsystem specs below are the per-paradigm detail.
  - `Documents/AQL_PAGE_AND_SECTION_SYSTEM.md`
  - `Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md`
  - `Documents/AQL_VIEW_SYSTEM.md` — when customizing View content (parent/child/column overrides, scope rules, JS modifier API)
  - `Documents/AQL_CREATE_AND_UPDATE_CONTENT_SYSTEM.md` — when customizing Create/Update content (`Create.vue`/`Update.vue`/`FormRecord.vue`/`FormChild.vue` prop tables, visibility precedence, child entry modes, Update hydration, child soft-deletion)

### Reusable Render Component Creation
Use when creating or restructuring a component under `FRONTENT/src/components/{abstract,app,contents,sections}/` — a new Section, a new content component, a new list/table/card primitive, or an app-level wrapper.
- Read:
  - `Documents/AQL_RENDERABLE_CONTRACT.md` — **mandatory, see Non-Negotiable Reusable-Component Pre-Read above**
  - `Documents/ARCHITECTURE RULES.md`
- Also read the domain doc for whatever subsystem the component belongs to (Content, Page & Section, Action).

### List Switcher Customization
Use when overriding or creating custom container or item layouts, template overrides, or dynamic modifiers for the list view switcher bar.
- Read:
  - `Documents/AQL_FRONTEND_LIST_SWITCHER.md`

### Action & FAB Customization
Use when overriding or creating custom action components, floating action buttons (FABs), workflow buttons, cancel/submit/reset form actions, the sticky form actions bar, the submission lifecycle, or workflow dialogs.
- Read:
  - `Documents/AQL_ACTION_SYSTEM.md` — **single canonical spec**: `Action.vue` / `useActionResolver.js`, the `components/actions/` folder, the 10-tier action lookup, the configurable `FormActions` `actions` array, `ResourceActions` FAB cluster, `ActionDialog` field resolution, and the loading-UX contract.


### Backend Design
Use when designing new backend behavior, evaluating options, or checking whether existing GAS capabilities already support the request.
- Read:
  - `Documents/GAS_API_CAPABILITIES.md`
- Read `Documents/AI_COLLABORATION_PROTOCOL.md` only if the task is moving beyond discussion into planning/building.

### Backend Implementation
Use when editing GAS code.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/GAS_API_CAPABILITIES.md`
  - `Documents/GAS_PATTERNS.md`
- Prefer existing GAS files and patterns first.
- Create a new GAS file only when the current structure cannot support the task cleanly.

### Module-Specific Work
Use when a documented module such as Reports or Bulk Upload is involved.
- Read:
  - only the relevant section of `Documents/MODULE_WORKFLOWS.md` (Note: Reports has its own dedicated guide at [REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/REPORTS_SYSTEM.md))
- Also read task-specific docs from this router as needed.

### Resource Metadata Or Sheet Schema Changes
Use when changing `APP.Resources`, resource columns, sheet structure, or setup/sync behavior.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/RESOURCE_COLUMNS_GUIDE.md`
- Also read the relevant structure doc section if needed.

### Menu Action Changes (Sheet Menu)
Use when adding, removing, renaming, or behavior-changing `AQL 🚀` sheet menu actions (the Google Sheets toolbar menu).
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/AQL_MENU_ADMIN_GUIDE.md`

### Sidebar Menu Configuration (Frontend)
Use when adding, removing, reordering, or changing permission gates for the web application's sidebar menu (Menu JSON in `APP.Resources`).
- Read:
  - `Documents/AQL_FRONTEND_MENU_SYSTEM.md` — **single canonical doc** covering schema, data flow, permission gating, tree building, route guard, and admin operation
  - `Documents/AI_COLLABORATION_PROTOCOL.md`

### Login Payload Or Auth Response Changes
Use when changing `handleLogin()` response shape, field sources, or frontend storage of login data.
- Read:
  - `Documents/AI_COLLABORATION_PROTOCOL.md`
  - `Documents/LOGIN_RESPONSE.md`

### Dashboard Implementation
Use when implementing or customizing dashboard modules, widgets, composables, or layout grids.
- Read:
  - `Documents/DASHBOARD_DEVELOPMENT_GUIDE.md`

### Tax System Design & Configuration
Use when customizing tax columns, calculating wholesale values, or modifying compound tax logic.
- Read:
  - `Documents/TAX_SYSTEM_DESIGN.md`

### Multi-Tenant System & Onboarding
Use when working with tenant routing, Master Apps Script configurations, select tenant forms, or generating a new client/tenant instance.
- Read:
  - `Documents/MULTI_TENANT_SYSTEM.md`
  - `Documents/NEW_CLIENT_SETUP_GUIDE.md`

### Sheet Views Formulation
Use when inspecting, designing, or changing Google Sheets View aggregation formulas.
- Read:
  - `Sheet Formulas/Views/INDEX.md`
  - and the specific view file under `Sheet Formulas/Views/`

### Sheet Reports Formulation
Use when inspecting, designing, or changing Google Sheets printable report templates or cell-specific formulas.
- Read:
  - `Sheet Formulas/Reports/INDEX.md`
  - and the specific report file under `Sheet Formulas/Reports/`
  - [REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/REPORTS_SYSTEM.md) (specifically Section 2 and 3)

## Maintenance Rule
Update this file when any of the following changes:
- a new recurring task type is introduced
- a canonical reference doc is added, removed, or renamed
- routing guidance changes for planning, build, backend, frontend, auth, menu, sidebar, or resume workflows
- mandatory-read rules for specific task categories change
- the Non-Negotiable Frontend Pre-Read list changes (e.g. a new always-read doc is added for frontend work)
- the Non-Negotiable Reusable-Component Pre-Read list changes, or the `Renderable` contract's folder scope changes
- sidebar menu routing or permission-evaluation rules change materially

