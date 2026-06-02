# 80_QUASAR_PERFORMANCE.md - Performance Optimization & Memory Management

This document defines the guidelines and programming checklists for maximizing application performance and minimizing memory consumption on mobile web browsers.

---

## 1. Purpose

The purpose of this guide is to ensure the mobile ERP application remains fast, responsive, avoids memory leaks that crash iOS/Android WebViews, and maintains stable framerates during scrolls.

---

## 2. Core Philosophy

AQL performance relies on **DOM Control and Reactivity Pruning**:
*   **Reactivity Minimization:** Vue's deep reactivity engine is highly expensive. We bypass recursive tracking on large database array tables by declaring them via `shallowRef`.
*   **DOM Node Containment:** Keep the DOM lightweight. Loop rendering must utilize element recycling (`QVirtualScroll`) to keep active DOM element counts under 500 nodes.
*   **Resource Throttling:** Network polling and input processing loops must declare debounced timers and pause when the viewport is hidden.

---

## 3. Golden Rules

1.  **Strict Shallow Reactivity:** Large list collections containing more than 20 items must be stored using Vue's `shallowRef` instead of `ref`.
2.  **Ensure Event Listeners Cleanup:** Event listeners initialized inside hooks must define corresponding teardowns: `window.removeEventListener(...)`.
3.  **Prohibit Nested Loops in Templates:** Never nest multiple `v-for` loops inside card feeds lists. Keep templates flat.
4.  **Confirm Input Debouncing:** Search input validations must throttle queries using debounce properties.

---

## 4. Performance Optimization Configuration

```javascript
// FRONTENT/src/composables/operations/useHeavyDataLoader.js
import { shallowRef, ref, onUnmounted } from 'vue'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { debounce } from 'quasar'

export function useHeavyDataLoader() {
  const ioStore = useResourceIoStore()
  
  // 1. Declare large list as shallowRef to block deep nested reactive checks
  const transactionItems = shallowRef([])
  const isFetching = ref(false)

  // 2. Debounce fetch queries by 400ms to throttle triggers
  const debouncedFetch = debounce(async (querySlug) => {
    isFetching.value = true
    try {
      const response = await ioStore.createRecord('heavyQuery', { query: querySlug })
      if (response.success) {
        // Assigning new array directly resets shallowRef cleanly
        transactionItems.value = response.data
      }
    } finally {
      isFetching.value = false
    }
  }, 400)

  // 3. Prevent memory leaks by detaching hook events
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab hidden: Pause live polls
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    debouncedFetch.cancel() // Cancel pending debounces
  })

  return {
    transactionItems,
    isFetching,
    debouncedFetch
  }
}
```

---

## 5. Best Practices

*   **Avoid Inline Calculations:** Never map currency formatting calculations (`_C()`) inside complex list cell loops dynamically. Pre-map total amounts inside composables during data load steps.
*   **Lazy Modals Loading:** Ensure all dialogs define the `lazy` attribute to prevent compiling invisible overlays upfront.

---

## 6. Mobile First Rules

*   **Throttle Touch Events:** Debounce panning or scrolling callbacks to prevent choking mobile device UI threads.
*   **Avoid Complex Filters:** Minimize styling properties like CSS backdrop filters (`backdrop-filter`) inside list card items. They trigger heavy GPU re-render cycles.

---

## 7. Common Patterns

### Reactive State Pruning Pattern

When updating a single row item inside a shallow reference array, trigger changes by overwriting the array reference to signal Vue's tracker:

```javascript
const updateSingleRow = (updatedRow) => {
  // Map values inside shallow array list
  const tempArray = [...transactionItems.value]
  const targetIndex = tempArray.findIndex(item => item.id === updatedRow.id)
  
  if (targetIndex !== -1) {
    tempArray[targetIndex] = updatedRow
    // Overwrite root reference to trigger computed evaluations
    transactionItems.value = tempArray
  }
}
```

---

## 8. Reusable Component Suggestions

*   Verify all heavy list templates utilize `AqlList` wrappers to automatically configure recycling buffers.

---

## 9. Accessibility Notes

*   Ensure loading overlays include descriptive status updates so accessibility users understand tasks are running.

---

## 10. Dark Mode Notes

*   Avoid applying dynamic styling rules that trigger reflow passes when themes toggle.

---

## 11. Performance Notes

*   **Avoid Component Watchers Loops:** Watchers monitoring complex objects must bypass `deep: true` configurations unless explicitly required.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Storing a stock catalog array of 200 items in a standard deep `ref()`.
    *   *Correction:* Replace with `shallowRef()`.
*   **Anti-Pattern:** Leaving document-level scrolling listeners active after routing away from pages.
    *   *Correction:* Always detach listeners inside `onUnmounted`.

---

## 13. AI Agent Rules

1.  **Validate Shallow State:** Ensure list arrays returned from store queries are initialized with `shallowRef`.
2.  **Confirm Event Unmounts:** Confirm all custom event listeners declare corresponding unmounted removal keys.

---

## 14. Decision Matrix

| Dataset Row Volume | Data Nesting Depth | Recommended State Type | View Rendering |
| :--- | :--- | :--- | :--- |
| **< 15 items** | Flat properties | Standard `ref()` | Simple `v-for` loop |
| **15 to 100 items** | Deep properties | `shallowRef()` | `QVirtualScroll` container |
| **100+ items** | Deep properties | `shallowRef()` | `QInfiniteScroll` loader |

---

## 15. Final Rule

All large database list variables must declare shallow reactive states, define virtual scroll recycling offsets, implement input debounces, and detach event listeners during unmount loops.
