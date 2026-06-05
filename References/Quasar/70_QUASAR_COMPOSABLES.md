# Quasar Composables Reference Guide

This reference guide describes how to implement and integrate composable functions inside AQL Vue components, utilizing Quasar's native composables (`useQuasar`, `useMeta`) and custom hooks.

---

## 1. Architectural Role of Composables

In the AQL architecture, composables act as the primary interface for encapsulating reusable business logic, state management, and device integration. 

*   **Layer Separation**: Vue SFC files focus primarily on layout structure, styling, and rendering templates. Calculations, validator configurations, event listeners, and API integrations are decoupled into modular composable functions.
*   **Encapsulation of Side Effects**: Event listeners, timers, and hardware connections are managed within composables, ensuring clean setup and teardown lifecycles.
*   **Dynamic Context Integration**: Vue composition context functions (like accessing the router, pinia store, or Quasar's root instance) are accessed within the Vue script execution context using setup hooks.

---

## 2. Key Quasar Composables

### `useQuasar`
Provides programmatic access to Quasar plugins and utilities directly inside Vue setup scripts, including:
*   **`$q.dialog`**: Creating custom or standard confirmation dialogs.
*   **`$q.notify`**: Spawning system notifications.
*   **`$q.dark.isActive`**: Checking dark mode status.
*   **`$q.screen`**: Reading viewport details dynamically.

### `useMeta`
Allows components to dynamically set SEO tags, metadata, page titles, and script dependencies.

---

## 3. Code Examples

### Business Manager Composable

The following example illustrates a composable managing page metadata, state indicators, custom form actions, and window resize events:

```javascript
// composables/operations/useRequisitionManager.js
import { ref, computed, onUnmounted } from 'vue'
import { useQuasar, useMeta } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useRequisitionManager(requisitionId = null) {
  const $q = useQuasar()
  const ioStore = useResourceIoStore()
  
  const isSaving = ref(false)
  const record = ref({ title: '', amount: 0 })

  // 1. Configure page metadata
  const metaData = {
    title: 'Purchase Requisition Detail',
    titleTemplate: (title) => `${title} - AQL Portal`
  }
  useMeta(metaData)

  // 2. Trigger programmatic dialog input
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

  // 3. Setup and teardown of event listeners
  const handleWindowResize = () => {
    // Resize calculations
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

### Online/Offline Connection Status Listener

This composable monitors browser online states and notifies users when status modifications occur:

```javascript
// composables/useNetworkStatus.js
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

## 4. Technical Considerations

*   **Lifecycle Awareness**: Event listeners, socket connections, or timers initialized inside a composable are cleaned up using Vue's lifecycle hooks (`onUnmounted` or `onBeforeUnmount`) to prevent memory leaks.
*   **Naming Conventions**: Custom composables are typically named using camelCase starting with the prefix `use` (e.g., `useNetworkStatus`, `useRequisitionManager`).
*   **Return Shapes**: Standard practices suggest returning reactive variables (`ref` or `computed`) and functions inside a flat, plain JavaScript object. This enables developers to destructure properties as needed.
*   **Hardware and Mobile Events**: When interfacing with device components (like camera overlays or geolocation trackers), wrap calls in lifecycle hooks (`onMounted`) to ensure the DOM and Cordova/Capacitor plugins are ready.
