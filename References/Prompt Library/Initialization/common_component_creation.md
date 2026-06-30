# AQL Framework Common Component Development Guide (Initialization)

This initialization prompt guides the creation, structure, layout rules, and dynamic resolution contracts of global/common fallback components under `src/components/_common/` in the AQL repository.

> [!IMPORTANT]
> **Scope Boundary**: This document covers ONLY the creation and structure of shared framework-level layout sections and fallback components located in the `src/components/_common/` directory. For resource-specific page/component overrides, read [page_and_sections_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_sections_customization.md).

---

## 1. Directory Structure & Naming Conventions

All framework fallbacks and common orchestrators reside under `src/components/_common/`.

### 1.1 Page Orchestrators
Each page directory (`Index/`, `View/`, `Add/`, `Edit/`, `Action/`) houses the page-level orchestrators. Every page folder contains exactly these four orchestration files:
* **`Header.vue`**: Orchestrates header overrides or metadata parsing.
* **`Toolbar.vue`**: Orchestrates search/switcher controls (Index) or action buttons (View/Action).
* **`Content.vue`**: Orchestrates the main content structure (wrapped in `AqlContentWrapper`).
* **`Actions.vue`**: Orchestrates bottom page-level action triggers and buttons.

### 1.2 Root Section Fallback Folders
Fallback elements and leaf sub-sections are grouped by their parent section:
* **`Header/`**: Holds generic `Header.vue` panel and breadcrumbs.
* **`Toolbar/`**: Holds fallback toolbar, `SearchInput.vue`, `ViewSwitcher.vue`, `ActionBar.vue`.
* **`Content/`**: Holds list fallbacks (`Records.vue`), detail layout (`Details.vue`), form layout (`Form.vue`), audit logs (`Audit.vue`), etc.
* **`Action/`**: Holds submit/cancel buttons (`FormSubmit.vue`, `FormCancel.vue`), FAB triggers (`AddFAB.vue`), reports (`ResourceReports.vue`).

### 1.3 Parent-Child Directory Pattern for Nested Sub-sections
If a common component resolves its own sub-sections, its sub-components reside in a subdirectory named exactly after it inside that root section folder.
* *Example*: [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue) (Parent component)
* *Example*: `SearchInputIcon.vue` under [SearchInput/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput) (Sub-component)
* *Example*: `SearchInputClear.vue` under [SearchInput/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput) (Sub-component)

---

## 2. Core Layout & Template Rules

1. **Single File Template Rule (Strict)**: Other than headers, every layout section and fallback component MUST be written as a standard Single File Component (SFC) containing a `<template>` block.
2. **Header Dual Model Exception**:
   [Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Header/Header.vue) is the ONLY component designed as an orchestrator shell using the script-only/presentation dual model.
   - It performs dynamic scans using `useSectionResolver` with `allowScriptOnly: true`.
   - If a script-only header override exists (a `.vue` file returning just a JS object with header config), it extracts title, subtitle, icon, status chip, and back actions, then renders them using the presentation component `components/shared/GenericHeaderPanel.vue`.
   - If a template-based override exists, it renders the template directly.

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

## 4. Dynamic Section Resolution

For common components that load dynamic sub-sections (e.g. [Toolbar.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/Toolbar.vue) resolving [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue), or `SearchInput.vue` resolving its icon/clear buttons):

1. **Import and Pass Fallbacks**: Pass static imports as default fallbacks in `useSectionResolver` so they render immediately if no override is provided.
2. **Propagate Page Context**: Pass the active page context dynamically from parents to children via props (e.g. `page="Index"`), enabling correct override lookups.

### Reference Code: `SearchInput.vue` Resolution Contract
Check how [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue) resolves leaf sub-sections dynamically:
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
    SearchInputPlaceholder: { section: 'SearchInputPlaceholder', default: EmptyComponent },
    SearchInputLabel: { section: 'SearchInputLabel', default: EmptyComponent }
  }
})
```

---

## 5. Working Example: Resolving Custom Elements from Templates

When extracting template-only content (like customized search placeholders or field labels) from dynamic components:
1. Mount the resolved component inside a hidden container: `<div ref="hiddenPlaceholderRef" class="hidden"><component :is="sections.SearchInputPlaceholder" /></div>`.
2. Extract the text content programmatically: `hiddenPlaceholderRef.value?.textContent?.trim()`.

Refer to the implementation in [SearchInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Toolbar/SearchInput.vue#L24-L31) for details.

### 5.2 Script-Only Resolution & The Presentation/Config Dual Model
When resolving child sections that can be either full template overrides OR script-only configurations (e.g., `Header` or `ViewSwitcher`), use the dual-model resolution pattern:

1. Call `useSectionResolver` with `allowScriptOnly: true`.
2. Compute the component and config dynamically inside the parent wrapper:
   ```javascript
   const resolvedComponent = computed(() => {
     const comp = sections.TargetSection
     if (!comp) return { component: null, config: null }
     const hasTemplate = !!(comp.render || comp.ssrRender || typeof comp === 'function')
     if (hasTemplate) {
       return { component: comp, config: null } // Template override
     }
     return { component: DefaultFallbackComponent, config: comp.config || {} } // Script-only config
   })
   ```
3. Pass the resolved `config` to the default fallback component as a prop to customize its output (e.g. dynamic labels or icons evaluated using state from context).



---

## 6. Content Components Signatures & Resolution Contracts

Each page content orchestrator resolves sub-sections recursively. When creating or modifying these shells, ensure props and emits are correctly passed.

### 6.1 Index Page Content Orchestrator (`Index/Content.vue`)
- **Resolves**: `Records` (default: `Content/Records.vue`)
- **Props Passed to Records**:
  - `items`: `filteredItems` array
  - `resolved-fields`: `resolvedFields` array
  - `resource-slug`: `resourceSlug` string
  - `customUIName`: `customUIName` string
  - `records-config`: resolved configuration object (merged from page `Content` and `Records` configurations)

### 6.2 View Page Content Orchestrator (`View/Content.vue`)
- **Resolves**:
  - `Details` (default: `Content/Details.vue`)
  - `Parent` (default: `Content/Parent.vue`)
  - `Children` (default: `View/Children.vue`)
  - `Audit` (default: `Content/Audit.vue`)
- **Resolved Props Passed**:
  - `Details`: `details-config` object
  - `Parent`: `parent-config` object
  - `Children`: `children-config` object
  - `Audit`: `audit-config` object

### 6.3 Add & Edit Content Orchestrators (`Add/Content.vue`, `Edit/Content.vue`)
- **Resolves**: `Form` (default: `Content/Form.vue`)
- **Props Passed to Form**:
  - `config`: resource config object
  - `resolved-fields`: resolved fields list
  - `parent-form`: parent form state object
  - `child-groups`: related children groups array
  - `status-options`: options for status dropdown
  - `form-config`: resolved configuration object

### 6.4 Action Content Orchestrator (`Action/Content.vue`)
- **Resolves**: `ActionFields` (default: `Content/Form.vue`)
- **Props Passed to ActionFields**:
  - `is-multi-outcome`: boolean flag
  - `outcome-options`: outcomes list array
  - `selected-outcome`: active selected outcome string
  - `resolved-action-fields`: outcome fields list
  - `action-form`: action inputs state object
  - `form-config`: resolved configuration object

---

## 7. Maintenance & Development Rule

> [!IMPORTANT]
> **Maintenance Rule**: Whenever a new common fallback component is created, modified, or a new layout resolution pattern is introduced in `src/components/_common/`, the developer or agent MUST update this document to document the new component signature, resolve rules, and layout logic.


