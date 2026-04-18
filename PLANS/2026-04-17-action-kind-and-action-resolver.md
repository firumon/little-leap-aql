# PLAN: Action Kind discriminator + useActionResolver (5-tier ActionPage)

**Status**: COMPLETED
**Created**: 2026-04-17
**Created By**: Solo Agent (Claude Opus 4.7)
**Executed By**: Solo Agent (Claude Opus 4.7)

## Objective
Introduce a `kind` discriminator on `AdditionalActions` (`mutate` vs `navigate`) so that
navigation-style actions can route directly to resource/record pages via
`useResourceNav.goTo()` instead of routing through `/_action/{action}`. In parallel,
add a `useActionResolver` composable that mirrors `useSectionResolver` and lets
`ActionPage` resolve its sections through a 5-tier discovery — including per-action
overrides. Extract the tier-walking logic into one shared helper to avoid drift.

## Scope
- Frontend-only. GAS `syncAppResources.gs` and `actionManager.html` are **not** touched
  in this pass. Frontend reads normalize legacy flat actions to `kind: 'mutate'` so
  the sheet data works unchanged.

## Steps

### Step 1: Shared tier walker
Add `resolveTieredComponent(tiers, defaultComponent)` in
`FRONTENT/src/composables/_resolveTieredComponent.js`.
Input: `[{ modules, path }, ...]` + fallback component. Walks tiers in order; returns
first hit via `markRaw(mod.default || mod)`; falls back to `markRaw(defaultComponent)`.

### Step 2: Refactor useSectionResolver onto shared helper
Keep existing 4-tier behavior. Just replace inline tier logic with calls to the helper.

### Step 3: Normalize `kind` in useResourceConfig
`additionalActions` computed returns entries always shaped as:
```
{ action, label, icon, color, confirm, kind, ...mutateFields?, navigate? }
```
Legacy rows (no `kind`) → `kind: 'mutate'`, leave `column/columnValue/...` flat.
This preserves `appHelpers.deriveActionStampHeaders` / `useActionFields` behavior.

### Step 4: Branch ActionBar clicks
In both `pages/Operations/_common/ViewPage.vue` and
`pages/Masters/_common/ViewPage.vue`, `navigateToAction(action)` branches:
- `kind === 'navigate'` → `nav.goTo(navigate.target, { pageSlug, resourceSlug?, scope? })`
- else → existing `nav.goTo('action', { action: action.action })`

The ActionBar components stay as-is (dumb buttons emitting `action`).

### Step 5: useActionResolver composable
`FRONTENT/src/composables/useActionResolver.js`. Signature mirrors useSectionResolver
plus `actionKey` ref. Tiers for each section:
```
1. _custom/{ui}/{Entity}/Action{Section}{Action}.vue
2. _custom/{ui}/{Entity}/Action{Section}.vue
3. {Entity}/Action{Section}{Action}.vue
4. {Entity}/Action{Section}.vue
5. passed-in default (Action{Section} _common component)
```

### Step 6: Rewrite ActionPage to use useActionResolver
Operations + Masters both. Section defs:
`ActionLoading`, `ActionEmpty`, `ActionHeader`, `ActionForm`, `ActionActions`.
Add two new default components: `OperationActionLoading.vue`, `OperationActionEmpty.vue`
(and Masters equivalents).

### Step 7: Build verification
`quasar build` via npm — catch import/resolution errors.

## Acceptance Criteria
- Existing Approve/Reject/SendBack on Purchase Requisitions still works unchanged.
- A navigate-kind action (once added to sheet) routes without hitting ActionPage.
- Entity-specific override `components/Operations/PurchaseRequisitions/ActionForm.vue`
  auto-resolves without page code changes.
- Per-action override `components/Operations/PurchaseRequisitions/ActionFormApprove.vue`
  resolves only for the Approve action.
- Build succeeds.

## Files Changed
- `FRONTENT/src/composables/_resolveTieredComponent.js` (new)
- `FRONTENT/src/composables/useSectionResolver.js`
- `FRONTENT/src/composables/useActionResolver.js` (new)
- `FRONTENT/src/composables/useResourceConfig.js`
- `FRONTENT/src/pages/Operations/_common/ViewPage.vue`
- `FRONTENT/src/pages/Masters/_common/ViewPage.vue`
- `FRONTENT/src/pages/Operations/_common/ActionPage.vue`
- `FRONTENT/src/pages/Masters/_common/ActionPage.vue`
- `FRONTENT/src/components/Operations/_common/OperationActionLoading.vue` (new)
- `FRONTENT/src/components/Operations/_common/OperationActionEmpty.vue` (new)
- `FRONTENT/src/components/Masters/_common/MasterActionLoading.vue` (new)
- `FRONTENT/src/components/Masters/_common/MasterActionEmpty.vue` (new)

## Post-Execution Notes

### Build Result
`quasar build` succeeded after stubbing four pre-existing empty `.vue` files that
blocked the build (unrelated to this plan's scope — just orphans picked up by the
entity-scan globs):
- `components/Masters/Warehouse/ManageStockEditGrid.vue`
- `components/Masters/Warehouse/ManageStockContextStep.vue`
- `components/Masters/Warehouse/StockMovementRow.vue`
- `components/Operations/_common/OperationRecordCard.vue`
Each replaced with a minimal `<template><div/></template><script setup></script>`
stub. Follow-up: confirm whether these were intended to exist and either remove
them or implement the real content.

### Deviations
- None from the designed 5-tier shape.
- `kind` normalization keeps `mutate` fields flat at the top level (not nested
  under `mutate:{}`) to avoid churn in `useActionFields` and
  `appHelpers.deriveActionStampHeaders`. Nested `mutate:{}` input is still
  accepted — normalizer lifts its fields to the top.

### Manual Actions Required
- None. GAS `syncAppResources.gs` and `actionManager.html` are untouched; legacy
  action rows continue to work because the frontend normalizer treats missing
  `kind` as `'mutate'`.
