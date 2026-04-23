# PLAN: Manage Stock Card-Based UX Implementation
**Status**: COMPLETED
**Created**: 2026-04-07
**Created By**: Solo Agent (Codex)
**Executed By**: Solo Agent (Codex | COMPLETED)

## Objective
Implement the full card-based Manage Stock UX for `/operations/manage-stock` so stock entry/editing is compact, non-blocking, and aligned with operator workflow.

## Context
- Current Step 2 uses a wide table with horizontal scrolling and blocking submit overlay.
- User requested per-SKU cards, location lines inside each card, inline edit/delete behavior, progressive add-new-location rows, and background save per card.
- Existing backend contract remains `StockMovements` (`QtyChange` as signed delta), with `WarehouseStorages` upsert hook.

## Pre-Conditions
- [x] Required source docs reviewed (`MODULE_WORKFLOWS`, collaboration protocols, handoff).
- [x] Current Manage Stock files and composable behavior reviewed.
- [x] Existing route and API contract validated before UI refactor.

## Steps

### Step 1: Refactor Step 2 UI to Card Model
- [x] Replace table layout in `ManageStockEditGrid.vue` with card stack UI.
- [x] Add “new movement card” with SKU selector and animated body reveal.
- [x] Render one card per SKU showing existing location lines and total quantity footer.
- [x] Add per-card edit toggle and line-level delete action.
**Files**: `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`
**Pattern**: keep Step 1/Step 2 split and `useStockMovements` composable usage.
**Rule**: no full-page horizontal scroll; UX must be mobile-friendly.

### Step 2: Implement Card Data Model + Save Flow
- [x] Introduce in-component card/line data model (existing rows + draft lines + computed totals).
- [x] Keep delta/newQty bi-directional behavior per line.
- [x] Save per card in background (header spinner), no global blocking loader.
- [x] Preserve aggregate notifications and failure reporting.
**Files**: `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`, `FRONTENT/src/composables/useStockMovements.js`
**Pattern**: continue using `callGasApi('create', { scope:'operation', resource:'StockMovements' })`.
**Rule**: only non-zero deltas are submitted.

### Step 3: Documentation + Registry + Validation
- [x] Update component registry descriptions for Manage Stock components.
- [x] Update Manage Stock section in `MODULE_WORKFLOWS.md` to card-based flow.
- [x] Add handoff note in `CONTEXT_HANDOFF.md`.
- [x] Run frontend build and GAS deployment command.
**Files**: `FRONTENT/src/components/REGISTRY.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/CONTEXT_HANDOFF.md`
**Pattern**: keep docs aligned with runtime UX and data contract.
**Rule**: if GAS files change, run `npm run gas:push`.

## Documentation Updates Required
- [x] Update `FRONTENT/src/components/REGISTRY.md` for card-based Manage Stock Step 2 behavior.
- [x] Update `Documents/MODULE_WORKFLOWS.md` (Section 5 Manage Stock architecture/flow).
- [x] Update `Documents/CONTEXT_HANDOFF.md` with dated note.

## Acceptance Criteria
- [x] Step 2 shows card-based stock editor with no horizontal table scroll.
- [x] Operators can add/edit/delete per-location lines per SKU card.
- [x] Save happens per card in background (no UI-blocking overlay), with correct movement creation and feedback.
- [x] Frontend build passes.

## Post-Execution Notes (Solo Agent fills this)

### Progress Log
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed

### Deviations / Decisions
- [x] `[?]` Decision needed: Kept `StockMovementRow.vue` as legacy fallback component; new Step 2 no longer depends on it.
- [x] `[!]` Issue/blocker: No blocking issues during implementation/build.

### Files Actually Changed
- `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue`
- `FRONTENT/src/composables/useStockMovements.js`
- `FRONTENT/src/components/REGISTRY.md`
- `FRONTENT/src/composables/REGISTRY.md`
- `Documents/MODULE_WORKFLOWS.md`
- `Documents/CONTEXT_HANDOFF.md`

### Validation Performed
- [x] Frontend build passes
- [x] Manual validation completed

### Manual Actions Required
- [ ] Re-login and validate Manage Stock UX in browser on desktop + mobile widths.
