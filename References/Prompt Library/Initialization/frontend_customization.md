# Frontend Customization & Component Implementation

This initialization prompt guides the implementation, customization, and structure of frontend pages and components in the AQL repository. It ensures strict compliance with AQL's 3-tier architecture, Quasar-first layouts, generic styling, and composable-only business logic.

---

## 1. Mandatory Pre-Reads & Context Gathering

Before writing or modifying any frontend component:
1. Read the core [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) to understand the strict boundary between View, Composable, and Store/Service layers.
2. Read the unified [CUSTOM_PAGE_AND_PAGE_SECTIONS_CUSTOMIZATIONS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CUSTOM_PAGE_AND_PAGE_SECTIONS_CUSTOMIZATIONS.md) for a detailed list of the 12-tier resolution priority checklist.
3. Search the reusable registry files to see if the required component or composable already exists:
   * Reusable Components: [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
   * Reusable Business Logic: [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md)

---

## 2. Core Implementation Principles

### A. Core Component Customization over Page Customization
* **Least Priority**: Customizing full page layouts (like overriding `ViewPage.vue`, `AddPage.vue`, or `IndexPage.vue`). Full page overrides duplicate layout boilerplate and increase maintenance overhead.
* **Highest Priority**: Customizing the specific **core component** or section only, resolved dynamically via the 12-tier system.
  * For `IndexPage` (List): Customize only `Records.vue` (the list cards) or `Toolbar.vue` (the filters).
  * For `AddPage` / `EditPage`: Customize only `Form.vue` (the input fields) or `Actions.vue` (buttons).
  * For `ViewPage`: Customize only `Details.vue` (the record fields display) or `ActionBar.vue` (triggers).

### B. The Three Customization Layers (Strict Responsibility Rules)
Customization is structured into three layers. You must respect this hierarchy to prevent layout and style leaks:
1. **Entity-Custom Layer (Standard / Recommended)**:
   * **Path**: `src/components/{ScopeFolder}/{EntityName}/` (e.g., `src/components/Masters/Products/`)
   * **Policy**: This is the **default, standard location** for customizing any resource. Creating a component in this directory is the standard way to implement custom resource sections.
2. **Tenant-Custom Layer (Rare Use Only)**:
   * **Path**: `src/components/_custom/{customUIName}/{ScopeFolder}/` (e.g., `src/components/_custom/A2930/Masters/`)
   * **Policy**: Reserved strictly for tenant-specific overrides. Creating or editing files here should be done in **rare situations only** when a specific tenant requires unique layout behavior.
3. **Framework Layer (Rare Use Only)**:
   * **Path**: `src/components/_common/`
   * **Policy**: Represents the core framework-level default templates and fallbacks shared globally across all resources. Creating or editing files here should be done in **rare situations only** (e.g., framework-wide updates) to avoid breaking global consistency.

### C. Maximum Reuse of Shared Components
* Search [components/shared/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/) first. Use existing building blocks (like `ReloadButton.vue`, `AqlList.vue`) to compose layouts.
* If existing components do not fit your exact requirement, **design a reusable component** that accepts customizable props or slots, rather than creating a highly specific, single-use file.
* Always update [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) or [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md) whenever a new shared component or composable is created or changed.

### D. Quasar-First Layouts & Generic CSS Styling
* **Markup Constraints**: Use only Quasar components (`q-card`, `q-card-section`, `q-list`, `q-item`, `q-btn`, etc.) and built-in Quasar CSS/Flex utility classes. 
* **Avoid Custom Markup**: Do not write nested custom `div` elements with custom styles unless there is absolutely no Quasar alternative.
* **Style Isolation**: Do not write `<style>` or `<style scoped>` blocks in Single File Components (SFCs). Use the global, shared classes defined in [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss).
* **Strict Class Naming**: If a new CSS class must be declared in [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss), the name must be **generic and reusable**. 
  * Class names must **never** contain page-specific, entity-specific, resource-specific, or scope-specific words.
  * *Forbidden Examples*: `.product-view-header`, `.visits-list-card`, `.masters-form-field`.
  * *Allowed Examples*: `.branded-hero-header`, `.touch-action-list`, `.accented-form-layout`.

### E. Composable-Only Business Logic
* The `<script setup>` block of any Vue file must remain thin. It is strictly reserved for component fueling, props/emits declarations, and minor visual UI state manipulation.
* All business logic, validations, state management, API action dispatches, and workflows must live **exclusively** in composables under `src/composables/`.
* No Vue component may import a Pinia store or service directly; all data and store interactions must be mediated by a composable.

---

## 3. Step-by-Step Customization Examples

### Example 1: Standard Entity-Specific Customization (Default Recommendation)
**Goal**: Customize the view details display for the `Products` resource globally across all tenants.
1. **Determine Path**: Create the file under the **Entity-Custom Layer**:
   `FRONTENT/src/components/Masters/Products/View/Details.vue`
2. **Implement Component**: Use Quasar markup and generic styling, delegating logic to the appropriate composable.

### Example 2: Tenant-Specific Customization (Rare Use Only)
**Goal**: Customize the view details display for `Products` for tenant `A2930` only.
1. **Verify Config**: Ensure `ui.customUIName` in the `products` resource configuration is set to `"A2930"`.
2. **Determine Path**: Create the file under the **Tenant-Custom Layer**:
   `FRONTENT/src/components/_custom/A2930/Masters/Products/View/Details.vue`

### Code Template:
```vue
<template>
  <q-card flat bordered class="accented-card-layout">
    <q-card-section class="q-pa-md">
      <div class="row q-col-gutter-sm">
        <!-- Reusing a shared component for currency display -->
        <div class="col-12 col-md-6">
          <div class="text-caption text-grey-6">Standard Price</div>
          <div class="text-subtitle1 text-weight-bold">
            {{ formattedPrice }}
          </div>
        </div>
        
        <!-- Standard Quasar layout with generic styles -->
        <div class="col-12 col-md-6">
          <div class="text-caption text-grey-6">UOM</div>
          <div class="text-subtitle1">{{ record.Uom || '-' }}</div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'

const props = defineProps({
  record: { type: Object, required: true },
  resolvedFields: { type: Array, default: () => [] },
  resourceName: { type: String, default: '' }
})

const { _C } = useCurrency()

// SFC contains only fueling and basic formatting logic
const formattedPrice = computed(() => {
  return _C(props.record.Price || 0, true)
})
</script>
```
