# 62_QUASAR_CHIPS.md - Status Badges & Interactive Tags

This document defines how to implement and configure tags using Quasar's chip component (`QChip`) to represent transaction statuses, resource category tags, and inline selection filters.

---

## 1. Purpose

The purpose of this guide is to explain chip tag configurations, standardize status color keys, and detail removable/interactive toggle patterns.

---

## 2. Core Philosophy

AQL chips are **Compact, Semantic, and Multi-Functional**:
*   **Compact Dimensions:** Chips must remain dense to prevent page-level content lines from stretching or breaking on mobile viewports.
*   **Semantic Consistency:** Visual colors must align strictly with status codes (e.g. Green for Approved, Yellow for Pending, Red for Overdue).
*   **Interactive Filters:** Chips can act as inline filters, allowing users to toggle query states on lists instantly.

---

## 3. Golden Rules

1.  **Always Set Dense Properties:** All `QChip` elements must declare the `dense` attribute to maintain compact visual scales.
2.  **No Monolithic Color Lists:** Standard status colors must map to standard utility color classes (e.g. `color="positive"`). Avoid inventing arbitrary styling color blocks.
3.  **Incorporate Clear Ripple Visuals:** If chips act as toggles, enable tactile clicks using `v-ripple` and active state color overrides.
4.  **Enforce Safe Removal Handlers:** Removable chips must bind events strictly via `@remove` triggers.

---

## 4. QChip Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletChipFilters.vue -->
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

---

## 5. Best Practices

*   **Chip Text Truncations:** Limit labels to 2 words. If option labels are long, use text truncation classes inside parent containers.
*   **Icon Accessories:** Add leading icons (`icon="check"`, `icon="warning"`) to provide immediate visual indicators.

---

## 6. Mobile First Rules

*   **Avoid Vertical Stacking loops:** Never stack 10 chips vertically on mobile screen lines. Wrap chip lists inside a horizontal scroll container (`row no-wrap scroll`).
*   **Ensure comfortable Touch Bounds:** Interactive chips must retain clear spacing dividers to prevent mis-taps (`q-gutter-xs`).

---

## 7. Common Patterns

### Status Chip Color Resolver Pattern

Consolidate status color logic into utility functions to keep component code clean:

```javascript
// FRONTENT/src/utils/statusResolver.js
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

## 8. Reusable Component Suggestions

*   `AqlStatusChip`: Pre-packaged chip component that automatically resolves background colors and icon configurations.

---

## 9. Accessibility Notes

*   Verify screen readers announce selected chip filter statuses.
*   Removable close buttons must have descriptive aria labels.

---

## 10. Dark Mode Notes

*   Verify that unselected chips (`bg-grey-3` class) invert colors in dark modes (`bg-grey-8` / `text-white`).

---

## 11. Performance Notes

*   Do not bind heavy computed search filters to chip triggers.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using large, standard-sized chips inside dense card lists.
    *   *Correction:* Always define the `dense` attribute on chips.
*   **Anti-Pattern:** Hardcoding background colors like `style="background: #e0e0e0"` for category tags.
    *   *Correction:* Apply Quasar class colors or grey variables (`bg-grey-3`).

---

## 13. AI Agent Rules

1.  **Validate Dense Properties:** Confirm that all generated `QChip` templates declare the `dense` attribute.
2.  **Confirm Removable Handlers:** Ensure removable chips hook callbacks explicitly to `@remove` triggers.

---

## 14. Decision Matrix

| Tag Requirement | Dynamic Actions | Recommended Styling | Interaction Trigger |
| :--- | :--- | :--- | :--- |
| **Workflow Status Badge**| None (Static tag) | Dense color chip | None |
| **Category Selection** | Toggle search value | Dense selectable chip | `@click="toggleState"` |
| **Selected parameter** | Dismiss selection | Dense removable chip | `@remove="clearState"` |

---

## 15. Final Rule

All visual status chips must use the dense property, map color selections semantically to transaction states, display horizontal scrolling rows for mobile views, and handle clears via explicit remove events.
