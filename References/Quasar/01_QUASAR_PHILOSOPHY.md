# Quasar Component Philosophy & Architecture

This document describes the design philosophy, layout paradigms, and architecture patterns of using Quasar within the AQL ecosystem. It focuses on mobile-first design considerations, standard component selections, and structural best practices for ERP, procurement, and inventory interfaces.

## 1. Core Principles

The AQL application is designed to be mobile-responsive. Layout decisions, touch interactions, and utility styles are structured to ensure consistency across different screen sizes.

### Responsive Design Approach
*   **Mobile-First Layouts:** Grids start at the mobile scale (using `col-12` for full-width components) and progressively scale up to wider viewports using responsive column classes (such as `col-sm-6` and `col-md-4`).
*   **Touch-Friendly Interactions:** Controls are designed for touch input, employing visible ripple feedback (`v-ripple`) and touch target recommendations (e.g., target height of 44px).
*   **Quasar Utility Class System:** Styling utilizes Quasar's built-in CSS utility classes (such as spacing, typography, colors, and shadows) to promote style consistency across the codebase.

---

## 2. Architecture & Layer Separation

AQL maintains a separation between the presentation layer and business logic.

*   **Presentation Layer:** Vue templates and `<script setup>` tags handle UI layout and state representation. Genuinely useful architectural rules include:
    *   **Layer Separation:** Templates and script blocks delegate business logic, validation rules, and service/API calls to dedicated composables.
    *   **Permission Gating:** UI elements, action controls, and routes are protected using permission checks (e.g., via the `allowed` function from resource composables).
    *   **Navigation:** Routing and resource navigation are handled using centralized navigation patterns or dedicated composables (such as `useResourceNav`).

---

## 3. Component Selection Guide

Choosing the appropriate Quasar component depends on data structure, volume, and display requirements:

*   **QCard:** Often used as the structural container for record details, form sections, and dashboard blocks. It supports utility props like `flat` and `bordered` for flat layouts.
*   **QList & QItem:** Typically used for navigation links, lists, settings, and dynamic options.
*   **QVirtualScroll:** Recommended for lists with high-volume rows to preserve performance and memory on mobile browsers.
*   **QDialog:** Renders modal dialogs, configuration dialogs, or bottom sheets.

### Data Display Decision Flow
For displaying lists, metrics, or choices, components can be selected based on the number of items and complexity:
*   **Under 20 items (Simple List):** `QList` with `QItem`.
*   **Under 20 items (Complex Records):** Stacked grid of `QCard` elements.
*   **Over 20 items:** `QVirtualScroll` wrapping card or list items.

---

## 4. Layout and Styling Practices

*   **Spacing and Gutters:** Aligning controls with Quasar classes like `row`, `col-12`, `q-col-gutter-sm`, and `q-gutter-y-md`.
*   **Text Handling:** Helper classes like `ellipsis` and `ellipsis-2-lines` manage text overflow on smaller screens.
*   **Semantic Color Classes:** Utilizing built-in tokens like `text-primary`, `bg-surface`, and `text-grey-7` for standard coloring.

---

## 5. Mobile Considerations

*   **Input Types:** Configuring inputs with appropriate types (e.g., `type="number"`, `inputmode="numeric"`, `type="email"`) triggers corresponding virtual keyboards on mobile devices.
*   **Scroll Boundaries:** Configuring containers and scroll areas (e.g., using `QScrollArea`) to prevent nested scroll bar clipping.
*   **Comfortable Tap Padding:** Utilizing padding classes (such as `q-py-md` or `q-pa-md`) to ensure tap targets are easily interactable.

---

## 6. Example: Mobile Record Card Pattern

Below is an example of a list item component showing standard styling, permission checks, and layout classes.

```html
<template>
  <q-card class="my-record-card q-mb-sm" flat bordered>
    <q-card-section class="q-pa-md">
      <div class="row items-center justify-between no-wrap">
        <div class="column">
          <span class="text-caption text-grey-7 uppercase">Item Code</span>
          <span class="text-subtitle1 text-weight-bold">{{ item.code }}</span>
        </div>
        <q-chip :color="statusColor" text-color="white" dense>
          {{ item.status }}
        </q-chip>
      </div>
      <q-separator class="q-my-sm" />
      <div class="row justify-between">
        <span class="text-body2 text-grey-8">Stock Qty:</span>
        <span class="text-body2 text-weight-medium">{{ item.qty }} pcs</span>
      </div>
    </q-card-section>
    
    <q-card-actions align="right" class="q-px-md q-pb-md" v-if="allowed({ inventory: 'update' })">
      <q-btn 
        v-ripple
        label="Edit Stock" 
        color="primary" 
        flat 
        dense
        icon="edit"
        @click="emit('edit', item.id)"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const props = defineProps({
  item: { type: Object, required: true }
})
const emit = defineEmits(['edit'])

const { allowed } = useResourceConfig()

const statusColor = computed(() => {
  return props.item.status === 'Active' ? 'positive' : 'negative'
})
</script>
```

---

## 7. Component Reference Overview

| Context | Recommended Components | Typical Interaction Pattern |
| :--- | :--- | :--- |
| **Small Lists / Low Volume** | `QCard`, `QList` / `QItem` | Stacked list with layout spacing |
| **High Volume Lists** | `QVirtualScroll` wrapping cards | Scroll container with virtual rendering |
| **Selection Options** | `QDialog` or `QBottomSheet` | Slide-up or overlay menu list |
| **Desktop High Volume** | `QTable` / `QVirtualScroll` | Wide grid layout with pagination |
