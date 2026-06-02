# 52_QUASAR_TOOLBAR.md - Header Toolbars & Action Bars

This document defines how to implement and configure headers using Quasar's toolbar component (`QToolbar`) to support clean action placement.

---

## 1. Purpose

The purpose of this guide is to explain layout spacing rules inside toolbars, ensure action icons have sufficient spacing, and detail status indicator configurations.

---

## 2. Core Philosophy

AQL toolbars are **Action-Light, Spacing-Consistent, and Highly Visible**:
*   **Minimal Actions:** Mobile toolbars must not exceed 2 primary actions (such as Search or Add) plus the side navigation drawer toggle button. Secondary options are grouped inside dropdown context menus.
*   **Logical Flex Separations:** Toolbar elements must align dynamically using `<q-space />` blocks rather than absolute text positioning rules.
*   **Standard Sizing:** Toolbars rely on native height profiles (`dense` setups inside child modules) to preserve vertical space.

---

## 3. Golden Rules

1.  **Restrict Active Icons Count:** Limit visible actions on the toolbar to a maximum of three on mobile views.
2.  **Ensure Explicit Focus Labels:** Every toolbar button icon must declare an `aria-label` or `title` key.
3.  **Prohibit Custom Height Styles:** Never force absolute heights on `QToolbar` containers.
4.  **Incorporate Spacing Helpers:** Segment titles from settings and icons using standard spaces (`<q-space />`).

---

## 4. QToolbar Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Navigation/OutletHeaderToolbar.vue -->
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

    <!-- Header Title -->
    <q-toolbar-title class="text-subtitle1 text-weight-bold text-truncate">
      {{ title }}
    </q-toolbar-title>

    <!-- Flex pusher -->
    <q-space />

    <!-- Synchronizing Indicator Badge -->
    <q-icon
      v-if="isSyncing"
      name="sync"
      class="q-mr-sm animate-spin"
      size="xs"
    />

    <!-- Primary Action Icon -->
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
/* Keyframe spin animation for synchronizing state */
.animate-spin {
  animation: q-spin 2s linear infinite;
}
@keyframes q-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
```

---

## 5. Best Practices

*   **Truncated Title Strings:** Add typography truncations (`text-truncate` or `ellipsis`) to header titles to prevent overflow wraps on narrow phone displays.
*   **Visual Contrasts:** Ensure toolbars maintain rich background alignments (like `bg-primary` or `bg-dark`) so layouts separate clearly from page contents.

---

## 6. Mobile First Rules

*   **Round Button Comfort:** Use round, dense action button properties (`round`, `dense`) to keep the button boundaries comfortably within mobile layouts.
*   **Limit Text Lengths:** Avoid putting secondary description sentences inside toolbar areas.

---

## 7. Common Patterns

### Adaptive Breadcrumb Toolbar Pattern

For nested layouts, replace side drawer toggles with dynamic back routing triggers:

```html
<!-- FRONTENT/src/components/Navigation/OutletBackToolbar.vue -->
<template>
  <q-toolbar class="bg-white text-dark border-grey-3">
    <!-- Back arrow trigger -->
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
  // Return to list view
  navigate({ action: 'list' })
}
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlToolbar`: Custom toolbar component wrapping drawer controllers, synchronizing tags, and permissions-checked search parameters.

---

## 9. Accessibility Notes

*   Verify all button controls describe their targets via labels (e.g. `aria-label="Search order logs"`).

---

## 10. Dark Mode Notes

*   Verify that toolbars apply slate configurations (`bg-dark`, `text-white`) under dark mode themes.

---

## 11. Performance Notes

*   Do not bind heavy data calculations to icons rendering loops.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting wide search text boxes inside mobile headers next to 3 action icons, causing layout crowding.
    *   *Correction:* Replace search bars with a single search trigger button that toggles an input overlay.
*   **Anti-Pattern:** Setting raw height values like `style="height: 80px;"` on toolbar wraps.
    *   *Correction:* Rely on default CSS properties.

---

## 13. AI Agent Rules

1.  **Reject Custom Heights:** Ensure all toolbar templates rely on standard styling properties.
2.  **Confirm Label Attributes:** Reject code blocks generating button icons lacking explicit `aria-label` settings.

---

## 14. Decision Matrix

| Layout Placement | Context Sizing | Primary Action | Target Configuration |
| :--- | :--- | :--- | :--- |
| **Main App Shell Header**| Standard size | Drawer toggle | Left side button, elevated |
| **Nested Sub-Page Header**| Dense size | Route back trigger | Back arrow icon |
| **Card Footer Action Bar**| Dense size | Submit button | Right aligned options |

---

## 15. Final Rule

All header toolbars must enforce action-light limits, apply flexible spacing helpers, include label attributes for icons, and back arrow routing controls.
