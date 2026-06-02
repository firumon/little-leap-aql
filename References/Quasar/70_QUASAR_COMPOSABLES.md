# 70_QUASAR_COMPOSABLES.md - Composable Functions & Separation of Logic

This document defines how to implement, import, and configure composition functions using Quasar's native composables (`useQuasar`, `useMeta`) and custom AQL business helpers.

---

## 1. Purpose

The purpose of this guide is to explain the architectural role of composables in the AQL frontend, ensure components remain logic-free view templates, and details cleanup routines.

---

## 2. Core Philosophy

AQL composables are the **Single Source of Business Logic**:
*   **Separation of Concerns:** Components must only render layouts and trigger events. All validation rules, URL builders, and Axios payload compilation must live inside composables.
*   **Decoupled Plugin Calls:** Dialog confirmation triggers, loader spinner operations, and toast alerts must run inside composables using `useQuasar()` properties.
*   **Resource Independence:** Composables must remain generic and process resource names dynamically via props or parameters.

---

## 3. Golden Rules

1.  **Strict Business Logic Exclusion:** Prohibit writing calculation loops, database mutations, or validation logic directly inside component files.
2.  **Rely on useQuasar inside Script:** Access layout status flags and dynamic plugins programmatically via `const $q = useQuasar()` inside composables.
3.  **Ensure Explicit Listener Cleanups:** If composables set up event listeners, always detach hooks inside `onUnmounted` blocks.
4.  **Enforce Standard Naming:** All custom composables must follow camelCase naming prefixes with "use" (e.g. `useOutletSync`).

---

## 4. useQuasar & useMeta Configuration

```javascript
// FRONTENT/src/composables/operations/useRequisitionManager.js
import { ref, computed, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useMeta } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useRequisitionManager(requisitionId = null) {
  const $q = useQuasar()
  const ioStore = useResourceIoStore()
  
  const isSaving = ref(false)
  const record = ref({ title: '', amount: 0 })

  // 1. Configure SEO Page Title metadata dynamically
  const metaData = {
    title: 'Purchase Requisition Detail',
    titleTemplate: (title) => `${title} - AQL Portal`
  }
  useMeta(metaData)

  // 2. Trigger programmatic dialog inputs
  const confirmRequisitionSave = async (payload) => {
    $q.dialog({
      title: 'Confirm Save',
      message: 'Save changes to this purchase requisition?',
      cancel: true,
      persistent: true
    }).onOk(async () => {
      isSaving.value = true
      try {
        const response = await ioStore.createRecord('purchaseRequisitions', payload)
        if (response.success) {
          $q.notify({ type: 'positive', message: 'Requisition saved' })
        }
      } finally {
        isSaving.value = false
      }
    })
  }

  // 3. Listener setup and teardown callbacks
  const handleWindowResize = () => {
    // Dynamic resizing rules calculations
  }
  window.addEventListener('resize', handleWindowResize)
  
  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  return {
    isSaving,
    record,
    confirmRequisitionSave
  }
}
```

---

## 5. Best Practices

*   **Avoid Monolithic Composables:** Design narrow, single-purpose composables (e.g. `useBarcodeScanner` for cameras, `useFormValidator` for validation inputs).
*   **Standardized Return Shapes:** Return reactive states (`ref`, `computed`) and execution functions wrapped inside standard JavaScript objects.

---

## 6. Mobile First Rules

*   **Hardware Event Locks:** Wrap hardware access hooks (like camera scopes or GPS locator parameters) inside custom lifecycle guards to prevent mobile freezes.
*   **Virtual Keyboard blur hooks:** Expose functions blurring inputs programmatically upon selecting results.

---

## 7. Common Patterns

### Online/Offline Status Listener Composable

Keep track of user connection status dynamically across views:

```javascript
// FRONTENT/src/composables/useNetworkStatus.js
import { ref, onMounted, onUnmounted } from 'vue'
import { Notify } from 'quasar'

export function useNetworkStatus() {
  const isOnline = ref(navigator.onLine)

  const updateStatus = () => {
    isOnline.value = navigator.onLine
    Notify.create({
      type: isOnline.value ? 'positive' : 'warning',
      message: isOnline.value ? 'Network connection restored' : 'Offline mode active',
      timeout: 2000
    })
  }

  onMounted(() => {
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
  })

  onUnmounted(() => {
    window.removeEventListener('online', updateStatus)
    window.removeEventListener('offline', updateStatus)
  })

  return { isOnline }
}
```

---

## 8. Reusable Component Suggestions

*   Verify all business pages mount state handlers inside matching composables.

---

## 9. Accessibility Notes

*   Verify that SEO title changes are parsed correctly by screen readers.

---

## 10. Dark Mode Notes

*   Rely on `useQuasar().dark.isActive` to return boolean state values inside calculations programmatically if styling triggers require.

---

## 11. Performance Notes

*   Do not bundle heavy computed watchers inside frequently unmounted list page composables.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Importing Axio services directly inside component vue files.
    *   *Correction:* Manage all data transport gates inside services, orchestrate inside stores, and call them inside composables.
*   **Anti-Pattern:** Instantiating window event listeners inside composables without removing hooks on unmounts.
    *   *Correction:* Always remove listeners inside `onUnmounted`.

---

## 13. AI Agent Rules

1.  **Reject Component Mutations:** If code edits contain Axios calls in `.vue` files, refactor them immediately into a custom composable.
2.  **Verify Unmounted Hooks:** Confirm all event listeners declare cleanup wrappers.

---

## 14. Decision Matrix

| Coding Target | State Requirement | Target Area | Tool Selection |
| :--- | :--- | :--- | :--- |
| **Simple details presentation**| None (Stateless tag) | Vue View template | CSS classes only |
| **Validate and Save form** | Stateful (isSubmitting) | Custom Composable | `useFormHandler.js` |
| **Trigger confirmations** | Programmatic modal | Composable function | `$q.dialog` preset |
| **Manage SEO Headings** | SEO tags metadata | Page route root | `useMeta` plugin helper |

---

## 15. Final Rule

All business logic, input validation calculations, page redirection states, and programmatic alerts must live inside custom composable wrappers, decoupling Vue templates entirely from data mutations.
