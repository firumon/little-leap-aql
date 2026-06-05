# 55_QUASAR_NOTIFICATIONS.md - Notifications, Alerts & Progress States

This document is an educational reference guide covering feedback systems, status notifications, and progress indicators in Quasar using the programmatic `Notify`, `Loading`, and `Dialog` plugins.

---

## 1. Component Overview

Quasar provides three primary programmatic plugins to give feedback to the user:
1.  **`Notify` (Toast Notifications)**: Used for displaying temporary, self-dismissing status alerts (such as success confirmation or error warnings) without blocking the user's interaction flow.
2.  **`Loading` (Full-Screen Overlays)**: Used to block user clicks during crucial or long-running database transactions (e.g. bulk catalog synchronizations).
3.  **`Dialog` (Programmatic Confirmation)**: Replaces browser alerts with customizable modal confirmation dialogs to double-check destructive actions.

---

## 2. Programmatic Plugin Configurations

*   **`Notify.create(...)`**: Spawns toast notifications. Key options include:
    *   `type`: Preset themes representing status types (`positive` for success, `negative` for failure, `warning` for alert, `info` for details).
    *   `timeout`: Time in milliseconds before the toast auto-dismisses (e.g., `2500` ms).
    *   `position`: Controls viewport placement (e.g., `'bottom-right'` on desktop or `'bottom'` on mobile).
    *   `actions`: Adds interactive buttons to dismiss or trigger events.
*   **`Loading.show(...)`**: Activates a full-screen loading spinner overlay. You can customize the message text, background class, and spinner color.
*   **`Dialog.create(...)`**: Spawns confirm/prompt modals programmatically with `.onOk` and `.onCancel` event handlers.

---

## 3. Usage Examples

### Unified Feedback Composable

This composable wraps Quasar's programmatic feedback APIs to expose clean functions for success, error, loading, and confirmation feedback.

```javascript
import { Notify, Loading, Dialog } from 'quasar'

export function useFeedback() {
  
  // Trigger toast notifications
  const notifySuccess = (messageText) => {
    Notify.create({
      type: 'positive',
      message: messageText,
      timeout: 2500,
      position: 'bottom-right',
      actions: [{ icon: 'close', color: 'white', round: true }]
    })
  }

  const notifyError = (messageText) => {
    Notify.create({
      type: 'negative',
      message: messageText,
      timeout: 4000,
      position: 'bottom',
      actions: [{ label: 'Dismiss', color: 'white', dense: true }]
    })
  }

  // Trigger full screen blocking spinner
  const toggleLoadingState = (isActive, messageText = 'Processing transaction...') => {
    if (isActive) {
      Loading.show({
        message: messageText,
        boxClass: 'bg-grey-2 text-dark rounded-borders',
        spinnerColor: 'primary'
      })
    } else {
      Loading.hide()
    }
  }

  // Confirm dialog helper
  const confirmAction = (titleText, messageText, onOkCallback) => {
    Dialog.create({
      title: titleText,
      message: messageText,
      cancel: true,
      persistent: true,
      ok: { label: 'Proceed', color: 'primary', flat: true }
    }).onOk(onOkCallback)
  }

  return {
    notifySuccess,
    notifyError,
    toggleLoadingState,
    confirmAction
  }
}
```

### Network Action with Feedback

This example shows how to orchestrate feedback within an asynchronous operation, ensuring the loader closes even if the request throws an error.

```javascript
import { useFeedback } from 'src/composables/useFeedback'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useOutletSync() {
  const { notifySuccess, notifyError, toggleLoadingState } = useFeedback()
  const ioStore = useResourceIoStore()

  const syncOutletCatalog = async (outletId) => {
    // Show full screen spinner
    toggleLoadingState(true, 'Downloading inventory details...')
    try {
      const response = await ioStore.createRecord('outletSync', { id: outletId })
      if (response.success) {
        notifySuccess('Catalog synchronized successfully')
      } else {
        notifyError(response.error || 'Synchronization failed')
      }
    } catch (e) {
      notifyError('Network timeout. Check your connection.')
    } finally {
      // Ensure spinner is hidden in finally block
      toggleLoadingState(false)
    }
  }

  return { syncOutletCatalog }
}
```

---

## 4. Behavior and Usability Guidelines

*   **Handling Asynchronous Failures**: Managing loading overlay states within a `finally` block ensures that loading overlays are dismissed in the event of an error, preventing the interface from locking up permanently.
*   **Error Message Clarity**: Success and error messages are more helpful when they provide clear, action-oriented explanations rather than generic system terms.
*   **Toasts Placement and Reachability**: On mobile layouts, displaying alerts near the bottom edge of the viewport aligns with natural touch targets and keeps the user's hand from obstructing the view of the screen.
*   **Accessibility**: Programmatic notifications spawned via `Notify` automatically inject `aria-live="polite"` tags to ensure screen readers announce updates dynamically.
