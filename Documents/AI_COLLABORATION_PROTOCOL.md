# AI Collaboration Protocol for AQL

This document defines how AI agents should collaborate on this project.

## Core Rule
Every functional change must keep code, Apps Script, Google Sheet structure, and documentation aligned.

## 1) Script Project Strategy
Single-script-project model is preferred:
- Maintain Apps Script code primarily in APP Google Sheet project.
- Use APP `Resources` (`Name`, `FileID`, `SheetName`) to operate on external files (`MASTERS`, `OPERATIONS`, `REPORTS`).
- Avoid maintaining separate Apps Script projects in other sheet files unless explicitly requested.

## 2) When Google Sheet Structure Changes
Applies to: `APP`, `MASTERS`, `OPERATIONS`, `REPORTS`.

AI agent must:
1. Update relevant documentation (`APP_SHEET_STRUCTURE`, `MASTER_SHEET_STRUCTURE`, etc.).
2. Create/update setup scripts in `GAS/` (`setupAppSheets.gs`, `setupMasterSheets.gs`, `syncAppResources.gs` etc.) that can be run from APP project. This is crucial for new client setups.
3. Verify if `Documents/NEW_CLIENT_SETUP_GUIDE.md` needs updates if the overall deployment flow has changed.
4. Clearly instruct the user what to create/change in Google Sheets (menu actions, sheet edits, etc.).

## 3) When Apps Script Changes
AI agent must:
1. Edit/create files under `GAS/` in this repository.
2. Show exactly which files were changed/created.
3. **Deploy via clasp**: Run `cd GAS && clasp push` (or `npm run gas:push` from repo root) to push changes to the remote Apps Script project. The agent should run this command itself — do NOT ask the user to manually copy-paste files into the Apps Script IDE.
4. If the API endpoint behavior changed (new actions, changed response shape), instruct the user to create a new Web App deployment version in the Apps Script IDE (Deploy > New deployment).

## 4) When Frontend/Local Code Changes
AI agent must:
1. Implement code changes directly in repository files.
2. Update related docs so future contributors understand current state and progress.
3. Mention files changed and any required follow-up actions.

## 5) Documentation Discipline
For all significant changes, update:
- What changed
- Why it changed
- Current behavior
- Next expected operational step (if any)
- If an `AQL 🚀` menu action is added, removed, renamed, or behavior-changed, update `Documents/AQL_MENU_ADMIN_GUIDE.md` in the same task.

## 6) Response Format Expectation
For implementation responses, AI agent should include:
1. Summary of what was done.
2. Files changed/created.
3. GAS deployment: If GAS files changed, the agent runs `cd GAS && clasp push` to deploy automatically.
4. Manual user actions (if applicable): Only for things the agent cannot do — e.g., Google Sheet menu actions (AQL 🚀 > ...), editing sheet data, creating a new Web App deployment version, or browser-based Google actions.
5. Deployment/testing note (if applicable).

## 7) Practical Constraint
Google Sheets are external to this local workspace — AI agent must provide explicit instructions for any sheet-level manual actions (menu clicks, data entry, deployment versioning). However, Apps Script code deployment is handled locally via `clasp push` and should be executed by the agent directly, not delegated to the user.

## 8) Multi-Agent Collaboration Model
This project uses four AI roles with distinct responsibilities:

- **Guide Agent** - Default entry for discussion, brainstorming, and clarifications.
- **Brain Agent** - Creates implementation plans, makes architecture decisions, and defines business rules.
- **Build Agent** - Executes plans step-by-step (code, terminal, documentation updates).
- **Solo Agent** - Autonomous planning + building for faster execution (exempt from written plans in `PLANS/`).

Communication happens through repository artifacts:
- **Brain Agent** writes **Implementation Plans** to `PLANS/`.
- **Build Agent** reads plans, executes, marks progress, and updates docs.
- **Guide Agent** reviews results and facilitates discussion.

## 9) Startup Consistency Rule
For each new context window, agents must follow:
1. Read `AGENTS.md` first.
2. Apply `Documents/MULTI_AGENT_PROTOCOL.md`.
3. Check `PLANS/` before starting implementation work.
4. Create new plans from `PLANS/_TEMPLATE.md`.
5. After planning (Brain), provide the execution handoff prompt for **Build Agent**.

## 10) Frontend Structure Rule (Mandatory)
For frontend changes under `FRONTENT/src/`:
1. Keep page files thin orchestration layers; move stateful logic to composables in `src/composables/`.
2. Extract reusable UI sections into self-contained components under `src/components/`.
3. Avoid large monolithic page files; when a page grows beyond a practical review size, split it into composable + components in the same task.
4. Preserve shared service contracts (`callGasApi`, IndexedDB helpers, Pinia stores); do not duplicate API/loading logic ad-hoc inside components.

## 11) Plan Metadata Identity Rule
When creating/updating plan files in `PLANS/`, ownership fields must include role + concrete agent identity:
1. `Created By: Brain Agent (AgentName)`
2. `Executed By: Build Agent (AgentName | pending)` while pending.
3. Build Agent must replace `| pending` after execution completion.
