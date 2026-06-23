# Master Resource Customization

## Overview

The Masters module's frontend architecture is designed for deep customization, allowing tenant-specific or entity-specific overrides for various UI components. This is achieved through a multi-tiered component resolution system powered by `useSectionResolver.js`.

- **12-Tier Resolution**: All standard page sections (like `Header`, `Toolbar`, `Records`, `Details`, `Children`) are resolved using a unified 12-tier priority checklist.
- **Bare Section Keys**: Resolvers use simple bare keys (like `Header` instead of `ListHeader`, or `Record` instead of `ListRecordsRecord`) to localise namespaces and reduce template complexity.
- **Vite Glob Discovery**: New components are dynamically scanned and registered from the `src/components/` directory at build time.

---

## Directory Structure

Custom components for Masters resources must be placed in specific directories to be discovered by the 12-tier resolver.

### 12-Tier Priority Resolution Paths:
1. **Tenant-custom, Entity-specific, Page-specific**:
   `components/_custom/{customUIName}/{ScopeFolder}/{EntityName}/{Page}/{SectionFilename}`
2. **Tenant-custom, Entity-specific, Page-generic**:
   `components/_custom/{customUIName}/{ScopeFolder}/{EntityName}/{SectionFilename}`
3. **Tenant-custom, Scope-common, Page-specific**:
   `components/_custom/{customUIName}/{ScopeFolder}/{Page}/{SectionFilename}`
4. **Tenant-custom, Global Page-specific (Scope-generic)**:
   `components/_custom/{customUIName}/{Page}/{SectionFilename}`
5. **Tenant-custom, Scope-common, Page-generic**:
   `components/_custom/{customUIName}/{ScopeFolder}/{SectionFilename}`
6. **Tenant-custom, Tenant-global**:
   `components/_custom/{customUIName}/{SectionFilename}`
7. **Entity-custom, Page-specific**:
   `components/{ScopeFolder}/{EntityName}/{Page}/{SectionFilename}`
8. **Entity-custom, Page-generic**:
   `components/{ScopeFolder}/{EntityName}/{SectionFilename}`
9. **Scope-common, Page-specific**:
   `components/_common/{ScopeFolder}/{Page}/{SectionFilename}`
10. **Scope-common, Scope-generic**:
    `components/_common/{ScopeFolder}/{SectionFilename}`
11. **Global-common, Page-specific**:
    `components/_common/{Page}/{SectionFilename}`
12. **Global-common (Global fallback)**:
    `components/_common/{SectionFilename}`

*Note: For the Masters module, `{ScopeFolder}` is always `Masters`.*

---

## Naming Conventions

- **Component Files**: Must be `PascalCase`. E.g., `Header.vue`, `Records.vue`.
- **Entity Folders**: Must be `PascalCase` derived from the resource slug. E.g., `products` -> `Products`.
- **Custom Name Folders**: The `customUIName` from the resource config.

---

## Action-Specific Suffix Checking
For pages like `ActionPage.vue` or custom workflows, you can override components for specific actions (like `Approve` or `Reject`).
For each tier checked, the resolver searches for:
1. **`{actionKey}{SectionFilename}.vue`** (e.g. `ApproveForm.vue` or `ApproveActions.vue`)
2. **`{SectionFilename}.vue`** (e.g. `Form.vue` or `Actions.vue`)

---

## Component Reference Table
The standard default components reside in `src/components/_common/` and are organized by their respective page type (e.g. `Add/`, `Edit/`, `List/`, `View/`, `Action/`).

| Page Type | Section Key | Purpose | Default Component File |
| :--- | :--- | :--- | :--- |
| **List** | `Header` | List title, counts, and reload buttons | `components/_common/List/Header.vue` |
| **List** | `Toolbar` | Search bar for text filtering | `components/_common/List/Toolbar.vue` |
| **List** | `ViewSwitcher` | Switcher chips for named list views | `components/_common/List/ViewSwitcher.vue` |
| **List** | `Records` | Card list container with loading/empty handlers | `components/_common/Masters/List/Records.vue` |
| **List** | `Loading` | Page-level loading spinner | `components/_common/List/Loading.vue` |
| **List** | `Empty` | Page-level empty state | `components/_common/List/Empty.vue` |
| **View** | `Header` | View page header with primary metadata | `components/_common/View/Header.vue` |
| **View** | `ActionBar` | Custom outcomes & edit triggers | `components/_common/Masters/View/ActionBar.vue` |
| **View** | `Details` | Record values grid | `components/_common/Masters/View/Details.vue` |
| **View** | `Audit` | Creation/modification metadata | `components/_common/View/Audit.vue` |
| **View** | `Children` | Loop of child resource lists | `components/_common/Masters/View/Children.vue` |
| **View** | `Loading` | Page-level loading spinner | `components/_common/View/Loading.vue` |
| **View** | `Empty` | Page-level record not found card | `components/_common/View/Empty.vue` |
| **Add** | `Header` | Form header title | `components/_common/Add/Header.vue` |
| **Add** | `Form` | Composite data input fields | `components/_common/Masters/Add/Form.vue` |
| **Add** | `Children` | Sub-tables for child record rows | `components/_common/Masters/Add/Children.vue` |
| **Add** | `Actions` | Cancel and Submit controls | `components/_common/Add/Actions.vue` |

---

## Step-by-Step Customization Example

### Goal: Customize the view details component for "Products" for a specific tenant `C456`

1. **Set `customUIName`**: In the resource configuration for `products`, ensure `ui.customUIName` is set to `"C456"`.
2. **Create the file**:
   - The resource slug is `products` (PascalCase: `Products`).
   - The page is `View`.
   - The component to override is `Details`.
   - Create the file path:
     `src/components/_custom/C456/Masters/Products/View/Details.vue`
3. **Implement the component**:
   - Reuse the default details fields and structure.
   - Branded customization can be added (e.g. customized headers or layout grids).
4. **Vite auto-discovery**: Save the file. Vite automatically registers the file in the glob mapping. (A dev server restart may be needed if a new folder is created for the first time).

---

## Rules and Gotchas

- **Vite Cache**: If a new component path does not load, restart the local Vite dev server.
- **Props/Emits Contract**: Override components MUST match the props and emits of the default component they replace.
- **`markRaw` wrapping**: Any custom component returned by resolvers is automatically wrapped in Vue's `markRaw` to avoid reactivity performance warnings.
- **Thin Components**: Keep custom overrides focused on layout and styles; business logic should remain in the shared composables.
