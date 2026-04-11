# AQL — Claude Code Project Instructions

This file is the startup instruction source for Claude Code sessions. It mirrors `AGENTS.md` to ensure consistency across all AI agents (Claude Code, Codex, Gemini, etc.).

## Startup Sequence (Mandatory)
In every new context window, before doing any work:
1. Read this file (`CLAUDE.md`).
2. Read `Documents/MULTI_AGENT_PROTOCOL.md` — defines the four agent roles.
3. Read `Documents/AI_COLLABORATION_PROTOCOL.md` — sync rules for code/sheets/docs.
4. Read `Documents/CONTEXT_HANDOFF.md` — current project state and resume context.
5. Read `Documents/GAS_API_CAPABILITIES.md` — full backend capabilities reference; mandatory before any GAS or new-module work.
6. Read `Documents/GAS_PATTERNS.md` — implementation patterns and anti-patterns; mandatory before writing any GAS code.
7. Check `PLANS/` for active or pending implementation plans.
8. Identify your role (default: **Guide Agent**).

## Context Budget Guardrails (Mandatory)
- Avoid full-file dumps, full `git diff`, or long raw logs unless explicitly needed.
- Prefer targeted file/section reads and concise summaries over large pasted output.
- After startup reads are done, do not repeatedly re-read broad docs every turn; read only what is relevant to the active task or changed areas.

## Multi-Agent Collaboration Model
This project uses four AI roles:
- **Guide Agent** (Default): Discussion, requirements clarification, feedback.
- **Brain Agent**: Architecture, planning, creates plans in `PLANS/`.
- **Build Agent**: Implementation, terminal execution, tests, commits, doc updates.
- **Solo Agent**: Autonomous end-to-end (planning + building).

## Plan-First Rule
- For this repo, the multi-agent plan-first protocol (Brain → Build) takes priority.
- If no executable plan exists for a requested task, create one in `PLANS/` first (Brain Agent).
- All new plan files must use `PLANS/_TEMPLATE.md` as the template.
- Do not start code implementation until a plan exists, except for small doc/rule-capture updates or Solo Agent mode.
- After planning (Brain), provide the handoff prompt: `Build Agent, read PLANS/<plan-file>.md and execute it end-to-end.`

## Project Structure
```
AQL/
├── GAS/                  # Google Apps Script backend (all .gs + .html files)
│   ├── appsscript.json   # GAS manifest (committed)
│   ├── .clasp.json       # clasp config with Script ID (gitignored)
│   └── clasp-configs/    # Per-client .clasp.json files (gitignored)
├── FRONTENT/             # Quasar (Vue 3 + Vite) frontend
│   └── src/
│       ├── components/   # Reusable UI components (maintain REGISTRY.md)
│       ├── composables/  # Stateful logic hooks (maintain REGISTRY.md)
│       ├── pages/        # Thin orchestration layers
│       ├── services/     # API services (callGasApi)
│       └── stores/       # Pinia stores
├── Documents/            # Architecture docs, sheet structures, protocols
├── PLANS/                # Implementation plans (Brain → Build workflow)
├── AGENTS.md             # Codex agent startup file
└── CLAUDE.md             # This file (Claude Code startup)
```

## GAS Deployment (Critical Rule)
**`clasp` is configured for automated deployment. Agents must NOT ask users to manually copy-paste GAS files.**

When GAS files are changed:
1. **Agent runs**: `cd GAS && clasp push` — this deploys all `.gs` and `.html` files to the remote Apps Script project automatically.
2. **User action only if** API behavior changed (new endpoints, changed response shape): Instruct the user to create a new Web App deployment version in the Apps Script IDE (Deploy > New deployment).

Manual user actions are limited to:
- Google Sheet operations: AQL 🚀 menu actions, editing sheet data
- Web App redeployment (only when API contract changes)
- Browser-based Google actions (authorization, settings)

## Frontend Rules
- **Quasar-First UI**: Default to Quasar components (`q-input`, `q-table`, etc.).
- **Single API contract**: Use `callGasApi` in `src/services/gasApi.js` for all backend calls.
- **Composable + Component architecture**: Keep pages thin; move logic to `src/composables/`, split UI into `src/components/`.
- **Registry maintenance**: Update `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` when creating/modifying reusable blocks.
- **PWA-SW-IDB-Pinia Data Contract**: IndexedDB for offline-first, `lastUpdatedAt` cursors for incremental sync, Service Worker for cache boundaries only.

## Backend Rules (GAS)
- **Single script project** in the APP spreadsheet — no separate scripts in external files.
- **Generic verbs**: `action=get`, `scope=master`, `resource=Products` — avoid hardcoded endpoints.
- **APP.Resources** is the supreme source of truth for routing, metadata, and permissions.
- **Config sheet** holds deployment-specific settings (file IDs, company branding). FileID resolution: `Resource.FileID` → `Config[{Scope}FileID]` → APP file ID.

## Naming & Identity
- Use exact role names: `Guide Agent`, `Brain Agent`, `Build Agent`, `Solo Agent`.
- Plan ownership: `Created By: Brain Agent (AgentName)`, `Executed By: Build Agent (AgentName | pending)`.

## GAS Backend Rules (Mandatory — read Documents/GAS_PATTERNS.md first)

### No New GAS Files
**Never create a new `.gs` file for a new module or feature.** The GAS file set is fixed. New resource logic belongs in one of the existing files, attached to an existing pattern.

### Use Existing Patterns — In Order of Preference
1. **Pure CRUD** — add resource to `syncAppResources.gs`, leave `PostAction` blank. Zero GAS code needed.
2. **After-create hook** — set `PostAction: 'myHandler'` in `syncAppResources.gs`; add `myHandler_afterCreate(record, auth)` to an existing hook file.
3. **Bulk save (array payload)** — same PostAction; add `myHandler(auth, payload)` to the same hook file; frontend calls `action=create, records: [...]`. Auto-detected by GAS. **Do NOT use `action=bulk` for operational saves** — that is reserved for the Bulk Upload UI only.
4. **No PostAction bulk** — for resources without side effects, `action=create, records: []` automatically uses `handleBulkUpsertRecords` (generic upsert). Zero GAS code needed.
5. **Additional actions (Approve/Reject)** — set `AdditionalActions` JSON in `syncAppResources.gs`; zero GAS code needed.
6. **Composite save (parent+children)** — use `handleCompositeSave` via `action=compositeSave`; zero GAS code needed.

### action=bulk Is Reserved for Bulk Upload UI Only
`action=bulk` routes through `dispatchBulkAction` and is exclusively used by the Bulk Upload page (`resource=BulkUploadMasters`). All other multi-record saves must use `action=create` or `action=update` with `records: []`.

### Never Hardcode Resource Names in Core Files
- Do NOT add `if (resourceName === 'SomeResource')` inside `masterApi.gs` or `apiDispatcher.gs`.
- Do NOT add new `case 'customAction'` in `apiDispatcher.gs` for resource-specific logic.
- Use the PostAction hook pattern instead.

### syncAppResources.gs Is the Single Source of Truth for Resource Config
All resource metadata (menu structure, PostAction, PreAction, UIFields, etc.) is defined in `APP_RESOURCES_CODE_CONFIG` in `syncAppResources.gs`. After any change, run: `AQL 🚀 > Setup & Refactor > Sync APP.Resources from Code`.

### Menu Structure Convention
Menu group arrays define the sidebar hierarchy. Top-level groups currently in use:
- `['Product']` — Product section (Manage, Stock)
- `['Warehouse']` — Warehouse section (Manage, Manual Stock Entry, GRN, etc.)
- `['Masters', 'Procurement']` — existing procurement items
- `['Operations']` — operational views

Full capabilities: **`Documents/GAS_API_CAPABILITIES.md`** | Patterns and anti-patterns: **`Documents/GAS_PATTERNS.md`**

## Menu Admin Guide Maintenance Rule
- `Documents/AQL_MENU_ADMIN_GUIDE.md` is the canonical admin-facing guide for all `AQL 🚀` menu actions.
- If any menu action is added, removed, renamed, or behavior-changed, update `Documents/AQL_MENU_ADMIN_GUIDE.md` in the same task.
- Keep `Documents/README.md` index entry aligned if the guide location/name changes.

## Login Response Documentation Maintenance Rule
- `Documents/LOGIN_RESPONSE.md` is the canonical specification of the login response payload returned by `handleLogin()`.
- Any change to the login response shape, field generators, source sheets/columns, AppConfig keys, AppOptions groups, or frontend storage locations MUST update `Documents/LOGIN_RESPONSE.md` in the same task.
- Keep `Documents/README.md` index entry aligned if the file location or name changes.

## Key Documents
| Document | Purpose |
|---|---|
| `AGENTS.md` | Codex agent startup (mirrors this file) |
| `Documents/MULTI_AGENT_PROTOCOL.md` | Role definitions and workflow |
| `Documents/AI_COLLABORATION_PROTOCOL.md` | Sync rules for code/sheets/docs |
| `Documents/CONTEXT_HANDOFF.md` | Current state + resume context |
| `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md` | APP.Resources architecture |
| `Documents/RESOURCE_COLUMNS_GUIDE.md` | Column conventions for resources |
| `Documents/AQL_MENU_ADMIN_GUIDE.md` | Admin-facing how-to for all AQL menu actions |
| `Documents/LOGIN_RESPONSE.md` | Canonical login response shape, field sources, and frontend storage locations |
| `Documents/GAS_API_CAPABILITIES.md` | **Mandatory** — complete GAS backend capabilities; read before designing any new module |
| `Documents/GAS_PATTERNS.md` | **Mandatory** — GAS implementation patterns, anti-patterns, action→handler map |
| `Documents/NEW_CLIENT_SETUP_GUIDE.md` | Client onboarding steps |
| `Documents/MODULE_WORKFLOWS.md` | End-to-end workflow docs per feature (Reports, etc.) |
| `PLANS/_TEMPLATE.md` | Template for new implementation plans |
| `.agents/skills/aql-expert/SKILL.md` | AQL expert skill for agents |

## Response Format
When completing implementation tasks, include:
1. **Summary**: What was accomplished.
2. **Files Modified**: List of changed files.
3. **GAS Deployment**: If GAS files changed → agent runs `cd GAS && clasp push`.
4. **Manual Actions**: Only sheet-level user actions (menu clicks, data edits, Web App redeployment if needed).
5. **Testing**: How to verify the changes.
6. **Doc Updates**: If any documented module workflow was changed, update the relevant section in `Documents/MODULE_WORKFLOWS.md`.
