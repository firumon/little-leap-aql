## Default Operating Mode (Mandatory)
- This file is the startup instruction source for this repository. In every new context window, apply this mode before starting implementation work.
- Default collaboration mode is **Multi-Agent** (Guide, Brain, Build, Solo):
  - **Guide Agent** (Default): Discussion, clarifies requirements, provides feedback.
  - **Brain Agent**: Planning, architecture decisions, rule capture, plan creation.
  - **Build Agent**: Implementation, terminal execution, tests, commits, doc updates.
  - **Solo Agent**: Autonomous end-to-end execution (planning + building combined; exempt from written plans).
- Default behavior for new tasks:
  1) Identify active role or default to **Guide Agent**.
  2) Read `Documents/MULTI_AGENT_PROTOCOL.md`.
  3) Read `Documents/AI_COLLABORATION_PROTOCOL.md`.
  4) Read `Documents/CONTEXT_HANDOFF.md`.
  5) Check `PLANS/` for active plans.
- Plan-first rule (Applies to Brain/Build; Solo is exempt):
  - Repository override: For this repo, the multi-agent plan-first protocol (Brain -> Build) takes priority over generic assistant defaults.
  - If no executable plan exists for the requested task, create a plan in `PLANS/` first via **Brain Agent**.
  - All new plan files must be created from `PLANS/_TEMPLATE.md`.
  - Do not start code implementation until a plan exists, except for small documentation/rule-capture updates or when operating as **Solo Agent**.
  - After planning is complete (Brain), provide the execution handoff prompt:
    - `Build Agent, read PLANS/<plan-file>.md and execute it end-to-end.`
- Naming rule:
  - Use exact role names in docs and templates: `Guide Agent`, `Brain Agent`, `Build Agent`, `Solo Agent`.
  - Avoid model-specific names in protocol instructions.
  - For plan ownership fields, use role + concrete agent identity:
    - `Created By: Brain Agent (AgentName)`
    - `Executed By: Build Agent (AgentName | pending)` until execution is completed.
  - Plan file naming: `YYYY-MM-DD-kebab-case-title.md` for dated plans, or `feature-name.md` for feature-specific plans.
- GAS deployment rule:
  - `clasp` is configured. When GAS files change, the agent runs `cd GAS && clasp push` to deploy automatically.
  - Alternatively, use workspace npm scripts: `npm run gas:push` (from root), which is equivalent to `cd GAS && clasp push`.
  - Do NOT ask the user to manually copy-paste `.gs` files into the Apps Script IDE.
  - Manual user actions are limited to: Google Sheet menu actions (AQL 🚀 > ...), editing sheet data, and creating new Web App deployment versions (only when API behavior changes).
  - Web App deployment: Only create a new deployment version in Apps Script IDE if the API endpoint contract changed (new actions, response shape changes). Normal GAS file updates via `clasp push` do not require Web App redeployment.
- Module workflow maintenance rule:
  - Before working on a documented module (Reports, etc.), read the relevant section in `Documents/MODULE_WORKFLOWS.md`.
  - If any documented module workflow is changed during implementation, update the relevant section in `Documents/MODULE_WORKFLOWS.md` before closing the task.
- Frontend registry maintenance rule:
  - When creating/updating reusable frontend building blocks, update:
    - `FRONTENT/src/components/REGISTRY.md` for component API changes (props/events/path).
    - `FRONTENT/src/composables/REGISTRY.md` for composable signature/returns changes.
  - Applies to all tasks touching `FRONTENT/src/components/` or `FRONTENT/src/composables/`.
  - Prefer tiny, single-responsibility reusable abstractions.
  - Avoid one-off wrappers that only mirror page-local logic without a clear reuse path.
  - Treat this as a design guideline (not a hard numeric usage threshold).

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
├── scripts/              # Build and deployment scripts
├── AGENTS.md             # This file (Codex agent startup)
└── CLAUDE.md             # Claude Code startup (mirrors this file)
```

## Frontend Rules
- **Quasar-First UI**: Default to Quasar components (`q-input`, `q-table`, etc.).
- **Single API contract**: Use `callGasApi` in `src/services/gasApi.js` for all backend calls.
- **Composable + Component architecture**: Keep pages thin; move logic to `src/composables/`, split UI into `src/components/`.
- **Registry maintenance**: Update `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` when creating/modifying reusable blocks.
- **PWA-SW-IDB-Pinia Data Contract**: IndexedDB for offline-first, `lastUpdatedAt` cursors for incremental sync, Service Worker for cache boundaries only.
- **Build and dev**: Use `npm run dev` (in FRONTENT/) for local development, `npm run build` for PWA build, `npm run gas:push` (from root) for backend deployment.

## Backend Rules (GAS)
- **Single script project** in the APP spreadsheet — no separate scripts in external files.
- **Generic verbs**: `action=get`, `scope=master`, `resource=Products` — avoid hardcoded endpoints.
- **APP.Resources** is the supreme source of truth for routing, metadata, and permissions.
- **Config sheet** holds deployment-specific settings (file IDs, company branding). FileID resolution: `Resource.FileID` → `Config[{Scope}FileID]` → APP file ID.
- **Dynamic file resolution**: Use helpers `resolveFileIdForScope()`, `getAppConfigValue()`, `getConfigMap()` from `sheetHelpers.gs` instead of hardcoded file IDs.

## Key Documents
| Document | Purpose |
|---|---|
| `AGENTS.md` | Codex agent startup (this file) |
| `CLAUDE.md` | Claude Code startup (mirrors AGENTS.md) |
| `Documents/MULTI_AGENT_PROTOCOL.md` | Role definitions and workflow |
| `Documents/AI_COLLABORATION_PROTOCOL.md` | Sync rules for code/sheets/docs |
| `Documents/CONTEXT_HANDOFF.md` | Current state + resume context |
| `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md` | APP.Resources architecture |
| `Documents/RESOURCE_COLUMNS_GUIDE.md` | Column conventions for resources |
| `Documents/NEW_CLIENT_SETUP_GUIDE.md` | Client onboarding steps |
| `Documents/MODULE_WORKFLOWS.md` | End-to-end workflow docs per feature (Reports, Bulk Upload, etc.) |
| `PLANS/_TEMPLATE.md` | Template for new implementation plans |

## Response Format
When completing implementation tasks, include:
1. **Summary**: What was accomplished.
2. **Files Modified**: List of changed files.
3. **GAS Deployment**: If GAS files changed → agent runs `npm run gas:push` (from root) or `cd GAS && clasp push`.
4. **Manual Actions**: Only sheet-level user actions (menu clicks, data edits, Web App redeployment if needed).
5. **Testing**: How to verify the changes.
6. **Doc Updates**: If any documented module workflow was changed, update the relevant section in `Documents/MODULE_WORKFLOWS.md`.


A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.
- **Module Workflows:** Before working on a documented module (Reports, etc.), read the relevant section in `Documents/MODULE_WORKFLOWS.md` for the complete end-to-end flow, responsible files, configuration surface, and known behaviors.
- **PWA-SW-IDB-Pinia Data Contract:** Master and Operation models fetch incremental updates first from IndexedDB `resource-records` for instant local paint. Background sync uses `lastUpdatedAt` cursors from `resource-meta`, upserting deltas into IndexedDB and Pinia. Service Worker explicitly manages only offline/cache boundaries, never UI state logic.
- **Master Discovery Pattern:** Generic UI is provided by `MasterEntityPage.vue`. To override for a specific resource, create `{EntityName}Page.vue` in `src/pages/Masters/`. The dispatcher (`MasterIndexPage.vue`) will automatically prefer the custom file.
### Available skills
- aql-engineer: Implement and maintain the AQL system across Quasar frontend, Google Apps Script backend, and Google Sheets metadata with strict documentation alignment. Use when tasks involve files under FRONTENT/, GAS/, or Documents/, especially resource-driven auth/master runtime changes, APP.Resources schema changes, route/menu authorization changes, setup script updates, or handoff/protocol documentation updates. (file: C:/Users/firum/.codex/skills/aql-engineer/SKILL.md)
- aql-project: Implement and maintain the AQL system across Quasar frontend, APP Apps Script backend, and Google Sheets metadata with strict documentation alignment. Use when tasks touch FRONTENT/, GAS/, or Documents/, especially resource-driven auth/master runtime changes, APP.Resources schema or permissions updates, route/menu authorization behavior, setup script updates, or project handoff/protocol maintenance. (file: C:/Users/firum/.codex/skills/aql-project/SKILL.md)
- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends agent capabilities with specialized knowledge, workflows, or tool integrations. (file: C:/Users/firum/.codex/skills/.system/skill-creator/SKILL.md)
- skill-installer: Install skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos). (file: C:/Users/firum/.codex/skills/.system/skill-installer/SKILL.md)
### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2) When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5) If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
