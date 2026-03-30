# Master Pages Architecture

## Overview

The Master Pages system uses **sub-route pages** with **two-level auto-discovery** for managing master, operation, and account resources. Each action (list, add, view, edit, custom actions) gets its own full page instead of dialogs.

## Route Structure

```
/:scope(masters|operations|accounts)/:resourceSlug
  ├── /                     → ListPage   (resource-list)
  ├── /add                  → AddPage    (resource-add)
  ├── /:code                → ViewPage   (resource-view)
  ├── /:code/edit           → EditPage   (resource-edit)
  └── /:code/:action        → ActionPage (resource-action, e.g. approve/reject)
```

## How It Works

### Two-Level Auto-Discovery

`ActionResolverPage.vue` resolves the correct page component at runtime:

```
User navigates to /masters/products/add
         |
   ActionResolverPage checks:
         |
   1. ./Products/AddPage.vue  (custom entity folder)
         |
   2. ./_common/AddPage.vue   (generic fallback)
```

**Resolution order** for each action:
1. `./Products/AddPage.vue` — custom entity-specific page
2. `./_common/AddPage.vue` — generic shared page

### Action-to-File Mapping

| Route Action | File Name | Purpose |
|---|---|---|
| `/` (list) | `ListPage.vue` | Card-based list with search/filter |
| `/add` | `AddPage.vue` | Create form with child records |
| `/:code` | `ViewPage.vue` | Read-only detail with actions |
| `/:code/edit` | `EditPage.vue` | Edit form with child records |
| `/:code/:action` | `ActionPage.vue` | Column-driven action form |

## Shell & Resolver

- **`ResourcePageShell.vue`** — Provides breadcrumbs and `<router-view>` wrapper
- **`ActionResolverPage.vue`** — Two-level `import.meta.glob` discovery, renders resolved component

## Common Pages (`_common/`)

Generic pages that work for any resource:

| Page | Description |
|---|---|
| `ListPage.vue` | Section-orchestrator list page (Header, Report Bar, Toolbar, Records), search, FAB to add |
| `ViewPage.vue` | Detail view with fields, child tables, action buttons, reports |
| `AddPage.vue` | Create form with composite parent + child save |
| `EditPage.vue` | Edit form loading existing record + children |
| `ActionPage.vue` | Column-driven action form (Approve, Reject, etc.) |

## Creating a Custom Page

### When to Customize

Create a custom page when you need entity-specific UI beyond what `_common/` provides.

### Steps

1. Create folder: `FRONTENT/src/pages/Masters/{EntityName}/`
2. Add the specific page file (e.g., `ListPage.vue`, `AddPage.vue`)
3. Only override the actions you need — others fall back to `_common/`

```
FRONTENT/src/pages/Masters/
├── _common/
│   ├── ListPage.vue
│   ├── ViewPage.vue
│   ├── AddPage.vue
│   ├── EditPage.vue
│   └── ActionPage.vue
├── Products/
│   └── ListPage.vue       # Custom list only; Add/View/Edit use _common/
├── ResourcePageShell.vue
├── ActionResolverPage.vue
└── README.md
```

### Naming Convention

Route slug → PascalCase folder name:
- `products` → `Products/`
- `price-lists` → `PriceLists/`
- `customer-groups` → `CustomerGroups/`

## Key Composables

| Composable | Purpose |
|---|---|
| `useResourceConfig` | Route params → resource config, headers, fields, actions, permissions |
| `useResourceData` | Cache-first loading, search, filter, background sync |
| `useResourceRelations` | Parent-child discovery from auth store |
| `useCompositeForm` | Parent + child form state, atomic composite save |
| `useActionFields` | Column-driven field resolution for action pages |

## Parent-Child (Composite) Records

- Driven by `ParentResource` column in APP.Resources
- `useResourceRelations` auto-discovers children from auth payload
- `useCompositeForm` handles recursive validate-all-first atomic save
- `ChildRecordsTable` renders inline editable child grids

## Additional Actions

Configured as JSON in the `AdditionalActions` column of APP.Resources:

```json
[
  {
    "action": "Approve",
    "label": "Approve",
    "icon": "check_circle",
    "color": "primary",
    "column": "Progress",
    "columnValue": "Approved",
    "confirm": true,
    "fields": [
      { "name": "Comment", "type": "textarea", "label": "Comment", "required": false }
    ]
  }
]
```

- **Column existence gate**: Field visibility determined by whether derived header exists in resource headers
- **Header derivation**: `{column}{columnValue}{fieldName}` (e.g., `ProgressApprovedComment`)
- **Multi-outcome**: `columnValueOptions` renders radio (<=4) or select (>4)
- **Auto-fill**: `*At` and `*By` suffixed columns are auto-filled by backend

## Files Reference

| File | Purpose |
|---|---|
| `ResourcePageShell.vue` | Breadcrumb wrapper + router-view |
| `ActionResolverPage.vue` | Two-level auto-discovery resolver |
| `_common/*.vue` | Generic pages for all resources |
| `{Entity}/*.vue` | Custom entity-specific page overrides |

