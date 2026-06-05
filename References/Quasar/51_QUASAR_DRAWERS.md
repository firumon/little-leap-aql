# 51_QUASAR_DRAWERS.md - Side Drawers & Navigation Menus

This document is an educational reference guide covering the implementation, configuration, and behavior of collapsible side drawers in Quasar utilizing the `QDrawer` component.

---

## 1. Component Overview

`QDrawer` is a Quasar component used to implement side navigation panels, collapsible menu lists, or detail sidebars. It integrates with Quasar's layout container (`QLayout`) and can be positioned on either the left or right side of the screen.

### Key Features
*   **Collapsible Behavior**: Drawers can transition between persistent (always open) and overlay (sliding out when triggered) states based on window width or explicit states.
*   **Scroll Area Integration**: Nesting a scroll area container inside the drawer ensures list content scrolls independently of the main page layout.
*   **Behavior Configuration**: Drawers support different modes such as `mobile`, `desktop`, or `overlay` to adjust styling and interaction patterns for various screens.

---

## 2. Key Properties & Configurations

*   **`v-model`**: Controls the visibility or expanded state of the drawer (boolean).
*   **`side`**: Specifies whether the drawer is placed on the `"left"` or `"right"` side of the layout.
*   **`behavior`**: Determines the layout behavior (`"mobile"`, `"desktop"`, or `"emulator"`).
*   **`width`**: Defines the width of the drawer in pixels (e.g., `:width="260"`).
*   **`breakpoint`**: The width threshold in pixels below which the drawer automatically switches to mobile (overlay) mode (e.g., `:breakpoint="600"`).
*   **`overlay`**: When active, the drawer slides over the page content rather than pushing it aside.

---

## 3. Usage Examples

### Responsive Side Navigation Drawer

This drawer is configured to automatically collapse below `600px` screen width and utilizes a `QScrollArea` to contain its navigation lists.

```html
<template>
  <q-drawer
    v-model="drawerState"
    side="left"
    overlay
    behavior="mobile"
    :width="260"
    :breakpoint="600"
    bordered
    class="bg-grey-1"
  >
    <!-- Scrollable container for menu list items -->
    <q-scroll-area class="fit">
      <q-list padding class="menu-list text-grey-8">
        <!-- Header Profile Summary Area -->
        <q-item class="q-py-md bg-primary text-white">
          <q-item-section avatar>
            <q-avatar icon="person" color="white" text-color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">Operator John</q-item-label>
            <q-item-label caption class="text-white opacity-70">Warehouse Manager</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator />

        <!-- Navigation items list -->
        <q-item clickable v-ripple to="/dashboard" active-class="text-primary bg-blue-1">
          <q-item-section avatar>
            <q-icon name="dashboard" />
          </q-item-section>
          <q-item-section>Dashboard</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          v-if="allowed({ inventory: 'read' })"
          to="/inventory"
          active-class="text-primary bg-blue-1"
        >
          <q-item-section avatar>
            <q-icon name="inventory_2" />
          </q-item-section>
          <q-item-section>Inventory</q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>
  </q-drawer>
</template>

<script setup>
import { ref } from 'vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const drawerState = ref(false)
const { allowed } = useResourceConfig()
</script>
```

### Drawer Toggle Button

Headers typically control drawer states by emitting toggle events:

```html
<template>
  <q-btn
    flat
    dense
    round
    icon="menu"
    aria-label="Toggle Drawer Menu"
    @click="toggleDrawer"
  />
</template>

<script setup>
const emit = defineEmits(['toggle'])
const toggleDrawer = () => {
  emit('toggle')
}
</script>
```

---

## 4. Behavior and Layout Considerations

*   **Responsive Widths**: Keeping drawer widths within range (e.g., `240px` to `280px`) allows users to see part of the background content when the drawer behaves as an overlay on smaller screens. This makes it clear that the overlay can be dismissed by tapping the backdrop.
*   **Independent Scroll Management**: Using `<q-scroll-area class="fit">` inside the drawer restricts scrolling to the menu itself, preventing double scrollbars or page-level scrolling issues when the list of navigation options is long.
*   **Touch and Gestures**: In mobile mode, supporting swipe gestures and dim-clickable backdrops improves navigation usability on touch-enabled devices.
*   **Accessibility**: Ensuring the drawer's elements are accessible involves using standard attributes (like `aria-hidden` when collapsed) and keeping the focus flow within the viewport for keyboard users.
