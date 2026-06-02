# 55_QUASAR_NOTIFICATIONS.md - Notifications, Alerts & Progress States

This document defines how to implement user alerts, toast notifications, loading blocks, and progress indicators using Quasar's feedback plugins (`Notify`, `Dialog`, `Loading`).

---

## 1. Purpose

The purpose of this guide is to ensure all operations display clean, non-intrusive status alerts, prevent screen freezing bugs during API latency, and standardize toast alert colors.

---

## 2. Core Philosophy

AQL notification workflows are **Non-Obtrusive, Safe, and Instant**:
*   **Toast feedback Priority:** Operations like success checks or light errors must slide as temporary, self-dismissing toast notifications (`Notify` plugin) that do not block visual workflows.
*   **Full-Screen Blockers:** Critical network mutations (like bulk syncing or transaction approval writes) must toggle temporary overlays (`Loading` plugin) to prevent click interference.
*   **Decoupled Triggers:** Popups must trigger programmatically via JS plugins rather than mounting DOM overlay code inside local views templates.

---

## 3. Golden Rules

1.  **Strict Color Mapping:** Toast overlays must map to standard statuses: Success uses Green (`positive`), Failures use Red (`negative`), Alerts use Gold (`warning`).
2.  **Declare Loaders for All API Actions:** Any network save event must toggle loading spinners, either on the specific button or full screen.
3.  **Support Safe Dismissal Options:** Toast notifications must define close buttons for touch users, even if auto-dismiss timers are configured.
4.  **No Naked Alert Modals:** Reject standard browser confirmation prompts. Use Quasar's programmatic `Dialog` plugin.

---

## 4. Notify, Loading & Dialog Plugin Setup

```javascript
// FRONTENT/src/composables/useFeedback.js
import { Notify, Loading, Dialog } from 'quasar'

export function useFeedback() {
  
  // 1. Trigger toast notifications
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

  // 2. Trigger Full screen blocking spinner
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

  // 3. Confirm dialog helper
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

---

## 5. Best Practices

*   **Progressive Loading Badges:** When uploading bulk Excel templates, display linear loading trackers (`QLinearProgress`) inside page headers rather than blocking the user's entire screen view.
*   **Clear Error Explanations:** Display actionable errors in failure alerts (e.g. "Missing required field: Quantity", not "Transaction failed").

---

## 6. Mobile First Rules

*   **Ergonomic Toast Placement:** On small mobile screens, display error notifications near the bottom edge (`position="bottom"`) to align with comfort touch boundaries.
*   **Brief Toast Lengths:** Toast text must not exceed two sentences to prevent blocking primary navigation menus.

---

## 7. Common Patterns

### Network Operation Feedback Pattern

```javascript
// FRONTENT/src/composables/operations/useOutletSync.js
import { useFeedback } from 'src/composables/useFeedback'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useOutletSync() {
  const { notifySuccess, notifyError, toggleLoadingState } = useFeedback()
  const ioStore = useResourceIoStore()

  const syncOutletCatalog = async (outletId) => {
    // 1. Show full screen spinner
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
      // 2. Hide spinner
      toggleLoadingState(false)
    }
  }

  return { syncOutletCatalog }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlOfflineBanner`: Reusable inline banner linked to network status listeners, warning when connections fail.

---

## 9. Accessibility Notes

*   Toasts triggered via `Notify` announce dynamically using `aria-live="polite"` tags to ensure screen readers read alerts.

---

## 10. Dark Mode Notes

*   Verify spinner box panels automatically use dark modes token colors (`bg-grey-9`, `text-white`) when themes toggle.

---

## 11. Performance Notes

*   Avoid spawning multiple notifications simultaneously. Let toast messages queue logically.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Implementing raw alert popups (`alert('Failed')`) inside code workflows.
    *   *Correction:* Replace with the `Notify` plugin.
*   **Anti-Pattern:** Leaving full-screen blockers active on API errors.
    *   *Correction:* Force loader cleanup inside a `finally` block.

---

## 13. AI Agent Rules

1.  **Ensure Programmatic Notifications:** Reject any template files writing custom modal toast alert layouts when `Notify` exists.
2.  **Validate Spinners Cleanup:** Confirm all async loaders hide inside `finally` blocks.

---

## 14. Decision Matrix

| Operation Danger | User Interruption | Recommended Action | Feedback Component |
| :--- | :--- | :--- | :--- |
| **Successful save** | Low (Informational) | Self-dismiss toast | `Notify` (type: positive) |
| **API query delay** | Medium (Wait check) | Simple element spin | `:loading` button property |
| **Dangerous edit** | High (Destructive) | Modal Confirmation | Programmatic `Dialog` |
| **System Sync** | High (Critical block) | Full screen blocker | `Loading.show()` plugin |

---

## 15. Final Rule

All user alerts and notifications must compile programmatically via Quasar plugins, apply standard semantic color presets, include touch dismiss options, and lock layouts during saves.
