# Quasar Performance & Memory Management Reference Guide

This reference guide describes the principles and practices for optimizing rendering performance, managing application state efficiently, and preventing memory leaks in mobile web viewports.

---

## 1. Core Concepts

Performance optimization in a Vue/Quasar application centers on managing the reactivity system and minimizing DOM complexity:

*   **Reactivity Overhead**: Vue's reactivity system wraps objects recursively. For large collections or deeply nested objects, this deep tracking can consume significant CPU and memory resources.
*   **DOM Node Count**: Large lists rendered via simple loops generate a high number of active DOM elements. Component recycling via virtualization displays only visible items, keeping the browser's DOM lightweight.
*   **Asynchronous & Event Overheads**: Throttling network requests, debouncing user inputs, and removing unused event listeners are critical to ensuring smooth scrolling and interaction speeds.

---

## 2. Key Optimization Strategies

### Shallow Reactivity (`shallowRef`)
Using `shallowRef` tells Vue to only track changes to the root reference (`.value`) of the variable, bypassing recursive reactivity on nested keys. This is particularly effective for storing large, read-only datasets fetched from API servers.

### Virtual Scrolling (`QVirtualScroll` & `QInfiniteScroll`)
Instead of rendering hundreds of card templates simultaneously, virtual scrolling recycles DOM nodes by rendering only the subset of items visible inside the user's viewport, which keeps the total DOM node count low.

### Debouncing and Throttling
Using Quasar's `debounce` or `throttle` utilities on search fields or event listeners blocks rapid, repeated executions and reduces CPU cycles.

---

## 3. Code Examples

### Heavy Data Loader with Shallow Reactivity & Debouncing

The following example demonstrates how to implement `shallowRef` for large lists, apply debouncing to inputs, and clean up event listeners to prevent memory leaks:

```javascript
// composables/operations/useHeavyDataLoader.js
import { shallowRef, ref, onUnmounted } from 'vue'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { debounce } from 'quasar'

export function useHeavyDataLoader() {
  const ioStore = useResourceIoStore()
  
  // 1. Declare large list as shallowRef to bypass deep reactive checks
  const transactionItems = shallowRef([])
  const isFetching = ref(false)

  // 2. Debounce fetch queries by 400ms to throttle API requests
  const debouncedFetch = debounce(async (querySlug) => {
    isFetching.value = true
    try {
      const response = await ioStore.createRecord('heavyQuery', { query: querySlug })
      if (response.success) {
        // Assigning a new array directly updates the shallowRef cleanly
        transactionItems.value = response.data
      }
    } finally {
      isFetching.value = false
    }
  }, 400)

  // 3. Prevent memory leaks by detaching window-level listeners
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause active routines when tab is in background
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    debouncedFetch.cancel() // Cancel pending debounced triggers
  })

  return {
    transactionItems,
    isFetching,
    debouncedFetch
  }
}
```

### Shallow Reactivity Update Pattern

When modifying a single element within a `shallowRef` array, trigger reactivity by creating a shallow copy and overwriting the root reference:

```javascript
const updateSingleRow = (updatedRow) => {
  // Map values inside shallow array list
  const tempArray = [...transactionItems.value]
  const targetIndex = tempArray.findIndex(item => item.id === updatedRow.id)
  
  if (targetIndex !== -1) {
    tempArray[targetIndex] = updatedRow
    // Overwrite root reference to notify reactive watchers
    transactionItems.value = tempArray
  }
}
```

---

## 4. Technical Considerations

*   **Calculations in Templates**: Executing complex formatting or operations inside a `v-for` loop triggers recalculation on every render frame. Pre-computing values in the composable prior to assignment optimizes rendering performance.
*   **Lazy Loading Modals**: Using the `lazy` attribute on `QDialog` components ensures that overlays are compiled and inserted into the DOM only when opened, reducing initial layout render time.
*   **Reactivity Watchers**: Restricting the use of `deep: true` in watchers unless absolutely necessary prevents Vue from walking down large object trees continuously.
*   **CSS Performance**: Heavy graphic filters (e.g., `backdrop-filter`, `box-shadow`) inside frequently scrolled components or cards can cause layout reflow and paint issues on lower-end mobile devices.
