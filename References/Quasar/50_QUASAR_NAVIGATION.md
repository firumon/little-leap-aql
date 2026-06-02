# 50_QUASAR_NAVIGATION.md - Navigation Bars & Routing Wrappers

This document defines how to implement and configure navigation links, tab bars, page transitions, and routing triggers using Quasar components integrated with AQL's navigation controls.

---

## 1. Purpose

The purpose of this guide is to ensure page transitions are ergonomically friendly on mobile screens, prevent routing conflicts, and enforce the usage of the unified navigation wrapper.

---

## 2. Core Philosophy

AQL navigation is **Centralized, Permission-Gated, and Touch-First**:
*   **Centralized Routing Wrapper:** Components and composables must never route pages directly. All URL transitions are dispatched through the centralized `useResourceNav` composable to guarantee proper parameter mapping.
*   **Bottom Navigation Tabs:** Mobile screens (95% usage) use bottom navigation bars containing large icons and text badges to switch dashboard zones.
*   **Uniform Touch Bounds:** Nav tabs and menus must be sized to comfortably support thumb taps.

---

## 3. Golden Rules

1.  **Prohibit Direct Router Push:** Never import `useRouter` or write `router.push(...)` inside components. Always route via `const { navigate } = useResourceNav()`.
2.  **No Naked Router Links:** Do not use HTML anchors (`<a>`) or raw `<router-link>` elements. Use Quasar buttons (`QBtn`) or route tabs (`QRouteTab`) bound to navigation targets.
3.  **Active Highlight Consistency:** Navigation items must declare explicit active colors (`active-color="primary"`) to tell the user what section is active.
4.  **Confirm Mobile Bottom Tabs:** Main layout navigation on screens under `sm` must map to sticky bottom toolbars.

---

## 4. QTabs & Routing Setup

```html
<!-- FRONTENT/src/layouts/NavigationFooter.vue -->
<template>
  <!-- Sticky bottom navigation bar -->
  <q-footer elevated class="bg-white text-grey-8 lt-sm">
    <q-tabs
      v-model="activeTab"
      dense
      no-caps
      indicator-color="transparent"
      active-color="primary"
      class="full-width"
    >
      <q-tab
        name="dashboard"
        icon="dashboard"
        label="Home"
        @click="goTo('Dashboard')"
      />
      <q-tab
        name="procurement"
        icon="shopping_cart"
        label="Orders"
        @click="goTo('Procurement')"
      />
      <q-tab
        name="inventory"
        icon="inventory"
        label="Stock"
        @click="goTo('Inventory')"
      />
      <q-tab
        name="admin"
        icon="settings"
        label="Admin"
        v-if="allowed({ admin: 'read' })"
        @click="goTo('Admin')"
      />
    </q-tabs>
  </q-footer>
</template>

<script setup>
import { ref } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const activeTab = ref('dashboard')
const { navigate } = useResourceNav()
const { allowed } = useResourceConfig()

const goTo = (slug) => {
  // Centralized navigation router mapping
  navigate({ resourceSlug: slug, action: 'list' })
}
</script>
```

---

## 5. Best Practices

*   **Indicator Color Exclusions:** In mobile bottom tabs, disable default sliding indicator lines (`indicator-color="transparent"`) as they cause visual layout jumps on small screens. Map active states using icon and text color swaps.
*   **Central Nav Configurations:** Maintain routing definitions in standard registry indexes.

---

## 6. Mobile First Rules

*   **Limit Tab Counts:** Bottom navigation bars must contain a maximum of 4 or 5 tabs. If your module has more targets, group secondary routes inside a menu list or drawer.
*   **Icon + Label Layouts:** Ensure tabs declare labels alongside icons to support quick scanning by users.

---

## 7. Common Patterns

### Unified Navigation Action Pattern

Expose clean, reusable navigation pathways inside business composables to decouple page templates from URL mappings:

```javascript
// FRONTENT/src/composables/operations/useOrderNavigation.js
import { useResourceNav } from 'src/composables/resources/useResourceNav'

export function useOrderNavigation() {
  const { navigate } = useResourceNav()

  const navigateToOrderDetails = (orderCode) => {
    navigate({
      resourceSlug: 'purchaseRequisitions',
      action: 'view',
      code: orderCode
    })
  }

  const navigateToOrderEdit = (orderCode) => {
    navigate({
      resourceSlug: 'purchaseRequisitions',
      action: 'edit',
      code: orderCode
    })
  }

  return {
    navigateToOrderDetails,
    navigateToOrderEdit
  }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlBottomNav`: Unified footer tab bar mapping routes, permission configs, and notification badges dynamically.

---

## 9. Accessibility Notes

*   Ensure that every tab control defines a clear keyboard tab index.
*   Add descriptive `aria-selected` bindings.

---

## 10. Dark Mode Notes

*   Verify bottom navigation footers apply suitable border separations (`border-top-1px`) to stand out against page colors in dark layouts.

---

## 11. Performance Notes

*   Avoid invoking route transition logic inside heavy layout rendering hooks to prevent page load stutter.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Importing `router` and calling `router.push('/operations/edit/' + item.id)` inside a click handler.
    *   *Correction:* Always leverage `useResourceNav` mapping parameters: `navigate({ resourceSlug: 'operations', action: 'edit', code: item.id })`.
*   **Anti-Pattern:** Overcrowding mobile view footer blocks with 7 tabs, forcing text to truncate.
    *   *Correction:* Restrict bottom navigation to 4 main items.

---

## 13. AI Agent Rules

1.  **Reject Direct Routing:** Reject any component code importing `vue-router` or executing direct push events.
2.  **Confirm Permissions checks:** Ensure all navigation buttons verify routing rights before rendering.

---

## 14. Decision Matrix

| Screen Width Category | Action Scope | Recommended Navigation | Configuration |
| :--- | :--- | :--- | :--- |
| **Mobile (<600px)** | Main app navigation | Footer Route Tabs (`QTabs`) | Locked sticky, 4 main routes |
| **Mobile (<600px)** | Context details | Drawer Navigation list | Gesture toggle menu |
| **Desktop (>1024px)**| Sidebar modules | Left Sidebar Drawer | Persistent list rows |
| **Desktop (>1024px)**| Secondary utilities | Header Toolbar Menu | Dropdown selection popup |

---

## 15. Final Rule

All page routing transitions must execute via the centralized navigation wrapper, use responsive bottom navigation bars for mobile views, and restrict button count to keep tap targets comfortable.
