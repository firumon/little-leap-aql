# AQL Page and Section System Guide

This is the canonical reference document for developers and AI agents on AQL's dynamic page orchestration and layout section customization.

---

## 1. Architectural Overview

AQL's frontend architecture is built on a dynamic, tiered, and metadata-driven resolution model. Instead of hardcoding layout views, pages are dynamically assembled at runtime based on the requested resource and active route.

```mermaid
graph TD
    Router([vue-router]) --> PageVue[src/pages/Page.vue]
    PageVue --> |always renders| Breadcrumb[ResourceBreadcrumb.vue]
    PageVue --> usePageResolver[usePageResolver.js]
    usePageResolver --> useResourceConfig[useResourceConfig.js]
    usePageResolver --> useRouteConfig[useRouteConfig.js]
    usePageResolver --> usePageOrchestrator[usePageOrchestrator.js]
    usePageResolver --> |Stage A: Load BP| BaseContract[pages/Scope/page.js]
    usePageResolver --> |Stage B: 6-candidate scan| CustomUiPages{Custom UI Page?}

    CustomUiPages --> |Vue Override| CustomPage[Render Override Page Directly]
    CustomUiPages --> |JS Modifier| MergeProps[Merge extra props into pageProps]
    CustomUiPages --> |None| SectionLayout[Generic Section Layout]

    SectionLayout --> |v-bind pageProps| SectionVue[src/components/Section.vue]
    SectionLayout --> |contents wrapped in| AqlContentWrapper[AqlContentWrapper.vue]

    SectionVue --> useSectionResolver[useSectionResolver.js]
    useSectionResolver --> |Step 1: Get Base Section| BaseSection{Base Section Found?}
    BaseSection --> |No| UndefinedCard[Render Section Not Defined Card]
    BaseSection --> |Yes| OverrideScan{10-Tier Override Scan}

    OverrideScan --> |Vue Override| CustomSection[Render Custom Section Template]
    OverrideScan --> |JS Modifier| RenderBaseWithJS[Render Base Section with Mod Props]
    OverrideScan --> |None| RenderBase[Render Base Section Template]
```

### 1.1 The Orchestrator Page (`src/pages/Page.vue`)
`Page.vue` acts as the single top-level entry point for all resource CRUD operations and custom actions. It does not contain static HTML elements except for `<ResourceBreadcrumb />`, which is **always rendered unconditionally** — outside the section system — regardless of whether a custom page override or generic sections are used. It resolves layout states dynamically:
1. **Full Page Custom Override (`resolvedPageComponent`)**: If a custom Vue component matches the current resource page under `src/_ui/`, it renders it directly, short-circuiting the generic layout.
2. **Generic Section Layout**: If no custom page component is found, it renders placeholding `<Section>` components sequentially:
   - Sections in `visibleSectionsBeforeAction` (such as `Header`, `Toolbar`).
   - Content wrapper (`<AqlContentWrapper>`) wrapping the `contents` sections (e.g. list, details, or forms).
   - Bottom page actions (`Action` section).
3. **Context Provider**:
   - Provides `'resourceConfig'` (metadata configuration).
   - Provides `'resourceRecord'` (active record reference and loading state).
   - Provides `'pageState'` (centralized page-level reactive form state).

#### `AqlContentWrapper` States
`<AqlContentWrapper>` is the gate component wrapping all `contents` sections. It handles four states and must never be bypassed:

| State | Condition | What Renders |
|-------|-----------|--------------|
| Blocking spinner | `loading && !hasData` | Centered `q-spinner-dots` |
| Non-blocking progress bar | `loading && hasData` | Thin bar at top (background sync) |
| Record not found | `requiresRecord && !recordExists` | Card with "Record not found" and Back to List |
| Empty dataset | `empty` | Card with configurable icon/title/message |
| Normal | none of the above | `<slot />` (the sections render) |

The `contentWrapperProps` computed in `usePageResolver.js` automatically derives these values per page type:

| `page` value | Key Props Set |
|--------------|---------------|
| `'index'` | `loading`, `empty`, `hasData` |
| `'view'` | `loading`, `requiresRecord`, `recordExists` |
| `'add'` | `loading: false`, `empty: false` |
| `'edit'` | `loading`, `requiresRecord`, `recordExists` |
| `'action'` | `loading`, `requiresRecord`, `recordExists`, custom `emptyIcon/Title/Message` |

### 1.2 The Section Placeholder (`src/components/Section.vue`)
`Section.vue` is a single generic placeholder component that represents a logical area of the screen (e.g. `Header`, `Toolbar`, `Content`, `Action`).
* It accepts a `section` string prop and captures additional attributes via `useAttrs()`.
* It calls `useSectionResolver(preparedProps)` and handles three states:
  1. **Loading (`!ready`)**: Displays a Quasar `q-spinner-dots`.
  2. **Resolved (`resolvedComponent`)**: Mounts the matched component via `<component :is="resolvedComponent" v-bind="finalProps" />`.
  3. **Undefined (`!resolvedComponent`)**: Displays a warning card informing the developer that the requested section has no fallback or override.

### 1.3 The Page Resolver (`src/composables/resources/usePageResolver.js`)
Handles page-level route resolution and loading. It is backed by `usePageOrchestrator` (see §1.3.3) which drives record loading, form state, and action execution.

#### 1.3.1 Stage A — Base Page Contract (BP)
Loads `src/pages/[Scope]/[page].js`. This JS file sets the default sections and contents layout for the page.

**Special page key mapping** (route `meta.page` → BP filename):

| `meta.page` value | BP file loaded |
|-------------------|----------------|
| `'resource-page'` | `resource.js` |
| `'record-page'` | `record.js` |
| anything else | `[page].js` as-is |

**BP export shape**: The BP can export either a plain object or a function. If it's a function, it receives the full `rcProps` (same shape as `pageProps` below) and must return an object of extra props to merge in:

```javascript
// Plain object (most common):
export default {
  sections: ['Header', 'Toolbar', 'Content', 'Action'],
  contents: []  // optional — sections rendered inside <AqlContentWrapper>
}

// Function form (dynamic, receives rcProps):
export default (rcProps) => ({
  sections: ['Header', rcProps.page === 'index' ? 'Toolbar' : 'Content', 'Action']
})
```

**`sections` vs `contents`**: `sections` drives the full rendering sequence. `visibleSectionsBeforeAction` is everything in `sections` except `'Action'`. The `contents` array (if provided) defines section names rendered *inside* `<AqlContentWrapper>`. If `contents` is empty or absent, the wrapper is skipped.

**Existing base contracts**:

| Scope | File | `sections` |
|-------|------|------------|
| `Master` | `index.js` | `['Header']` |
| `Master` | `record.js` / `view.js` / `add.js` / `edit.js` / `action.js` / `resource.js` | `['Header', 'Toolbar', 'Content', 'Action']` |
| `Operation` | `index.js` | `['Header', 'Toolbar']` |

#### 1.3.2 Stage B — Custom Page Override Scan (6 Candidates)
After loading the BP, `usePageResolver` scans `src/_ui/[UiName]/pages/` for custom overrides in this order (first match wins):

| Priority | Path | Type |
|----------|------|------|
| 1 (CC) | `_ui/{uiName}/pages/{scope}/{slug}/{page}.vue` | Full Vue override |
| 2 (CP) | `_ui/{uiName}/pages/{scope}/{slug}/{page}.js` | JS modifier |
| 3 (O2) | `_ui/{uiName}/pages/{scope}/{page}.vue` | Scope-wide Vue override |
| 4 (O3) | `_ui/{uiName}/pages/{scope}/{page}.js` | Scope-wide JS modifier |
| 5 (O4) | `_ui/{uiName}/pages/{page}.vue` | UI-wide Vue override |
| 6 (O5) | `_ui/{uiName}/pages/{page}.js` | UI-wide JS modifier |

- A **Vue override** (`isVue: true`) replaces the entire page; the section layout is bypassed.
- A **JS modifier** (`isVue: false`) receives the merged `baseProps` and returns additional props to merge. The section layout still runs with the modified `pageProps`.

#### 1.3.3 `usePageOrchestrator` — The Hidden Middle Layer
`usePageResolver` delegates all record loading, form management, and action execution to `usePageOrchestrator`. This composable:
- Calls `useRecord()` and triggers the correct reload strategy per page (`index` → load list, `view` → load + relations, `edit` → load + initialize form, `add` → initialize empty form, `action` → load record).
- Sets up `useCompositeForm` for parent/child form state (`parentForm`, `childGroups`, `saving`, save handler).
- Detects scope (`master` vs `operation`) and wires the correct action store (`useMasterActions` or `useOperationActions`) for action submission.
- Resolves action-page-specific state via `useActionFields` (`actionForm`, `selectedOutcome`, `resolvedActionFields`, `isMockMultiOutcome`, `outcomeOptions`).
- Exposes `handleSave`, `navigateBack`, `handleSubmit`, `navigateToView`, `addChildRecord`, `removeChildRecord`, `updateChildField`.

#### 1.3.4 The `pageProps` Contract
`pageProps` is the computed object assembled by `usePageResolver` and `v-bind`-ed onto every `<Section>` placeholder and any full page override. **Section authors must understand every prop in this object.**

| Prop | Type | Description |
|------|------|-------------|
| `page` | `String` | Canonical page name: `'index'`, `'view'`, `'add'`, `'edit'`, `'action'`, or custom action slug |
| `scope` | `String` | Route scope: `'master'`, `'operation'`, `'accounts'`, etc. |
| `resource` | `String` | Resource slug from route (e.g. `'currencies'`, `'purchase-orders'`) |
| `uiName` | `String` | Resolved `customUIName` from `APP.Resources` (defaults to `'AQL'`) |
| `parentForm` | `reactive({})` | Parent record form object (bound to add/edit form inputs) |
| `childGroups` | `Array` | Child record groups for composite forms |
| `actionForm` | `reactive({})` | Field values for the current action page |
| `isMockMultiOutcome` | `Boolean` | Whether the action offers multiple outcome choices |
| `outcomeOptions` | `Array` | Available outcome choices (for multi-outcome actions) |
| `resolvedActionFields` | `Array` | Field definitions resolved for the current action |
| `selectedOutcome` | `Ref<String>` | Currently selected action outcome |
| `loading` | `Ref<Boolean>` | Whether the resource record/list is loading |
| `saving` | `Ref<Boolean>` | Whether a composite save is in progress |
| `submitting` | `Ref<Boolean>` | Whether an action submit is in progress |
| `currentActionConfig` | `Object\|null` | The resolved action configuration from `AdditionalActions` |
| `actionAllowedForRecord` | `Boolean` | Whether the action is visible/permitted for the current record |
| `actionName` | `String` | Current action slug or name |
| `onSave` | `Function` | Triggers composite save, navigates on success |
| `onCancel` | `Function` | Navigates back (view → index, edit → view) |
| `onSubmit` | `Function` | Triggers action submission |
| `onNavigateToView` | `Function` | Navigates to the record's view page |
| `'onUpdate:field'` | `Function(header, val)` | Updates a field on `parentForm` |
| `'onAdd-child'` | `Function` | Adds a row to a child resource group |
| `'onRemove-child'` | `Function` | Removes a row from a child resource group |
| `'onUpdate-child-field'` | `Function` | Patches a field on a child row |
| `'onUpdate:selected-outcome'` | `Function(val)` | Updates the selected action outcome |
| `'onUpdate:action-field'` | `Function(header, val)` | Updates a field on `actionForm` |

> [!NOTE]
> **BP props are merged last.** The BP's exported object (or function return) is merged on top of the base `rcProps` above. This means a BP can add additional props (e.g. `sections`, `contents`, custom config keys) that sections can then access via `attrs`.

### 1.4 The Section Resolver (`src/composables/resources/useSectionResolver.js`)
Resolves section-level components and options using a two-step lookup.

#### Registry Architecture
The resolver maintains **two Vite glob registries** built once at module load (before any component mounts):

| Registry | Source Glob | Key Format |
|----------|-------------|------------|
| `frameworkRegistry` | `../../components/**/*.{vue,js}` | `components/...` (lowercased) |
| `customUiRegistry` | `../../_ui/**/*.{vue,js}` | `_ui/...` (lowercased) |

Both registries lowercase all path keys on build. Lookup paths are also constructed in lowercase. **This means section file names are case-insensitive on any OS.** `Header.vue`, `header.vue`, and `HEADER.vue` all resolve to the same registry key.

#### Contexts Injected Internally
`useSectionResolver` **itself injects all three page contexts** (`resourceConfig`, `resourceRecord`, `pageState`) internally — so it can pass them to JS modifier functions. Sections that don't need these contexts in their template do not have to inject them again, though they should inject them for their own use when needed.

#### Step 1 — Base Section Resolution
Lookup order (first match wins):
1. `_ui/{uiName}/components/sections/{section}.vue` — client-specific generic base.
2. `components/sections/{section}.vue` — framework default base.

If neither exists, `Section.vue` renders the "Section Not Defined" card.

#### Step 2 — 10-Tier Override Scan (see §3)

### 1.5 The Page State (`src/composables/resources/usePageState.js`)
Centralizes the reactive form state shared across the Header, Content, and Action sections. It is the single source of truth for input collection, request building, and submission on a resource page.

> For the complete API reference (node mutations, strategy contract, request builders, triggers, and validation), see the canonical document: [PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/PAGE_STATE.md).

**Key points for section authors:**
- `inject('pageState')` gives access to the full `usePageState` return value.
- Use `pageState.useNode(resourceName)` to get a per-section reactive `{ node, options, validation }` accessor.
- Call `pageState.submit()` from Action sections to validate, build, send, and notify.
- Standalone request builders (`compositeSaveRequest`, `resourceBulkRequest`, etc.) and response helpers (`responseFailed`, `failureMessage`, `batchResultCode`) are exported directly from `usePageState.js` and can be imported independently.

---

## 2. Developing Section Components

When creating a new Section component (e.g., adding `src/components/sections/Toolbar.vue`), follow this strict recipe:

### 2.1 Component Signature Checklist
1. **Disable Attribute Fallthrough**: Add `inheritAttrs: false` to options. This is essential to prevent parent properties from colliding with computed final values on the root element.
   ```javascript
   defineOptions({ name: 'Sections[SectionName]', inheritAttrs: false })
   ```
2. **Inject Contexts**: Ingest the provided contexts so that the section stays reactive to page states:
   ```javascript
   const resourceConfig = inject('resourceConfig', null)
   const resourceRecord = inject('resourceRecord', null)
   const pageState      = inject('pageState', null)
   ```
3. **Expose Custom Props Supporting Closures**: Props must accept `Function` as a valid type in addition to raw types:
   ```javascript
   const props = defineProps({
     label: { type: [String, Function], default: '' },
     visible: { type: [Boolean, Function], default: true }
   })
   ```
4. **Evaluate Props via `evaluateProp`**: Map all attributes to a computed `finalAttrs` object using `evaluateProp` before binding them to the inner presenter element:
   ```javascript
   import { evaluateProp } from 'src/composables/resources/useSectionResolver'

   const finalAttrs = computed(() => ({
     ...attrs, // pass through un-declared parent attributes
     label: evaluateProp(props.label, resourceRecord, resourceConfig),
     visible: evaluateProp(props.visible, resourceRecord, resourceConfig) ?? true
   }))
   ```

   > [!IMPORTANT]
   > **`evaluateProp` unwraps refs before calling closures.** When a prop value is a function, `evaluateProp` calls it with `(resourceRecord?.record?.value, resourceConfig?.config?.value)` — plain unwrapped objects, not Vue refs. Write closures accordingly:
   > ```javascript
   > // In a JS modifier or BP — closure receives plain objects:
   > title: (record, config) => `Product: ${record?.Name ?? config?.name}`
   > ```
   > Do **not** attempt to call `.value` inside the closure.

5. **Standard Actions / Emits**: Route actions back using appropriate helpers (e.g., using `useResourceNav` instead of raw `router.push`).

### 2.2 Base Section Component Boilerplate (Modelled after Header.vue)
Use this standard code template as the starting point for any new base section component under `src/components/sections/`:

```html
<template>
  <!-- Render the visual/presenter component binding the finalAttrs -->
  <PresenterComponent v-bind="finalAttrs" @click="handleAction" />
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import PresenterComponent from 'components/app/PresenterComponent.vue'

// 1. Disable Attribute Fallthrough to prevent parent properties from overwriting local values
defineOptions({ name: 'Sections[SectionName]', inheritAttrs: false })

// 2. Define props supporting both static types and dynamic closure functions
const props = defineProps({
  label: { type: [String, Function], default: undefined },
  back: { type: [Boolean, String, Function], default: undefined }
})

const attrs = useAttrs()

// 3. Inject provided page contexts (reactivity sources of truth)
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState      = inject('pageState', null)

// 4. Compute local fallbacks if props are undefined
const derivedLabel = computed(() => {
  return resourceConfig?.config?.value?.name || 'Default Label'
})

// 5. Build finalAttrs evaluating any closures via evaluateProp
const finalAttrs = computed(() => ({
  ...attrs, // pass through un-declared parent attributes
  label: evaluateProp(props.label, resourceRecord, resourceConfig) ?? derivedLabel.value,
  back: props.back ?? true
}))

// 6. Handle local actions and custom callback functions
function handleAction() {
  const backProp = props.back ?? attrs.back
  if (typeof backProp === 'function') {
    return backProp()
  }
  // Fallback to default page/routing navigations
}
</script>
```

### 2.3 Documenting Your Section Component
Once a new Section component is created, you **MUST** update this file to document its parameters and behavior. Provide:
* The props catalog, including data types and default values.
* The arguments passed to closure-based props (by default, `evaluateProp` provides `(record, config)`).
* Example overrides (both JS logic modifiers and Vue overrides).

#### Current Sections Catalog
* **[Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/Header.vue)**: Renders the top branding panel, back arrows, status chips, and reload buttons.
  * *Props*: `title`, `subtitle`, `chip`, `chipColor`, `chipTextColor`, `back`, `reload`, `backIcon`, `reloadIcon`, `leftIconColor`, `icon`, `iconColor`.
  * *Defaults*: Derived automatically from routing metadata and `resourceConfig.ui.menus`.

---

## 3. Section Customization & Overrides

Section customization is handled cleanly using client-specific overrides under `src/_ui/[UiName]/components/`.

### 3.1 The 10-Tier Lookup Priority
When `Section.vue` calls `useSectionResolver(preparedProps)`, it scans for overrides in this order (first match wins):
1. **Vue override** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].vue`
2. **JS modifier** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].js`
3. **Vue override** (resource specific): `.../[scope]/[Resource]/[Section].vue`
4. **JS modifier** (resource specific): `.../[scope]/[Resource]/[Section].js`
5. **Vue override** (page specific): `.../[scope]/[page]/[Section].vue`
6. **JS modifier** (page specific): `.../[scope]/[page]/[Section].js`
7. **Vue override** (scope-wide): `.../[scope]/[Section].vue`
8. **JS modifier** (scope-wide): `.../[scope]/[Section].js`
9. **Vue override** (ui-wide fallback): `.../[Section].vue`
10. **JS modifier** (ui-wide fallback): `.../[Section].js`

**Path segment transformation rules** (critical — get this wrong and nothing resolves):

| Segment | Input | Transformation | Example |
|---------|-------|----------------|---------|
| `[scope]` | Route scope | Lowercased as-is | `master` |
| `[Resource]` | Resource slug | `toPascalCase` → then lowercased | `'purchase-orders'` → `PurchaseOrders` → `purchaseorders` |
| `[page]` | Canonical page | Lowercased as-is | `view` |
| `[Section]` | Section name | Lowercased as-is | `header` |
| `[UiName]` | `customUIName` | Lowercased as-is | `aql` |

> [!IMPORTANT]
> The `[Resource]` path segment is **not** the raw slug. It goes through `toPascalCase` first (joining hyphenated words, capitalising each), then gets lowercased for the registry key. This means `'purchase-orders'` maps to the directory `purchaseorders`, not `purchase-orders` or `PurchaseOrders`. Use this to name your override files/folders.
>
> `customUIName` defaults to `'AQL'` when not configured in `APP.Resources`. This means `src/_ui/AQL/components/` is always scanned — it is the framework's default client, not a special-case tenant.

### 3.2 Vue Overrides vs. JS Modifiers
* **JS Modifiers (`.js`)**: Keep the base template but alter or computed the props passed to it. It can export a static object or a function receiving the current state.
  * *Function signature*:
    ```javascript
    // src/_ui/AQL/components/master/products/header.js
    // Note: all path segments are lowercased; 'Products' → 'products'
    export default (currentProps, { pageState, resourceRecord, resourceConfig }) => {
      // currentProps = the full pageProps object (page, scope, resource, uiName, loading, ...)
      // resourceRecord and resourceConfig here are the raw injected objects (with .record.value etc.)
      return {
        title: (record) => `Product: ${record?.Name || 'Unnamed'}`
      }
    }
    ```
* **Vue Overrides (`.vue`)**: Replaces the base template completely. Write standard SFC files containing a `<template>` block.

### 3.3 Overlapping Attribute Conflicts (The Div-Wrap Trap)
When implementing a `.vue` template override that still wraps the framework's presentation element, you must handle attribute fallthrough carefully. If you do not disable fallthrough, the parent orchestrator attributes will overwrite your local variables.

#### **Avoid the Div-Wrap Trap**
Do not wrap your override inside a `<div>` simply to stop attribute fallthrough:
```html
<!-- BAD: Swallows back/reload actions, permission controls, and status badges -->
<template>
  <div>
    <GenericHeaderPanel title="Custom Title" />
  </div>
</template>
```

#### **Correct Pattern: Disable Fallthrough & Explicitly Bind `$attrs`**
Set `inheritAttrs: false` in the component script and bind `$attrs` **before** writing your custom properties:
```html
<!-- GOOD: Preserves all common behaviors while applying your specific title override -->
<template>
  <GenericHeaderPanel v-bind="$attrs" title="Custom Title" />
</template>

<script setup>
import GenericHeaderPanel from "../../../shared/GenericHeaderPanel.vue"
defineOptions({ inheritAttrs: false })
</script>
```

---

## 4. Strict Maintenance Rule

> [!IMPORTANT]
> **Documentation Sync Requirement**: Any modifications, refactoring, or additions to the Page/Section system structure (such as expanding page overrides, adding custom Vue-based page customization logic, or rewriting record/resource page flows) MUST be accompanied by updates to:
> 1. This document: [AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md)
> 2. The initialization prompt: [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md)
