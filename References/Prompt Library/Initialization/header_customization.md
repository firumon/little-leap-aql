# AQL Unified Header Customization Guide (Initialization)

Use this document to initialize an AI agent session when the task involves customizing, overriding, or debugging the resource header across any page (Index, Add, Edit, View, Action) in the AQL repository.

> **Scope Boundary**: This document covers both JS logic modifiers and template-based local header customizations, dynamic properties resolution, and back/reload button behaviors. Refer to [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for general frontend rules.

---

## 1. Architecture & Reference Files

The header uses a **two-tier architecture** that separates orchestration (file scanning and fallback logic) from presentation (rendering and slots):

1. **Orchestrator Shell**: [Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Header/Header.vue)
   - The central entry point loaded by `Page.vue`.
   - Injects the page-level provided `resourceConfig` context.
   - Calls `useSectionResolver({ sectionName: 'Header', page })` to look for a custom header template (`Header.vue`) or JS logic modifier (`Header.js`).
   - If a custom template is found, mounts it. If a JS modifier is found, merges configurations and renders the presentation layer.
2. **Presentation Foundation**: [GenericHeaderPanel.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/GenericHeaderPanel.vue)
   - Houses the Quasar flex layout, styling, and standard slots.
   - Renders titles, subtitles, status chips, and back/reload button setups.

---

## 2. Dynamic Property Resolution Matrix

The orchestrator resolves properties in this priority order, evaluating functions with both the active `record` context and the resource `config` if provided.

| Property | Local `header` Source | High-Priority Metadata Source | Fallback (Index Page) | Fallback (Add Page) | Fallback (Edit Page) | Fallback (View Page) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`title`** | `localConfig.title` | `config.ui.header.title` | `config.name` | `"New [Resource]"` | `"Edit [Resource]"` | `config.name` |
| **`subtitle`**| `localConfig.subtitle` | `config.ui.header.subtitle` | `config.description` | `"Create a new entry"` | `"[Code] - Modify"` | `"[Code] - Details"` |
| **`icon`** | `localConfig.icon` | `config.ui.header.icon` | `null` (hidden) | `null` (hidden) | `null` (hidden) | `null` (hidden) |
| **`back`** | `localConfig.back` | `config.ui.header.back` | `false` (hidden) | `true` (shown) | `true` (shown) | `true` (shown) |
| **`reload`** | `localConfig.reload` | `config.ui.header.reload` | `true` (shown) | `false` (hidden) | `false` (hidden) | `false` (hidden) |

---

## 3. Back Button and Action Resolution Logic

The `back` property in the `header` configuration is highly overloaded to consolidate visibility, icon overrides, and custom navigation:

* **`back: false` or `'false'`**: Completely disables and hides the back button.
* **`back: Function`**: Renders the back button (default `'arrow_back'` icon) and executes the function on click.
* **`back: String`** (except `'true'`/`'false'`): Treats the string as a custom icon name (e.g., `'close'`). Renders the back button with this icon.
* **Default (`true`, `'true'`, or `undefined`)**:
  * If route history exists: **Show** back button (goes back `history -1`).
  * If route history is empty and page is not `'index'`: **Show** back button (navigates to `'index'`).
  * If route history is empty and page is `'index'`: **Hide** back button.

---

## 4. Local Customization Patterns

### Pattern 1: JS Logic Modifier (Tiers 7 & 8 only)
Create a `.js` file to modify the header props. You can return static config settings or functions reading the record and resource config:

#### `src/components/Masters/Products/Index/Header.js`
```javascript
export default function (props) {
  return {
    ...props,
    headerConfig: {
      // Title and subtitle as functions reading both active record and resource config
      title: (record, config) => record ? `Product: ${record.Name}` : (config?.name || 'Product Catalog'),
      subtitle: (record, config) => record ? `SKU: ${record.SkuCode}` : (config?.description || 'Manage catalog'),
      
      // Custom left icon
      icon: 'inventory_2',
      
      // Custom back button
      back: 'close',
      
      // Status chip badge customization
      chip: (record) => record?.Status || 'Draft',
      chipColor: (record) => record?.Status === 'Active' ? 'positive' : 'warning',
      chipTextColor: 'white'
    }
  }
}
```

### Pattern 2: Custom Template Wrapping `GenericHeaderPanel` (Tiers 1-8)
To customize the template structure or slots while preserving the standard layout, wrap the shared presentation panel in a `.vue` file:

#### `src/components/Masters/Products/Index/Header.vue`
```html
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

### Pattern 3: Complete Custom Override (Tiers 1-8)
To completely bypass the standard layout, write a standard Vue template:

#### `src/components/Masters/Products/Index/Header.vue`
```html
<template>
  <q-banner class="bg-primary text-white q-pa-md rounded-borders">
    <div class="row items-center justify-between">
      <span class="text-h6 text-weight-bold">Complete Custom Banner Header</span>
      <q-btn flat round icon="settings" color="white" />
    </div>
  </q-banner>
</template>
```
