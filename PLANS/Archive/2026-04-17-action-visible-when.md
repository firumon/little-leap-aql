# Action `visibleWhen` condition support

Date: 2026-04-17
Agent: Solo

## Goal
Add a `visibleWhen` clause to `AdditionalActions` JSON so an action only appears on a record when the record matches the condition(s). Applies to both `mutate` and `navigate` kinds.

## JSON shape (A + C hybrid)
Single condition (object) or array of conditions (AND).

```json
{
  "action": "Approve",
  "kind": "mutate",
  "column": "Progress",
  "columnValue": "Approved",
  "visibleWhen": { "column": "Progress", "op": "in", "value": ["Pending", "Review"] }
}
```

```json
"visibleWhen": [
  { "column": "Progress", "op": "in", "value": ["Pending","Review"] },
  { "column": "Type",     "op": "ne", "value": "Asset" }
]
```

## Operators
- `eq`, `ne`
- `in`, `nin` (value is an array)
- `empty`, `notEmpty` (value ignored; `""`, `null`, `undefined` all count as empty)

## Rules
- Absent / `null` / `[]` → **visible** (backward compatible).
- Multi-condition → AND. If any condition fails, hide.
- Unknown `op` → treat as absent (visible). No errors, permissive default.

## Files to change
1. `FRONTENT/src/composables/useResourceConfig.js`
   - `normalizeAction` normalises `visibleWhen` to an array of `{column, op, value}`.
   - Export `isActionVisible(action, record)`.
2. `FRONTENT/src/pages/{Masters,Operations}/_common/ViewPage.vue`
   - Compute `visibleActions` = `additionalActions.filter(a => isActionVisible(a, record))`.
   - Pass `visibleActions` into ViewActionBar (and other consumers that currently receive `additionalActions`).
3. `FRONTENT/src/pages/{Masters,Operations}/_common/ActionPage.vue`
   - If action not visible for current record → render Empty with a "not available for this record" message.
4. `GAS/syncAppResources.gs` lines 282–286
   - Update PurchaseRequisitions demo: add `visibleWhen` so Approve/Reject/SendBack only show on `Progress in ["Review","Pending"]`.
5. `GAS/actionManager.html`
   - Add **Kind** selector (mutate | navigate).
   - Show mutate fields when kind=mutate; navigate target/pageSlug/resourceSlug/scope when kind=navigate.
   - Add **Visible When** editor: list of `{column, op, value}` rows with `+ Add condition`.
6. Docs
   - `Documents/OPERATION_CUSTOMIZATION.md`
   - `Documents/MASTER_CUSTOMIZATION.md`
   - Document `kind` (already briefly) and new `visibleWhen` clause with examples.

## Out of scope
- OR / nested conditions
- Enable/disable (greyed) state — only hide/show for now
- Per-user permission conditions (handled separately)

## Verification
- Build frontend.
- Spot-check ViewPage renders only the matching action for a seeded record.
