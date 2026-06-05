# Quasar Mobile-First Design & Ergonomics Reference Guide

This reference guide describes the design and configuration strategies for optimizing layouts, touch zones, input modes, and form usability on mobile viewports.

---

## 1. Ergonomic Layout Principles

Designing for mobile screens involves accommodating physical interactions (such as thumb reaches) and device-specific behaviors:

*   **Thumb Zone Reach**: Placing high-frequency action buttons and primary inputs in the lower half of the screen makes them easier to tap when using a device one-handed.
*   **Viewport Constraints**: Fixing primary containers (like headers or footers) while scrolling content blocks prevents important tools and titles from sliding out of view.
*   **Preventing Horizontal Overflows**: Sizing cards, tables, and buttons to scale fluidly with the viewport width helps prevent horizontal scrolling, which can disrupt the user experience.

---

## 2. Input & Keyboard Adaptability

Mapping form fields to their correct input mode activates the most efficient browser-native keyboard on mobile devices, minimizing typing mistakes:

*   **Numeric Fields**: Utilizing `type="number" inputmode="numeric" pattern="[0-9]*"` displays a standard phone-style numeric pad.
*   **Decimal/Financial Fields**: Using `inputmode="decimal"` triggers a numeric keyboard containing a decimal point.
*   **Contact Fields**: Using `type="tel" inputmode="tel"` displays the telephone entry keyboard.
*   **Text Size Zooming**: Setting the base font-size of inputs to at least `16px` on mobile viewports prevents mobile browsers (especially iOS Safari) from automatically zooming in and shifting the layout when an input receives focus.

---

## 3. Code Examples

### Mobile-Optimized Stock Confirmation Page

The following layout demonstrates a sticky page configuration with a scrollable form, keyboard optimizations, and a bottom actions container:

```html
<template>
  <q-page class="column no-wrap bg-grey-1" style="min-height: inherit;">
    <!-- Sticky page header -->
    <div class="bg-white q-pa-md shadow-1">
      <h1 class="text-h5 text-weight-bold q-my-none">Confirm Stock</h1>
      <span class="text-caption text-grey-6">Warehouse Section A</span>
    </div>

    <!-- Scrolling content area -->
    <div class="col scroll q-pa-md column q-gutter-y-md">
      <q-card flat bordered class="q-pa-md">
        <!-- Number input configured with numeric touch keyboard -->
        <q-input
          v-model.number="fields.qty"
          outlined
          dense
          type="number"
          inputmode="numeric"
          label="Confirmed Qty"
          suffix="units"
          class="full-width"
        />
      </q-card>
    </div>

    <!-- Sticky bottom button panel within thumb zone -->
    <div class="bg-white q-pa-md border-top-1px row justify-end" v-if="allowed({ inventory: 'update' })">
      <q-btn
        v-ripple
        label="Approve Count"
        color="primary"
        class="full-width"
        size="md"
        @click="submitCount"
      />
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const emit = defineEmits(['approve'])
const { allowed } = useResourceConfig()

const fields = ref({
  qty: null
})

const submitCount = () => {
  emit('approve', fields.value.qty)
}
</script>

<style scoped>
.border-top-1px {
  border-top: 1px solid #e0e0e0;
}
</style>
```

### Mobile Input Configurations

Different field types can be customized to display tailored keyboards:

```html
<!-- Text Input -->
<q-input v-model="name" type="text" autocomplete="name" />

<!-- Quantity Input -->
<q-input v-model.number="qty" type="number" inputmode="numeric" pattern="[0-9]*" />

<!-- Price Input -->
<q-input v-model.number="price" type="number" inputmode="decimal" />

<!-- Phone Number Input -->
<q-input v-model="phone" type="tel" inputmode="tel" />
```

---

## 4. Technical Considerations

*   **Action Sheets vs. Menus**: For select fields or context menus containing more than three options, replacing standard dropdown menus with bottom action sheets (`QBottomSheet` or dialog panels) on smaller screens provides a larger, touch-friendly interface.
*   **Touch Clearances**: Maintaining spacing boundaries (e.g., minimum dimensions of 44px) on clickable targets ensures elements remain easily selectable without user frustration.
*   **Viewport Spacing**: Adding padding offsets (like `q-pb-xl` or dynamic margins) below scrollable lists prevents mobile keyboards from completely obscuring the last input fields or buttons in the form.
