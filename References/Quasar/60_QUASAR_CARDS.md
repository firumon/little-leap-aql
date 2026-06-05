# Quasar Cards (QCard) Reference Guide

This reference guide describes the implementation and configuration of cards using Quasar's card component (`QCard`) to display record details, metrics, and structured datasets.

---

## 1. Component Overview

The `QCard` component is a versatile container used to group related information. It is designed to adapt to various screen sizes and works in tandem with several helper sub-components:

*   **`QCardSection`**: Defines content blocks (headers, body text, or detailed fields) within the card. Multiple sections can be used to separate content.
*   **`QCardActions`**: A specialized container for grouping action buttons, typically aligned to the bottom or side of the card.
*   **`QSeparator`**: A thin line component used to visually divide card sections.

---

## 2. Key Attributes & Visual Properties

`QCard` supports several props to configure its appearance:

*   **`flat`**: Removes the default card shadow, making it flush with the background.
*   **`bordered`**: Adds a thin outline border around the card edges.
*   **`square`**: Removes border-radius from the card corners.
*   **`dark`**: Adapts the component colors for dark themes.

---

## 3. Architectural Integration in AQL

When rendering cards in the AQL application, integrate the following project-wide architectural utilities:

*   **Currency Formatting**: Use the currency formatting helper `_C` from `useCurrency()` for displaying monetary amounts to ensure consistent formatting across the application.
*   **Permission Gating**: Restrict card actions or sensitive information sections using the `allowed` utility from `useResourceConfig()`.

---

## 4. Code Examples

### Basic Record Card

Below is an example of a record card component displaying transaction details with permission-gated footer actions and currency formatting.

```html
<template>
  <q-card class="record-card q-mb-sm" flat bordered>
    <!-- Header Section -->
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

    <!-- Details Section -->
    <q-card-section class="q-pa-md column q-gutter-y-xs">
      <div class="row justify-between text-body2">
        <span class="text-grey-7">Supplier:</span>
        <span class="text-weight-medium text-truncate" style="max-width: 180px;">
          {{ requisition.supplierName }}
        </span>
      </div>
      <div class="row justify-between text-body2">
        <span class="text-grey-7">Total Amount:</span>
        <span class="text-weight-bold">{{ _C(requisitionTotal, true) }}</span>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Action Section (Permission Gated) -->
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

### Swipe-to-Action Card Pattern

To facilitate mobile interaction, cards can be wrapped in swipe gesture handlers using Quasar's touch directives (`v-touch-swipe`).

```html
<template>
  <div class="relative-position overflow-hidden rounded-borders">
    <!-- Behind-the-card swipe action container -->
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

const onSwipe = ({ direction }) => {
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

## 5. Technical Considerations

*   **Typography Hierarchy**: Using classes like `text-subtitle2` for headings and `text-body2` or `text-caption` for descriptive items helps build a clear text hierarchy.
*   **Accessibility**: Utilizing appropriate semantic tags or `aria` labels on card sections allows assistive technologies to convey the card structure more effectively.
*   **Performance**: Minimizing deep layout nesting inside repeating card lists prevents rendering bottlenecks. Using lightweight child components or flat list structures can optimize layout rendering.
