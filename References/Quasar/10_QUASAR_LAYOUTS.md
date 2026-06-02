# 10_QUASAR_LAYOUTS.md - Page & Shell Layouts

This document defines how to configure page layouts using Quasar's layout elements. It establishes rules for layout structure, header navigation, footers, drawer containers, and scroll boundaries.

---

## 1. Purpose

The purpose of this layout guide is to ensure all pages maintain visual layout integrity on small screens, prevent vertical overflow bugs, and ensure consistent header toolbar alignments.

---

## 2. Core Philosophy

AQL layouts rely on **Structural Consistency**. The application shell must behave like a native mobile app:
*   **Viewport Locking:** The main app shell must fit exactly within the viewport bounds. Header bars, footers, and side drawers must stay sticky, and only the central content container (`QPage`) is permitted to scroll.
*   **Logical View Configuration:** Configure `QLayout` using the exact view template property (e.g., `lHh Lpr fFf`) to define how headers and footers overlap drawer layouts.
*   **Dynamic Height Resolution:** Heights of sub-containers must be resolved using flex-grid layouts or inherited percentage heights rather than absolute pixel measurements.

---

## 3. Golden Rules

1.  **Strict View Configurations:** The standard layout view property for AQL mobile apps is `lHh Lpr lFf` (Header is persistent, side drawers slide under the header, footer is persistent).
2.  **No `100vh` in Pages:** Never apply `height: 100vh` to a `QPage` or sub-card. Always use Quasar's dynamic padding calculations or `height: 100%` on inherit blocks.
3.  **One `QPageContainer` per Layout:** The main layout must contain exactly one `QPageContainer` child element to host route transitions. Do not nest page containers.
4.  **Sticky Headers Only:** Mobile pages must lock the header toolbars sticky at the top using `QHeader` with the `elevated` prop.

---

## 4. Component Layout Setup

Here is a standard base template showing layout structural elements:

```html
<!-- FRONTENT/src/layouts/MainLayout.vue -->
<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Header Gated with user profile checks -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title class="text-subtitle1 text-weight-bold">
          AQL Portal
        </q-toolbar-title>
        <q-btn flat round dense icon="search" @click="openSearch" />
      </q-toolbar>
    </q-header>

    <!-- Navigation Drawer -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="250"
      :breakpoint="600"
    >
      <q-scroll-area class="fit">
        <q-list padding class="menu-list">
          <q-item clickable v-ripple to="/dashboard">
            <q-item-section avatar>
              <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>Dashboard</q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <!-- Main Content Area -->
    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Mobile Navigation Footer Bar (Visible on mobile viewports only) -->
    <q-footer v-if="$q.screen.lt.sm" elevated class="bg-white text-primary">
      <q-tabs no-caps active-color="primary" class="text-grey-7" dense>
        <q-route-tab to="/operations" icon="assignment" label="Operations" />
        <q-route-tab to="/inventory" icon="store" label="Inventory" />
        <q-route-tab to="/profile" icon="person" label="Profile" />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'

const leftDrawerOpen = ref(false)
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
const openSearch = () => {
  // Navigation search page logic
}
</script>
```

---

## 5. Best Practices

*   **Configure View Property Properly:** The property `view="lHh Lpr lFf"` ensures the left drawer has a lower vertical layer order, meaning it slides under the toolbar. This keeps headers visible for quick back navigation at all times.
*   **Prevent Double Scrollbars:** If your inner page contents need to scroll independently, make the parent container lock height (`overflow-hidden`) and place a `QScrollArea` inside the target card. Never allow the main window scrollbar and an inner card scrollbar to render concurrently.

---

## 6. Mobile First Rules

*   **Page padding adjustments:** On screen widths under `sm`, shrink standard page padding from `q-pa-lg` to `q-pa-md` or `q-pa-sm` to prevent layout narrowing on small devices.
*   **Adaptive Footer Visibility:** Use `$q.screen.lt.sm` on `QFooter` tabs to hide the bottom tab bar on desktop and expand the content space.

---

## 7. Common Patterns

### Sticky Sub-Header Search Layout

```html
<!-- FRONTENT/src/pages/Operations/OutletSearchPage.vue -->
<template>
  <q-page class="column no-wrap bg-grey-1" style="min-height: inherit;">
    <!-- Sticky Search Block -->
    <div class="bg-white q-pa-sm shadow-1">
      <q-input
        v-model="searchQuery"
        outlined
        dense
        placeholder="Search operations..."
        class="full-width"
      >
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <!-- Scrolling List Block -->
    <div class="col scroll q-pa-sm">
      <q-list separator>
        <q-item v-for="i in 20" :key="i" clickable v-ripple>
          <q-item-section>
            <q-item-label class="text-weight-bold">Order #{{ i }}</q-item-label>
            <q-item-label caption>Status: Processing</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
const searchQuery = ref('')
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlLayout`: Master responsive drawer shell component wrapping drawer configurations, footer items, and route views.
*   `AqlStickyBar`: Floating action wrapper that pins to the screen bottom for quick, thumb-accessible mobile buttons.

---

## 9. Accessibility Notes

*   Provide clear landmark semantic configurations. Wrap your pages using the main layout tag, and ensure all toolbar actions contain custom `aria-label` settings.

---

## 10. Dark Mode Notes

*   Avoid applying solid light borders on drawer navigation menus. Use `dark` tags or default `bordered` values that automatically map grey color thresholds.

---

## 11. Performance Notes

*   Disable dynamic animation effects on `QDrawer` transition rules on low-power mobile devices.
*   Enforce lazy-mount configurations (`lazy`) on drawers that start collapsed.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Nesting `QLayout` blocks inside another `QLayout`.
    *   *Correction:* Always manage sub-content segments via columns or tabs inside a single root `QLayout`.
*   **Anti-Pattern:** Setting hardcoded vertical heights (e.g. `style="height: 600px"`) on layout containers.
    *   *Correction:* Use the `col` CSS class and `scroll` utility for flexible heights.

---

## 13. AI Agent Rules

1.  **Enforce Container Hierarchies:** Ensure every page file begins with a root `<q-page>` tag.
2.  **Verify Layout Boundaries:** Verify that no layouts specify raw absolute position variables when standard slot structures exist.

---

## 14. Decision Matrix

| Screen Size Mode | View Property Configuration | Drawer Trigger Action | Footer Layout |
| :--- | :--- | :--- | :--- |
| **Mobile (<600px)** | `lHh Lpr lFf` | Touch gesture swipe right | Dynamic route tabs panel |
| **Tablet (600-1024px)** | `hHh Lpr fFf` | Click toggle button | Hidden (Drawer list primary) |
| **Desktop (>1024px)** | `hHh Lpr fFf` | Always expanded | Hidden (Sidebar navigation) |

---

## 15. Final Rule

All layouts must use a single root `QLayout` with view property `lHh Lpr lFf`, nested page container, page block wrappers, and keep sticky header toolbars elevated for direct back navigation.
