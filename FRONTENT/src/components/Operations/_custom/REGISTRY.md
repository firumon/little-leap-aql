# Custom Section Component Registry

Purpose: track tenant-specific section overrides under `components/Operations/_custom/`.

## How It Works

When `APP.Resources.CustomUIName` is set for a resource (e.g. `A2930`), the `useSectionResolver` composable checks for a custom section at:

```
components/Operations/_custom/{CustomUIName}/{Entity}{Section}.vue
```

If no custom section is found, resolution falls through to entity-custom (`components/Operations/{Entity}/{Section}.vue`) then to the default (`components/Operations/_common/Operation{Action}{Section}.vue`).

Full architecture reference: `Documents/MODULE_WORKFLOWS.md` Section 3.

## Valid Section Names Per Action

| Action | Valid Sections |
|--------|---------------|
| Index | `ListHeader`, `ListReportBar`, `ListToolbar`, `ListViewSwitcher`, `ListRecords` |
| View | `ViewHeader`, `ViewActionBar`, `ViewDetails`, `ViewParent`, `ViewChildren` |
| Add | `AddHeader`, `AddForm`, `AddChildren`, `AddActions` |
| Edit | `EditHeader`, `EditForm`, `EditChildren`, `EditActions` |
| Action | `ActionHeader`, `ActionForm`, `ActionActions` |

## File Naming Convention

```
_custom/{CustomUIName}/{Entity}{Section}.vue
```

Examples:
- `_custom/A2930/PurchaseRequisitionsListHeader.vue` — custom list header for PurchaseRequisitions under tenant A2930
- `_custom/A2930/PurchaseRequisitionsViewDetails.vue` — custom view details for PurchaseRequisitions under tenant A2930
- `_custom/HEILUNG/StockMovementsEditForm.vue` — custom edit form for StockMovements under tenant HEILUNG

**PascalCase rule**: The entity name must be the PascalCase conversion of the route slug.
- `purchase-requisitions` → `PurchaseRequisitions`
- `stock-movements` → `StockMovements`

## When to Use Section Overrides vs Full Page Overrides

| Scenario | Use |
|----------|-----|
| Only 1-2 sections need changes (e.g. different header layout) | Section override here (`components/Operations/_custom/`) |
| Most/all sections need changes or the page layout itself changes | Full page override in `pages/Operations/_custom/` |
| Custom page exists for a tenant+entity | No need for section overrides (the custom page controls its own sections) |

## Guidelines

- Custom sections should be **tiny layout shells** that reuse shared composables and components — not duplicated logic.
- Props and events must match the default component's contract (see `Documents/MODULE_WORKFLOWS.md` Section 3).
- No registration in code needed — `import.meta.glob` auto-discovers at build time.
- **Dev server restart** may be needed after creating new files (glob patterns are resolved at build/startup time).
- Update this registry table when adding new custom sections.

## Registered Custom Sections

| CustomUIName | Entity | Section | Description | Path |
|---|---|---|---|---|
| _(none yet)_ | | | | |
