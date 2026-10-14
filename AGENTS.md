# AQL Startup & Context Routing

## Purpose
- This is the startup file for AI agents in this repo.
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

## Code Comments — Keep Them Rare (STRICT)
Write code that explains itself. Do not narrate it.
- **Default: no comment.** No JSDoc blocks, no file-header docblocks, no section banners.
- When truly warranted: **1 line, 2 at the very most.** Never a paragraph.
- Clean up as you go: delete long comments and docblocks in files you edit.
- **One exception**: Data files (DJS) and dashboard items (DBI) require a descriptive JSDoc block.
- Full specification: [CORE_ARCHITECTURE_RULES.md §8](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md).

## Strict Truthfulness & Evidence-First Rule (STRICT)
- Never speak from memory, assumptions, or guesses.
- Never claim a feature exists without verifying it directly in the codebase or canonical docs first.
- Every statement must be precise, accurate, and backed by direct evidence (file paths and line numbers).
- Do not speak on behalf of AQL, the user, or any system element.
- If a feature, function, or rule does not exist in the code, state clearly and plainly that it is missing or not implemented yet.

## Quasar MCP Documentation Rule (STRICT)
- Always use the Quasar MCP server (`quasar`) to get answers for any Quasar-related queries and implementations (components, props, slots, events, methods, directives, plugins, configs).
- Never guess Quasar APIs or search the web when the local Quasar MCP server can answer directly from the installed packages.

## UI Screen Symmetry Rule (STRICT)
- When writing code for UI or screen display elements, always follow similar existing pages, patterns, and code.
- Keep the exact same look, feel, and layout everywhere in the app.
- All pages must have symmetry.
- A design on one page that differs from another page is not supported at all.

## Feature Implementation & Source of Truth Rule (STRICT)
- **Docs First**: Always read the canonical documentation for that feature first.
- **Core Feature Engine Next**: Next, read the core codebase of the feature itself (for example, `FRONTENT/src/composables/resources/pageState/`).
- **Never Copy Other Implementations**: Do NOT copy code or patterns from other resource pages. Write fresh code directly from canonical docs and the core engine.
- **When Docs and Code Disagree**: The actual core code is the ultimate truth. You must immediately notify the user about any mismatch.

## Startup Sequence
- Read this file.
- **Protocol check first**:
  - If the request mentions **MACP**, the Multi-Agent Collaborative Protocol, the Architect/Builder relay workflow, or asks you to act as the **Architect Agent**, read [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md) in full first.
  - If the request explicitly invokes an AQL role mode (**Guide**, **Solo**, **Brain**, or **Build**), read [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md) and execute its role handshake:
    - **Guide / Solo**: Ask directly what task is being discussed or implemented.
    - **Brain**: Prompt for the Building Agent's Capability Tier first, then prompt for the task to plan.
    - **Build**: Prompt for the plan file under `PLANS/` to execute.
- Run **Query Classification** (below) to classify the request.
- Load only the matching initialization prompt from [Initialization Prompt Routing](#initialization-prompt-routing).

## Query Classification (Run Before Loading Prompts)

Classify the user's request into one of these categories:

| Category | Rule | Action |
|---|---|---|
| **MACP / Protocol Session (takes precedence)** | The query mentions MACP, role modes (Guide, Brain, Build, Solo), or asks you to act under a protocol | Read [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md) or [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md) and follow its handshake and execution boundaries. |
| **Resource UI Module Generation / 3-Layer UI (takes precedence over Single-category)** | Any request to build, generate, create, extend, or change a resource's UI or module under the 3-Layer UI Architecture | Load [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) FIRST. |
| **Single-category match** | The query maps cleanly to exactly ONE routing category below | Load ONLY that one init prompt. Do NOT load related prompts speculatively. |
| **Multi-category match** | The query explicitly spans multiple distinct domains | Load ONLY the prompts that match the explicit scope. Do NOT load transitive dependencies. |
| **Unclear / Concept Search** | General investigation, or locating a specific codebase feature/file | Load [general_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/general_query.md) and FIRST read [CODEBASE_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/References/CODEBASE_INDEX.md). |

When in doubt, prefer single-prompt loading.

> [!IMPORTANT]
> **Additive prompt — the one exception to single-category loading.** If the task creates or materially restructures a component under `FRONTENT/src/components/{abstract,app,contents,sections}/`, ALSO load [renderable_contract.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/renderable_contract.md) on top of the matching domain prompt.

## Initialization Prompt Routing

Load the matching initialization document from [References/Prompt Library/Initialization/](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/):

* **Resource UI Module Generation / 3-Layer UI**: Read [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md). Backed by [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md) and [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
* **Database Schema Alteration**: Read [database_schema_alteration.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/database_schema_alteration.md).
* **Frontend Modification**: Read [frontend_modification.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/frontend_modification.md).
* **Page & Section Customization & Creation**: Read [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md). Backed by [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md).
* **Sidebar Menu & Access Control**: Read [frontend_menu_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/frontend_menu_system.md). Backed by [UI_SIDEBAR_MENU_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_SIDEBAR_MENU_SYSTEM.md).
* **Report Template & Aggregations**: Read [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md).
* **Report UI & Feature Development**: Read [report_ui_development.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_ui_development.md). Backed by [FEATURE_REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_REPORTS_SYSTEM.md).
* **Writing/Editing Plans**: Read [plan_writing.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/plan_writing.md).
* **Git Actions (Commit, Push)**: Read [git_operations.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/git_operations.md).
* **General Investigatory Query**: Read [general_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/general_query.md).
* **AQL-Specific Codebase Investigation**: Read [codebase_investigation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/codebase_investigation.md).
* **Dashboard Items (Widgets, Cards, Tiles, Charts, KPIs)**: Read [dashboard_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/dashboard_implementation.md). Backed by [FEATURE_DASHBOARD_ENGINE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE.md).
* **Backend GAS Implementation**: Read [backend_gas_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/backend_gas_implementation.md). Backed by [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md).
* **Tax / Currency System Changes**: Read [tax_currency_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/tax_currency_system.md). Backed by [FEATURE_TAX_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_TAX_SYSTEM.md).
* **Sheet Views / Reports Formulation**: Read [sheet_views_formulation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/sheet_views_formulation.md) or [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md).
* **Prompt & Instruction Creation**: Read [create_prompt_instruction.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/create_prompt_instruction.md).
* **API Related Query**: Read [api_related_query.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/api_related_query.md). Backed by [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md).
* **Multi-Tenant System, Routing & New Client Setup**: Read [multi_tenant_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/multi_tenant_system.md). Backed by [TENANT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TENANT_SYSTEM.md).
* **AQL Sheet Menu Actions & Setup Scripts**: Read [sheet_menu_actions.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/sheet_menu_actions.md). Backed by [SHEET_TOOLBAR_MENU_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHEET_TOOLBAR_MENU_GUIDE.md).
* **Header Customization & Overrides**: Read [header_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/header_customization.md).
* **List Switcher Customization**: Read [list_switcher_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/list_switcher_customization.md). Backed by [UI_LIST_SWITCHER.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_LIST_SWITCHER.md).
* **List View Filters & Dynamic Tokens**: Read [list_view_tokens.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/list_view_tokens.md).
* **Content Page & Form Customization**: Read [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md). Backed by [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md).
* **Create & Update Content & Child Entry Customization**: Read [content_create_and_update_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_create_and_update_customization.md). Backed by [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md).
* **View Content Customization**: Read [view_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/view_customization.md). Backed by [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md).
* **Reusable Render Component Creation (`abstract/`, `app/`, `contents/`, `sections/`)**: Read [renderable_contract.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/renderable_contract.md) (additive prompt). Backed by [UI_RENDERABLE_CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RENDERABLE_CONTRACT.md).
* **Refactoring & Code Cleanup**: Read [refactoring_and_code_cleanup.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/refactoring_and_code_cleanup.md).
* **Action & FAB Customization**: Read [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md). Backed by [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md).

> [!IMPORTANT]
> **Single-category rule**: If the query maps cleanly to exactly ONE routing category above, load ONLY that one initialization prompt. Do NOT load related prompts speculatively.
>
> **Multi-category rule**: Only when the query explicitly spans multiple domains, load only the matching prompts — do NOT load transitive dependencies.

> [!NOTE]
> If the user's request doesn't cleanly match any category above, consult [CORE_DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_DOC_ROUTING.md) to identify the correct canonical documents for the task.

## Multi-Agent Collaboration Frameworks
- **Multi-Agent Collaborative Protocol (MACP)**: Canonical doc at [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md).
- **AQL Multi-Agent Protocol (Guide, Solo, Brain, Build)**: Canonical doc at [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md).
- Protocol rules govern conversation and execution flow. Repository knowledge comes from Query Classification and the initialization prompts above.

## Repo-Local Skills
- Skills are task adapters, not policy sources.
- `aql-expert`: AQL domain work across frontend, GAS, sheet metadata, resources, permissions, and workflows.
- `aql-frontend-design`: AQL-specific Quasar UI design, prototypes, and frontend visual refinement.
- `aql-coding-patterns`: Maintaining consistent formatting, syntax, and styling across JS, Vue, and GS files.
- These skills must defer to this file, [MAP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MAP.md), and [CORE_DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_DOC_ROUTING.md).
- If a skill conflicts with canonical docs, follow the canonical docs and update the skill.

## Split Canonical Docs (read this before citing a §)
Any doc in `Documents/` that grew past ~25KB is **split into parts**. The original filename is still a HUB carrying:
- **Parts of this document** — what each part covers, with links.
- **Where each section lives** — every `§N` mapped to the file holding it.

Read the hub first, then open only the part your task needs.
Split hubs: `FEATURE_DASHBOARD_ENGINE.md`, `UI_MODULE_DEVELOPER_GUIDE.md`, `UI_PAGE_STATE.md`, `UI_ACTION_SYSTEM.md`, `UI_CREATE_AND_UPDATE_SYSTEM.md`, `UI_PAGE_AND_SECTION_SYSTEM.md`, `UI_RESOURCE_DOMAIN_LOGIC.md`, `UI_LIST_SWITCHER.md`, `UI_CONTENT_SYSTEM.md`.

## Architecture & Implementation Rules (STRICT)
- **Frontend Architecture Spec**: Before touching any file under `FRONTENT/`, read [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) without exception — this includes small fixes and one-liners.
- **Layer 2 Unified Node Transport**: Every function exported from `FRONTENT/src/_resource/` across a layer boundary returns a pure Node Object, or an array of Node Objects. No envelopes. Pages mount live nodes at ready, and submit handlers only validate. Full spec: [UI_PAGE_STATE_NODES.md §5](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE_NODES.md) and [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md).
- **Single Domain Source of Truth**: Every resource domain (`src/_resource/{Scope}/{Resource}/`) must have exactly ONE calculation path for each domain concept. Never create parallel builders or functions. Full spec: [UI_RESOURCE_DOMAIN_LOGIC.md §6](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
- **Thin Frontend Pages**: Keep Vue pages thin. Orchestrate layout with child components. No business logic, stores, services, API calls, or IDB operations inside components.
- **Backend GAS**: Prefer existing GAS files and patterns. Create a new file only when existing structure cannot support the task cleanly.

## Reuse First & Anti-Duplication Policy (STRICT)
- **Never create a new utility, helper, or core function without first checking existing implementations.**
- **Check the canonical index first**: Read [SHARED_UTILITIES_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHARED_UTILITIES_INDEX.md) and the relevant files under `FRONTENT/src/utils/`, `FRONTENT/src/composables/`, and `FRONTENT/src/_resource/` before writing any helper.
- **Prefer extension over new files**: Add clean, pure functions to existing utility files rather than creating new files.
- **Layer 1 / core files are READ-ONLY unless the user explicitly asks**: Never add module-specific helpers into core infrastructure.
- **Ask BEFORE creating any new file or function — never after**: Post the audit report from [SHARED_UTILITIES_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHARED_UTILITIES_INDEX.md) and wait for user approval.
- Full catalogue, concrete homes, audit templates, and mandatory exhaustion quotes live in [SHARED_UTILITIES_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHARED_UTILITIES_INDEX.md).

## Remote Updates & External Sync Policy (STRICT)
- **Do not update remote files, repositories, or services automatically.**
- Any action that modifies files or state outside the local file system is restricted (`clasp push`, `gas:push`, `git push`, remote deploys).
- **Allowed ONLY when explicitly requested by the user.**
- **Mandatory User-Quote Requirement:** Whenever performing any remote update action, the agent MUST explicitly quote or cite the exact statement where the user asked for this action (e.g. *"Performing GAS push because you explicitly requested: '<exact user quote>'"*).

## Verification
- Do not run broad verification by default.
- Prefer targeted checks.
- Run `npm run build` for frontend only when changes touch 10 or more files or have equivalent risk.

## Documentation Gap & Self-Healing Rule (STRICT)
- When a bug, missed parallel update, or execution failure happens because a document or prompt lacked required instructions:
  1. **Identify the Gap**: Find which canonical doc (`Documents/`) or prompt missed the rule.
  2. **Notify the User**: Explain the documentation gap clearly in simple words.
  3. **Ask Permission**: Ask the user for permission to update the affected documents and prompts immediately.
  4. **Update & Prevent**: Once approved, update the docs and prompts so future agents do not repeat the mistake.

## Maintenance Rule
- Update this file when startup behavior, default reading expectations, role invocation, deployment expectations, or canonical startup references change.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **little-leap-aql** (25848 symbols, 44788 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
