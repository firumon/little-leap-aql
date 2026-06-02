# 91_QUASAR_MOBILE_FIRST.md - Mobile Ergonomics & Touch UX Checklist

This document defines the strict mobile visual design requirements and ergonomic checklists for the AQL mobile application.

---

## 1. Purpose

The purpose of this guide is to compile all touch ergonomics, spacing standards, virtual keyboard parameters, and scroll locks into a single verification checklist.

---

## 2. Core Philosophy

AQL mobile designs are **Thumb-Comfortable, Keyboard-Aware, and Visually Dense**:
*   **Thumb Zone Layouts:** Place high-frequency inputs and action buttons in comfortable reach regions (bottom half of viewport).
*   **Keyboard Layout Tuning:** Inputs must map directly to their data fields (numeric pads for numeric inputs, emails for email addresses) to prevent typing friction.
*   **Zero Horizontal Scrolls:** Visual components must match screen boundaries exactly. Horizontal scrolls are prohibited outside custom lists rows.

---

## 3. Golden Rules

1.  **Enforce Minimum Touch Sizing:** Any element responsive to touch taps (cards, lists, buttons) must cover an area of at least `44px` by `44px`.
2.  **Lock Dynamic Viewports:** Main scrolling areas must fit within the window height to prevent header bars from sliding off-screen.
3.  **Default Options to Bottom Sheets:** Group contextual actions (>3 choices) inside bottom action sheets on screens under `sm`.
4.  **Confirm Dense Form Aesthetics:** Apply the `dense` attribute to form inputs (`QInput`, `QSelect`) to optimize mobile view spaces.

---

## 4. Mobile Ergonomics Configuration Setup

```html
<!-- FRONTENT/src/components/Operations/OutletMobileChecklist.vue -->
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
    <div class="bg-white q-pa-md border-top-1px row justify-end">
      <q-btn
        v-ripple
        v-if="allowed({ inventory: 'update' })"
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
/* Top border separation helper */
.border-top-1px {
  border-top: 1px solid #e0e0e0;
}
</style>
```

---

## 5. Best Practices

*   **Avoid Text Truncations in Forms:** Ensure input labels are short (1-2 words) so they are fully readable on small screens.
*   **Adaptive Button Scaling:** On mobile screen sizes, use full-width primary buttons (`class="full-width"`) to increase tap comfort.

---

## 6. Mobile First Rules

*   **Prevent Browser Pinch Zooming:** Standard mobile fields must preserve font sizes of at least `16px` to prevent iOS zoom behaviors on focus events.
*   **Soft Keyboard Clearances:** Add spacing offsets below the last inputs inside scroll trees to allow keyboard margins.

---

## 7. Common Patterns

### Responsive Keyboard Configuration Matrix

Select inputs configurations strictly mapping appropriate touch keyboard properties:

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

## 8. Reusable Component Suggestions

*   Enforce usage of `AqlPage` to wrap layouts scroll bars and margins.

---

## 9. Accessibility Notes

*   Verify all touch targets define label descriptors.

---

## 10. Dark Mode Notes

*   Ensure deep dark themes use slate shades to map boundaries cleanly.

---

## 11. Performance Notes

*   Do not trigger dynamic styling updates on panning scroll hooks.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting heavy text layouts next to button arrays inside card footers, causing horizontal line wrapping.
    *   *Correction:* Place button groups in their own row inside `QCardActions`.
*   **Anti-Pattern:** Centering tiny dialog panels with narrow text on mobile viewports.
    *   *Correction:* Maximize dialog elements on screens under `sm`.

---

## 13. AI Agent Rules

1.  **Validate Touch Bounds:** Reject button layouts lacking spacing helpers.
2.  **Confirm Keyboard Bindings:** Ensure text fields map matching keyboard types.

---

## 14. Decision Matrix

| Mobile UX Constraint | Target Alignment | Component Setup | Recommended Spacing |
| :--- | :--- | :--- | :--- |
| **Grid Sizing** | Full width cards | `col-12` grid | `q-mb-md` margin |
| **Touch targets** | Button overlays | Dense outlined | `44px` min clearance |
| **Modal action** | Select options | Bottom sheet | Swipe dismiss backdrop |
| **Keyboard** | Number entry | Numeric type | `inputmode="numeric"` |

---

## 15. Final Rule

All user interfaces must default to full-width card structures, implement explicit input keyboard attributes, align main action buttons to bottom thumb zones, and swap menus for bottom sheets.
