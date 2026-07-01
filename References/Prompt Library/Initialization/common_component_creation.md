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
Fallback elements and leaf sub-sections are grouped by their parent section:
* **`Header/`**: Holds generic `Header.vue` fallback panel and breadcrumbs.
* **`Toolbar/`**: Holds fallback toolbar, `SearchInput.vue`, `ViewSwitcher.vue`, `ActionBar.vue`.
* **`Content/`**: Holds list fallbacks (`Records.vue`), detail layout (`Details.vue`), form layout (`Form.vue`), audit logs (`Audit.vue`), etc.
* **`Action/`**: Holds submit/cancel buttons (`FormSubmit.vue`, `FormCancel.vue`), FAB triggers (`AddFAB.vue`), reports (`ResourceReports.vue`).

### 1.3 Parent-Child Directory Pattern for Nested Sub-sections
If a common component renders sub-sections, they must reside in a subdirectory named exactly after it inside that root section folder:
* *Example*: [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue) (Parent component)
* *Example*: `SearchInputIcon.vue` under [SearchInput/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput) (Sub-component)

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
const { scope, resourceSlug, config } = inject('resourceConfig')
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

## 6. Content Components Signatures & Resolution Contracts

Each page content orchestrator resolves its own override. If no override is found, it renders its default fallback, passing the prepared props down:

### 6.1 Index Page Content Orchestrator (`Index/Content.vue`)
- **Statically Imports**: `Records.vue`
- **Props Passed to Records**:
  - `items`: `filteredItems` array
  - `resolved-fields`: `resolvedFields` array
  - `resource-slug`: `resourceSlug` string
  - `customUIName`: `customUIName` string
  - `records-config`: resolved configuration object

### 6.2 View Page Content Orchestrator (`View/Content.vue`)
- **Statically Imports**: `Details.vue`, `Parent.vue`, `Children.vue`, `Audit.vue`

### 6.3 Add & Edit Content Orchestrators (`Add/Content.vue`, `Edit/Content.vue`)
- **Statically Imports**: `Form.vue`

### 6.4 Action Content Orchestrator (`Action/Content.vue`)
- **Statically Imports**: `Form.vue`

---

## 7. Maintenance & Development Rule

> [!IMPORTANT]
> **Maintenance Rule**: Whenever a new common fallback component is created, modified, or a new layout resolution pattern is introduced in `src/components/_common/`, the developer or agent MUST update this document to document the new component signature, resolve rules, and layout logic.
