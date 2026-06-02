# 02_QUASAR_AI_RULES.md - AI Agent Operational Rules

This document outlines the strict operational rules, code boundaries, prompt guidelines, and validation protocols that every AI coding agent must follow when editing, refactoring, or generating Quasar component code in the AQL repository.

---

## 1. Purpose

The purpose of these rules is to enforce design standards automatically. It prevents AI agents from injecting legacy patterns (e.g., Options API, TypeScript wrappers, direct API execution in buttons, hardcoded text styles) and guarantees that all created files fit the specific Architecture Rules of the AQL system.

---

## 2. Core Philosophy

AI agents do not write "generic Vue". AI agents write **AQL-Compliant Quasar Code**. This means:
*   **Zero-Trust Layering:** No Vue component is allowed to possess direct access to stores, IndexedDB (IDB) gateways, or API services.
*   **No Loose Endpoints:** All components must handle async logic by subscribing to the state exposed by composables.
*   **Strict Styling Hierarchy:** Rely strictly on built-in Quasar components and CSS utilities before introducing global styles or local styling overrides.

---

## 3. Golden Rules

1.  **Reject TypeScript:** All generated code blocks, imports, and variables must use plain ES6+ JavaScript. Never write types, interfaces, or generic `<script setup lang="ts">` sections.
2.  **Verify Gating Permissions:** Every action trigger (`@click`) must have a corresponding permission gate verification using the `allowed()` helper from `useResourceConfig`.
3.  **Use Dynamic Currency Helper:** Never print price amounts using hardcoded strings like `₹` or `AED`. Always process numeric values through the `_C` helper.
4.  **No Direct router.push:** Page redirection must run through the `useResourceNav` composable.

---

## 4. Component Usage (AI Boundaries)

AI agents must comply with the following architectural boundary zones when coding:

| File Type / Zone | Permitted Operations | Forbidden Operations |
| :--- | :--- | :--- |
| **Vue Components (`.vue`)** | Render layout templates, invoke functions from composables, bind props, emit events, declare minor local UI-only states. | Import Axios, import services, import stores directly, write business rules, perform heavy data mappings. |
| **Composables (`use*.js`)** | Read Pinia stores, validate inputs, build API payloads, execute route transitions via navigation helper, handle errors. | Write inline styles, import UI components, manipulate raw DOM elements, query IndexedDB directly. |
| **Pinia Stores (`.js`)** | Manage in-memory state caches, coordinate sync schedules, trigger generic service updates. | Store layout states, run form validations, mount alert notification overlays directly. |
| **Services (`*Service.js`)** | Run raw Axios payloads, perform direct IndexedDB CRUD queries, handle data transforms, write network logs. | Store reactive states, track route paths, evaluate business permissions. |

---

## 5. Best Practices

*   **Self-Documentation:** AI agents must keep existing comments and docstrings intact. If a function is refactored, the inline comment must reflect the updated arguments.
*   **Script Setup Uniformity:** Structure `<script setup>` in the following order:
    1.  Imports (Vue, Quasar, custom composables, helpers).
    2.  Props & Emits (`defineProps`, `defineEmits`).
    3.  Composables invocation (stores, navigation, configs).
    4.  Local state declarations (`ref`, `reactive`).
    5.  Computed properties (`computed`).
    6.  Lifecycle hooks (`onMounted`, etc.).
    7.  Functions & handlers.
*   **Header-Light Rule:** When querying APIs, assume headers are light. Do not append redundant header refresh parameters unless requested.

---

## 6. Mobile First Rules

*   **Touch Bounds:** Verify that spacing helpers (`q-pa-md`, `q-ma-sm`) prevent buttons from rendering too close to the screen edges.
*   **Inline Actions limit:** Never render more than two primary action buttons on a single row in mobile card items. Use a `QBottomSheet` or action menu dropdown for supplementary workflows.

---

## 7. Common Patterns

### Correct AI Implementation Flow

Here is a standard, correct pattern showing component-to-composable-to-store boundaries:

```javascript
// Component Level: FRONTENT/src/components/Operations/OutletActionCard.vue
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
import { useOutletInvoice } from 'src/composables/operations/useOutletInvoice'

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

```javascript
// Composable Level: FRONTENT/src/composables/operations/useOutletInvoice.js
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

## 8. Reusable Component Suggestions

*   Verify if the target component can use `AqlList` or `AqlItem` wrappers before generating raw loops over `div` elements.

---

## 9. Accessibility Notes

*   Never use color alone to represent a status state (e.g. green for paid, red for overdue). Add text labels or distinct icons to support color-blind users.

---

## 10. Dark Mode Notes

*   Ensure that components use native background variables (`bg-surface`, `bg-dark`) so layouts adapt without styling patches.

---

## 11. Performance Notes

*   Use `shallowRef` instead of `ref` when importing massive datasets that do not require nested reactive tracking to reduce garbage collection loads.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Importing Pinia stores (`useDataStore` or `useResourceIoStore`) inside components.
    *   *Correction:* Always import stores in the business logic composables, and expose the values via returned properties.
*   **Anti-Pattern:** Modifying DOM attributes directly inside Vue component scripts.
    *   *Correction:* Use Quasar's data binding and directives (`v-touch-pan`, etc.) to drive DOM changes reactively.

---

## 13. AI Agent Rules

*   **Layer Verification:** Before adding any logic, double-check: Is this code in a `.vue` file doing service calls? If yes, refactor it to a composable.
*   **Impact Analysis:** Before editing a shared layout helper, locate all callers and review their usage parameters.
*   **Lint Compliance:** Strictly match standard ES6 formatting. Use 2 spaces for indentation, always format templates with grouped properties, and avoid dangling semi-colons where not required.

---

## 14. Decision Matrix

| Coding Challenge | Allowed Implementation | Prohibited Implementation |
| :--- | :--- | :--- |
| **Retrieve data rows** | Composable invokes `store.fetchRecord` | Component imports `Axios` or `service` directly |
| **Verify Permission** | Use `allowed({ res: 'action' })` check | Parse user scopes manually in component script |
| **Calculate Totals** | Compute via `computed()` inside composable | Write math parsing loops inside Vue templates |
| **Redirect Route** | Invoke `useResourceNav` methods | Import `useRouter` and call `router.push` |

---

## 15. Final Rule

AI agents must verify that every component matches JavaScript first, Composition API `<script setup>` syntax, implements permission-gated controls, references dynamic currency formatting, and remains decoupled from raw service or store operations.
