# Quasar Selects: Dropdowns & Autocomplete Options

This reference document describes how to implement and configure select dropdown inputs using Quasar's `QSelect` component, covering search filtering, viewport behaviors, and model mapping attributes.

---

## 1. Overview of QSelect

The `QSelect` component is a form control designed for selecting single or multiple options from a dataset. It supports standard dropdown layouts, search filtering, remote async option loading, and adaptive list containers.

### Key Capabilities
* **Model Property Mapping:** Using target props, `QSelect` can map arrays of complex objects into simple IDs or values stored inside the target variables.
* **Search Autocomplete:** Activating text inputs allows users to search and filter option lists.
* **Viewport Adaptability:** The selection popup can automatically display as a floating dropdown menu or a centered modal dialog window.

---

## 2. Key Properties & Options

### Mapping Options
* `options`: An array of values, strings, or objects representing selectable options.
* `option-value`: Defines which property of the option object acts as the value of the option (e.g. `value` or `id`).
* `option-label`: Defines which property of the option object acts as the text label displayed to users (e.g. `label` or `name`).
* `emit-value`: Directs Quasar to update the model value with the chosen option's value property rather than the entire option object.
* `map-options`: Maps the current model value back to the options array to display the correct label when `emit-value` is active.

### Interaction & Style Settings
* `use-input`: Enables an inner text input, allowing users to type and filter the option list.
* `input-debounce`: Adds a millisecond delay to keyboard inputs before firing filter callbacks.
* `behavior`: Sets the selection list display method:
  * `menu`: Renders a floating popover list.
  * `dialog`: Renders a centered modal dialog wrapper.
  * `default`: Dynamically shifts behavior based on platform thresholds (e.g., using dialog mode on smaller screens).

---

## 3. Implementation Example

The example below demonstrates a filterable `QSelect` component configured with options mapping and a custom clear action:

```html
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
    label="Supplier"
    placeholder="Search suppliers..."
    :options="filteredOptions"
    :behavior="$q.screen.lt.sm ? 'dialog' : 'menu'"
    @filter="onFilterSuppliers"
  >
    <!-- Slot displayed when search query yields no matches -->
    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">
          No suppliers found
        </q-item-section>
      </q-item>
    </template>

    <!-- Custom append button for clearing selection -->
    <template v-slot:append v-if="selectedSupplierId">
      <q-icon 
        name="close" 
        @click.stop.prevent="selectedSupplierId = null" 
        class="cursor-pointer" 
      />
    </template>
  </q-select>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  suppliers: { type: Array, required: true } // Array structure: [{ label: 'Supplier A', value: 123 }]
})

const selectedSupplierId = ref(null)
const filteredOptions = ref([])

// Filtering method with input validation
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

## 4. Options Loading & Asynchronous Integration

For remote datasets, options can be retrieved dynamically from external APIs and mapped into standard select structures using stores or composables:

```javascript
// Example: src/composables/useSupplierLoader.js
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
