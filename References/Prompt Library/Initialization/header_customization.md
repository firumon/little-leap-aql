# AQL Unified Header Customization Guide (Initialization)

Use this document to initialize an AI agent session when the task involves customizing, overriding, or debugging the resource header across any page (Index, Add, Edit, View, Action) in the AQL repository.

> **Scope Boundary**: This document covers both JS logic modifiers and template-based local header customizations, dynamic properties resolution, and back/reload button behaviors. Refer to [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for general frontend rules.

---

## 1. Architecture & Reference Files

The header uses a **two-tier architecture** that separates resolution (Vite glob registration and override matching) from presentation (rendering and slots):

1. **Orchestrator Shell**: [PageHeader.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/PageHeader.vue)
   - The central section component loaded via [Section.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Section.vue).
   - Injects `resourceConfig` and `resourceRecord` page contexts.
   - [Section.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Section.vue) resolves custom overrides or modifiers using [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js) (which scans `_ui/` for custom components/modifiers under section name `'PageHeader'`).
   - If a custom template is found, Vue renders it directly. If a JS modifier (`PageHeader.js`) is found, `useSectionResolver` merges configurations, evaluates properties via `evaluateProp`, and renders the base `PageHeader.vue` layer.
2. **Presentation Foundation**: [Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/app/Header.vue)
   - Houses the Quasar flex layout, styling, and standard slots.
   - Renders titles, subtitles, status chips, and back/reload button setups.

---

## 2. Dynamic Property Resolution Matrix

The orchestrator resolves properties in this priority order, evaluating function properties with both the active `record` context and the resource `config` if provided.

| Property | Local JS Modifier (`PageHeader.js`) | Default Fallback (Index Page) | Default Fallback (Add Page) | Default Fallback (Edit Page) | Default Fallback (View/Action Pages) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`label`** | `localConfig.label` (or function) | `config.name` | `"New [Resource]"` | `"Edit [Resource]"` | `config.name` / action label |
| **`caption`** | `localConfig.caption` (or function) | `config.description` | `"Create a new entry"` | `"[Code] - Modify"` | `"[Code] - Details"` / action suffix |
| **`icon`** | `localConfig.icon` | `null` (hidden) | `null` (hidden) | `null` (hidden) | `null` (hidden) |
| **`back`** | `localConfig.back` (Boolean/String/Function) | `false` (hidden) | `true` (shown) | `true` (shown) | `true` (shown) |
| **`reload`** | `localConfig.reload` | `true` (shown) | `false` (hidden) | `false` (hidden) | `false` (hidden) |

---

## 3. Back Button and Action Resolution Logic

The `back` property defined in a local JS modifier override (`PageHeader.js`) is highly overloaded to consolidate visibility, icon overrides, and custom navigation:

* **`back: false` or `'false'`**: Completely disables and hides the back button.
* **`back: Function`**: Renders the back button (default `'arrow_back'` icon) and executes the function on click.
* **`back: String`** (except `'true'`/`'false'`): Treats the string as a custom icon name (e.g., `'close'`). Renders the back button with this icon.
* **Default (`true`, `'true'`, or `undefined`)**:
  * If route history exists: **Show** back button (goes back `history -1`).
  * If route history is empty and page is not `'index'`: **Show** back button (navigates to `'index'`).
  * If route history is empty and page is `'index'`: **Hide** back button.

---

## 4. Local Customization Patterns

### Pattern 1: JS Logic Modifier (Preferred for prop changes)
Create a `.js` file inside the resource components directory under custom UI (e.g. `src/_ui/AQL/components/`) to modify the header props. You only need to return the properties you want to override; [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js) automatically merges them, and `PageHeader.vue` evaluates any function props via `evaluateProp`, passing `(record, config)` unwrapped context arguments to any function values.

#### `src/_ui/AQL/components/master/Products/Index/PageHeader.js`
```javascript
export default {
  // Override title/label and subtitle/caption (using record and config)
  label: (r, c) => r ? `Product: ${r.Name}` : (c?.name || 'Product Catalog'),
  caption: (r, c) => r ? `SKU: ${r.SkuCode}` : (c?.description || 'Manage catalog'),

  // Custom left icon
  icon: 'inventory_2',

  // Custom back button
  back: 'close',

  // Status chip badge customization
  chip: (r) => r?.Status || 'Draft',
  chipColor: (r) => r?.Status === 'Active' ? 'positive' : 'warning',
  chipTextColor: 'white'
}
```

### Pattern 2: Custom Template Wrapping `PageHeader` (Required for slot customization)
To customize the template structure or slots while preserving the standard layout, wrap the shared presentation panel in a `.vue` file.

> [!IMPORTANT]
> **To prevent parent orchestrator attributes from overriding your local properties, you MUST use `defineOptions({ inheritAttrs: false })` and bind `$attrs` BEFORE specifying your overrides.**

#### `src/_ui/AQL/components/master/Products/Index/PageHeader.vue`
```html
<template>
  <PageHeader
    v-bind="$attrs"
    label="Product Catalog"
    caption="Manage active catalog"
    :reload="false"
  >
    <!-- Override the chip slot with a custom widget -->
    <template #chip>
      <q-badge color="accent" class="q-py-xs">Special Catalog</q-badge>
    </template>
  </PageHeader>
</template>

<script setup>
import PageHeader from 'components/sections/PageHeader.vue'

// Disable automatic attribute fallthrough so parent attributes don't overwrite local values
defineOptions({ inheritAttrs: false })
</script>
```

> [!WARNING]
> **Do not use a `<div>` wrapper** (e.g. `<div><PageHeader ... /></div>`) to bypass overrides unless you intentionally want to isolate the child component. Wrapping in a `<div>` blocks the parent attributes completely, causing the panel to lose dynamic behaviors like the back button, reload actions, and status badges. Always prefer `inheritAttrs: false` instead.

### Pattern 3: Complete Custom Override
To completely bypass the standard layout, write a standard Vue template:

#### `src/_ui/AQL/components/master/Products/Index/PageHeader.vue`
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

