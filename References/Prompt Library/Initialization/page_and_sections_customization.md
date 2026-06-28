# AQL Page & Dynamic Section Customization Guide (Initialization)

This initialization prompt guides the implementation, customization, and structure of frontend pages and components in the AQL repository. It ensures strict compliance with AQL's 4-part layout contract, dynamic section resolution, and flat override pathways.

> [!IMPORTANT]
> **Mandatory Compliance Rule**: Every agent and developer working on the AQL frontend MUST follow the instructions in this document and the core [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) without exception. Layer violations, improper component nesting, and ad-hoc CSS additions are strictly prohibited.

---

## 1. Mandatory Pre-Reads & Context Gathering

Before writing or modifying any frontend component:
1. Read the core [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) to understand the strict boundary between View, Composable, and Store/Service layers.
2. Read the unified [CUSTOM_PAGE_AND_PAGE_SECTIONS_CUSTOMIZATIONS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CUSTOM_PAGE_AND_PAGE_SECTIONS_CUSTOMIZATIONS.md) for the visual layout trees and directory mapping.
3. Search the reusable registry files to see if the required component or composable already exists:
   * Reusable Components: [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
   * Reusable Business Logic: [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md)

---

## 2. Core Layout Concepts & Terminology

### 2.1 The Five Pages
Pages represent the top-level route targets:
1. **Index** (Index listing page)
2. **View** (Read-only record detail view)
3. **Add** (Record creation form page)
4. **Edit** (Record modification form page)
5. **Action** (Workflow state-transition form page)

### 2.2 The Four Top-Level Sections
Every page orchestrates exactly four top-level layout sections in this strict sequence:
1. **Header** (Branding, title, sync triggers, and status badges)
2. **ToolBar** (Search inputs, view switcher tabs, and record action bars)
3. **Content** (The main body payload—where **Form** is a sub-section of Content for Add/Edit pages)
4. **Action** (Bottom footers, primary submit/cancel buttons, and FABs)

---

## 3. Directory Structure & Naming Rules (src/components/_common/)

AQL organizes fallback components under `src/components/_common/` into Page folders and Root Section folders:

### 3.1 Page Orchestrators
We use page-scoped directories (`Index/`, `View/`, `Add/`, `Edit/`, `Action/`) to house page-level orchestrators. Every page folder contains exactly these four orchestrators:
- **`Header.vue`**: Orchestrates local overrides or script-only panels for the header.
- **`Toolbar.vue`**: Orchestrates search/switcher controls (Index) or Action bars (View/Action).
- **`Content.vue`**: Orchestrates the main content structure (wrapped in `AqlContentWrapper`).
- **`Actions.vue`**: Orchestrates bottom page-level action triggers and buttons.

### 3.2 Root Section Fallback Folders
All fallback components and leaf sub-sections are grouped by their root section:
- **`Header/`**: Holds generic `Header.vue` panel and `ResourceBreadcrumb.vue`.
- **`Toolbar/`**: Holds generic `Toolbar.vue` fallback, `SearchInput.vue`, `ViewSwitcher.vue`, `ActionBar.vue`.
- **`Content/`**: Holds list fallbacks (`Records.vue`, `RecordsRecord.vue`), details (`Details.vue`, `Parent.vue`, `Children.vue`), form layouts (`Form.vue`, `Child.vue`), audit logs (`Audit.vue`), and states (`Loading.vue`, `Empty.vue`).
- **`Action/`**: Holds global action fallbacks (`ActionsFallback.vue`), submit/cancel buttons (`FormSubmit.vue`, `FormCancel.vue`, `ActionSubmit.vue`, `ActionCancel.vue`), and FAB/Reports triggers (`AddFAB.vue`, `ResourceReports.vue`, `ReportBar.vue`).

### 3.3 Parent-Child Directory Pattern for Nested Sub-sections
If a component recursively resolves its own sub-sections, its sub-components reside in a subdirectory named after it inside the same root section folder:
- *Example*: `src/components/_common/Toolbar/SearchInput.vue` (Parent component)
- *Example*: `src/components/_common/Toolbar/SearchInput/SearchInputIcon.vue` (Sub-component)
- *Example*: `src/components/_common/Toolbar/SearchInput/SearchInputClear.vue` (Sub-component)

To resolve them, call `useSectionResolver` and pass the active Page Name in the `page` parameter (e.g., `page: props.page`). The `page` parameter MUST always be one of the standard Page Names (`Index`, `Add`, `Edit`, `Action`, `View`) to ensure that resource-level overrides are correctly looked up under the standard Page folders.

---

## 4. Standard Resource-Level Overrides

Standard resource-specific overrides in the codebase are placed under `src/components/[Scope]/[ResourceName]/` in a flat structure. **No custom subdirectories** (such as `Records/`, `Forms/`, etc.) are allowed.

A component can only be placed at one of two target override locations:

1. **Page-Generic Override**:
   `src/components/[Scope]/[ResourceName]/[Section].vue`
   - *Example*: `src/components/Masters/Products/RecordsListItem.vue`
2. **Page-Specific Override**:
   `src/components/[Scope]/[ResourceName]/[Page]/[Section].vue`
   - *Where `[Page]` is one of: `Index`, `View`, `Add`, `Edit`, `Action`*
   - *Example*: `src/components/Masters/Products/Index/Header.vue` (overriding just the Index page header)

### Recursive Sub-component Overrides
For recursively resolved sub-components (like `SearchInputIcon.vue` resolved on the `Index` page), they can be placed at:
- `src/components/[Scope]/[ResourceName]/SearchInputIcon.vue` (generic)
- `src/components/[Scope]/[ResourceName]/Index/SearchInputIcon.vue` (page-specific under the standard Page folder)

---

## 5. Architectural Customization & Implementation Rules

### 5.1 Customization Priority (The Last-Layer Rule)
When customizing or building new layouts, **complete page customization is the absolute lowest priority**. You must focus your effort at the highest specificity—customizing the **deepest nested component ("last-layer component")** rather than duplicating or overriding entire pages or high-level sections.

* **High-Level Page Orchestrators**: Never duplicate or customize the page controllers (`IndexPage.vue`, `ViewPage.vue`, etc.). They must remain completely identical across all resources.
* **Top-Level Sections**: Avoid overriding top-level sections like `Content.vue` or `Toolbar.vue` unless you are altering the entire layout flow.
* **Last-Layer Customization**: Direct all overrides to the final rendering components that display the data:
  - For **Index listing**: Override/customize `RecordsListItem.vue` or `RecordsListItemHeader.vue`.
  - For **View details**: Override/customize `Details.vue` or `DetailItem.vue`.
  - For **Add/Edit forms**: Override/customize `FormField.vue` or `FormFieldControl.vue`.

> [!TIP]
> By keeping high-level pages and section containers generic, any framework updates, loading transitions, or central layout enhancements automatically apply to all modules in the application.

### 5.2 Maximum Reuse of Shared Components
Before creating a new custom component, you must search [FRONTENT/src/components/shared](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared) and check the [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) file.
1. **Reuse First**: Leverage existing shared components (e.g., `GenericHeaderPanel.vue`, `AqlContentWrapper.vue`, `AqlFileUpload.vue`) at their maximum.
2. **Extend with Props**: If an existing shared component does not fully meet your requirements, add configurable props to it rather than writing a new standalone component from scratch.
3. **Strict Component Controls**: If you must write a new custom component, it must rely almost exclusively on **native Quasar components** (such as `q-card`, `q-card-section`, `q-list`, `q-item`, `q-btn`, etc.) and native Quasar CSS utility classes.
4. **No Custom Div Hierarchies**: Building complex, nested hierarchies of custom `<div>` tags styled with custom CSS or ad-hoc style classes is strictly prohibited unless there is absolutely no other technical way.

### 5.3 Strict Style Restraint (No SFC Styles & Generic SCSS)
To maintain styling consistency and a clean codebase, custom CSS must be strictly controlled:
1. **No `<style>` Blocks in SFCs**: Single File Components (SFCs) must avoid having `<style>` or `<style scoped>` blocks. Rely entirely on native Quasar flex layout classes (e.g., `row`, `column`, `items-center`, `justify-between`, `q-gutter-x-sm`) and utility spacing classes (e.g., `q-pa-md`, `q-py-sm`).
2. **Centralized SCSS**: If custom styling is absolutely necessary, add it to [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss).
3. **Strict Generic Class Naming**: Any new class added to `custom.scss` must have a **strictly generic and reusable name**.
4. **Prohibition of Specific Terms**: You are strictly forbidden from using any names of pages, entities, resources, or scopes inside class names.
   - *Forbidden*: `.outlet-detail-card`, `.products-header-btn`, `.view-page-form`, `.masters-scope-list`
   - *Allowed*: `.aql-card-flat`, `.aql-btn-sync`, `.aql-text-subtitle`, `.aql-grid-dense`

### 5.4 Separation of Concerns (Composables Only)
All script blocks (`<script setup>`) in SFC files must be kept thin and declarative.
1. **SFC Script Duty**: The component script block is strictly for "fueling" the template. It should only define props, emits, import refs/computed properties, and map data to the HTML markup.
2. **Composables Business Logic**: All business logic, API communication (axios/HTTP calls), state transitions, validation logic, and multi-step data transformations must reside in **composables** under `src/composables/`.
3. **No Heavy Operations in SFC**: Never write raw business processes, complex loops, or direct database operations in a Vue component script.

### 5.5 Registry Maintenance Rule
To keep the codebase discoverable and documented, you must update the indexes when adding features:
1. **Component Registry**: Whenever you add or significantly modify a shared component, you must record its signature and prop contract in [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).
2. **Composable Registry**: Whenever you add or modify a business logic composable, you must record its interface and usage in [composables/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/REGISTRY.md).

### 5.6 Page-Level Context Sharing (Provide/Inject) (STRICT)

To eliminate redundant instantiations and synchronize state across sibling components (e.g. sharing `searchTerm` between a `Toolbar` and a `Content` list view), AQL utilizes Vue 3's `provide` and `inject` mechanisms at the **Page level**:

1. **Page-Level Providers**:
   The common page orchestrators (`IndexPage.vue`, `AddPage.vue`, `EditPage.vue`, `ActionPage.vue`, and `ViewPage.vue`) instantiate the composables once and `provide` them to all descendant components:
   ```javascript
   const resourceConfig = useResourceConfig()
   const resourceRecord = useRecord()

   provide('resourceConfig', resourceConfig)
   provide('resourceRecord', resourceRecord)
   ```
2. **Component-Level Injections**:
   Descendant components (like `Header.vue`, `Toolbar.vue`, `Content.vue`, `ActionBar.vue`, `AddFAB.vue`, `Details.vue`, `Records.vue`, `SearchInput.vue`, `Children.vue`) must **inject** these instances instead of calling `useResourceConfig()` or `useRecord()` locally:
   ```javascript
   const { scope, resourceSlug, config } = inject('resourceConfig')
   const { record, loading, searchTerm } = inject('resourceRecord')
   ```
3. **Strict No-Local-Instantiation Rule**:
   Common sub-components directly under `src/components/_common/` must NOT import or instantiate `useResourceConfig` or `useRecord` locally. They must rely exclusively on the injected parent contexts to maintain a clean, thin, and unified state tree.

---

## 6. Concrete Implementation Examples

### 6.1 Last-Layer Customization (Index Listing Card)
Suppose you need to customize how product records are rendered in the Index page listing. Rather than overriding `IndexPage.vue` or `Index/Content.vue`, you override only the last-layer component:

#### `src/components/Masters/Products/RecordsListItem.vue` [Correct - Specific Overriding]
```html
<template>
  <!-- Rely on native Quasar components and classes -->
  <q-item clickable class="q-pa-sm aql-card-flat" @click="$emit('open-detail', row.Code)">
    <q-item-section>
      <div class="row items-center justify-between">
        <!-- Display fields mapped from the row -->
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

### 6.2 Separating Logic into a Composable
Suppose a component needs to validate and submit form data. Keep the component script thin and delegate to a composable:

#### `src/composables/resources/useProductForm.js` [Correct - Logic Layer]
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

#### `src/components/_common/Form.vue` [Correct - Clean View Layer]
```html
<template>
  <q-card flat bordered class="q-pa-md">
    <q-card-section class="q-gutter-y-sm">
      <!-- Native Quasar Inputs -->
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

// Fuel the component template using the logic layer
const { form, errors, loading, submit } = useProductForm(props.code)
</script>
```

### 5.7 Static Fallback Components in Page Shells (STRICT)

To prevent runtime errors, dynamic component creation failures (`InvalidCharacterError` due to raw filepath string evaluation in `createElement`), page-scoped controllers MUST statically import the standard fallback components (e.g., `Header`, `Toolbar`, and `Actions`) and pass them as defaults inside the `sectionDefs` contract of `useSectionResolver`:

```javascript
import Header from 'components/_common/Header/Header.vue'
import Toolbar from 'components/_common/Toolbar/Toolbar.vue'
import Actions from 'components/_common/Action/ActionsFallback.vue'

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index',
  sectionDefs: {
    Header: { section: 'Header', default: Header },
    ToolBar: { section: 'Toolbar', default: Toolbar },
    Content: 'Content',
    Action: { section: 'Actions', default: Actions }
  }
})
```

### 5.8 Recursive Dynamic Resolution of Leaf Sub-sections

For sub-sections that reside deep inside root sections (such as `SearchInput.vue` rendering inside a `Toolbar` orchestrator), they must:
1. Receive page context dynamically from their parents via props (e.g., `<component :is="sections.SearchInput" :page="page" />`).
2. Pass their local static imports as default fallbacks inside `useSectionResolver` to ensure they render immediately if no override is provided:

```javascript
import SearchInputIcon from 'components/_common/Toolbar/SearchInput/SearchInputIcon.vue'
import SearchInputClear from 'components/_common/Toolbar/SearchInput/SearchInputClear.vue'

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: props.page, // Dynamically maps resolution scope to active page context
  sectionDefs: {
    SearchInputIcon: { section: 'SearchInputIcon', default: SearchInputIcon },
    SearchInputClear: { section: 'SearchInputClear', default: SearchInputClear },
    SearchInputPlaceholder: { section: 'SearchInputPlaceholder', default: EmptyComponent }
  }
})
```

### 5.9 Extraction of Template Content (Placeholder/Label Pattern)

When overriding static text values (such as search placeholders) using custom Vue components (which are template-only files), we extract their contents programmatically by rendering them inside a hidden container:

```html
<template>
  <q-input
    v-model="searchTerm"
    :placeholder="placeholderText"
    dense
    outlined
  >
    <!-- Programmatically extract content from custom template-only component -->
    <div style="display: none;">
      <component
        :is="sections.SearchInputPlaceholder"
        ref="placeholderRef"
      />
    </div>
  </q-input>
</template>

<script setup>
import { ref, computed } from 'vue'

const placeholderRef = ref(null)

const placeholderText = computed(() => {
  if (!sections.SearchInputPlaceholder || sections.SearchInputPlaceholder === EmptyComponent) {
    return 'Search...' // Default fallback search placeholder
  }
  // Programmatically extract text content from custom component DOM node
  return placeholderRef.value?.$el?.textContent?.trim() || 'Search...'
})
</script>
```
This pattern allows developers to create custom static texts (e.g. `SearchInputPlaceholder.vue` containing `<template>Search items...</template>`) and have them resolved cleanly without complex Javascript props.
