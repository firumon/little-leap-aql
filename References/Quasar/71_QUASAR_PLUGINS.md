# 71_QUASAR_PLUGINS.md - Framework Service Plugins

This document defines how to configure and call Quasar's programmatic service plugins (`Notify`, `Dialog`, `Loading`, `LocalStorage`, `AddressbarColor`, `AppVisibility`) inside AQL scripts.

---

## 1. Purpose

The purpose of this guide is to explain framework plugin integrations, standardize client storage cache access, and define configurations for system feedback layers.

---

## 2. Core Philosophy

AQL plugins are **Framework-Standard, Programmatic, and Safe**:
*   **Zero Custom Overlays:** Do not code custom HTML alert dialogs or loading spinner screens. Use Quasar's native service plugins to keep views clean.
*   **Protected Client Cache:** User preferences (like dark mode configurations or warehouse tags) must access storage via Quasar's `LocalStorage` wrapper.
*   **App Status Aware:** Use native visibility hooks (`AppVisibility`) to freeze live queries loops when the user shifts the mobile app to background screens.

---

## 3. Golden Rules

1.  **Register Plugins in Config:** Ensure all utilized plugins are declared inside the `quasar.config.js` configuration file (AQL has these pre-registered).
2.  **No Direct window.localStorage:** Always read and write client storage states using Quasar's `LocalStorage` or `SessionStorage` wrappers.
3.  **Optimize Addressbar Colors:** Apply dynamic colors to mobile web browser header borders using the `AddressbarColor` plugin.
4.  **Confirm AppVisibility Triggers:** Pause sync intervals programmatically when `AppVisibility.now` returns false (user minimized app).

---

## 4. Quasar Plugins Configuration & Layout Setup

### Programmatic Configs & Storage API
```javascript
// FRONTENT/src/composables/useAppSetup.js
import { onMounted } from 'vue'
import { LocalStorage, AddressbarColor, AppVisibility, Notify } from 'quasar'

export function useAppSetup() {

  const initializeAppAesthetics = () => {
    // 1. Configure mobile browser header tab colors
    AddressbarColor.set('#1a56db') // Maps to primary theme color
  }

  const saveUserPreference = (key, value) => {
    // 2. Safe local storage wrap
    LocalStorage.set(key, value)
  }

  const getUserPreference = (key) => {
    return LocalStorage.getItem(key)
  }

  // 3. Monitor browser tab visibility
  const setupVisibilityTracker = () => {
    onMounted(() => {
      // Pause queries if app is minimized
      if (AppVisibility.appVisible) {
        // App is visible
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

---

## 5. Best Practices

*   **LocalStorage Error Fallbacks:** Wrap LocalStorage writes inside standard try-catch blocks to prevent crashes if mobile safari browsers run in private incognito screens (where writes are blocked).
*   **Clean Keys Structures:** Prefix local storage keys to prevent collisions with other domains: `AQL_USER_THEME`.

---

## 6. Mobile First Rules

*   **Responsive Address Bar Color:** Coordinate address bar color changes with page transitions or dark mode toggles to create a native app feel on mobile.
*   **Compact Toast Positions:** Display toast confirmations near layout edges to keep primary screens clear.

---

## 7. Common Patterns

### Network Status & Visibility Manager Pattern

Pause background sync processes when the user minimizes the mobile app viewport:

```javascript
// FRONTENT/src/composables/operations/useAppSyncManager.js
import { watch } from 'vue'
import { AppVisibility } from 'quasar'

export function useAppSyncManager(syncCallback) {
  
  // Watch app visibility status changes
  watch(
    () => AppVisibility.now,
    (isAppVisible) => {
      if (isAppVisible) {
        // App returned to foreground: Trigger data refresh query
        syncCallback()
      } else {
        // App backgrounded: Stop sync queries loops
      }
    }
  )
}
```

---

## 8. Reusable Component Suggestions

*   Verify all local settings pages access configurations via standard storage plugins.

---

## 9. Accessibility Notes

*   Verify screen readers announce alert outputs dynamically when `Notify` triggers.

---

## 10. Dark Mode Notes

*   Coordinate Addressbar Colors. When dark mode is active, set borders to dark grey: `AddressbarColor.set('#121212')`.

---

## 11. Performance Notes

*   **Avoid Over-Saving:** Do not write massive data structures (such as complete stock lists) to LocalStorage. Limit storage to preferences and small user tags.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Querying `window.localStorage` directly, which crashes on older iOS incognito viewports.
    *   *Correction:* Call Quasar's `LocalStorage` wrapper.
*   **Anti-Pattern:** Leaving background data polling loops active when the app is minimized.
    *   *Correction:* Pause sync loops using the `AppVisibility` plugin.

---

## 13. AI Agent Rules

1.  **Reject Direct Storage API:** Reject any code blocks using raw `window.localStorage` actions.
2.  **Verify Addressbar Setup:** Ensure theme change composables update browser header bar colors.

---

## 14. Decision Matrix

| Storage Requirement | Data Footprint | Recommended Tool | Security Focus |
| :--- | :--- | :--- | :--- |
| **Dark mode flag** | Single Boolean | `LocalStorage` | Non-sensitive preference |
| **Active warehouse ID**| Numeric ID | `LocalStorage` | Non-sensitive tag |
| **Login token credentials**| Encrypted string | Secure cookie / IDB | High security (No raw storage) |
| **Temporary form draft**| Object | `SessionStorage` | Session lifetime cache |

---

## 15. Final Rule

All visual alerts, storage operations, browser header borders, and background visibility states must utilize standard Quasar service plugins rather than custom HTML/DOM scripts.
