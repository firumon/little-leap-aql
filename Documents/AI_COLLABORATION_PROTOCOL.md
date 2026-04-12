# AI Collaboration Protocol for AQL

## Purpose
This document defines the cross-surface alignment rules for implementation work in AQL.

## When To Read This File
Read this file only when the task involves one of the following:
- planning implementation work
- executing implementation work
- modifying frontend code, GAS code, setup scripts, or project docs
- changing sheet structure, API behavior, or documented workflows

It is optional for short discussions, brainstorming, and other Guide Agent-only conversations.

## Core Rule
For functional changes, keep code, Google Apps Script, Google Sheet structure, and documentation aligned.

## Implementation Alignment Rules

### When Google Sheet Structure Changes
- Update the relevant structure docs.
- Update supporting setup or sync scripts if needed.
- Update onboarding/setup docs if the setup flow changed.
- Tell the user only the sheet-level manual actions that cannot be done locally.

### When GAS Changes
- Edit the repository files under `GAS/`.
- Show which GAS files changed.
- Run `cd GAS && clasp push` or `npm run gas:push` after GAS changes.
- Ask the user to create a new Web App deployment version only if the API contract changed.

### When Frontend Changes
- Implement the requested changes directly in the repo.
- Keep pages thin and move reusable logic into composables/components when the task meaningfully changes frontend structure.
- Update related docs only when behavior, structure, or reusable interfaces changed.

### When Docs Must Be Updated
Update the relevant canonical doc when the task changes its subject area, for example:
- `Documents/AQL_MENU_ADMIN_GUIDE.md` for menu action changes
- `Documents/LOGIN_RESPONSE.md` for login payload changes
- `Documents/MODULE_WORKFLOWS.md` when a documented module workflow changes
- frontend registries when reusable components/composables change

## Planning and Execution Notes
- Brain Agent writes plans in `PLANS/`.
- Build Agent executes the assigned plan and updates its status.
- Solo Agent creates a written plan only when explicitly requested.

## Testing Guidance
- Do not run broad verification by default.
- Prefer targeted checks that match the changed area.
- Run a full frontend build only for major or cross-cutting frontend changes, typically around 10 or more touched files or equivalent risk.

## Maintenance Rule
Update this file when any of the following changes:
- cross-surface alignment expectations
- deployment responsibility or redeployment rules
- documentation update triggers
- verification/testing policy for implementation work
