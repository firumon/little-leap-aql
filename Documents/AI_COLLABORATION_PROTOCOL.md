# AI Collaboration Protocol for Little Leap AQL

This document defines how AI agents should collaborate on this project.

## Core Rule
Every functional change must keep code, Apps Script, Google Sheet structure, and documentation aligned.

## 1) Script Project Strategy
Single-script-project model is preferred:
- Maintain Apps Script code primarily in APP Google Sheet project.
- Use APP `Resources` (`Name`, `FileID`, `SheetName`) to operate on external files (`MASTERS`, `TRANSACTIONS`, `REPORTS`).
- Avoid maintaining separate Apps Script projects in other sheet files unless explicitly requested.

## 2) When Google Sheet Structure Changes
Applies to: `APP`, `MASTERS`, `TRANSACTIONS`, `REPORTS`.

AI agent must:
1. Update relevant documentation (`APP_SHEET_STRUCTURE`, `MASTER_SHEET_STRUCTURE`, etc.).
2. Create/update setup scripts in `GAS/` that can be run from APP project.
3. Clearly instruct the user what to create/change in Google Sheets.
4. Clearly instruct the user what to copy-paste in APP Apps Script and what function to run.

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
