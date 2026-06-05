# 50_QUASAR_NAVIGATION.md - Navigation Bars & Routing Wrappers

This document is an educational reference guide covering navigation components, responsive layouts, and routing conventions in the AQL application architecture, particularly utilizing Quasar's `QTabs` and routing wrappers.

---

## 1. Architectural Convention: Centralized Navigation

In the AQL architecture, routing is centralized to ensure parameter safety, consistent route logging, and permission validation. 

### `useResourceNav`
Instead of using direct router pushes (like `router.push(...)` from `vue-router`), pages and buttons route via the `useResourceNav` composable. This composable abstracts path construction and enforces uniform route matching rules across the project.

---

## 2. Key Components & Layouts

*   **`QTabs`**: Commonly used to construct navigation bars. In mobile configurations, tabs are often styled with `dense` and `no-caps` attributes.
*   **`QRouteTab`**: Inherits from `QTab` and integrates directly with Vue Router, automatically styling active links based on the current URL.
*   **`active-color`**: Highlights the active navigation item (e.g., `active-color="primary"`).
*   **`indicator-color`**: Defines the color of the sliding active indicator. Setting this to `transparent` can be useful in mobile layouts to minimize visual layout jumps.

---

## 3. Usage Examples

### Mobile Footer Navigation Layout

This layout is commonly positioned at the bottom of mobile viewports, mapping core resources using `useResourceNav` for page routing.

```html
<template>
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
  navigate({ resourceSlug: slug, action: 'list' })
}
</script>
```

### Encapsulating Routes inside Business Composables

To decouple user interface components from specific routing parameters, navigation functions can be wrapped in dedicated composables:

```javascript
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

## 4. Layout and Usability Considerations

*   **Responsive Placement**: For narrow viewports (e.g. mobile), a bottom navigation bar layout provides easy reachability. For wider desktop viewports, a persistent sidebar drawer or header menu is typically preferred.
*   **Item Count Limits**: Standard mobile bottom navigation works best when limited to 4 or 5 primary categories to ensure readable text labels and adequate spacing.
*   **Gating Routes**: Combining navigation links with permission checks (`allowed(...)`) helps dynamically hide options that the user does not have access to read or update.
*   **Accessibility**: Assigning clear labels alongside icons improves usability for screen readers and assists in scanning navigation items.
