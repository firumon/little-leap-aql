# PLAN: Fix Master Page Template Error
**Status**: COMPLETED
**Created**: 2026-03-12
**Created By**: Brain Agent
**Executed By**: Build Agent

## Objective
Fix the Vue template error: `[plugin:vite:vue] v-else/v-else-if has no adjacent v-if or v-else-if` in `MasterEntityPage.vue`.

## Context
A recent refactor of `MasterEntityPage.vue` introduced a `v-else-if` inside a `v-if` block, which is invalid Vue syntax. The error state `q-page v-else-if` should be a sibling of the main `q-page v-if`.

## Pre-Conditions
- [ ] Required access/credentials are available.
- [ ] Required source docs were reviewed.
- [ ] Any dependent plan/task is completed.

## Steps

### Step 1: Fix Template Structure in MasterEntityPage.vue
- [ ] Re-organize the top-level template elements so that `v-if="config"`, `v-else-if="!loading"`, and any other conditional root elements are siblings.
- [ ] Ensure the FAB and Dialog are moved outside or included appropriately in the `v-if="config"` block if they depend on `config`.
- [ ] Ensure the overall page structure remains "stunning" and mobile-first.
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
**Pattern**: Proper Vue template conditional structures.
**Rule**: `v-else/v-else-if` must be adjacent siblings of a `v-if`.

### Step 2: Verify Compilation
- [ ] Run `lint` on the file to catch syntax/template errors.
- [ ] Confirm no more `plugin:vite:vue` errors are present.
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`

## Documentation Updates Required
- [ ] Update `Documents/CONTEXT_HANDOFF.md` to reflect the template fix.

## Acceptance Criteria
- [ ] `MasterEntityPage.vue` compiles without template errors.
- [ ] The page correctly displays the "Config not found" error state when `config` is missing and loading is finished.
- [ ] The "stunning" Card UI remains intact when `config` is present.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `FRONTENT/src/pages/Masters/MasterEntityPage.vue`

### Validation Performed
- [ ] Unit/manual validation completed
- [ ] Acceptance criteria verified

### Manual Actions Required
- [ ] None.
