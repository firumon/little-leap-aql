# Custom Section Component Registry

Purpose: track tenant-specific section overrides under `components/Masters/_custom/`.

## How It Works

When `APP.Resources.CustomUIName` is set for a resource (e.g. `A2930`), the `useSectionResolver` composable checks for a custom section at:

```
components/Masters/_custom/{CustomUIName}/{Entity}{Section}.vue
```

If no custom section is found, resolution falls through to entity-custom (`components/Masters/{Entity}/{Section}.vue`) then to the default (`components/Masters/Master{Action}{Section}.vue`).

Full architecture reference: `Documents/MODULE_WORKFLOWS.md` Section 2.

## Valid Section Names Per Action

| Action | Valid Sections |
|--------|---------------|
| Index | `ListHeader`, `ListReportBar`, `ListToolbar`, `ListRecords` |
| View | `ViewHeader`, `ViewActionBar`, `ViewDetails`, `ViewAudit`, `ViewChildren` |
| Add | `AddHeader`, `AddForm`, `AddChildren`, `AddActions` |
| Edit | `EditHeader`, `EditForm`, `EditChildren`, `EditActions` |
| Action | `ActionHeader`, `ActionForm`, `ActionActions` |

## File Naming Convention

```
_custom/{CustomUIName}/{Entity}{Section}.vue
```

Examples:
- `_custom/A2930/ProductsListHeader.vue` — custom list header for Products under tenant A2930
- `_custom/A2930/ProductsViewDetails.vue` — custom view details for Products under tenant A2930
- `_custom/HEILUNG/WarehouseStoragesEditForm.vue` — custom edit form for WarehouseStorages under tenant HEILUNG

**PascalCase rule**: The entity name must be the PascalCase conversion of the route slug.
- `products` → `Products`
- `warehouse-storages` → `WarehouseStorages`
- `purchase-orders` → `PurchaseOrders`

## When to Use Section Overrides vs Full Page Overrides

| Scenario | Use |
|----------|-----|
| Only 1-2 sections need changes (e.g. different header layout) | Section override here (`components/Masters/_custom/`) |
| Most/all sections need changes or the page layout itself changes | Full page override in `pages/Masters/_custom/` |
| Custom page exists for a tenant+entity | No need for section overrides (the custom page controls its own sections) |

## Guidelines

- Custom sections should be **tiny layout shells** that reuse shared composables and components — not duplicated logic.
- Props and events must match the default component's contract (see `Documents/MODULE_WORKFLOWS.md` Section 2.4).
- No registration in code needed — `import.meta.glob` auto-discovers at build time.
- **Dev server restart** may be needed after creating new files (glob patterns are resolved at build/startup time).
- Update this registry table when adding new custom sections.

## Registered Custom Sections

| CustomUIName | Entity | Section | Description | Path |
|---|---|---|---|---|
| _(none yet)_ | | | | |
