# Quasar Plugins Reference Guide

This reference guide describes the configuration and usage of Quasar's native programmatic service plugins (such as `Notify`, `Dialog`, `Loading`, `LocalStorage`, `AddressbarColor`, and `AppVisibility`) to handle core application services.

---

## 1. Overview of Service Plugins

Quasar framework plugins provide programmatic utility APIs that interact with the browser, application state, and UI overlay layers without requiring manual component markup:

*   **`LocalStorage` / `SessionStorage`**: Provide safe wrappers around browser storage APIs, featuring built-in fallbacks and structure serialization (handling object conversion automatically).
*   **`AddressbarColor`**: Programmatically alters the header color of mobile browsers to match the application's current theme.
*   **`AppVisibility`**: Detects whether the application is currently visible (active tab/foreground) or minimized (background tab).
*   **`Notify` / `Dialog`**: Allow developer-driven alerts, toasts, and confirmation dialogs to be spawned directly from JavaScript code.

---

## 2. Dynamic Settings & Storage Examples

The following example shows how to configure and interact with storage, visibility tracking, and mobile address bar configurations:

```javascript
// composables/useAppSetup.js
import { onMounted } from 'vue'
import { LocalStorage, AddressbarColor, AppVisibility } from 'quasar'

export function useAppSetup() {

  const initializeAppAesthetics = (primaryColorHex = '#1a56db') => {
    // 1. Configure mobile browser header tab colors
    AddressbarColor.set(primaryColorHex)
  }

  const saveUserPreference = (key, value) => {
    // 2. Safe local storage write
    try {
      LocalStorage.set(key, value)
    } catch (e) {
      console.warn('LocalStorage write failed:', e)
    }
  }

  const getUserPreference = (key) => {
    return LocalStorage.getItem(key)
  }

  // 3. Monitor browser tab visibility
  const setupVisibilityTracker = () => {
    onMounted(() => {
      if (AppVisibility.appVisible) {
        // App is currently focused in the foreground
      }
    })
  }

  return {
    initializeAppAesthetics,
    saveUserPreference,
    getUserPreference,
    setupVisibilityTracker
  }
}
```

### Minimizing Background Overhead via `AppVisibility`

To conserve device battery and reduce server load, applications can monitor visibility states to pause background polling loops:

```javascript
// composables/operations/useAppSyncManager.js
import { watch } from 'vue'
import { AppVisibility } from 'quasar'

export function useAppSyncManager(syncCallback) {
  // Watch app visibility status changes
  watch(
    () => AppVisibility.now,
    (isAppVisible) => {
      if (isAppVisible) {
        // App returned to foreground: Resume operations
        syncCallback()
      } else {
        // App minimized: Pause operations
      }
    }
  )
}
```

---

## 3. Technical Considerations

*   **Safe Storage Writes**: Surrounding `LocalStorage` operations with `try-catch` guards avoids potential crashes in environments with restricted storage access, such as browsers configured for high-privacy/incognito browsing.
*   **Theme Synchronization**: Coordinating browser header colors (`AddressbarColor`) with dark mode state updates helps create a unified theme transition.
*   **Background Data Controls**: Utilizing `AppVisibility.now` to pause active polling intervals prevents unnecessary API requests when the user minimizes the tab or switches apps.
*   **Data Footprint**: Keeping stored objects compact by saving only user preferences or IDs (rather than heavy cached database datasets) optimizes storage efficiency and read/write times.
