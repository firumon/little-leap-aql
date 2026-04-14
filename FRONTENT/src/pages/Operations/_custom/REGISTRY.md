# Custom Page Registry

Purpose: track tenant-specific full-page overrides under `pages/Operations/_custom/`.

## How It Works

When `APP.Resources.CustomUIName` is set for a resource (e.g. `A2930`), the `ActionResolverPage` checks for a custom page at:

```
pages/Operations/_custom/{CustomUIName}/{Entity}.vue          → Index page
pages/Operations/_custom/{CustomUIName}/{Entity}{Action}.vue  → View/Add/Edit/Action pages
```

If no custom page is found, resolution falls through to entity-custom (`pages/Operations/{Entity}/`) then to the default (`pages/Operations/_common/`).

Full architecture reference: `Documents/MODULE_WORKFLOWS.md` Section 3.

## File Naming Convention

```
_custom/{CustomUIName}/{Entity}.vue              → replaces IndexPage
_custom/{CustomUIName}/{Entity}View.vue          → replaces ViewPage
_custom/{CustomUIName}/{Entity}Add.vue           → replaces AddPage
_custom/{CustomUIName}/{Entity}Edit.vue          → replaces EditPage
_custom/{CustomUIName}/{Entity}{ActionName}.vue  → replaces ActionPage for that action
```

Examples:
- `_custom/A2930/PurchaseRequisitions.vue` — custom index page for Purchase Requisitions under tenant A2930
- `_custom/A2930/PurchaseRequisitionsView.vue` — custom view page for Purchase Requisitions under tenant A2930
- `_custom/HEILUNG/StockMovements.vue` — custom index for Stock Movements under tenant HEILUNG

**PascalCase rule**: The entity name must be the PascalCase conversion of the route slug.
- `purchase-requisitions` → `PurchaseRequisitions`
- `stock-movements` → `StockMovements`

## When to Use Full Page Overrides vs Section Overrides

| Scenario | Use |
|----------|-----|
| Page layout/structure itself needs to change (e.g. different section order, extra panels) | Full page override here (`pages/Operations/_custom/`) |
| Only 1-2 sections need changes (e.g. different header layout) | Section override in `components/Operations/_custom/` instead |
| Both page and sections are custom | Full page only (it controls its own sections) |

## Guidelines

- Custom pages should be **thin orchestration shells** that reuse shared composables and components.
- If only a few sections need customization, prefer custom section components instead of a full custom page.
- One `CustomUIName` code can have pages for multiple entities.
- No registration in code needed — `import.meta.glob` auto-discovers at build time.
- **Dev server restart** may be needed after creating new files.
- Update this registry table when adding new custom pages.

## Registered Custom Pages

| CustomUIName | Entity | Action | Description | Path |
|---|---|---|---|---|
| _(none yet)_ | | | | |
