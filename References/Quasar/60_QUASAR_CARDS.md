# 60_QUASAR_CARDS.md - Record Cards & Dashboard Layouts

This document defines how to implement and configure cards using Quasar's card component (`QCard`) to replace standard tables and display high-density transaction data on mobile screens.

---

## 1. Purpose

The purpose of this guide is to explain card layout design, define visual sections partition thresholds, and establish rules for card action button placements.

---

## 2. Core Philosophy

AQL cards are **Flat, Segmented, and Action-Isolated**:
*   **Flat Aesthetics:** We avoid elevated, heavy shadows. Cards must define `flat` and `bordered` properties to maintain clean interfaces.
*   **Structured Sections:** Card details are divided into logical blocks using separator lines (`QSeparator`) and card sections (`QCardSection`).
*   **Clean Action Rows:** Call-to-action buttons (like Approve or Edit) are isolated inside card actions (`QCardActions`) pinned to the card footer.

---

## 3. Golden Rules

1.  **Always Set Flat and Bordered:** Cards must use attributes `:flat="true"` and `:bordered="true"`. Elevated cards with shadows are prohibited.
2.  **No Naked Click Triggers:** If clicking the entire card body routes pages, add the `v-ripple` directive and ensure hover/active class overrides are clear.
3.  **Separate Sections with Separators:** Insert a `<q-separator />` between titles blocks, details lists, and card actions.
4.  **Keep Action Layout Dense:** Buttons inside card footers must declare `dense` and `flat` properties.

---

## 4. QCard Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletRecordCard.vue -->
<template>
  <q-card class="record-card q-mb-sm" flat bordered>
    <!-- Card header block -->
    <q-card-section class="row items-center justify-between q-py-sm bg-grey-1">
      <div class="column">
        <span class="text-caption text-grey-7 uppercase text-weight-medium">PO Number</span>
        <span class="text-subtitle2 text-weight-bold text-primary">#{{ requisition.code }}</span>
      </div>
      <q-chip dense :color="statusColor" text-color="white">
        {{ requisition.status }}
      </q-chip>
    </q-card-section>

    <q-separator />

    <!-- Card details content block -->
    <q-card-section class="q-pa-md column q-gutter-y-xs">
      <div class="row justify-between text-body2">
        <span class="text-grey-7">Supplier:</span>
        <span class="text-weight-medium text-truncate" style="max-width: 180px;">
          {{ requisition.supplierName }}
        </span>
      </div>
      <div class="row justify-between text-body2">
        <span class="text-grey-7">Total Amount:</span>
        <span class="text-weight-bold">{{ _C(requisquisitionTotal, true) }}</span>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Card actions block (Gated with permissions) -->
    <q-card-actions align="right" class="q-py-xs q-px-md" v-if="allowed({ purchaseRequisitions: 'update' })">
      <q-btn
        v-ripple
        flat
        dense
        color="grey-7"
        icon="visibility"
        label="View"
        @click="emit('view', requisition.id)"
      />
      <q-btn
        v-ripple
        flat
        dense
        color="primary"
        icon="check_circle"
        label="Approve"
        @click="emit('approve', requisition.id)"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const props = defineProps({
  requisition: { type: Object, required: true }
})

const emit = defineEmits(['view', 'approve'])

const { _C } = useCurrency()
const { allowed } = useResourceConfig()

const requisitionTotal = computed(() => {
  return props.requisition.amount || 0
})

const statusColor = computed(() => {
  switch (props.requisition.status) {
    case 'Draft': return 'grey-7'
    case 'Approved': return 'positive'
    default: return 'warning'
  }
})
</script>
```

---

## 5. Best Practices

*   **Row-as-Card Mobile Pattern:** Replace long data grid lists on mobile viewports with vertically stacked cards. This allows the layout to remain fluid on all screens.
*   **Typography Hierarchy:** Restrict titles to `text-subtitle2` and descriptions to `text-body2` classes.

---

## 6. Mobile First Rules

*   **Avoid Action Buttons Clutters:** Limit card buttons to a maximum of two inline. If there are more options, replace them with a dropdown trigger button.
*   **Responsive Widths:** Cards must occupy the full layout width (`class="full-width q-mb-md"`) on mobile viewports.

---

## 7. Common Patterns

### Swipe-to-Action Card Pattern

Support mobile swipe gestures (such as swiping left to delete) by using Quasar touch directives:

```html
<!-- FRONTENT/src/components/Operations/OutletSwipeCard.vue -->
<template>
  <div class="relative-position overflow-hidden rounded-borders">
    <!-- Background swipe action button -->
    <div class="absolute-right bg-negative text-white flex flex-center q-px-md" style="height: 100%; width: 80px;">
      <q-btn flat round icon="delete" color="white" @click="emit('delete')" />
    </div>

    <!-- Swipeable Card Body -->
    <q-card
      v-touch-swipe.horizontal="onSwipe"
      class="transition-swipe"
      :style="swipeStyle"
      flat
      bordered
    >
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 text-weight-bold">Swipe to Delete Item</div>
        <div class="text-caption text-grey-6">Swipe left to reveal the delete action.</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['delete'])
const swipeOffset = ref(0)

const onSwipe = ({ direction, offset }) => {
  if (direction === 'left') {
    swipeOffset.value = -80
  } else if (direction === 'right') {
    swipeOffset.value = 0
  }
}

const swipeStyle = computed(() => {
  return `transform: translateX(${swipeOffset.value}px);`
})
</script>

<style scoped>
.transition-swipe {
  transition: transform 0.2s ease;
  z-index: 2;
  position: relative;
}
</style>
```

---

## 8. Reusable Component Suggestions

*   `AqlCard`: Standard card container pre-loaded with title grids, status badges, and permission-gated action buttons.

---

## 9. Accessibility Notes

*   Verify card headers use clear title configurations (`aria-labelledby`) so screen readers announce sections correctly.

---

## 10. Dark Mode Notes

*   Avoid setting hardcoded light background colors (e.g. `bg-white` class overrides) on cards. Rely on default `bg-surface` styles.

---

## 11. Performance Notes

*   Keep card item structures light. Avoid compiling nested conditional layout blocks inside high-density lists.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using elevated cards (`class="q-card shadow-15"`) with heavy shadows.
    *   *Correction:* Always define `flat` and `bordered` cards.
*   **Anti-Pattern:** Putting heavy text layouts next to button arrays inside card footers, causing horizontal line wrapping.
    *   *Correction:* Place button groups in their own row inside `QCardActions`.

---

## 13. AI Agent Rules

1.  **Validate Flat Styles:** Confirm all generated `QCard` components define `flat` and `bordered` props.
2.  **Confirm Separator Spacings:** Ensure separators are declared between card sections and card footer actions.

---

## 14. Decision Matrix

| Data Volume | Layout Density | Recommended Container | Footer Actions |
| :--- | :--- | :--- | :--- |
| **Single record details**| High density | Dedicated Page layout | Sticky bottom toolbar |
| **Grid item row** | Medium density | `QCard` flat & bordered | Dense inline card actions |
| **Ledger transaction** | Very high density | `QList` + compact items | Tap dialog details |

---

## 15. Final Rule

All cards must use flat and bordered styling, partition data via card sections separated by lines, group footer buttons in card actions, and support swipe actions on mobile viewports.
