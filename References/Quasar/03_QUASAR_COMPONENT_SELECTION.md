# Quasar Component Selection Guide

This guide describes component selection patterns and layouts for designing user interfaces using Quasar, particularly in responsive and mobile-friendly environments.

## 1. Component Selection Framework

When building responsive applications, choosing the right component depends on screen real estate, interaction comfort, and rendering performance.

### Data Lists and Grids
*   **QCard Stack:** On smaller screens (e.g., mobile viewports under 600px), data is often presented as a vertical stack of `QCard` items. Each card represents a record, showing key fields and actions clearly.
*   **QTable:** For desktop viewports (e.g., above 1024px) or wider screens, `QTable` provides column-based sorting, filtering, and tabular visualization.
*   **QVirtualScroll:** For datasets containing large numbers of items (e.g., more than 15–20 rows), wrapping lists or cards inside `QVirtualScroll` helps manage browser DOM node counts and improves scrolling performance.

---

## 2. Decision Trees and Matrices

The following structures show common patterns for choosing components based on viewport sizes, option counts, and input complexity.

### Data Layout Selection
*   **Mobile Viewport (< 600px):**
    *   *Low Volume (< 15 items):* `QList` with `QItem` structures.
    *   *High Volume (> 15 items):* `QVirtualScroll` wrapping flat `QCard` components.
*   **Desktop Viewport (> 1024px):** `QTable` with grid filters and action columns.

### Option Selections & Input Types
*   **Low Choice Count (2 options):** `QToggle` or `QCheckbox`.
*   **Medium Choice Count (3 to 5 options):** `QRadio` or `QOptionGroup`.
*   **High Choice Count (> 5 options):** `QSelect` with filtering and virtual-scroll options.

### Action Panels & Menus
*   **Fewer than 5 options:** Inline action buttons (e.g., `QCardActions`).
*   **5 to 10 options:** Slide-up bottom sheets (e.g., `QBottomSheet` or `QDialog` with bottom alignment).
*   **More than 10 options:** Routing to a dedicated menu or full-page layout.

---

## 3. Responsive Dialogs and Forms

*   **Dialog Sizing:** Setting the `maximized` prop dynamically on `QDialog` based on viewport width (e.g., `v-bind:maximized="$q.screen.lt.sm"`) adapts modal interfaces for touch screens.
*   **Form Routing:** For complex forms with numerous inputs, routing the user to a dedicated edit page (using `useResourceNav`) rather than opening a large dialog modal provides more workspace.
*   **Select Filtering:** Large selection lists in `QSelect` benefit from enabling the `use-input` prop along with a filter function, allowing users to type and narrow down options dynamically.

---

## 4. Code Example: Responsive List/Card Toggle

The following component dynamically displays a data table on desktop screens and a virtual scroll of cards on mobile screens, utilizing permission checks and currency helpers.

```html
<template>
  <div class="outlet-item-feed">
    <!-- Desktop View -->
    <q-table
      v-if="$q.screen.gt.sm"
      :rows="items"
      :columns="columns"
      row-key="id"
      flat
      bordered
    />

    <!-- Mobile View -->
    <q-virtual-scroll
      v-else
      :items="items"
      item-size="110"
      v-slot="{ item }"
    >
      <q-card class="q-mb-sm" flat bordered :key="item.id">
        <q-card-section class="q-pa-sm">
          <div class="row justify-between items-center">
            <span class="text-subtitle2 text-weight-bold">{{ item.name }}</span>
            <span class="text-primary">{{ _C(item.price, true) }}</span>
          </div>
          <div class="text-caption text-grey-6">{{ item.description }}</div>
        </q-card-section>
        
        <q-card-actions align="right" class="q-py-xs">
          <q-btn 
            v-if="allowed({ inventory: 'create' })"
            v-ripple 
            label="Add" 
            color="primary" 
            dense 
            flat 
            @click="emit('add', item)" 
          />
        </q-card-actions>
      </q-card>
    </q-virtual-scroll>
  </div>
</template>

<script setup>
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceConfig } from 'src/composables/useResourceConfig'

defineProps({
  items: { type: Array, required: true },
  columns: { type: Array, required: true }
})
const emit = defineEmits(['add'])

const { _C } = useCurrency()
const { allowed } = useResourceConfig()
</script>
```

---

## 5. Summary Selection Matrix

| Context | Dataset Size / Complexity | Recommended Component | Layout Setup |
| :--- | :--- | :--- | :--- |
| **Simple Selection** | Under 5 options | `QOptionGroup` / `QRadio` | Inline layout |
| **Searchable Selection** | Over 10 options | `QSelect` with `use-input` | Outlined, filtered popup |
| **Minor Action Form** | 2–3 fields | `QDialog` modal | Centered, lazy loaded |
| **Complex Action Form** | 5+ inputs | Full page route page | Scrollable grid layout |
| **Data Feed** | 50+ records | `QVirtualScroll` | Dynamic rendering container |
