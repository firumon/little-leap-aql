# 53_QUASAR_PAGE_HEADERS.md - Page Title Sections & Action Groups

This document is an educational reference guide detailing the implementation, layout structure, and responsive configuration of page header sections in Quasar.

---

## 1. Concept Overview

A page header is the content section positioned directly below the primary application toolbar. It serves to establish visual hierarchy, display the title and description of the current view, and provide primary actions relevant to the context of the page (such as creating a resource, filtering lists, or navigating back).

---

## 2. Key Layout Elements & Classes

*   **Grid and Flexbox**: Page headers commonly use standard flex containers (e.g. `row items-center justify-between no-wrap`) to distribute titles on the left and primary page actions on the right.
*   **Typography Scaling**: Applying classes like `text-h5` (or `text-h4` on larger screens) provides clear hierarchy. Setting semantic headers (e.g. `<h1>` tags) helps with screen reader document structure.
*   **Margin & Padding**: Using standard Quasar spacing tokens (such as `q-mb-md` for bottom margin or `q-pb-sm` for padding) establishes consistent separation from the page body.
*   **Dynamic Actions Layout**: Header actions can be configured to toggle between icon-only buttons on narrow screens and icon-with-text buttons on wider viewports.

---

## 3. Usage Examples

### Responsive Page Header with Actions

This header component adapts its action buttons based on screen size, displaying text labels on desktop and round icons on mobile devices.

```html
<template>
  <div class="page-header-container row items-center justify-between no-wrap q-mb-md">
    <!-- Title block with optional back arrow navigation -->
    <div class="row items-center no-wrap ellipsis">
      <q-btn
        v-if="hasBack"
        flat
        round
        dense
        icon="arrow_back"
        color="primary"
        class="q-mr-sm"
        aria-label="Back"
        @click="emit('back')"
      />
      <div class="column ellipsis">
        <h1 class="text-h5 text-weight-bold q-my-none ellipsis">{{ title }}</h1>
        <span v-if="subtitle" class="text-caption text-grey-7 ellipsis">
          {{ subtitle }}
        </span>
      </div>
    </div>

    <!-- Header Action Buttons ( gated by permissions ) -->
    <div class="row items-center q-gutter-x-sm" v-if="allowed({ inventory: 'create' })">
      <q-btn
        v-ripple
        color="primary"
        :round="$q.screen.lt.sm"
        :icon="actionIcon"
        :label="$q.screen.gt.xs ? actionLabel : ''"
        @click="emit('action')"
      />
    </div>
  </div>
</template>

<script setup>
import { useResourceConfig } from 'src/composables/useResourceConfig'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  hasBack: { type: Boolean, default: false },
  actionLabel: { type: String, default: 'Create' },
  actionIcon: { type: String, default: 'add' }
})

const emit = defineEmits(['back', 'action'])
const { allowed } = useResourceConfig()
</script>
```

### Sub-Header Search Layout

This layout couples a page title with an inline search input field positioned directly below it.

```html
<template>
  <div class="column q-mb-md">
    <div class="row justify-between items-center q-mb-sm">
      <h1 class="text-h5 text-weight-bold q-my-none">Inventory Catalog</h1>
      <q-btn flat round icon="filter_list" @click="emit('filter')" />
    </div>
    
    <q-input
      v-model="searchQuery"
      outlined
      dense
      clearable
      placeholder="Search items..."
      @update:model-value="onSearch"
    >
      <template v-slot:prepend>
        <q-icon name="search" />
      </template>
    </q-input>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const searchQuery = ref('')
const emit = defineEmits(['search', 'filter'])

const onSearch = (val) => {
  emit('search', val)
}
</script>
```

---

## 4. Accessibility and Styling Best Practices

*   **Heading Semantics**: Using semantic header tags (like `<h1>` styled with Quasar typography classes) helps screen readers build page outlines correctly.
*   **Responsive Typography**: Gating font-scale classes based on the viewport (e.g., smaller classes for mobile screens) helps titles fit without truncating vital information.
*   **Action Gutters**: Adding spacing rules (such as `q-gutter-x-sm`) prevents buttons from overlapping, which supports touch interface accuracy.
*   **Accessibility Labels**: Interactive elements, such as back navigation arrows, are best configured with descriptive labels or titles for assistive devices.
