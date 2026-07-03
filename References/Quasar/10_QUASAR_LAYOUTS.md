# Quasar Layouts & Page Shells Reference

This document describes how page layouts are configured and structured using Quasar's layout system. It focuses on shell design, header navigation, footers, drawer configurations, and viewport space management.

## 1. The Quasar Layout System

Quasar utilizes a centralized layout system (`QLayout`) to manage headers, footers, drawers, page containers, and route views within a single cohesive shell.

### Layout View Configuration
The `view` property on `QLayout` consists of three letters representing the positions of the header, drawers, and footer relative to each other:
*   **Format:** A string of 9 characters (e.g., `lHh Lpr lFf`) that dictates how layout boundaries behave:
    *   **First part (`lHh`):** Dictates header placement. If `l` is lowercase, the left drawer slides under the header. If `H` is uppercase, the header is persistent and drawer slides under it.
    *   **Second part (`Lpr`):** Dictates drawer behavior (left drawer, page container, right drawer).
    *   **Third part (`lFf`):** Dictates footer behavior.
*   **Common Setup:** A configuration like `lHh Lpr lFf` keeps the header at the top layer, letting side navigation drawers slide underneath it, and places the footer at the bottom.

---

## 2. Page & Shell Components

*   **QHeader:** Holds toolbar components. Typically configured as sticky at the top of the viewport.
*   **QToolbar & QToolbarTitle:** Structural containers for buttons, titles, search bars, and action links.
*   **QDrawer:** Provides sidebar navigation. It can be configured with props like `show-if-above` to display by default on wide screens and hide into a swipeable menu on smaller viewports.
*   **QPageContainer:** The host container that wraps routing layouts. In a standard Quasar application, a single `QPageContainer` wraps the `<router-view />`.
*   **QFooter:** Sticky bottom container. Often used to host navigation tabs on mobile screens.
*   **QPage:** The root container for individual page templates.

---

## 3. Viewport and Scroll Management

*   **Viewport Height Resolution:** Using `min-height: inherit` or flex columns instead of `height: 100vh` on pages allows components to fit properly within the page container without causing layout shifts or overlapping toolbars.
*   **Scroll Areas:** To prevent nested or concurrent scrollbars, pages can lock the outer overflow and handle scrolling internally using `QScrollArea` or CSS `scroll` classes inside child containers.
*   **Dynamic Padding:** Modifying container padding class helpers (e.g., `q-pa-xs`, `q-pa-sm`, `q-pa-md`) based on viewport sizes allows content to fit comfortable margins.

---

## 4. Code Example: Layout Shell Template

Below is a standard layout template showing how header, drawer, and footer tabs can be arranged:

```html
<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Header -->
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

    <!-- Page Content Container -->
    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Footer Navigation (Visible on mobile viewports) -->
    <q-footer v-if="$q.screen.lt.sm" elevated class="bg-white text-primary">
      <q-tabs no-caps active-color="primary" class="text-grey-7" dense>
        <q-route-tab to="/operation" icon="assignment" label="Operations" />
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
  // Search activation logic
}
</script>
```

---

## 5. Layout Setup Summary

| Screen Width Category | Common View Layout | Drawer Toggle Trigger | Footer Tabs |
| :--- | :--- | :--- | :--- |
| **Mobile (<600px)** | `lHh Lpr lFf` | Touch swipe / toggle button | Enabled dynamic route tabs |
| **Tablet (600-1024px)** | `hHh Lpr fFf` | Click toggle button | Hidden |
| **Desktop (>1024px)** | `hHh Lpr fFf` | Always expanded by default | Hidden |

