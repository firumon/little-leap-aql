# AQL — Claude Code Project Instructions

This file is the startup instruction source for Claude Code sessions. It mirrors `AGENTS.md` to ensure consistency across all AI agents (Claude Code, Codex, Gemini, etc.).

## Startup Sequence (Mandatory)
In every new context window, before doing any work:
1. Read this file (`CLAUDE.md`).
2. Read `Documents/MULTI_AGENT_PROTOCOL.md` — defines the four agent roles.
3. Read `Documents/AI_COLLABORATION_PROTOCOL.md` — sync rules for code/sheets/docs.
4. Read `Documents/CONTEXT_HANDOFF.md` — current project state and resume context.
5. Check `PLANS/` for active or pending implementation plans.
6. Identify your role (default: **Guide Agent**).

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

## Menu Admin Guide Maintenance Rule
- `Documents/AQL_MENU_ADMIN_GUIDE.md` is the canonical admin-facing guide for all `AQL 🚀` menu actions.
- If any menu action is added, removed, renamed, or behavior-changed, update `Documents/AQL_MENU_ADMIN_GUIDE.md` in the same task.
- Keep `Documents/README.md` index entry aligned if the guide location/name changes.

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
