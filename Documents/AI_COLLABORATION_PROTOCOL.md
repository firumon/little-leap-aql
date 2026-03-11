# AI Collaboration Protocol for Little Leap AQL

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
4. Clearly instruct the user what to create/change in Google Sheets.
5. Clearly instruct the user what to copy-paste in APP Apps Script and what function to run.

## 3) When Apps Script Changes
AI agent must:
1. Edit/create files under `GAS/` in this repository.
2. Show exactly which files were changed/created.
3. Ask user to copy-paste those files into APP Apps Script and redeploy Web App if required.

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

## 6) Response Format Expectation
For implementation responses, AI agent should include:
1. Summary of what was done.
2. Files changed/created.
3. What user must do manually in Google Sheets/Apps Script (if applicable).
4. Deployment/testing note (if applicable).

## 7) Practical Constraint
Because Google Apps Script and Google Sheets are external to this local workspace, AI agent must always provide explicit copy-paste/deployment instructions when those environments are impacted.

## 8) Dual-Agent Collaboration Model
This project uses two AI roles with distinct responsibilities:

- **Brain Agent** - Creates implementation plans, makes architecture decisions, defines business rules, and reviews execution.
- **Execution Agent** - Executes plans step-by-step (code, terminal commands, browser actions, git operations, and doc updates).

Communication happens through repository artifacts:
- Brain Agent writes **Implementation Plans** to `Documents/PLANS/`.
- Execution Agent reads plans, executes, marks progress, and updates docs.
- Brain Agent reviews results and creates follow-up plans if needed.

## 9) Startup Consistency Rule
For each new context window, agents must follow:
1. Read `AGENTS.md` first.
2. Apply `Documents/DUAL_AGENT_PROTOCOL.md`.
3. Check `Documents/PLANS/` before starting implementation work.
4. Create new plans from `Documents/PLANS/_TEMPLATE.md`.
5. After planning, provide the execution handoff prompt with the exact plan filename.
