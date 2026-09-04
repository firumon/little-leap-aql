# Document Routing Guide

## Purpose
This document is the canonical task-to-doc router for AQL. Use it to decide what to read after `AGENTS.md` and [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md).

## Core Routing Rule
- Read only the docs required for the current task.
- For large docs, read only the relevant section instead of the whole file whenever possible.
- **A doc past ~25KB is SPLIT into parts** (see Split Canonical Docs below). Open the hub, read its two tables, then open only the part you need.
- Do not load `PLANS/` or backend-heavy docs unless the task actually needs them.
- **Init prompt routing is owned by AGENTS.md** — use its Query Classification table to decide which init prompt (if any) to load. This file covers canonical docs only, not init prompts.

### System Knowledge (`Documents/`) vs. Agent Execution Prompts (`References/Prompt Library/`)
- **`Documents/` (Humans & AI Agents)**: Canonical architecture specifications, data schemas, domain workflows, and system rules. Both humans and AI agents read these files to understand how the system works.
- **`References/Prompt Library/Initialization/` (AI Agents Only)**: Machine-optimized, task-specific procedural prompts and checklists. These instruct the AI agent on how to completely execute a specific task or workflow.

## Split Canonical Docs

Any `Documents/` file that grew past ~25KB is **split into parts**. The original filename is
still the entry point and is still what this router names — it is now a HUB carrying two
tables:

- **Parts of this document** — what each part covers, with links.
- **Where each section lives** — every `§N` mapped to the file holding it.

**Section numbers did not change**, so an existing `§` reference still resolves — look it up
in the hub's map. A hub deliberately does **not** restate its parts, so never assume it still
contains the section you remember.

| Hub | Parts |
|---|---|
| `UI_MODULE_DEVELOPER_GUIDE.md` | `UI_MODULE_DEVELOPER_FOLDERS.md`, `UI_MODULE_DEVELOPER_LOOKUP.md`, `UI_MODULE_DEVELOPER_CONTRACTS.md`, `UI_MODULE_DEVELOPER_LISTS.md`, `UI_MODULE_DEVELOPER_INDEX_PAGE.md`, `UI_MODULE_DEVELOPER_ACTIONS.md`, `UI_MODULE_DEVELOPER_FORM_ARCH.md`, `UI_MODULE_DEVELOPER_VISUAL.md` |
| `UI_PAGE_STATE.md` | `UI_PAGE_STATE_NODES.md`, `UI_PAGE_STATE_API.md`, `UI_PAGE_STATE_SUBMISSION.md`, `UI_PAGE_STATE_LIFECYCLE.md` |
| `UI_ACTION_SYSTEM.md` | `UI_ACTION_PAGE_ACTION.md`, `UI_ACTION_FAB_AND_BUTTONS.md`, `UI_ACTION_MULTI_RECORD.md`, `UI_ACTION_EXECUTION.md` |
| `UI_CREATE_AND_UPDATE_SYSTEM.md` | `UI_CREATE_AND_UPDATE_ANATOMY.md`, `UI_CREATE_AND_UPDATE_VISIBILITY.md`, `UI_CREATE_AND_UPDATE_CHILDREN.md`, `UI_FIELDS_REGISTRY_GUIDE.md` |
| `UI_PAGE_AND_SECTION_SYSTEM.md` | `UI_PAGE_AND_SECTION_RESOLVERS.md`, `UI_SECTION_AUTHORING.md`, `UI_SECTION_WIDGETS.md`, `UI_PAGE_AND_SECTION_OVERRIDES.md` |
| `UI_RESOURCE_DOMAIN_LOGIC.md` | `UI_RESOURCE_DOMAIN_BOUNDARIES.md`, `UI_RESOURCE_DOMAIN_PAYLOAD_CHAINS.md`, `UI_RESOURCE_DOMAIN_COMPOSITION.md` |
| `UI_LIST_SWITCHER.md` | `UI_LIST_SWITCHER_COMPONENTS.md`, `UI_LIST_SWITCHER_SHEET.md` |
| `UI_CONTENT_SYSTEM.md` | `UI_CONTENT_PAGE_SCHEMAS.md` |

## Non-Negotiable Frontend Pre-Read
**Before touching ANY file under `FRONTENT/` — regardless of scope, size, or perceived simplicity — you MUST read:**
- `Documents/CORE_ARCHITECTURE_RULES.md`

This applies to: bug fixes, one-line patches, component tweaks, composable changes, store edits, service changes, style adjustments — everything.
Small fixes are the most frequent source of layer violations (e.g. calling services directly in components, using `router.push()` instead of `useResourceNav`, placing business logic in pages).
**Do not skip this step even for trivial-seeming changes.**

## Non-Negotiable Reusable-Component Pre-Read
**Before creating or materially restructuring ANY component under `FRONTENT/src/components/{abstract,app,contents,sections}/`, you MUST read:**
- `Documents/UI_RENDERABLE_CONTRACT.md`

Every prop a caller might want to replace with their own markup has to route through `abstract/Renderable.js`. A prop interpolated directly into a template is closed to `_ui/` customization and forces tenants into a full `.vue` override — which swaps component identity, remounts the list, and kills row transitions. This applies to new components and to any change that adds a rendered cell to an existing one.

## Task Routing

### Discussion Only
Use when the task is brainstorming, clarification, tradeoff analysis, or high-level thinking.
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
- Read more only if the discussion needs specific evidence from a canonical doc.

### Planning Work
Use when the user asks for a plan or explicitly invokes Brain Agent behavior.
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - `PLANS/_TEMPLATE.md`
- Also read only the docs directly relevant to the task area.

### Execute A Named Plan
Use when Build Agent is asked to execute a plan.
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - the specific named plan file only
- Do not read all files in `PLANS/`.

### System Orientation & Baseline Architecture
Use when an overview of the architecture, stack, runtime direction, or system context is needed.
- Read:
  - `Documents/CORE_OVERVIEW.md`

### Frontend Implementation
Use when editing files under `FRONTENT/`.
- Read:
  - `Documents/CORE_ARCHITECTURE_RULES.md` — **mandatory, see Non-Negotiable Frontend Pre-Read above**
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - `Documents/SHARED_UTILITIES_INDEX.md` — **read before adding ANY new utility/helper/core function** (canonical catalogue; enforces the Reuse-First policy in `AGENTS.md`)
  - `Documents/UI_PAGE_STATE.md` — **MUST be used for any resource page that collects input or submits data** (centralized form-state composable: API prep, Content/Action section contract, response handling). Split: start at the hub, then `UI_PAGE_STATE_NODES.md` for the Node transport, `UI_PAGE_STATE_API.md` to read/write one, `UI_PAGE_STATE_SUBMISSION.md` for the batch and Layer 2 payload rules, `UI_PAGE_STATE_LIFECYCLE.md` for drafts and the `ready(ctx)` hook.
- Frontend work MUST comply with the Vue Reactivity Contract in `Documents/CORE_ARCHITECTURE_RULES.md`; manual synchronization that imitates Vue reactivity is a serious architecture violation.
- If the task affects reusable building blocks, also read/update:
  - `FRONTENT/src/components/REGISTRY.md`
  - `FRONTENT/src/composables/REGISTRY.md`
  - `FRONTENT/src/dashboard/REGISTRY.md` (if affecting dashboard widgets)
- If the task affects a documented module, also read only the relevant section of:
  - `Documents/WORKFLOW_OUTLET_OPERATIONS.md` (for retail outlets, visits, restocks, deliveries, invoicing, and payments)
  - `Documents/WORKFLOW_PROCUREMENT.md` (for product variants, POs, receiving, GRNs, and warehouse inventory)

### Frontend Architecture Planning & Refactoring
Use when defining architectural steps, planning refactors, or preparing frontend implementation tasks.
- Read:
  - `Documents/CORE_ARCHITECTURE_RULES.md`
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - task-specific module docs only when directly relevant

### Formal Frontend Architecture Review
Use ONLY when explicitly asked to perform a comprehensive code review against architecture rules (e.g., "Review the whole frontend code against rules"). This task is for analysis and reporting only.
- Read:
  - `Documents/CORE_ARCHITECTURE_RULES.md`
  - `Documents/CORE_ARCHITECTURE_REVIEW.md`
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)

### Full Resource UI Module Generation
Use when building, generating, or materially extending a whole resource UI module (Index + Add/Edit + View together) — not a single piece of an already-built module. Init prompt routing for this task type is owned by `AGENTS.md`'s Query Classification (Resource UI Module Generation takes precedence over single-category matching).
- Read:
  - `Documents/UI_MODULE_DEVELOPER_GUIDE.md` — **start here**: the hub — workflow-first build rule, the model in one picture, the generation checklist and troubleshooting. Its parts are canonical; open the one each step needs:
    - `UI_MODULE_DEVELOPER_FOLDERS.md` (§2) — folder layout, naming, resource-private sub-components
    - `UI_MODULE_DEVELOPER_LOOKUP.md` (§3–§4) — the 10-tier lookup and business-logic placement
    - `UI_MODULE_DEVELOPER_CONTRACTS.md` (§5–§6, §11–§12) — page contracts, import boundaries, reactivity, prop drilling
    - `UI_MODULE_DEVELOPER_LISTS.md` (§7) — list rows, row action clusters, the View card blueprint
    - `UI_MODULE_DEVELOPER_INDEX_PAGE.md` (§9) — the 4-stage Index hierarchy and its widgets
    - `UI_MODULE_DEVELOPER_ACTIONS.md` (§8) — action dispatch, handler contract, permission gates
    - `UI_MODULE_DEVELOPER_FORM_ARCH.md` (§13) — form shape, shared Add/Edit cards, wizard navigation
    - `UI_MODULE_DEVELOPER_VISUAL.md` (§10) — the visual design contract
  - `Documents/UI_RESOURCE_DOMAIN_LOGIC.md` — the three-layer architectural boundary (Core Infrastructure / `src/_resource/` domain logic / `_ui/` presentation). Split: `UI_RESOURCE_DOMAIN_BOUNDARIES.md` (§6–§8) for the one-way import chain and the injection-relay pattern, `UI_RESOURCE_DOMAIN_PAYLOAD_CHAINS.md` (§9) for cross-resource mutations and the canonical envelope, `UI_RESOURCE_DOMAIN_COMPOSITION.md` (§10) for the composition cascade
  - The three catalogues the guide links rather than restates — read the one the current step needs, and update it there rather than restating it in a module:
    - `FRONTENT/src/_fields/REGISTRY.md` — implemented field types, and the contract for mounting one by hand inside a workflow form
    - `FRONTENT/src/components/REGISTRY.md` — reusable Section/Content/app bases (Index widget bases, list renderers), their props and hide rules
    - `FRONTENT/src/_ui/{UiName}/_config/config.md` — that UI's design tokens and the reasoning behind each (default UI: `FRONTENT/src/_ui/AQL/_config/config.md`)
  - `Documents/SCHEMA_RESOURCE_COLUMNS.md` — `_fields`/`UIFields`/`Relations` schema
  - `Documents/UI_PAGE_STATE.md` — mandatory for any Add/Edit/wizard/action page (see its parts above; `UI_PAGE_STATE_NODES.md` and `UI_PAGE_STATE_LIFECYCLE.md` are the two a wizard always needs)
  - `Documents/UI_PAGE_AND_SECTION_SYSTEM.md`, `Documents/UI_CONTENT_SYSTEM.md`, `Documents/UI_ACTION_SYSTEM.md`, `Documents/UI_CREATE_AND_UPDATE_SYSTEM.md`, `Documents/UI_VIEW_SYSTEM.md` as the specific page being built requires

### Frontend Resource Customization & Single-Piece Overrides
Use when overriding or creating custom section or sub-components for any resource scope (master, operation, or Accounts) (e.g., custom record card, custom details view, custom form, custom button, custom child layout, custom loading/empty states).
- Read:
  - `Documents/UI_MODULE_DEVELOPER_GUIDE.md` — **read only the part your piece belongs to**: `UI_MODULE_DEVELOPER_FOLDERS.md` (§2 folder layout), `UI_MODULE_DEVELOPER_LOOKUP.md` (§3 10-tier lookup), `UI_MODULE_DEVELOPER_CONTRACTS.md` (§5 page contracts & `Props<Identity>`), `UI_MODULE_DEVELOPER_LISTS.md` (§7 content/View blueprints), `UI_MODULE_DEVELOPER_ACTIONS.md` (§8 actions), `UI_MODULE_DEVELOPER_VISUAL.md` (§10 visual contract).
  - `Documents/UI_PAGE_AND_SECTION_SYSTEM.md` — when customizing Sections / page chrome. Split: `UI_PAGE_AND_SECTION_RESOLVERS.md` (§1.3–§1.5) for the resolvers and targeted props, `UI_SECTION_AUTHORING.md` (§2.1–§2.3) to write a new Section, `UI_SECTION_WIDGETS.md` (§2.4–§2.8) for the built-in metric sections, `UI_PAGE_AND_SECTION_OVERRIDES.md` (§3) for overrides
  - `Documents/UI_CONTENT_SYSTEM.md` — when customizing page body / List contents; `UI_CONTENT_PAGE_SCHEMAS.md` (§5–§6) for the View/Add/Edit/Action JS-modifier schemas and the content-atomicity rule
  - `Documents/UI_VIEW_SYSTEM.md` — when customizing View content (parent/child/column overrides, scope rules, JS modifier API)
  - `Documents/UI_CREATE_AND_UPDATE_SYSTEM.md` — when customizing Create/Update content. Split: `UI_CREATE_AND_UPDATE_ANATOMY.md` (§3) for the prop tables, `UI_CREATE_AND_UPDATE_VISIBILITY.md` (§4–§7) for visibility precedence, defaults and `fieldProps`, `UI_CREATE_AND_UPDATE_CHILDREN.md` (§8–§14) for child entry modes, Update hydration and soft-deletion, `UI_FIELDS_REGISTRY_GUIDE.md` (§15) for the `_fields/` subsystem
  - `Documents/UI_ACTION_SYSTEM.md` — when modifying buttons, FABs, or sticky actions bar; see its parts below

### Utility Function Discovery & New Helper Creation
Use when looking for an existing helper, deciding where a new utility belongs, or adding any new utility/helper/core function across Layer 1, Layer 2, or Layer 3.
- Read:
  - `Documents/SHARED_UTILITIES_INDEX.md` — **canonical catalogue of every shared utility, helper, and core composable**, with per-function purpose, purity, and reuse/extend guidance. This is the first stop before writing any new helper.
  - `AGENTS.md` → **Reuse First & Anti-Duplication Policy (STRICT)** — mandatory search-before-create rule and the required Exhaustion Quote.
- Prefer extending an existing utility file (see the Extension Cheat-Sheet in the index) over creating a new file.

### Reusable Render Component Creation
Use when creating or restructuring a component under `FRONTENT/src/components/{abstract,app,contents,sections}/` — a new Section, a new content component, a new list/table/card primitive, or an app-level wrapper.
- Read:
  - `Documents/UI_RENDERABLE_CONTRACT.md` — **mandatory, see Non-Negotiable Reusable-Component Pre-Read above**
  - `Documents/CORE_ARCHITECTURE_RULES.md`
- Also read the domain doc for whatever subsystem the component belongs to (Content, Page & Section, Action).

### List Switcher Customization
Use when overriding or creating custom container or item layouts, template overrides, or dynamic modifiers for the list view switcher bar.
- Read:
  - `Documents/UI_LIST_SWITCHER.md` — hub: core architecture, overrides and responsive rules. `UI_LIST_SWITCHER_COMPONENTS.md` (§4) for the component catalog, `UI_LIST_SWITCHER_SHEET.md` (§5) for `App.Resources.ListViews` schema, filters and tokens

### Action & FAB Customization
Use when overriding or creating custom action components, floating action buttons (FABs), workflow buttons, cancel/submit/reset form actions, the sticky form actions bar, the submission lifecycle, or workflow dialogs.
- Read:
  - `Documents/UI_ACTION_SYSTEM.md` — **canonical hub**: architectural overview and the resolution sequence. Its parts:
    - `UI_ACTION_PAGE_ACTION.md` (§3.1–§3.2) — `PageAction.vue` submission lifecycle, `FormActions` `actions` array
    - `UI_ACTION_FAB_AND_BUTTONS.md` (§3.3–§3.5, §4) — button components, `ResourceActions` FAB cluster, `ResourceReports`, tenant override cookbook
    - `UI_ACTION_MULTI_RECORD.md` (§7.0–§7.4) — `AdditionalActions.targets[]` config shape and expression grammar
    - `UI_ACTION_EXECUTION.md` (§7.5–§7.7) — execution/security model, response reactivity, embedding a trigger

### Backend Design
Use when designing new backend behavior, evaluating options, or checking whether existing GAS capabilities already support the request.
- Read:
  - `Documents/GAS_API_CAPABILITIES.md`
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md) only if the task is moving beyond discussion into planning/building.

### Backend Implementation
Use when editing GAS code.
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - `Documents/GAS_API_CAPABILITIES.md`
  - `Documents/GAS_PATTERNS.md`
- Prefer existing GAS files and patterns first.
- Create a new GAS file only when the current structure cannot support the task cleanly.

### Module-Specific Work
Use when a documented business module is involved.
- Read:
  - `Documents/WORKFLOW_OUTLET_OPERATIONS.md` — when working on retail stores, visits, restocks, deliveries, invoicing, or payments.
  - `Documents/WORKFLOW_PROCUREMENT.md` — when working on product variants, RFQs, POs, receiving inspections, GRNs, or warehouse stock.
  - `Documents/FEATURE_REPORTS_SYSTEM.md` — when working on reports generation or printable sheets.
- Also read task-specific docs from this router as needed.

### Resource Metadata Or Sheet Schema Changes
Use when changing `APP.Resources`, resource columns, sheet structure, or setup/sync behavior.
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - `Documents/SCHEMA_RESOURCE_COLUMNS.md`
- Also read the relevant structure doc section if needed.

### Menu Action Changes (Sheet Menu)
Use when adding, removing, renaming, or behavior-changing `AQL 🚀` sheet menu actions (the Google Sheets toolbar menu).
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - `Documents/SHEET_TOOLBAR_MENU_GUIDE.md`

### Sidebar Menu Configuration (Frontend)
Use when adding, removing, reordering, or changing permission gates for the web application's sidebar menu (Menu JSON in `APP.Resources`).
- Read:
  - `Documents/UI_SIDEBAR_MENU_SYSTEM.md` — **single canonical doc** covering schema, data flow, permission gating, tree building, route guard, and admin operation
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)

### Login Payload Or Auth Response Changes
Use when changing `handleLogin()` response shape, field sources, or frontend storage of login data.
- Read:
  - [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md)
  - `Documents/API_LOGIN_RESPONSE.md`

### Dashboard Implementation
Use when implementing or customizing dashboard modules, widgets, composables, or layout grids.
- Read:
  - `Documents/FEATURE_DASHBOARD_GUIDE.md`

### Tax System Design & Configuration
Use when customizing tax columns, calculating wholesale values, or modifying compound tax logic.
- Read:
  - `Documents/FEATURE_TAX_SYSTEM.md`

### Multi-Tenant System & Onboarding
Use when working with tenant routing, Master Apps Script configurations, select tenant forms, or generating a new client/tenant instance.
- Read:
  - `Documents/TENANT_SYSTEM.md`
  - `Documents/TENANT_NEW_CLIENT_SETUP.md`

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
  - [FEATURE_REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_REPORTS_SYSTEM.md) (specifically Section 2 and 3)

## Maintenance Rule
Update this file when any of the following changes:
- a new recurring task type is introduced
- a canonical reference doc is added, removed, or renamed
- a new shared utility/helper file or function is introduced (keep `Documents/SHARED_UTILITIES_INDEX.md` and `AGENTS.md` Reuse-First policy in sync)
- routing guidance changes for planning, build, backend, frontend, auth, menu, sidebar, or resume workflows
- mandatory-read rules for specific task categories change
- the Non-Negotiable Frontend Pre-Read list changes (e.g. a new always-read doc is added for frontend work)
- the Non-Negotiable Reusable-Component Pre-Read list changes, or the `Renderable` contract's folder scope changes
- a canonical doc is SPLIT, or a part is added/renamed/merged — update the Split Canonical Docs table above AND the routing entry that names that hub, so the entry points at the part holding the section, not just at the hub
- sidebar menu routing or permission-evaluation rules change materially
