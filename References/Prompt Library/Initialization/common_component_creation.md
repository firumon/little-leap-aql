# AQL Framework Common Component Development Guide (Initialization)

This initialization prompt guides the creation, structure, layout rules, and dynamic resolution contracts of global/common fallback components under `src/components/_common/` in the AQL repository.

> [!IMPORTANT]
> **Scope Boundary**: This document covers ONLY the creation and structure of shared framework-level layout sections and fallback components located in the `src/components/_common/` directory. For resource-specific page/component overrides, read [page_and_sections_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_sections_customization.md).

---

## 1. Directory Structure & Naming Conventions

All framework fallbacks and common orchestrators reside under `src/components/_common/`.

### 1.1 Page-Specific Fallback Orchestrators
Each page directory (`Index/`, `View/`, `Add/`, `Edit/`, `Action/`) houses the page-level orchestrators:
* **`Toolbar.vue`**: Orchestrates search/switcher controls (Index) or action buttons (View/Action).
* **`Content.vue`**: Orchestrates the main content structure (wrapped in `AqlContentWrapper`).
* **`Actions.vue`**: Orchestrates bottom page-level action triggers and buttons.

### 1.2 Root Section Fallback Folders
Fallback elements and reusable sub-sections are grouped by their parent section type inside the `src/components/_common/sections/` directory:
* **`Header/`**: Holds generic `Header.vue` fallback panel and breadcrumbs.
* **`Toolbar/`**: Holds fallback toolbar, `SearchInput.vue`, `ViewSwitcher.vue`.
* **`Content/`**: Holds list fallbacks (`Records.vue`), detail layout (`Details.vue`), form layout (`Form.vue`), audit logs (`Audit.vue`), etc.
* **`Action/`**: Holds FAB triggers (`Downloads.vue`, `CrudActions.vue`), workflow actions (`AdditionalActionSingle.vue`, `AdditionalActionMultiple.vue`), forms (`FormActions.vue`), and executes (`ActionDialog.vue`).

### 1.3 Parent-Child Directory Pattern for Nested Sub-sections
If a common component inside `sections/` renders sub-sections, they must reside in a subdirectory named exactly after it inside that root section folder:
* *Example*: `SearchInput.vue` (Parent component) $\rightarrow$ `SearchInput/` subdirectory.
* *Example*: `CrudActions.vue` (Parent component) $\rightarrow$ `CrudActions/` subdirectory.
* *Example*: `Downloads.vue` (Parent component) $\rightarrow$ `Downloads/` subdirectory.
* *Example*: `AdditionalActionSingle` / `Multiple` (Parent component) $\rightarrow$ `AdditionalActions/` subdirectory.
* *Example*: `FormActions.vue` (Parent component) $\rightarrow$ `FormActions/` subdirectory.

---

## 2. Core Layout & Template Rules (STRICT)

1. **Static Composition**: Parent fallback components must **statically import** and render their children sub-sections. Dynamic resolver pipelines using the old `sectionDefs` key map are **strictly prohibited**.
2. **Template SFC Rule**: Every layout section and fallback component MUST be written as a standard Vue Single File Component (SFC) containing a `<template>` block. Vue components without a template block are **never allowed**.
3. **Decentralized Overrides**: Every fallback component resolves its own custom override locally.
   - Example: `Header.vue` calls `useCommonSection({ sectionName: 'Header', page: props.page, preparedProps, evaluateKeys: [...] })`. If a custom template is resolved (`resolvedComponent`), it mounts it. If a JS logic modifier is resolved, it automatically merges, evaluates function-based overrides, and passes them via `finalProps` before rendering `GenericHeaderPanel.vue`.

---

## 3. Page-Level Context Sharing (Provide / Inject) (STRICT)

Page controllers (`IndexPage.vue`, `ViewPage.vue`, etc.) instantiate key composables and `provide` them. Framework common components under `_common/` **must inject** these contexts to preserve a single, unified reactive state tree.

Common components must NOT call `useResourceConfig` or `useRecord` directly.

```javascript
// Injecting context at component level
const { scope, resourceSlug, resourceConfig } = inject('resourceConfig')
const { record, loading, searchTerm } = inject('resourceRecord', { record: ref(null) })
```

---

## 4. Decentralized Section Resolution

For common components that support overrides:

1. **Resolve locally**: Call `useCommonSection({ sectionName, page, preparedProps })` inside the setup block.
2. **Propagate Page Context**: Pass the active page context dynamically from parents to children via props (e.g. `page="Index"`), enabling correct override lookups.

### Reference Code: `SearchInput.vue` Resolution Contract
Check how [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue) resolves leaf sub-sections and its own override dynamically:
```html
<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    v-model="searchTerm"
  />

  <div v-else class="search-input-container">
    <q-input v-model="searchTerm" :placeholder="placeholderText">
      <template #prepend>
        <SearchInputIcon :page="page" />
      </template>
      <template #append v-if="searchTerm">
        <SearchInputClear :page="page" @clear="searchTerm = ''" />
      </template>
    </q-input>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import SearchInputIcon from 'components/_common/Toolbar/SearchInput/SearchInputIcon.vue'
import SearchInputClear from 'components/_common/Toolbar/SearchInput/SearchInputClear.vue'

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { searchTerm } = inject('resourceRecord')
const preparedProps = computed(() => ({ searchTerm: searchTerm.value }))

// Resolve own local override via useCommonSection wrapper
const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'SearchInput',
  page: props.page,
  preparedProps
})
</script>
```

---

## 5. Working Example: Resolving Custom Elements from Templates

When extracting template-only content (like customized search placeholders or field labels) from dynamic components:
1. Mount the resolved component inside a hidden container: `<div ref="hiddenPlaceholderRef" class="hidden"><SearchInputPlaceholder :page="page" /></div>`.
2. Extract the text content programmatically: `hiddenPlaceholderRef.value?.textContent?.trim()`.

Refer to the implementation in [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue) for details.

---

## 6. Advanced Customization & Sub-section Development Patterns

To ensure maximum extensibility for all future components, developers and AI agents must follow these three architectural patterns:

### 6.1 Consistent Sub-component Naming Conventions
Sub-components of a parent section must use unified prefixing so they are easily discoverable and mapped.
* *Standard*: If a parent resolves sub-components, group them with descriptive, consistent suffixes (e.g. `CrudActionsFabBtnAdd`, `CrudActionsFabBtnEdit` rather than `CrudActionsFabAddBtn`, `CrudActionsFabEditBtn`). This aligns child components with their respective slot-items (e.g. `CrudActionsFabItemAdd`, `CrudActionsFabItemEdit`).

### 6.2 Evaluated Function Type Properties
Any visual property (like `color`, `icon`, `label`, `flat`, `unelevated`) inside generic sub-components (such as lists, FABs, or form actions) must accept function callbacks in addition to standard types:
```javascript
const props = defineProps({
  color: { type: [String, Function], default: 'primary' },
  label: { type: [String, Function], default: '' }
})
```
Within the setup block, compute the resolved attributes dynamically, passing the current record and component props context:
```javascript
const resolvedColor = computed(() => {
  const c = finalProps.value.color
  return typeof c === 'function' ? c(resourceRecord?.value, props) : c
})
```
This enables local JS logic overrides to dynamically style elements based on real-time data states.

### 6.3 Standard Slot-Scope Propagation
If a parent common component resolves a custom override template via `<component :is="...">`, ensure you bind all slot variables on the element:
```html
<component
  :is="resolvedComponent"
  v-slot="{ color, icon, label }"
  v-slot:default="{ color, icon, label }"
  v-if="resolvedComponent"
  v-bind="finalProps"
>
  <slot />
</component>
```
This ensures a custom Vue template can receive and forward slot scope properties safely down.

---

## 7. Content Components Signatures & Resolution Contracts

Each page content orchestrator resolves its own override. If no override is found, it renders its default fallback, passing the prepared props down:

### 7.1 Common Content Orchestrator (`_common/sections/Content/Content.vue`)
**Main unified orchestrator component** that houses list, form, and detail sub-sections. Automatically handles Index, View, Add, Edit, and Action modes. Fully customizable and overridable.

- **Statically Imports**: `List.vue`, `Form.vue`, `Details.vue`, `Parent.vue`, `Children.vue`, `Audit.vue`
- **Props**:
  - `page`: String - current page context (Index, Add, Edit, View, Action)
  - `listProps`: Object - passed to List sub-section
  - `detailsConfig`: Object - passed to Details sub-section
  - `parentConfig`: Object - passed to Parent sub-section
  - `parentForm`: Object - passed to Form sub-section
  - `childGroups`: Array - passed to Form sub-section
  - `statusOptions`: Array - passed to Form sub-section
  - `formConfig`: Object - passed to Form sub-section
  - `formFieldRender`: Function - passed to Form sub-section
  - Action-specific props (`isMultiOutcome`, `outcomeOptions`, `selectedOutcome`, `resolvedActionFields`, `actionForm`)
- **Resolution**: Resolves its own custom override via `useCommonSection`

### 7.2 List Subsection (`sections/Content/List.vue`)
Renders `AqlList` directly. Resolves list columns automatically based on spreadsheet headers via `useDefaultListProps.js`.

- **Props**:
  - `items`: Array - records to display
  - `resolvedFields`: Array - field definitions
  - `page`: String - page context
- **Emits**: `navigate-to-view` - emitted when item clicked
- **Features**:
  - Clickable rows navigate to view page using `useResourceNav`
  - Eliminates custom list/grid layout wrappers
  - All properties of `AqlList` are customizable

### 7.3 Form Subsection (`sections/Content/Form.vue`)
Renders form fields with dense, attractive styling. Supports custom field rendering via function props.

- **Props**:
  - `code`: String - record code
  - `resolvedFields`: Array - field definitions
  - `parentForm`: Object - form data for records
  - `childGroups`: Array - child record groups
  - `statusOptions`: Array - status dropdown options
  - `resourceName`: String - resource name
  - `formConfig`: Object - configuration
  - `formFieldRender`: Function - custom field renderer
- **Emits**: `update:field`, `update:actionField`, `add-child`, `remove-child`, `update-child-field`
- **Features**:
  - Date fields render using `AppDate.vue` instead of native picker
  - Dense field spacing (4px gaps)
  - Multi-column grid support
  - Collapsible sections

### 7.4 Details Subsection (`sections/Content/Details.vue`)
Renders read-only detail view. Supports custom details item rendering.

- **Props**:
  - `detailsConfig`: Object - configuration
  - `page`: String - page context
- **Features**:
  - Grid-based multi-column fields layout
  - Section title with accent bar
  - File preview card support

---

## 8. Maintenance & Development Rule

> [!IMPORTANT]
> **Maintenance Rule**: Whenever a new common fallback component is created, modified, or a new layout resolution pattern is introduced in `src/components/_common/`, the developer or agent MUST update this document to document the new component signature, resolve rules, and layout logic.
