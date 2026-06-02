# 23_QUASAR_SELECTS.md - Dropdown Selects & Autocomplete Options

This document defines how to implement and configure select dropdown inputs using Quasar's selection component (`QSelect`) to support easy option navigation on touch screens.

---

## 1. Purpose

The purpose of this guide is to optimize dropdown lists, prevent UI overlaps from floating menus on small viewports, handle large selection datasets without memory lag, and configure search filtering options.

---

## 2. Core Philosophy

AQL selection inputs are **Filterable, Paginated, and Adaptable**:
*   **Search by Default:** If a select container is expected to hold more than 10 options, it must support search autocomplete.
*   **Touch Friendly Menus:** On mobile screens, select dropdown lists should open in modal dialog sheets (`behavior="dialog"`) rather than floating menus.
*   **Standardized Payload:** Option arrays must maintain uniform structures, typically objects containing `label` and `value` properties.

---

## 3. Golden Rules

1.  **Strict Styling Uniformity:** All `QSelect` elements must use the `outlined` and `dense` attributes by default.
2.  **Enforce Mobile Dialog List:** Always set the layout attribute `:behavior="$q.screen.lt.sm ? 'dialog' : 'menu'"` to ensure comfortable touch selection areas.
3.  **Mandatory Search Autocomplete:** When options exceed 10 records, configure `use-input`, `input-debounce="300"`, and map an `@filter` handler to narrow down lists.
4.  **Emit Option Values Directly:** Use `emit-value` and `map-options` attributes to store only the target ID/value property inside the models, rather than complex objects.

---

## 4. QSelect Layout & Filtering Setup

```html
<!-- FRONTENT/src/components/Operations/OutletSupplierSelect.vue -->
<template>
  <q-select
    v-model="selectedSupplierId"
    outlined
    dense
    use-input
    fill-input
    hide-selected
    emit-value
    map-options
    option-label="label"
    option-value="value"
    label="Supplier *"
    placeholder="Search suppliers..."
    :options="filteredOptions"
    :behavior="$q.screen.lt.sm ? 'dialog' : 'menu'"
    @filter="onFilterSuppliers"
  >
    <!-- Template for when option list is empty -->
    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">
          No suppliers found
        </q-item-section>
      </q-item>
    </template>

    <!-- Clear button accessory -->
    <template v-slot:append v-if="selectedSupplierId">
      <q-icon name="close" @click.stop.prevent="selectedSupplierId = null" class="cursor-pointer" />
    </template>
  </q-select>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  suppliers: { type: Array, required: true } // Array of { label: '...', value: 123 }
})

const selectedSupplierId = ref(null)
const filteredOptions = ref([])

// Filtering method with input debounce validation
const onFilterSuppliers = (val, update) => {
  if (val === '') {
    update(() => {
      filteredOptions.value = props.suppliers
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    filteredOptions.value = props.suppliers.filter(
      v => v.label.toLowerCase().indexOf(needle) > -1
    )
  })
}
</script>
```

---

## 5. Best Practices

*   **Option Item Slices:** If option lists contain thousands of items, paginate options locally inside the filtering method to prevent long lists from bogging down the DOM.
*   **Clear Option Triggers:** Always append a close icon suffix to let users reset values instantly without opening the select menu container.

---

## 6. Mobile First Rules

*   **Keyboard Management:** Autocomplete selects on mobile viewports must open virtual keyboards with focus flags configured correctly to prevent keyboard overlays from jumping.
*   **Max Selection Comfort:** Dialog mode selectors (`behavior="dialog"`) on mobile automatically render native backdrop overlays, which fits mobile ergonomic sweeps.

---

## 7. Common Patterns

### Async Remote Option Loader

```javascript
// Composable Level: FRONTENT/src/composables/operations/useSupplierLoader.js
import { ref } from 'vue'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useSupplierLoader() {
  const ioStore = useResourceIoStore()
  const suppliers = ref([])
  const isLoading = ref(false)

  const loadSuppliers = async () => {
    isLoading.value = true
    try {
      const response = await ioStore.fetchRecord('suppliers')
      if (response.success) {
        suppliers.value = response.data.map(item => ({
          label: item.companyName,
          value: item.id
        }))
      }
    } finally {
      isLoading.value = false
    }
  }

  return {
    suppliers,
    isLoading,
    loadSuppliers
  }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlSupplierSelect`: Pre-packaged supplier lookup select field linked to resources fetch helpers, integrating search queries.

---

## 9. Accessibility Notes

*   Ensure screen readers announce selected option text. Use `emit-value` with `map-options` to let Quasar lookup labels.

---

## 10. Dark Mode Notes

*   Verify that dialog selection headers default to theme colors (`bg-dark` or `bg-surface`) inside selection menus.

---

## 11. Performance Notes

*   Use `virtual-scroll-slices` on selects with large option lists.
*   Do not query APIs inside `@filter` handlers without debounces.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Standard floating select list menus overflow mobile screen boundaries because they lack `:behavior` declarations.
    *   *Correction:* Always define behavior adaptive thresholds (`dialog` on mobile).
*   **Anti-Pattern:** Manually mapping option values via computed maps instead of utilizing `map-options` and `emit-value`.
    *   *Correction:* Add standard mapping parameters.

---

## 13. AI Agent Rules

1.  **Verify Select Dialog Fallback:** Confirm that all generated `QSelect` components integrate the `:behavior` screen responsive check attribute.
2.  **Ensure Map Options:** Reject any option dropdown component that does not define `emit-value` and `map-options` when handling ID values.

---

## 14. Decision Matrix

| Item Option Count | Search Required? | Target Behavior | Selection Method |
| :--- | :--- | :--- | :--- |
| **< 5 items** | No | Inline menu | Simple select list |
| **5 to 15 items** | Optional | Adaptive (`dialog` / `menu`) | Autocomplete select |
| **> 15 items** | Mandatory | Mobile `dialog` modal | Filtered debounced search |

---

## 15. Final Rule

All dropdown select components must be dense and outlined, use maps to output values directly, enable filtering inputs when options exceed 10 records, and switch to dialog layouts on mobile.
