# AQL Resource-Level Page & Section Customization Guide (Initialization)

This initialization prompt guides the implementation, customization, and override of frontend pages and components for specific database resources in the AQL repository. It ensures that modular customization is achieved without cluttering or modifying the shared framework-level fallback components.

> [!IMPORTANT]
> **Scope Boundary**: This document covers ONLY resource-level frontend overrides placed under `src/components/[Scope]/[ResourceName]/`. It does NOT cover building common fallback components under `src/components/_common/` or modifying the central resolver itself. For framework-level component creation, read [common_component_creation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/common_component_creation.md).

---

## 1. Customization Priority: The Last-Layer Rule

When customizing layouts for a specific resource, **direct your changes to the deepest nested component ("last-layer component") rather than duplicating higher-level shells**.
* **High-Level Orchestrators**: Never duplicate or customize top-level page controllers (`IndexPage.vue`, `ViewPage.vue`, etc.) or generic section wrappers.
* **Last-Layer Customization**: Focus overrides on the final rendering leaf nodes that bind and display the records:
  - For **Index listing**: Customize/override `RecordsListItem.vue` or `RecordsListItemHeader.vue`.
  - For **View details**: Customize/override `Details.vue` or `DetailItem.vue`.
  - For **Add/Edit forms**: Customize/override `FormField.vue` or `FormFieldControl.vue`.

---

## 2. Overrides Directory Structure & Naming Contracts

Standard resource-specific overrides in the codebase must be placed directly under `src/components/[Scope]/[ResourceName]/` in a completely flat structure. **No custom subdirectories** (such as `Records/`, `Forms/`, etc.) are allowed.

A custom override component must be placed at one of two target locations:

1. **Page-Generic Override** (Applies across all pages of the resource):
   `src/components/[Scope]/[ResourceName]/[Section].vue`
   - *Example*: `src/components/Masters/Products/RecordsListItem.vue`
2. **Page-Specific Override** (Applies ONLY on a specific page: `Index`, `View`, `Add`, `Edit`, `Action`):
   `src/components/[Scope]/[ResourceName]/[Page]/[Section].vue`
   - *Example*: `src/components/Masters/Products/Index/Header.vue` (overriding header ONLY on the Products Index page)

### Recursive Sub-component Overrides
For leaf sub-components resolved inside generic sections (like `SearchInputIcon` resolved on the `Index` page), they follow the same flat structure:
* `src/components/[Scope]/[ResourceName]/SearchInputIcon.vue` (generic)
* `src/components/[Scope]/[ResourceName]/Index/SearchInputIcon.vue` (page-specific)

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

### 6.1 Last-Layer Override: RecordsListItem.vue
Customize how product records display in the Index list view:

#### `src/components/Masters/Products/RecordsListItem.vue`
```html
<template>
  <q-item clickable class="q-pa-sm aql-card-flat" @click="$emit('open-detail', row.Code)">
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
</template>

<script setup>
defineProps({
  row: { type: Object, required: true }
})
defineEmits(['open-detail'])
</script>
```

### 6.2 Form Override Delegating to a Composable
Delegate form fields, validation, and submission logic to a separate composable:

#### `src/composables/resources/useProductForm.js`
```javascript
import { ref, computed } from 'vue'
import { api } from 'boot/axios'

export function useProductForm(productCode) {
  const form = ref({ Name: '', SkuCode: '', Price: 0 })
  const errors = ref({})
  const loading = ref(false)

  const isValid = computed(() => Object.keys(errors.value).length === 0)

  function validate() {
    errors.value = {}
    if (!form.value.Name) errors.value.Name = 'Name is required'
    if (!form.value.SkuCode) errors.value.SkuCode = 'SKU is required'
    return isValid.value
  }

  async function submit() {
    if (!validate()) return false
    loading.value = true
    try {
      await api.post('/products/save', form.value)
      return true
    } catch (err) {
      errors.value.global = err.message || 'Submission failed'
      return false
    } finally {
      loading.value = false
    }
  }

  return { form, errors, loading, submit }
}
```

#### `src/components/Masters/Products/Form.vue`
```html
<template>
  <q-card flat bordered class="q-pa-md">
    <q-card-section class="q-gutter-y-sm">
      <q-input 
        v-model="form.Name" 
        label="Product Name *" 
        :error="!!errors.Name" 
        :error-message="errors.Name"
        dense outlined 
      />
      <q-input 
        v-model="form.SkuCode" 
        label="SKU Code *" 
        :error="!!errors.SkuCode" 
        :error-message="errors.SkuCode"
        dense outlined 
      />
      <q-btn 
        label="Save Product" 
        color="primary" 
        :loading="loading" 
        @click="submit" 
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useProductForm } from 'src/composables/resources/useProductForm'

const props = defineProps({
  code: { type: String, default: '' }
})

const { form, errors, loading, submit } = useProductForm(props.code)
</script>
```

### 6.3 Script-Only Override: ViewSwitcher.vue
You can customize the layout, icons, labels, and behavior of the list view switcher on the Index page using a script-only Vue component (no `<template>` tag, only `<script>` or `<script setup>`).

Create a file named `ViewSwitcher.vue` under your resource's Index override folder (e.g., `src/components/Masters/Products/Index/ViewSwitcher.vue`):

```vue
<script>
export const config = {
  // Label: string or fn(viewItem, items, resourceConfig)
  label: (view, items) => `${view.name} (${items.filter(r => r.Status === view.name).length})`,

  // Icon: string or fn(viewItem, items, resourceConfig)
  icon: (view) => view.name === 'Active' ? 'check_circle' : 'cancel',

  // Layout: icon above label (true) or side-by-side (false). Default: true
  stacked: false,

  // Overflow arrows: show horizontal navigation arrows if tabs overflow. Default: true
  outsideArrows: true,

  // Custom icon size (e.g., '16px', 'sm')
  iconSize: '16px'
}
</script>
```
---

## 7. Registry Maintenance & Pre-Reads

1. **Verify Registries**: Before creating overlays, ensure no reusable component or composable already exists in:
   - Reusable Components: [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
   - Reusable Business Logic: [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md)
2. **Update Registries**: If a custom component or composable is developed that could be shared, document it inside the registries above.
3. **Core Rules Compliance**: Every custom override file must strictly respect [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

