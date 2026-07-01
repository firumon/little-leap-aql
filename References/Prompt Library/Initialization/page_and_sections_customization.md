# AQL Resource-Level Page & Section Customization Guide (Initialization)

This initialization prompt guides the implementation, customization, and override of frontend pages and components for specific database resources in the AQL repository. It ensures that modular customization is achieved without cluttering or modifying the shared framework-level fallback components.

> [!IMPORTANT]
> **Scope Boundary**: This document covers ONLY resource-level frontend overrides placed under `src/components/[Scope]/[ResourceName]/`. It does NOT cover building common fallback components under `src/components/_common/` or modifying the central resolver itself. For framework-level component creation, read [common_component_creation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/common_component_creation.md).

---

## 1. Customization Priority: The Last-Layer Rule

When customizing layouts for a specific resource, **direct your changes to the deepest nested component ("last-layer component") rather than duplicating higher-level shells**.
* **High-Level Orchestrators**: Never duplicate or customize top-level page controllers (`IndexPage.vue`, `ViewPage.vue`, etc.) or generic section wrappers.
* **Last-Layer Customization**: Focus overrides on the final rendering leaf nodes that bind and display the records:
  - For **Index listing**: Customize/override `Records.vue` or `RecordsRecord.vue`.
  - For **View details**: Customize/override `Details.vue` or `Parent.vue`.
  - For **Add/Edit forms**: Customize/override `Form.vue`.

---

## 2. Overrides Directory Structure & Naming Contracts

Standard resource-specific overrides in the codebase must be placed directly under `src/components/[Scope]/[ResourceName]/` in a completely flat structure. **No custom subdirectories** (such as `Records/`, `Forms/`, etc.) are allowed.

A custom override component must be placed at one of two target locations:

1. **Page-Generic Override** (Applies across all pages of the resource):
   `src/components/[Scope]/[ResourceName]/[Section].[vue|js]`
   - *Example*: `src/components/Masters/Products/Records.vue`
2. **Page-Specific Override** (Applies ONLY on a specific page: `Index`, `View`, `Add`, `Edit`, `Action`):
   `src/components/[Scope]/[ResourceName]/[Page]/[Section].[vue|js]`
   - *Where `[Page]` is one of: `Index`, `View`, `Add`, `Edit`, `Action`*
   - *Example*: `src/components/Masters/Products/Index/Header.vue` (overriding header ONLY on the Products Index page)

---

## 3. Page-Level Context Sharing (Provide / Inject) (STRICT)

Custom override components must **never** instantiate `useResourceConfig()` or `useRecord()` locally. Page-level orchestrators instantiate these and `provide` them. Overridden components must `inject` the existing context to keep the state synchronized.

```javascript
// CORRECT: Inject provided context
const { scope, resourceSlug, config } = inject('resourceConfig')
const { record, loading, searchTerm } = inject('resourceRecord', { record: ref(null) })
```

---

## 4. Separation of Concerns (Thin Templates & Composables)

All SFC files must remain thin and presentation-focused:
1. **SFC Script Block**: Use strictly to define props, emits, inject context, and map data properties to the HTML markup.
2. **Composables Business Logic**: Place all calculations, validation rules, API calls (Axios/HTTP), and multi-step data formatting in a custom resource composable under `src/composables/resources/` (e.g. `useProductForm.js`).

---

## 5. Strict Style Restraint

1. **No SFC Style Blocks**: Single File Components (SFCs) must avoid `<style>` or `<style scoped>` blocks. Rely entirely on native Quasar flex layout classes and utility spacing classes.
2. **Centralized SCSS**: Place all necessary custom styling in [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss).
3. **Generic Class Naming**: Any classes added to `custom.scss` must have strictly generic names. It is **forbidden** to include names of pages, resources, scopes, or entities in class names (e.g., use `.aql-card-flat` instead of `.products-detail-card`).

---

## 6. Concrete Override Examples

### 6.1 Template Override: Records.vue
To replace the default list rendering layout with a completely custom Vue template:

#### `src/components/Masters/Products/Records.vue`
```html
<template>
  <q-card flat bordered class="q-mt-sm rounded-borders">
    <q-card-section>
      <q-list separator>
        <q-item v-for="row in items" :key="row.Code" clickable @click="$emit('navigate-to-view', row.Code)">
          <q-item-section>
            <div class="row items-center justify-between">
              <span class="text-weight-bold text-primary">{{ row.Name }}</span>
              <q-badge :color="row.Status === 'Active' ? 'positive' : 'negative'">
                {{ row.Status }}
              </q-badge>
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">
              SKU: {{ row.SkuCode }} | Price: {{ row.Price }}
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true }
})
defineEmits(['navigate-to-view'])
</script>
```

### 6.2 JS Logic Modifier: ViewSwitcher.js
To customize property structures, icons, labels, or configurations programmatically without replacing the HTML layout template, create a `.js` modifier file under Tiers 7 & 8:

#### `src/components/Masters/Products/Index/ViewSwitcher.js`
```javascript
/**
 * Intercepts and adjusts the props fed to the ViewSwitcher fallback component.
 */
export default function (props) {
  return {
    ...props,
    viewSwitcherConfig: {
      // Custom tab labels showing counts
      label: (view, items) => `${view.name} (${items.filter(r => r.Status === view.name).length})`,
      
      // Custom tab icons
      icon: (view) => view.name === 'Active' ? 'check_circle' : 'cancel',
      
      // Configuration overrides
      stacked: false,
      outsideArrows: true,
      iconSize: '16px'
    }
  }
}
```

---

## 7. Registry Maintenance & Pre-Reads

1. **Verify Registries**: Before creating overlays, ensure no reusable component or composable already exists in:
   - Reusable Components: [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
   - Reusable Business Logic: [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md)
2. **Update Registries**: If a custom component or composable is developed that could be shared, document it inside the registries above.
3. **Core Rules Compliance**: Every custom override file must strictly respect [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

---

## 8. Attribute Overrides & Merging Workarounds (STRICT)

When overriding properties on same-component overlays (e.g. wrapper component using the standard fallback internally), parent fallthrough attributes will overwrite the local component's root-node attributes. Use these strict rules to handle merging:

### 8.1 Preferred: JS Logic Modifiers for Property Changes
If you only need to change props (like `label`, `caption`, `reload`), use a `.js` modifier instead of a `.vue` template. The [useCommonSection.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useCommonSection.js) wrapper (built on top of [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js)) automatically merges and evaluates them dynamically:
```javascript
// Return only the overrides; common defaults are preserved automatically
export default {
  label: 'Than podo'
}
```

### 8.2 Template Overrides: inheritAttrs: false + Explicit v-bind
If you must write a `.vue` template (e.g. when slots are required), prevent default attribute overrides by disabling inheritance and manually binding `$attrs` **before** the local properties:
```html
<template>
  <GenericHeaderPanel v-bind="$attrs" label="Than podo" />
</template>

<script setup>
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
defineOptions({ inheritAttrs: false })
</script>
```

### 8.3 The Div-Wrapping Workaround Warning
Wrapping the panel inside a wrapper element (like `<div><GenericHeaderPanel label="..." /></div>`) stops parent attributes from overriding the local panel. 

> [!CAUTION]
> **Do not use this unless you deliberately want to break connection with the parent orchestrator**. The dynamic back buttons, reload commands, status badges, and other parent-computed attributes will be captured by the outer `<div>` and lost to the inner panel. Prefer **inheritAttrs: false** for template wrapping instead.
