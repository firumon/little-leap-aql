# AQL Startup & Context Routing

## Purpose
- This is the startup file for repository-aware agents and Claude sessions in this repo.
- Keep this file lean. Use canonical docs for detailed policy.

### System Knowledge (`Documents/`) vs. Agent Execution Prompts (`References/Prompt Library/`)
- **`Documents/` (Humans & AI Agents)**: Canonical architecture specifications, data schemas, domain workflows, and system rules. Both humans and AI agents read these files to understand how the system works.
- **`References/Prompt Library/Initialization/` (AI Agents Only)**: Machine-optimized, task-specific procedural prompts and checklists. These instruct the AI agent on how to completely execute a specific task or workflow.

## Language and Communication Rule (STRICT)
- Always speak and write in very simple, easy English.
- Write like a lower primary school story book.
- Use short sentences.
- Use small, everyday words.
- Do not use big, fancy, or confusing words.
- Do not use double-meaning sentences or hard grammar.
- Keep everything direct, clear, and very easy to understand.

## Strict Truthfulness & Evidence-First Rule (STRICT)
- Never speak from memory, assumptions, or guesses.
- Never claim a feature exists without verifying it directly in the codebase or canonical docs first.
- Every statement must be precise, accurate, and backed by direct evidence (file paths and line numbers).
- Do not speak on behalf of AQL, the user, or any system element.
- If a feature, function, or rule does not exist in the code, state clearly and plainly that it is missing or not implemented yet.

## Startup Sequence
- Read this file.
- **Protocol check first**:
  - If the request mentions **MACP**, the Multi-Agent Collaborative Protocol, the Architect/Builder relay workflow, or asks you to act as the **Architect Agent**, read [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md) in full before anything else and operate under that protocol for the rest of the session.
  - If the request explicitly invokes an AQL role mode (**Guide**, **Solo**, **Brain**, or **Build**), read [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md) and execute the corresponding role handshake:
    - **Guide / Solo**: Ask directly what task/activity is being discussed or implemented.
    - **Brain**: Prompt for the Building Agent's Capability Tier (High, Medium, Low) first, then prompt for the task to plan.
    - **Build**: Prompt for the plan file under `PLANS/` to execute.
- Run **Query Classification** (below) to classify the request.
- Load only the matching initialization prompt(s) from [Initialization Prompt Routing](#initialization-prompt-routing).

## Query Classification (Run Before Loading Prompts)

Classify the user's request into one of these categories:

| Category | Rule | Action |
|----------|------|--------|
| **MACP / Protocol Session (takes precedence)** | The query mentions MACP, role modes (Guide, Brain, Build, Solo), or asks you to act under a specific protocol | Read [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md) or [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md) and follow its handshake and execution boundaries. |
| **Resource UI Module Generation / 3-Layer UI (takes precedence over Single-category)** | The query — a task, an implementation plan, an update, or anything else — asks to build, generate, create, extend, or change a resource's UI/module/interface under the **3-Layer UI Architecture** — e.g. "build the X module UI", "3-layer UI for Y", "add a new resource UI for Y", "make the Add/Edit/View pages for Z", "add a list for W" | Load [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) FIRST, always, for any resource-UI-touching request — do not pre-filter by whether the task looks like a whole module or a single piece. The prompt's own Step 0 analyzes the nature of the request (full module, one page/piece only, dashboard-sounding, list-only, or unclear) and determines whether to proceed under it, hand off to a narrower domain prompt, or ask the user a clarifying question first. |
| **Single-category match** | The query maps cleanly to exactly ONE routing category below | Load ONLY that one init prompt. Do NOT load related prompts speculatively — the prompt itself tells you what codebase files to read. |
| **Multi-category match** | The query explicitly spans multiple distinct domains (e.g., "add a database column AND update the frontend form AND add a menu entry") | Load ONLY the prompts that match the explicit scope. Do NOT load transitive dependencies (e.g., don't load schema + frontend + backend if only schema + frontend are needed). |
| **Unclear / Concept Search** | The query doesn't fit any category, is a general investigation, or you need to locate a specific codebase feature/layout/file | Load [general_query.md] and FIRST read [CODEBASE_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/References/CODEBASE_INDEX.md) to locate the relevant files/docs before reading other codebase files. |

When in doubt, prefer single-prompt loading. Each init prompt has a **Scope Boundary** header that defines its domain — respect it.

> [!IMPORTANT]
> **Additive prompt — the one exception to single-category loading.** If the task creates or materially restructures a component under `FRONTENT/src/components/{abstract,app,contents,sections}/`, ALSO load [renderable_contract.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/renderable_contract.md) on top of the matching domain prompt. Skipping it produces components that are closed to `_ui/` customization and force every tenant into a full `.vue` override.

## Initialization Prompt Routing

After classifying the query, read the appropriate initialization document(s) from [References/Prompt Library/Initialization/](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/) based on your classification above:
* **Resource UI Module Generation / 3-Layer UI**: Read [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) (machine-optimized, step-by-step: classify maturity tier, scaffold the `src/_resource/` domain layer (Layer 2) FIRST, scaffold the injection-relay UI Composable, then build Index/Add/Edit/View under `src/_ui/` (Layer 3) per the strict 3-Layer UI import boundary — backed by canonical specs [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md) and [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md)). Always load this first for any request to build/generate/extend a resource's UI — its own Scope Boundary hands off to a narrower prompt below if the task turns out to be single-piece.
* **Database Schema Alteration**: Read [database_schema_alteration.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/database_schema_alteration.md) (covers sheet setups, metadata config, view/report scans, and clasp sync instructions).
* **Frontend Modification**: Read [frontend_modification.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/frontend_modification.md) (covers Quasar/Vue 3 boundaries, store wrappers, reactivity limits, and local testing).
* **Page & Section Customization & Creation**: Read [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md) (covers the dynamic Page & Section architecture, resolver lookups, page-level form state, creating new Section components with function-based prop evaluation, and override/modifier implementation).
* **Sidebar Menu & Access Control**: Read [frontend_menu_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/frontend_menu_system.md) (single init prompt covering Menu JSON schema, data flow, permission gating, tree building, route guard, and admin operation — backed by canonical doc at [UI_SIDEBAR_MENU_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_SIDEBAR_MENU_SYSTEM.md)).
* **Report Template & Aggregations**: Read [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md) (covers printable headers, LAMBDA row functions, and virtual array calculations).
* **Report UI & Feature Development**: Read [report_ui_development.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_ui_development.md) (covers frontend ResourceReports component, useReports composable, ReportInputDialog, and Apps Script Manage Reports menu dialogue).
* **Writing/Editing Plans**: Read [plan_writing.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/plan_writing.md) (only if the user explicitly asks to write, edit, or create an implementation plan).
* **Git Actions (Commit, Push)**: Read [git_operations.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/git_operations.md).
* **General Investigatory Query**: Read [general_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/general_query.md). Use this for any general investigatory queries that do not contain project-specific or repository-specific phrasing.
* **AQL-Specific Codebase Investigation**: Read [codebase_investigation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/codebase_investigation.md) (covers systematic discovery, domain-to-doc mapping, data flow tracing, and response standards). Use this if the query contains repository/project-specific references or phrases (e.g., "in AQL", "in this project", "in this app", "our app", "our project", or "this AQL").
* **Dashboard Implementation**: Read [dashboard_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/dashboard_implementation.md) (covers widget config contracts, declarative pipelines, SVG widget creation, and dashboard registries).
* **Backend GAS Implementation**: Read [backend_gas_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/backend_gas_implementation.md) (covers generic CRUD, post-write hooks, batch operation, and Apps Script patterns).
* **Tax / Currency System Changes**: Read [tax_currency_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/tax_currency_system.md) (covers compound tax logic, currency helpers, tax-inclusive/exclusive pricing, and tax transaction storage).
* **Sheet Views / Reports Formulation**: Read [sheet_views_formulation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/sheet_views_formulation.md) for View formulas, or [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md) for Report template formulas.
* **Prompt & Instruction Creation**: Read [create_prompt_instruction.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/create_prompt_instruction.md) (covers exhaustive codebase discovery and output structure for generating new initialization prompts).
* **API Related Query**: Read [api_related_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/api_related_query.md) (covers backend request routing in GAS, request/response envelopes, batching, composite saves, and post-write hooks).
* **Multi-Tenant System, Routing & New Client Setup**: Read [multi_tenant_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/multi_tenant_system.md) (covers folder setup, automated client generation, central TENANTS spreadsheet, Master Apps Script router project, SelectTenantPage onboarding flow, and browser cache/cleansing mechanics).
* **AQL Sheet Menu Actions & Setup Scripts**: Read [sheet_menu_actions.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/sheet_menu_actions.md) (covers custom Sheet Menu `AQL 🚀` actions, admin forms/dialogs, callbacks, and setup/refactor scripts).
* **Header Customization & Overrides**: Read [header_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/header_customization.md) (covers dynamic local header overrides, JS logic modifiers, custom template wrappers, and history-aware back/reload actions).
* **List Switcher Customization**: Read [list_switcher_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/list_switcher_customization.md) (covers container/item template overrides, dynamic modifiers, and responsive properties). Use this for the switcher's **visual layout**; for the filter/token logic behind the views, use the entry below instead.
* **List View Filters & Dynamic Tokens**: Read [list_view_tokens.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/list_view_tokens.md) (covers the `APP.Resources.ListViews` filter tree, comparison operators, and the date/time + current-user token system — `$startOfMonth`, `$daysIn:7`, `$userRoles`. Includes the two-sided coercion contract, the mandatory `tokenEvaluator.js` ↔ `GAS/listViewsManager.html` sync rule, settled invariants, and the esbuild verification harness). Use this whenever a token is added, renamed, or re-specced, or when filter/operator evaluation changes.
* **Content Page & Form Customization**: Read [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md) (covers the `contents:` page contract, `Content.vue`/`useContentResolver.js` resolution, the built-in `List` content component, `useListStrategy.js` defaults, per-active-view `List<ViewName>` overrides, form/details sections, and template vs JS logic modifiers).
* **Create & Update Content & Child Entry Customization**: Read [content_create_and_update_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_create_and_update_customization.md) (routing/implementation rules for the `Create` **and** `Update` content systems), which points to the canonical spec [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) (covers `Create.vue`/`Update.vue`/`FormRecord.vue`/`FormChild.vue` full prop tables, the `showFields`/`hideFields`/`workflowFields` visibility precedence chain, `defaultValues`/`fieldProps` function resolution, `inline`/`popup`/`multi` child entry modes, `Update.vue`'s hydration lifecycle (`pageState.load`, `node.identifier` reset detection, existing-child pre-population), `FormChild`'s `_action: 'deactivate'` soft-delete + undo contract, and `create.vue`/`create.js` / `update.vue`/`update.js` override paths).
* **View Content Customization**: Read [view_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/view_customization.md) (covers parent/child/column override paths in custom UI, JS modifier function/object APIs, Vue SFC override props, and naming conventions).
* **Reusable Render Component Creation (`abstract/`, `app/`, `contents/`, `sections/`)**: Read [renderable_contract.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/renderable_contract.md) (governs the **prop surface** of any new or restructured reusable render component: which props are slot-shaped, routing them through `abstract/Renderable.js`, the `[String, Function, Object]` widening rule across the forwarding chain, and the contract for components passed as prop values — backed by canonical spec [UI_RENDERABLE_CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RENDERABLE_CONTRACT.md)). **This prompt is ADDITIVE** — load it *alongside* the matching domain prompt (Content, Page & Section, Action, …) whenever the task creates or materially restructures a component under those four folders. It is the one exception to the single-category rule.
* **Action & FAB Customization**: Read [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md) (routing/implementation rules for the **Action Subsystem**), which points to the canonical spec [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md) (covers `Action.vue`/`useActionResolver.js`, the `components/actions/` folder, the 10-tier action lookup, the configurable `FormActions` `actions` array with `FormActionSubmit`/`FormActionReset`/`FormActionCancel`, the unified `ResourceActions` FAB cluster (CRUD + `AdditionalActions` workflow items, per-item `ResourceAction<Name>` overrides), the `PageAction` submission lifecycle hooks, and the disable-plus-overlay loading contract).

> [!IMPORTANT]
> **Single-category rule**: If the query maps cleanly to exactly ONE routing category above, load ONLY that one initialization prompt. Do NOT load related prompts speculatively — the prompt itself tells you what codebase files to read.
>
> **Multi-category rule**: Only when the query explicitly spans multiple domains (e.g., database schema alteration + frontend modification + menu updates) should you load multiple prompts. Load only the matching prompts — do NOT load transitive dependencies.

> [!NOTE]
> If the user's request doesn't cleanly match any category above, consult [CORE_DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_DOC_ROUTING.md) to identify the correct canonical documents for the task.

## Multi-Agent Collaboration Frameworks

- **Multi-Agent Collaborative Protocol (MACP)**: Canonical doc at [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md).
- **AQL Multi-Agent Protocol (Guide, Solo, Brain, Build)**: Canonical doc at [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md).
- Protocol rules govern conversation and execution flow. Repository knowledge comes from Query Classification and the initialization prompts above.

## Repo-Local Skills
- Skills are task adapters, not policy sources.
- `aql-expert` remains relevant for AQL domain work across frontend, GAS, sheet metadata, resources, permissions, and workflows.
- `aql-frontend-design` remains relevant for AQL-specific Quasar UI design, prototypes, and frontend visual refinement.
- `aql-coding-patterns` remains relevant for maintaining strict and consistent code formatting, syntax (ES6+ in JS, hybrid in GAS/Vue), HTML/Vue template attribute groups, and layout styling across the codebase.
- These skills must defer to this file, `References/Prompt Library/MAP.md`, and `Documents/CORE_DOC_ROUTING.md` for role boundaries, required reads, and implementation rules.
- If a skill conflicts with canonical docs, follow the canonical docs and update the skill.

## Implementation Notes
- Keep docs, code, and sheets aligned only when the task modifies them.
- For frontend edits, keep pages thin when the task materially changes page structure and update frontend registries only when reusable interfaces change.
- **Before touching any file under `FRONTENT/`, read `Documents/CORE_ARCHITECTURE_RULES.md` without exception — this includes small fixes, one-liners, and style tweaks. Layer violations most often enter through minor edits.**
- For backend edits, prefer existing GAS files and patterns first. Create a new GAS file only when the current structure cannot support the task cleanly.
- **Layer 2 returns the Unified Node Transport Structure, always.** Every function exported from `FRONTENT/src/_resource/` and consumed across a layer boundary returns a **pure Node Object, or an array of Node Objects** — single-node builders included. A Node carries its own `record`/`children`/`records`, `controls`, `actions`, `derive`, `permissions` (`{ action: 'message shown when denied' }`), `reload` and optional `successMsg`/`outcome`. There is no envelope and no constructor module: `nodePayloads.js` was deleted, `resourceRow` lives in `FRONTENT/src/composables/resources/useResourceConfig.js`, and builders combine with plain array spread. A builder that cannot build returns `[{ valid: false, message }]`. Layer 3 does NOT pre-check validity or permissions — it calls `pageState.applyNodes(nodes)`, returns `false` when `applied.valid === false`, and reports `applied.successMsg`. Row helpers that return a bare sheet row are the only exception. Full specification: `Documents/UI_PAGE_STATE.md` §5; see also `Documents/UI_RESOURCE_DOMAIN_LOGIC.md` §9.1–§9.3.

## Reuse First & Anti-Duplication Policy (STRICT)
- **Never create a new utility, helper, or core function without first checking existing implementations.** Before adding any new utility, helper function, core method, or file across Layer 1 (Core Infrastructure), Layer 2 (`src/_resource/` domain logic), or Layer 3 (`src/_ui/` presentation), you MUST inspect what already exists.
- **Check the canonical index first**: Read [Documents/SHARED_UTILITIES_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHARED_UTILITIES_INDEX.md) and the relevant files under `FRONTENT/src/utils/`, `FRONTENT/src/composables/`, and `FRONTENT/src/_resource/` to confirm no existing helper already covers the capability.
- **Prefer extension over new files**: When a missing capability is closely related to an existing utility (e.g. a new date calculation, a new string transform, a new payload builder), add a clean, pure function to the existing utility file rather than creating a new file. Concrete homes:
  - String / object transforms → `FRONTENT/src/utils/appHelpers.js`
  - Date / time ops → `FRONTENT/src/utils/dateHelpers.js`
  - Colors / visual → `FRONTENT/src/utils/colorHelpers.js`
  - Sorting / tokens → `FRONTENT/src/utils/sortHelpers.js`, `FRONTENT/src/utils/tokenEvaluator.js`
  - Workflow / audit stamps → `FRONTENT/src/utils/workflowStamp.js`
  - Sheet-row shaping / resource schema / permission checks → `FRONTENT/src/composables/resources/useResourceConfig.js`
- **Mandatory Exhaustion Quote**: When an agent DOES create a new helper function or file, it MUST explicitly cite in its output:
  > *"Checked existing utilities in [list of files / SHARED_UTILITIES_INDEX.md] and confirmed no existing helper accomplishes <function/feature>. Adding/extending <function_name> in <file_path> because <specific rationale>."*

## Single Domain Source of Truth Policy (STRICT)
- **Every resource domain (`src/_resource/{Scope}/{Resource}/`) MUST have exactly ONE calculation path for each domain concept.**
- **Never create a second function for a new task or workflow**: When a new task requires building a node, calculating progress, or formatting rows, you MUST route through the existing row/node builder (`<resource>ItemRow`, `<resource>Node`, `derive<Resource>Progress`).
- **If a new task has slightly different inputs or flags**, generalize and extend the existing builder with options — DO NOT write a parallel function (`build<Task>Nodes`, `custom<Task>Fields`) that duplicates the domain arithmetic or stamps.
- **Rule of One**:
    - Exactly ONE function that calculates item-level progress and stamps (`<resource>ItemRow`).
    - Exactly ONE function that calculates parent-level progress and stamps (`derive<Resource>Progress` / `<resource>Node`).
    - All workflows (standalone create, wizard submission, chained create) MUST call that ONE engine.

## Remote Updates & External Sync Policy (STRICT)
- **Do not update remote files, repositories, or services automatically.**
- Any action that modifies files or state outside the local file system is restricted. This includes:
  - `gas:push` / `clasp push` (deploying to Google Apps Script)
  - `git push` (updating remote git repository)
  - Cloud deploys, remote uploads, or external sync scripts.
- **Allowed ONLY when explicitly requested by the user.**
- **Mandatory User-Quote Requirement:** Whenever performing any remote update action, the agent MUST explicitly quote or cite the exact statement where the user asked for this action (e.g. *"Performing GAS push because you explicitly requested: '<exact user quote>' "*).

## Verification
- Do not run broad verification by default.
- Prefer targeted checks.
- Run `npm run build` for frontend only when the change is major or cross-cutting, typically around 10 or more touched files or equivalent risk.

## Documentation Gap & Self-Healing Rule (STRICT)
- When a bug, missed parallel update, or execution failure happens because a document or prompt lacked required instructions or dependency steps:
  1. **Identify the Gap**: Find which canonical doc (`Documents/`) or initialization prompt (`References/Prompt Library/Initialization/`) missed the rule.
  2. **Notify the User**: Explain the documentation gap clearly in simple words.
  3. **Ask Permission**: Ask the user for permission to update the affected documents and prompts immediately.
  4. **Update & Prevent**: Once approved, update the docs and prompts so future developers and AI agents do not repeat the mistake.

## Maintenance Rule
- Update this file when startup behavior, default reading expectations, role invocation, deployment expectations, or canonical startup references change.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **little-leap-aql** (14531 symbols, 23540 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/little-leap-aql/context` | Codebase overview, check index freshness |
| `gitnexus://repo/little-leap-aql/clusters` | All functional areas |
| `gitnexus://repo/little-leap-aql/processes` | All execution flows |
| `gitnexus://repo/little-leap-aql/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
