# Master Pages Architecture

## Overview

The Master Pages system uses **sub-route pages** with **3-tier auto-discovery** for managing master, operation, and account resources. Each action (index, add, view, edit, custom actions) gets its own full page instead of dialogs. Per-tenant customization is driven by `APP.Resources.CustomUIName`.

## Route Structure

```
/:scope(masters|operations|accounts)/:resourceSlug
  ├── /                     → IndexPage  (resource-list)
  ├── /add                  → AddPage    (resource-add)
  ├── /:code                → ViewPage   (resource-view)
  ├── /:code/edit           → EditPage   (resource-edit)
  └── /:code/:action        → ActionPage (resource-action, e.g. approve/reject)
```

## How It Works

### 3-Tier Auto-Discovery

`ActionResolverPage.vue` resolves the correct page component at runtime:

```
User navigates to /master/products/add
         |
   ActionResolverPage checks (customUIName = "A2930"):
         |
   1. ./_custom/A2930/ProductsAdd.vue  (tenant-custom)
         |
   2. ./Products/AddPage.vue           (entity-custom)
         |
   3. ./_common/AddPage.vue            (generic fallback)
```

**Resolution order** for each action:
1. `./_custom/{CustomUIName}/{Entity}{Action}.vue` — tenant-specific page
2. `./{Entity}/{Action}Page.vue` — entity-specific page
3. `./_common/{Action}Page.vue` — generic shared page

### Action-to-File Mapping

| Route Action | File Name | Purpose |
|---|---|---|
| `/` (index) | `IndexPage.vue` | Card-based list with search/filter |
| `/add` | `AddPage.vue` | Create form with child records |
| `/:code` | `ViewPage.vue` | Read-only detail with actions |
| `/:code/edit` | `EditPage.vue` | Edit form with child records |
| `/:code/:action` | `ActionPage.vue` | Column-driven action form |

## Shell & Resolver

- **`ResourcePageShell.vue`** — Provides breadcrumbs and `<router-view>` wrapper
- **`ActionResolverPage.vue`** — 3-tier `import.meta.glob` discovery with `CustomUIName` support

## Section-Level Component Architecture

Each page is split into independently replaceable **sections** using `useSectionResolver`. Sections also follow 3-tier resolution:

1. **Tenant-custom**: `components/master/_custom/{CustomUIName}/{Entity}{Section}.vue`
2. **Entity-custom**: `components/master/{Entity}/{Section}.vue`
3. **Default**: `components/master/Master{Action}{Section}.vue`

See `Documents/MODULE_WORKFLOWS.md` Section 2 for full details on sections, props, and events.

## Common Pages (`_common/`)

Generic pages that work for any resource:

| Page | Description |
|---|---|
| `IndexPage.vue` | Section-orchestrator index page (Header, Report Bar, Toolbar, Records), search, FAB to add |
| `ViewPage.vue` | Detail view with fields, child tables, action buttons, reports |
| `AddPage.vue` | Create form with composite parent + child save |
| `EditPage.vue` | Edit form loading existing record + children |
| `ActionPage.vue` | Column-driven action form (Approve, Reject, etc.) |

## Creating Custom Overrides

### Option A: Tenant-Custom Section (Most Common)

Override one section for a specific tenant:
```
FRONTENT/src/components/master/_custom/{CustomUIName}/{Entity}{Section}.vue
```

### Option B: Entity-Custom Section

Override one section for all tenants:
```
FRONTENT/src/components/master/{Entity}/{Section}.vue
```

### Option C: Tenant-Custom Full Page

Replace the entire page for a specific tenant:
```
FRONTENT/src/pages/master/_custom/{CustomUIName}/{Entity}.vue
FRONTENT/src/pages/master/_custom/{CustomUIName}/{Entity}{Action}.vue
```

### Option D: Entity-Custom Full Page

Replace the entire page for all tenants:
```
FRONTENT/src/pages/master/{Entity}/{Action}Page.vue
```

### Directory Structure

```
FRONTENT/src/pages/master/
├── _common/
│   ├── IndexPage.vue
│   ├── ViewPage.vue
│   ├── AddPage.vue
│   ├── EditPage.vue
│   └── ActionPage.vue
├── _custom/
│   └── A2930/
│       └── Products.vue       # Tenant-custom index page
├── Products/
│   └── IndexPage.vue          # Entity-custom; other actions use _common/
├── ResourcePageShell.vue
├── ActionResolverPage.vue
└── README.md
```

### Naming Convention

Route slug → PascalCase folder/file name:
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
| `useSectionResolver` | Generic 3-tier section resolver for all page actions |

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
| `ActionResolverPage.vue` | 3-tier auto-discovery resolver with CustomUIName |
| `_common/*.vue` | Generic pages for all resources (5 action pages) |
| `_custom/{Code}/*.vue` | Tenant-specific page overrides |
| `{Entity}/*.vue` | Entity-specific page overrides |

