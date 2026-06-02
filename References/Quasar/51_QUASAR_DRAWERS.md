# 51_QUASAR_DRAWERS.md - Side Drawers & Navigation Menus

This document defines how to implement and configure collapsible side navigation drawers using Quasar's drawer component (`QDrawer`) to support ergonomic menu selections.

---

## 1. Purpose

The purpose of this guide is to explain drawer breakpoint variables, detail scroll area nesting configurations, and define responsive width boundaries.

---

## 2. Core Philosophy

AQL drawers are **Collapsible, Scroll-Managed, and Lightweight**:
*   **Collapsible Default:** On mobile viewports (95% usage), the side navigation drawer must hide by default and slide into view only when triggered by swipe gestures or header button taps.
*   **Contained Scrolls:** Drawers must not trigger page-level scrolling. We wrap drawer options inside a `QScrollArea` container.
*   **Ergonomic Sizing:** Drawer widths must remain compact (typically `240px` to `280px`) so a portion of the main layout page remains visible as a tap-dismiss backdrop surface.

---

## 3. Golden Rules

1.  **Strict Mobile Breakpoint:** Configure the breakpoint attribute on drawers to ensure automatic collapse on screens under tablet sizes: `:breakpoint="600"`.
2.  **Nest Scroll Areas Natively:** Always wrap lists inside drawers using a `<q-scroll-area class="fit">` tag to support high-density scroll lists.
3.  **Restrict Drawer Widths:** Mobile drawer widths must not exceed `280px`. Use `:width="250"` as the default standard.
4.  **Incorporate Gesture Swipes:** Support touch actions on mobile by enabling overlay gestures: `behavior="mobile"`.

---

## 4. QDrawer Layout Setup

```html
<!-- FRONTENT/src/layouts/NavigationDrawer.vue -->
<template>
  <!-- Drawer component mapping responsive behavior -->
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
    <!-- Container scroll block -->
    <q-scroll-area class="fit">
      <!-- Options layout list -->
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

---

## 5. Best Practices

*   **Active Item Highlights:** Set `active-class="text-primary bg-blue-1"` on navigation elements to display visual selection cues.
*   **Simple Transitions:** Rely on native CSS transitions to prevent visual stutters on mobile CPUs.

---

## 6. Mobile First Rules

*   **Swipe to Open Toggles:** Ensure drawers allow swipe controls by keeping overlays enabled. This matches native mobile navigation ergonomics.
*   **Dismiss Backdrops:** Verify that backdrop overlays are dim-clickable so users can close menus easily.

---

## 7. Common Patterns

### Toggle Button Controller Pattern

Ensure your layout headers expose clean drawer controllers:

```html
<!-- FRONTENT/src/components/Navigation/OutletDrawerToggler.vue -->
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

## 8. Reusable Component Suggestions

*   `AqlDrawerList`: Standardized navigation menu list wrapper linked to routes configuration arrays.

---

## 9. Accessibility Notes

*   Verify drawer elements define `aria-hidden` attributes correctly when collapsed.
*   Keep list items keyboard navigable.

---

## 10. Dark Mode Notes

*   Ensure list backgrounds change automatically to `bg-dark` or `bg-surface` when dark mode triggers.

---

## 11. Performance Notes

*   **Lazy Drawer Renders:** Avoid rendering heavy widgets inside drawer scroll trees. Keep layouts text-focused.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Setting a side drawer width to `100vw`, completely covering the viewport on mobile and hiding close overlays.
    *   *Correction:* Enforce width limits between `240px` and `280px`.
*   **Anti-Pattern:** Implementing scrolling directly inside the drawer without utilizing `QScrollArea`.
    *   *Correction:* Nest drawer lists inside `QScrollArea`.

---

## 13. AI Agent Rules

1.  **Verify Breakpoint Settings:** Confirm all drawer code implements the `:breakpoint="600"` responsive toggle.
2.  **Validate Scroll Wrappers:** Ensure menu lists are nested inside `QScrollArea` tags.

---

## 14. Decision Matrix

| Viewport Width | Drawer Mode Selection | Width Value | Scroll Strategy |
| :--- | :--- | :--- | :--- |
| **Mobile (<600px)** | `overlay` behavior | `250px` | Nested `QScrollArea` fit |
| **Tablet (600-1024px)** | `overlay` behavior | `260px` | Nested `QScrollArea` fit |
| **Desktop (>1024px)** | `persistent` / `side` | `280px` | Persistent column flow |

---

## 15. Final Rule

Collapsible drawers must utilize responsive breakpoints, lock width limits, scroll options lists inside nested scroll area wrappers, and slide under headers.
