# Quasar Inputs: Text Fields & Input Configuration

This reference document describes how to implement and configure text input fields using Quasar's `QInput` component, covering touch interactions, masks, suffixes/prefixes, and dynamic data integration.

---

## 1. Overview of QInput

The `QInput` component is a wrapper around standard HTML input elements. It integrates with Vue's reactivity system (`v-model`), supports validation rules, and offers customization options for layouts, formatting masks, and action buttons.

### Styling Variants
Quasar provides several styling modes for text fields, including:
* `outlined`: Adds a complete border outline around the component.
* `dense`: Trims vertical padding to make inputs more compact, which is common in layout-dense or mobile-focused interfaces.
* `filled` / `standout` / `borderless`: Alternative styles suited to differing interface aesthetics.

---

## 2. Key Properties & Options

### Inputs & Keyboard Optimization
* `type`: Specifies the type of input control (e.g., `text`, `password`, `email`, `number`, `tel`).
* `inputmode`: Dictates which virtual keyboard to display on touch devices (e.g., `numeric` for integers, `decimal` for prices, `email` for email addresses, `tel` for telephone pads).
* `mask`: Applies an input formatting structure (e.g., `mask="####/##/##"` for dates or `mask="###-###-###"` for phone numbers), assisting users with input formats.
* `clearable`: Appends an icon that resets the model to `null` or an empty string when clicked.

### Text Adornments
* `prefix`: Prepends static or dynamic text to the left side of the input (often used for currency symbols).
* `suffix`: Appends static or dynamic text to the right side of the input (often used for unit measurements like `pcs` or `kg`).

---

## 3. Implementation Example

The example below shows a configuration of inputs showcasing outlines, masks, clearable buttons, and currency prefixes. In AQL, currency values are dynamically prefixed using the `useCurrency` composable:

```html
<template>
  <div class="row q-col-gutter-sm">
    <!-- Outlined field with clearable action -->
    <div class="col-12">
      <q-input
        v-model="fields.title"
        outlined
        dense
        clearable
        label="Item Title"
        placeholder="Enter item name"
      />
    </div>

    <!-- Currency Field using a dynamic currency helper prefix -->
    <div class="col-6">
      <q-input
        v-model.number="fields.price"
        outlined
        dense
        clearable
        type="number"
        inputmode="decimal"
        label="Unit Price"
        :prefix="defaultCurrency.Symbol"
      />
    </div>

    <!-- Field with unit suffix and touch keyboard settings -->
    <div class="col-6">
      <q-input
        v-model.number="fields.qty"
        outlined
        dense
        clearable
        type="number"
        inputmode="numeric"
        label="Stock Quantity"
        suffix="pcs"
      />
    </div>

    <!-- Masked Date Field with calendar popover -->
    <div class="col-12">
      <q-input
        v-model="fields.expiryDate"
        outlined
        dense
        clearable
        label="Expiry Date (YYYY/MM/DD)"
        mask="####/##/##"
      >
        <template v-slot:append>
          <q-icon name="event" class="cursor-pointer">
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date v-model="fields.expiryDate" mask="YYYY/MM/DD">
                <div class="row items-center justify-end">
                  <q-btn v-close-popup label="Close" color="primary" flat />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'

const { defaultCurrency } = useCurrency()

const fields = ref({
  title: '',
  price: null,
  qty: null,
  expiryDate: ''
})
</script>
```

---

## 4. Common Input Patterns

### Debounced Query Inputs
For search fields querying high-frequency APIs or performing local filter calculations, debouncing prevents executing updates on every single keystroke. Quasar's `debounce` helper utility can wrap search update methods:

```html
<template>
  <q-input
    v-model="searchText"
    outlined
    dense
    clearable
    placeholder="Search catalog SKU..."
    @update:model-value="onQueryUpdate"
  >
    <template v-slot:prepend>
      <q-icon name="search" />
    </template>
  </q-input>
</template>

<script setup>
import { ref } from 'vue'
import { debounce } from 'quasar'

const emit = defineEmits(['search'])
const searchText = ref('')

// Debounces model updates by 300ms before emitting the search event
const onQueryUpdate = debounce((val) => {
  emit('search', val)
}, 300)
</script>
```
