# Quasar Coding Patterns & Architectural Boundaries

This document describes the coding standards, layer boundaries, and structural patterns for Vue and Quasar development in the AQL repository. It outlines the responsibilities of components, composables, stores, and services.

## 1. Architectural Layers & Separation of Concerns

AQL architecture separates presentation layout, business rules, and state management into distinct layers:

| Layer / File Type | Primary Role & Permitted Operations | Typical Boundaries / Exclusions |
| :--- | :--- | :--- |
| **Vue Components (`.vue`)** | Render layout templates, invoke logic via composables, bind props, emit events, manage local UI-only states. | Avoid importing Axios, services, or stores directly; avoid embedding complex business rules or raw data transforms. |
| **Composables (`use*.js`)** | Manage reactive business logic, read Pinia stores, validate inputs, build payloads, coordinate navigation transitions. | Avoid writing inline CSS styles or directly manipulating raw DOM elements. |
| **Pinia Stores (`.js`)** | Manage in-memory state caches, track sync states, trigger service updates. | Avoid managing local form validation states or mounting UI dialogs directly. |
| **Services (`*Service.js`)** | Coordinate HTTP requests (e.g., via Axios), interact with local storage/IndexedDB, perform data parsing. | Avoid tracking route paths or storing reactive UI states. |

---

## 2. Core Coding Conventions

*   **JavaScript ES6+ Setup:** Development uses plain JavaScript ES6+ Composition API within `<script setup>` tags.
*   **Layer Separation:** Vue components consume data and invoke actions through business logic composables rather than interacting directly with services or Pinia stores.
*   **Permission Gating:** UI elements, action controls, and route redirects are verified against permissions (e.g., using the `allowed()` helper from `useResourceConfig`).
*   **Currency Formatting:** Prices and numeric amounts are formatted dynamically through the `_C` helper instead of using hardcoded currency symbols.
*   **Resource Navigation:** Page redirection and routing transitions utilize the `useResourceNav` composable rather than direct router commands.

---

## 3. `<script setup>` Structure

To maintain consistency, the `<script setup>` block is typically structured in the following order:
1.  **Imports:** Vue APIs, Quasar plugins, composables, helper functions.
2.  **Props & Emits:** Declared via `defineProps` and `defineEmits`.
3.  **Composables:** Invocation of stores, navigation, and configuration utilities.
4.  **Local State:** Reactive variables and configurations (`ref`, `reactive`).
5.  **Computed Properties:** Computed values derived from props or states.
6.  **Lifecycle Hooks:** Vue lifecycle hooks (e.g., `onMounted`).
7.  **Functions & Handlers:** Event handlers and utility methods.

---

## 4. Implementation Example

The following example shows the interaction between a Vue component and a business logic composable:

### Component Level (`OutletActionCard.vue`)

```html
<template>
  <q-card flat bordered class="q-pa-md">
    <div class="text-subtitle1">{{ _C(invoiceTotal, true) }}</div>
    <q-btn 
      v-if="allowed({ outletInvoice: 'create' })"
      v-ripple
      color="primary"
      label="Submit Invoice"
      :loading="isSubmitting"
      @click="submitInvoice"
    />
  </q-card>
</template>

<script setup>
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useOutletInvoice } from 'src/composables/operation/useOutletInvoice'

const props = defineProps({
  invoiceData: { type: Object, required: true }
})

const { _C } = useCurrency()
const { allowed } = useResourceConfig()
const { invoiceTotal, isSubmitting, handleInvoiceSubmit } = useOutletInvoice(props.invoiceData)

const submitInvoice = async () => {
  await handleInvoiceSubmit()
}
</script>
```

### Composable Level (`useOutletInvoice.js`)

```javascript
import { ref, computed } from 'vue'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { Dialog, Notify } from 'quasar'

export function useOutletInvoice(invoiceData) {
  const ioStore = useResourceIoStore()
  const isSubmitting = ref(false)

  const invoiceTotal = computed(() => {
    return (invoiceData.amount || 0) + (invoiceData.tax || 0)
  })

  const handleInvoiceSubmit = async () => {
    isSubmitting.value = true
    try {
      const response = await ioStore.createRecord('outletInvoice', invoiceData)
      if (response.success) {
        Notify.create({ message: 'Invoice submitted successfully', color: 'positive' })
      } else {
        Dialog.create({ title: 'Error', message: response.error })
      }
    } catch (e) {
      Notify.create({ message: 'Submission failed', color: 'negative' })
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    invoiceTotal,
    isSubmitting,
    handleInvoiceSubmit
  }
}
```

---

## 5. Summary of Architectural Decisions

| Task | Pattern |
| :--- | :--- |
| **Retrieve Data Rows** | Composable invokes Pinia store methods -> Composable exposes reactive state to component. |
| **Verify Permission** | Check scopes using `allowed({ res: 'action' })`. |
| **Perform Calculations** | Compute values via `computed()` inside the composable layer. |
| **Redirect Route** | Invoke routing via the `useResourceNav` composable. |

