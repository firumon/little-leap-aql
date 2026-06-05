# Quasar Responsive Design & Adaptive Layouts Reference

This document describes how to implement responsive layouts using Quasar's breakpoint grid system, CSS visibility classes, and the programmatic `Screen` plugin.

## 1. Breakpoint Grid System

Quasar utilizes standard screen size thresholds to apply responsive styles and column grids. These thresholds are defined as:

| Breakpoint | Screen Width Range | Target Category |
| :--- | :--- | :--- |
| **xs** (extra small) | 0px to 599px | Mobile handsets |
| **sm** (small) | 600px to 1019px | Tablets |
| **md** (medium) | 1020px to 1439px | Laptops / smaller desktops |
| **lg** (large) | 1440px to 1919px | Desktop monitors |
| **xl** (extra large) | 1920px+ | Large displays |

### Responsive Column Grid
Quasar's flex grid classes can be combined to define layout structures that adapt dynamically to viewport changes:
*   **Mobile-First Columns:** Setting `col-12` as the base class ensures the column spans full width on mobile screens. Overrides for larger screens (e.g., `col-sm-6` or `col-md-4`) can be appended to adjust spacing on wider viewports.
*   **Column Summation:** To prevent accidental horizontal scrollbars or columns wrapping unexpectedly, grid items within a `row` container typically sum to exactly 12 columns for a given viewport target.

---

## 2. Programmatic Adaptation with the Screen Plugin

For complex UI components that require different structures on mobile versus desktop (such as data tables versus card lists), the programmatic Quasar `Screen` plugin is used.

*   **Conditional Rendering:** Using `v-if="$q.screen.lt.sm"` allows components to render only when the screen size matches the target viewport, rather than rendering both and hiding one using CSS `display: none` (e.g. `class="gt-xs"`). This optimizes DOM node usage and memory footprints on mobile devices.
*   **Dynamic Attributes:** Button labels, icon selections, or spacing parameters can adapt using screen variables (e.g., binding `:round="$q.screen.lt.sm"` or dynamically choosing button text).
*   **Resize Performance:** Referencing boolean flags (like `$q.screen.lt.sm` or `$q.screen.gt.xs`) is preferred over binding heavy calculations to `$q.screen.width` to avoid continuous event firing during browser resize events.

---

## 3. CSS Visibility Classes

Quasar offers utility classes to hide or show elements based on active breakpoints:
*   `gt-*` (greater than): Displays elements only when the viewport is larger than the specified breakpoint (e.g., `gt-xs` shows the element on screen widths of `sm` and above).
*   `lt-*` (less than): Displays elements only when the viewport is smaller than the specified breakpoint (e.g., `lt-md` shows the element on screen widths of `sm` and below).

---

## 4. Code Example: Adaptive Grid and List Toggle

Below is a component showing how to alternate between a mobile-friendly virtual scroll card view and a desktop data table using `$q.screen` properties, alongside permission checks.

```html
<template>
  <q-page class="q-pa-md" style="min-height: inherit;">
    <!-- Section Title Block -->
    <div class="row justify-between items-center q-mb-md">
      <h5 class="text-h5 q-my-none text-weight-bold">Outlet Orders</h5>
      <!-- Compact action on mobile, full label on desktop -->
      <q-btn
        v-ripple
        v-if="allowed({ orders: 'create' })"
        color="primary"
        :round="$q.screen.lt.sm"
        :icon="orderIcon"
        :label="$q.screen.gt.xs ? 'New Order' : ''"
      />
    </div>

    <!-- Conditional rendering: Cards list (mobile) vs Data Table (desktop) -->
    <template v-if="$q.screen.lt.sm">
      <q-virtual-scroll :items="orders" item-size="80" class="col scroll">
        <template v-slot="{ item }">
          <q-card class="q-mb-sm" flat bordered :key="item.id">
            <q-card-section class="q-pa-sm">
              <div class="row justify-between text-weight-medium">
                <span>#{{ item.code }}</span>
                <span>{{ _C(item.total, true) }}</span>
              </div>
              <div class="text-caption text-grey-7">Date: {{ item.date }}</div>
            </q-card-section>
          </q-card>
        </template>
      </q-virtual-scroll>
    </template>
    
    <template v-else>
      <q-table
        :rows="orders"
        :columns="columns"
        row-key="id"
        flat
        bordered
      />
    </template>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceConfig } from 'src/composables/useResourceConfig'

defineProps({
  orders: { type: Array, required: true },
  columns: { type: Array, required: true }
})

const { _C } = useCurrency()
const { allowed } = useResourceConfig()

const orderIcon = computed(() => {
  return 'add'
})
</script>
```

---

## 5. Summary Adaptive Selection Matrix

| Content/UI Scenario | Device/Screen Target | Recommended Layout Technique | Rendering Approach |
| :--- | :--- | :--- | :--- |
| **Secondary status badge** | Handset (<600px) | CSS visibility class | `class="gt-xs"` (Hide on mobile) |
| **Core transaction list** | Handset (<600px) | `QVirtualScroll` + `QCard` | `v-if="$q.screen.lt.sm"` (Mobile layout) |
| **Detailed audit logs** | Desktop (>1024px) | `QTable` | `v-if="$q.screen.gt.xs"` (Desktop layout) |
| **Supplier select option** | All screen sizes | `QSelect` or search overlay | Programmatic adaptive popup size |
