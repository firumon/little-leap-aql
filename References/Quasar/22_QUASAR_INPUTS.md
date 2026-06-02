# 22_QUASAR_INPUTS.md - Text Fields & Inputs

This document defines how to implement and configure text input fields using Quasar's input component (`QInput`) to align with mobile ergonomics and transactional efficiency.

---

## 1. Purpose

The purpose of this guide is to ensure all input fields are configured with correct touch heights, show immediate clear options, map to appropriate keyboard types, and display units or icons correctly using suffixes/prefixes.

---

## 2. Core Philosophy

AQL inputs are **Efficient, Assisted, and Explicit**:
*   **Assisted Entry:** Users must not type formatting characters (like dates or phone formats). We enforce this by using Quasar field masks (`mask` prop).
*   **Explicit Context:** Every input must clearly declare its requirements. Numbers show suffixes (e.g. `pcs`, `kg`) and values show currency symbols as prefixes.
*   **Outlined and Dense:** Form controls must use standard outlined card aesthetics and remain compact to preserve mobile screen spaces.

---

## 3. Golden Rules

1.  **Strict Styling Uniformity:** All `QInput` elements must use the `outlined` and `dense` attributes by default. Do not mix borderless, filled, or stand-alone designs.
2.  **Add Clear Actions:** Any field that is editable by the user must specify the `clearable` property to support instant correction.
3.  **Prefix Dynamic Symbols:** Always prefix price fields with the dynamic currency helper variable: `:prefix="defaultCurrency.Symbol"`. Never hardcode symbols like `₹`.
4.  **No Naked Input Types:** Number fields must use the correct mapping configurations: `type="number" inputmode="numeric"`.

---

## 4. QInput Properties & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletInventoryFields.vue -->
<template>
  <div class="row q-col-gutter-sm">
    <!-- Basic Outlined Clearable Field -->
    <div class="col-12">
      <q-input
        v-model="fields.title"
        outlined
        dense
        clearable
        label="Item Title *"
        placeholder="Enter SKU name"
      />
    </div>

    <!-- Currency Prefix Field with Dynamic Symbol -->
    <div class="col-6">
      <q-input
        v-model.number="fields.price"
        outlined
        dense
        clearable
        type="number"
        inputmode="decimal"
        label="Unit Price *"
        :prefix="defaultCurrency.Symbol"
      />
    </div>

    <!-- Number Suffix Field with Touch Keyboard -->
    <div class="col-6">
      <q-input
        v-model.number="fields.qty"
        outlined
        dense
        clearable
        type="number"
        inputmode="numeric"
        label="Stock Quantity *"
        suffix="pcs"
      />
    </div>

    <!-- Masked Field (e.g., Dates) -->
    <div class="col-12">
      <q-input
        v-model="fields.expiryDate"
        outlined
        dense
        clearable
        label="Expiry Date (YYYY/MM/DD) *"
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

## 5. Best Practices

*   **Autofill Settings:** Configure correct autocomplete scopes for address, email, or telephone fields (`autocomplete="email"`).
*   **Clear Suffix Margins:** Ensure suffixes contain clear spacing so input values do not run into the suffix text.

---

## 6. Mobile First Rules

*   **Prevent Keyboard Zoom:** iOS devices automatically zoom in on views if input font sizes are under `16px`. Ensure input texts default to Quasar's `text-body1` sizes.
*   **Capitalization Management:** Turn off auto-capitalization on SKU, email, or passcode fields using `autocapitalize="off"` and `autocorrect="off"`.

---

## 7. Common Patterns

### Debounced Search Input Pattern

```html
<!-- FRONTENT/src/components/Operations/OutletSearchInput.vue -->
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

// Debounce keyboard inputs by 300ms before emitting
const onQueryUpdate = debounce((val) => {
  emit('search', val)
}, 300)
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlCurrencyInput`: Customized `QInput` pre-mapped to dynamic currency stores and validating decimals automatically.
*   `AqlMaskedDateInput`: Simple date text field component that packages the calendar popup toggle natively.

---

## 9. Accessibility Notes

*   Always supply clear placeholder attributes or labels. If labels are hidden, bind input tags via `aria-label`.
*   Ensure clear buttons are keyboard-tabbable.

---

## 10. Dark Mode Notes

*   Verify that custom field backgrounds (if explicitly styled in `.scss`) use CSS variable references like `var(--q-dark)` to support seamless inversion.

---

## 11. Performance Notes

*   Do not attach dynamic style handlers that trigger browser layout passes on inputs during keyboard typings.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Implementing text formatting (like adding slashes to date keys) inside a custom keyboard listener.
    *   *Correction:* Apply Quasar's `mask` property to format inputs.
*   **Anti-Pattern:** Hardcoding money icons/labels (like `₹` or `Rs.`) inside input label or prefix strings.
    *   *Correction:* Bind prefix values to dynamic currency symbols.

---

## 13. AI Agent Rules

1.  **Validate Outlined Standard:** Ensure all generated inputs declare `outlined` and `dense` props.
2.  **Verify Keyboard Mode Bindings:** Reject phone, number, or money fields that fail to define correct type/inputmode keys.

---

## 14. Decision Matrix

| Input Context | Type Parameter | Inputmode | Suffix/Prefix Bindings |
| :--- | :--- | :--- | :--- |
| **SKU Code** | `type="text"` | `text` | None |
| **Price Amount** | `type="number"` | `decimal` | Prefix: `defaultCurrency.Symbol` |
| **Stock Count** | `type="number"` | `numeric` | Suffix: unit code (e.g. `pcs`) |
| **Email Address** | `type="email"` | `email` | None |
| **Date String** | `type="text"` | `numeric` | Mask: `####/##/##` |

---

## 15. Final Rule

All inputs must utilize outlined, dense text designs, apply clear helper masks, map keyboard attributes explicitly, prefix dynamic currencies dynamically, and expose clear actions.
