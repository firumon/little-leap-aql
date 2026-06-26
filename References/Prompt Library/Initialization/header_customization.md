# AQL Unified Header Customization Guide (Initialization)

Use this document to initialize an AI agent session when the task involves customizing, overriding, or debugging the resource header across any page (Index, Add, Edit, View, Action) in the AQL repository.

> **Scope Boundary**: This document covers both script-only and template-based local header customizations, dynamic properties resolution, and back/reload button behaviors. Refer to [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for general frontend rules.

---

## 1. Architecture & Reference Files

The header uses a **two-tier architecture** that separates orchestration (file scanning and fallback logic) from presentation (rendering and slots):

1. **Orchestrator Shell**: [Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Header.vue)
   - The central entry point loaded by all page controllers.
   - Dynamically scans the Vite glob registry for local overrides at `src/components/[Scope]/[Resource]/[Page]/Header.vue` (page-specific) or `src/components/[Scope]/[Resource]/Header.vue` (resource-generic).
   - If a local header has a template, it mounts it directly. Otherwise, it merges script configurations and renders the presentation layer.
2. **Presentation Foundation**: [GenericHeaderPanel.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/GenericHeaderPanel.vue)
   - Houses the Quasar flex layout, styling, and standard slots.
   - Renders titles, subtitles, status chips, and back/reload button setups.
3. **Reload Presentation**: [ReloadButton.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/ReloadButton.vue)
   - Renders the refresh button and handles IndexedDB dependency syncing.

---

## 2. Dynamic Property Resolution Matrix

The orchestrator resolves properties in this priority order, evaluating functions with the active `record` context if provided.

| Property | Local `headerConfig` Source | High-Priority Metadata Source | Fallback (Index Page) | Fallback (Add Page) | Fallback (Edit Page) | Fallback (View Page) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`title`** | `localConfig.title` | `config.ui.header.title` | `config.name` | `"New [Resource]"` | `"Edit [Resource]"` | `config.name` |
| **`subtitle`**| `localConfig.subtitle` | `config.ui.header.subtitle` | `config.description` | `"Create a new entry"` | `"[Code] - Modify"` | `"[Code] - Details"` |
| **`icon`** | `localConfig.icon` | `config.ui.header.icon` | `null` (hidden) | `null` (hidden) | `null` (hidden) | `null` (hidden) |
| **`back`** | `localConfig.back` | `config.ui.header.back` | `false` (hidden) | `true` (shown) | `true` (shown) | `true` (shown) |
| **`reload`** | `localConfig.reload` | `config.ui.header.reload` | `true` (shown) | `false` (hidden) | `false` (hidden) | `false` (hidden) |

---

## 3. Back Button and Action Resolution Logic

The `back` property in `headerConfig` is highly overloaded to consolidate visibility, icon overrides, and custom navigation:

* **`back: false` or `'false'`**: Completely disables and hides the back button.
* **`back: Function`**: Renders the back button (default `'arrow_back'` icon) and executes the function on click.
* **`back: String`** (except `'true'`/`'false'`): Treats the string as a custom icon name (e.g., `'close'`). Renders the back button with this icon.
* **Default (`true`, `'true'`, or `undefined`)**:
  * If route history exists: **Show** back button (goes back `history -1`).
  * If route history is empty and page is not `'index'`: **Show** back button (navigates to `'index'`).
  * If route history is empty and page is `'index'`: **Hide** back button.

---

## 4. Local Customization Patterns

### Pattern 1: Script-Only Customization (No Template)
Create a local header file and export a `headerConfig` object. Variables can be plain values or functions reading the active `record`.

> [!NOTE]
> When exporting `headerConfig` from a component using `<script setup>`, you must use a secondary, standard `<script>` block to expose the export to the module registry.

```html
<!-- src/components/Masters/Products/Index/Header.vue -->
<script>
export const headerConfig = {
  // Title and subtitle as functions reading active record
  title: (record) => record ? `Product: ${record.Name}` : 'Product Catalog',
  subtitle: (record) => record ? `SKU: ${record.SkuCode}` : 'Manage catalog',
  
  // Custom left icon (hidden if not defined)
  icon: 'inventory_2',
  
  // Custom back button (string = custom icon, function = custom click action)
  back: 'close',
  
  // Reload button: false to disable, string for custom icon name (default: 'refresh')
  reload: 'sync',
  
  // Status chip badge customization (accepts string or function)
  chip: (record) => record?.Status || 'Draft',
  chipColor: (record) => record?.Status === 'Active' ? 'positive' : 'warning',
  chipTextColor: 'white'
}
</script>

<script setup>
// Normal component setup logic can reside here
</script>
```

### Pattern 2: Custom Template Wrapping `GenericHeaderPanel`
To customize the template structure or slots while preserving the standard layout, wrap the shared presentation panel:

```html
<!-- src/components/Masters/Products/Index/Header.vue -->
<template>
  <GenericHeaderPanel
    v-bind="$attrs"
    label="Product Catalog"
    caption="Manage active catalog"
    :reload="false"
  >
    <!-- Override the chip slot with a custom widget -->
    <template #chip>
      <q-badge color="accent" class="q-py-xs">Special Catalog</q-badge>
    </template>
  </GenericHeaderPanel>
</template>

<script setup>
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
</script>
```

### Pattern 3: Complete Custom Override
To completely bypass the standard layout and write a completely custom header, simply write standard HTML and Quasar markup in the template:

```html
<!-- src/components/Masters/Products/Index/Header.vue -->
<template>
  <q-banner class="bg-primary text-white q-pa-md rounded-borders">
    <div class="row items-center justify-between">
      <span class="text-h6 text-weight-bold">Complete Custom Banner Header</span>
      <q-btn flat round icon="settings" color="white" />
    </div>
  </q-banner>
</template>
```
