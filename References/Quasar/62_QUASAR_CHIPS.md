# Quasar Chips (QChip) Reference Guide

This reference guide describes the implementation and configuration of badges and tags using Quasar's chip component (`QChip`) to represent transaction statuses, resource category tags, and inline selection filters.

---

## 1. Component Overview

The `QChip` component represents small, discrete pieces of information, status indicators, or interactive tags. It is highly configurable and commonly used in the following roles:

*   **Static Badge**: Displays non-interactive state labels (e.g., status flags).
*   **Interactive / Selectable Tag**: Acts as a button or filter option that can be toggled by the user.
*   **Removable Tag**: Includes a dismissal button to clear selection criteria or tags from a list.

---

## 2. Key Attributes & Visual Properties

*   **`dense`**: Compacts the internal padding and font size of the chip.
*   **`clickable`**: Enhances user interaction by enabling click events and hover styles.
*   **`selected`**: A boolean state representing whether the chip is currently active or selected.
*   **`removable`**: Appends a close icon inside the chip, emitting a `@remove` event when clicked.
*   **`icon`**: Renders a leading icon inside the chip.
*   **`outline`**: Renders a chip with a transparent background and a colored border.

---

## 3. Code Examples

### Status Badges & Interactive Filters

Below is a component showing static badges, selectable filtering tags, and removable filter chips:

```html
<template>
  <div class="row q-gutter-xs items-center scroll no-wrap q-py-xs">
    <!-- Static status badge -->
    <q-chip
      dense
      color="primary"
      text-color="white"
      icon="label"
    >
      Status: Active
    </q-chip>

    <!-- Interactive toggle filter chip -->
    <q-chip
      v-for="filter in filters"
      :key="filter.value"
      clickable
      v-ripple
      dense
      :selected="activeFilter === filter.value"
      :color="activeFilter === filter.value ? 'secondary' : 'grey-3'"
      :text-color="activeFilter === filter.value ? 'white' : 'dark'"
      @click="toggleFilter(filter.value)"
    >
      {{ filter.label }}
    </q-chip>

    <!-- Removable selected tag chip -->
    <q-chip
      v-if="selectedSku"
      dense
      removable
      color="orange-1"
      text-color="orange-10"
      icon="inventory_2"
      @remove="clearSku"
    >
      {{ selectedSku }}
    </q-chip>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeFilter = ref('all')
const selectedSku = ref('BOX-102')

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' }
]

const toggleFilter = (val) => {
  activeFilter.value = val
}

const clearSku = () => {
  selectedSku.value = ''
}
</script>
```

### Status Chip Color Resolver Pattern

To keep templates clean, map statuses to colors and icons using helper modules:

```javascript
// utils/statusResolver.js
export function getStatusConfig(status) {
  switch (status) {
    case 'Draft':
      return { color: 'grey-5', icon: 'edit' }
    case 'Pending':
      return { color: 'warning', icon: 'pending' }
    case 'Approved':
      return { color: 'positive', icon: 'check_circle' }
    case 'Rejected':
    case 'Overdue':
      return { color: 'negative', icon: 'cancel' }
    default:
      return { color: 'info', icon: 'info' }
  }
}
```

Usage inside templates:
```html
<q-chip
  dense
  :color="getStatusConfig(requisition.status).color"
  :icon="getStatusConfig(requisition.status).icon"
  text-color="white"
>
  {{ requisition.status }}
</q-chip>
```

---

## 4. Technical Considerations

*   **Responsive Scrolling**: For mobile screen layouts with numerous category tags, placing chips in a horizontal scroll container (`row no-wrap scroll`) allows swipe navigation without stretching vertical space.
*   **Touch Targets**: When configuring clickable or removable chips, ensure there is adequate spacing between adjacent chips (`q-gutter-xs`) to prevent unintentional taps.
*   **Accessibility**: Provide descriptive text or aria-labels for the close button on removable chips so screen readers can properly announce the dismiss action.
*   **State Alignment**: Link removal logic strictly to the `@remove` event rather than general click events to avoid triggering both selection and removal behaviors simultaneously.
