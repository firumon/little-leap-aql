# 52_QUASAR_TOOLBAR.md - Header Toolbars & Action Bars

This document is an educational reference guide covering the layout, elements, and usage of Quasar's Toolbar component (`QToolbar`).

---

## 1. Component Overview

`QToolbar` is a container component typically used in headers, footers, or sub-headers to align titles, navigation triggers, and context actions. It utilizes CSS Flexbox layout internally to distribute elements across the bar.

### Key Sub-Components
*   **`QToolbarTitle`**: Wraps the text title of the current view, applying appropriate font-weight, padding, and text overflow settings.
*   **`QSpace`**: A spacer element that fills available space, pushing adjacent components to the left or right edges of the toolbar container.

---

## 2. Key Configurations

*   **Action Spacing**: Spacing button elements with attributes like `flat`, `round`, and `dense` helps fit action items cleanly into the toolbar height constraints.
*   **Truncation Helpers**: Applying classes like `text-truncate` or `ellipsis` to `QToolbarTitle` prevents long headers from pushing action buttons off-screen on narrow viewports.
*   **Height Constraints**: Rather than overriding container heights with absolute pixel styling, relying on Quasar's default toolbar spacing or the `dense` property ensures alignment with other components.

---

## 3. Usage Examples

### Standard Header Toolbar

This layout includes a side drawer trigger, a page title, an activity status indicator, and context menu actions.

```html
<template>
  <q-toolbar class="bg-primary text-white shadow-2">
    <!-- Menu Drawer Toggler -->
    <q-btn
      flat
      dense
      round
      icon="menu"
      aria-label="Toggle Navigation Drawer"
      @click="emit('toggle-drawer')"
    />

    <!-- Header Title with truncation helper -->
    <q-toolbar-title class="text-subtitle1 text-weight-bold text-truncate">
      {{ title }}
    </q-toolbar-title>

    <!-- Pushes subsequent items to the right -->
    <q-space />

    <!-- Status Indicator -->
    <q-icon
      v-if="isSyncing"
      name="sync"
      class="q-mr-sm animate-spin"
      size="xs"
    />

    <!-- Action Icon -->
    <q-btn
      flat
      round
      dense
      icon="search"
      aria-label="Search items"
      @click="emit('search')"
    />

    <!-- Context Actions Trigger -->
    <q-btn
      flat
      round
      dense
      icon="more_vert"
      aria-label="More settings options"
    >
      <q-menu auto-close>
        <q-list style="min-width: 120px;">
          <q-item clickable v-ripple @click="emit('settings')">
            <q-item-section>Settings</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </q-toolbar>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  isSyncing: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-drawer', 'search', 'settings'])
</script>

<style scoped>
.animate-spin {
  animation: q-spin 2s linear infinite;
}
@keyframes q-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
```

### Sub-Page Header Toolbar with Back Navigation

For detail pages or nested layouts, replacing the side menu toggle with a back-navigation button allows users to return to parent pages. This example uses the AQL architectural `useResourceNav` wrapper to manage routes.

```html
<template>
  <q-toolbar class="bg-white text-dark border-grey-3">
    <!-- Back Navigation Action -->
    <q-btn
      flat
      round
      dense
      icon="arrow_back"
      aria-label="Go Back to list"
      @click="goBack"
    />
    <q-toolbar-title class="text-subtitle2 text-weight-bold">
      Record details: {{ code }}
    </q-toolbar-title>
  </q-toolbar>
</template>

<script setup>
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineProps({
  code: { type: String, required: true }
})

const { navigate } = useResourceNav()

const goBack = () => {
  navigate({ action: 'list' })
}
</script>
```

---

## 4. Accessibility and Usability Guidelines

*   **Descriptive Buttons**: Interactive icons without text labels are best paired with `aria-label` or `title` attributes so screen readers can describe the button's action.
*   **Controlling Visual Clutter**: If a design calls for more than a few toolbar buttons on narrow screens, grouping secondary operations into a `QMenu` dropdown keeps the header organized and prevents buttons from overlapping.
*   **Search Input Alternatives**: On small screens, embedding a full-width search input directly inside the toolbar can crowd titles. An alternative is using a search icon button that displays a full-width search overlay or dropdown input field when tapped.
