# Page & Section — Authoring a Section Component

> Part of **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**. Signature checklist, boilerplate and documentation rules for a new Section.

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
* **[FilterInput.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/FilterInput.vue)**: Renders a text input for filtering or searching record datasets, supporting debounce and custom icons.
  * *Props*: `outlined`, `debounce`, `placeholder`, `icon`, `iconColor`, `clearable`, `clearIcon`, `label`.
  * *Defaults*: Binds dynamically to `filterTerm` or `searchTerm` inside `resourceRecord` (falls back to local state). Default icon is `'filter_list'`.
* **[ListSwitcher.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/ListSwitcher.vue)**: Renders a premium pill/segment-style switcher bar for switching between named list views or states.
  * For full catalog specification, customization scenarios, dynamic modifiers, and responsive overflow logic, refer to the canonical [AQL Frontend List Switcher Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_LIST_SWITCHER.md).
* **[MetricCards.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/MetricCards.vue)**: Renders a horizontal row of dashboard stat counters — "12 overdue visits", "8 due today", and similar key operational metrics. See §2.4 below.
* **[LinearProgress.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/LinearProgress.vue)**: Renders graphical linear progress bars for completion tracking — "14 / 25 completed visits (56%)". See §2.5 below.


---

⬑ Back to **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**.
