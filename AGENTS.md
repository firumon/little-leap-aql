# AQL Startup & Context Routing

## Purpose
- This is the startup file for repository-aware agents and Claude sessions in this repo.
- Keep this file lean. Use canonical docs for detailed policy.

## Startup Sequence
- Read this file.
- Run **Query Classification** (below) to classify the request.
- Load only the matching initialization prompt(s) from [Initialization Prompt Routing](#initialization-prompt-routing).

## Query Classification (Run Before Loading Prompts)

Classify the user's request into one of these three categories:

| Category | Rule | Action |
|----------|------|--------|
| **Single-category match** | The query maps cleanly to exactly ONE routing category below | Load ONLY that one init prompt. Do NOT load related prompts speculatively — the prompt itself tells you what codebase files to read. |
| **Multi-category match** | The query explicitly spans multiple distinct domains (e.g., "add a database column AND update the frontend form AND add a menu entry") | Load ONLY the prompts that match the explicit scope. Do NOT load transitive dependencies (e.g., don't load schema + frontend + backend if only schema + frontend are needed). |
| **Unclear / Concept Search** | The query doesn't fit any category, is a general investigation, or you need to locate a specific codebase feature/layout/file | Load [general_query.md] and FIRST read [CODEBASE_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/References/CODEBASE_INDEX.md) to locate the relevant files/docs before reading other codebase files. |

When in doubt, prefer single-prompt loading. Each init prompt has a **Scope Boundary** header that defines its domain — respect it.

## Initialization Prompt Routing

After classifying the query, read the appropriate initialization document(s) from [References/Prompt Library/Initialization/](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/) based on your classification above:
* **Database Schema Alteration**: Read [database_schema_alteration.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/database_schema_alteration.md) (covers sheet setups, metadata config, view/report scans, and clasp sync instructions).
* **Frontend Modification**: Read [frontend_modification.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/frontend_modification.md) (covers Quasar/Vue 3 boundaries, store wrappers, reactivity limits, and local testing).
* **Frontend Page & Component Customization**: Read [page_and_sections_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_sections_customization.md) (covers 4-part layout contract, dynamic section resolution, page-isolated directories, and flat resource override pathways).
* **Sidebar Menu & Access Control**: Read [frontend_menu_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/frontend_menu_system.md) (single init prompt covering Menu JSON schema, data flow, permission gating, tree building, route guard, and admin operations — backed by canonical doc at [AQL_FRONTEND_MENU_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_FRONTEND_MENU_SYSTEM.md)).
* **Report Template & Aggregations**: Read [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md) (covers printable headers, LAMBDA row functions, and virtual array calculations).
* **Report UI & Feature Development**: Read [report_ui_development.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_ui_development.md) (covers frontend ResourceReports component, useReports composable, ReportInputDialog, and Apps Script Manage Reports menu dialogue).
* **Writing/Editing Plans**: Read [plan_writing.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/plan_writing.md) (only if the user explicitly asks to write, edit, or create an implementation plan).
* **Git Actions (Commit, Push)**: Read [git_operations.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/git_operations.md).
* **General Investigatory Query**: Read [general_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/general_query.md). Use this for any general investigatory queries that do not contain project-specific or repository-specific phrasing.
* **AQL-Specific Codebase Investigation**: Read [codebase_investigation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/codebase_investigation.md) (covers systematic discovery, domain-to-doc mapping, data flow tracing, and response standards). Use this if the query contains repository/project-specific references or phrases (e.g., "in AQL", "in this project", "in this app", "our app", "our project", or "this AQL").
* **Dashboard Implementation**: Read [dashboard_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/dashboard_implementation.md) (covers widget config contracts, declarative pipelines, SVG widget creation, and dashboard registries).
* **Backend GAS Implementation**: Read [backend_gas_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/backend_gas_implementation.md) (covers generic CRUD, post-write hooks, batch operations, and Apps Script patterns).
* **Tax / Currency System Changes**: Read [tax_currency_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/tax_currency_system.md) (covers compound tax logic, currency helpers, tax-inclusive/exclusive pricing, and tax transaction storage).
* **Sheet Views / Reports Formulation**: Read [sheet_views_formulation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/sheet_views_formulation.md) for View formulas, or [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md) for Report template formulas.
* **Prompt & Instruction Creation**: Read [create_prompt_instruction.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/create_prompt_instruction.md) (covers exhaustive codebase discovery and output structure for generating new initialization prompts).
* **API Related Query**: Read [api_related_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/api_related_query.md) (covers backend request routing in GAS, request/response envelopes, batching, composite saves, and post-write hooks).
* **Multi-Tenant System, Routing & New Client Setup**: Read [multi_tenant_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/multi_tenant_system.md) (covers folder setup, automated client generation, central TENANTS spreadsheet, Master Apps Script router project, SelectTenantPage onboarding flow, and browser cache/cleansing mechanics).
* **AQL Sheet Menu Actions & Setup Scripts**: Read [sheet_menu_actions.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/sheet_menu_actions.md) (covers custom Sheet Menu `AQL 🚀` actions, admin forms/dialogs, callbacks, and setup/refactor scripts).
* **Header Customization & Overrides**: Read [header_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/header_customization.md) (covers dynamic local header overrides, script-only configurations, custom template wrappers, and history-aware back/reload actions).


> [!IMPORTANT]
> **Single-category rule**: If the query maps cleanly to exactly ONE routing category above, load ONLY that one initialization prompt. Do NOT load related prompts speculatively — the prompt itself tells you what codebase files to read.
>
> **Multi-category rule**: Only when the query explicitly spans multiple domains (e.g., database schema alteration + frontend modification + menu updates) should you load multiple prompts. Load only the matching prompts — do NOT load transitive dependencies.

> [!NOTE]
> If the user's request doesn't cleanly match any category above, consult [DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/DOC_ROUTING.md) to identify the correct canonical documents for the task.

## Repo-Local Skills
- Skills are task adapters, not policy sources.
- `aql-expert` remains relevant for AQL domain work across frontend, GAS, sheet metadata, resources, permissions, and workflows.
- `aql-frontend-design` remains relevant for AQL-specific Quasar UI design, prototypes, and frontend visual refinement.
- `aql-coding-patterns` remains relevant for maintaining strict and consistent code formatting, syntax (ES6+ in JS, hybrid in GAS/Vue), HTML/Vue template attribute groups, and layout styling across the codebase.
- These skills must defer to this file, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md` for role boundaries, required reads, and implementation rules.
- If a skill conflicts with canonical docs, follow the canonical docs and update the skill.

## Implementation Notes
- Keep docs, code, and sheets aligned only when the task modifies them.
- For frontend edits, keep pages thin when the task materially changes page structure and update frontend registries only when reusable interfaces change.
- **Before touching any file under `FRONTENT/`, read `Documents/ARCHITECTURE RULES.md` without exception — this includes small fixes, one-liners, and style tweaks. Layer violations most often enter through minor edits.**
- For backend edits, prefer existing GAS files and patterns first. Create a new GAS file only when the current structure cannot support the task cleanly.
- If GAS files change, run `npm run gas:push` from the repo root or `cd GAS && clasp push`.

## Verification
- Do not run broad verification by default.
- Prefer targeted checks.
- Run `npm run build` for frontend only when the change is major or cross-cutting, typically around 10 or more touched files or equivalent risk.

## Maintenance Rule
- Update this file when startup behavior, default reading expectations, role invocation, deployment expectations, or canonical startup references change.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **little-leap-aql** (9681 symbols, 16191 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
