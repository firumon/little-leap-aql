# 54_QUASAR_GLOBAL_SEARCH.md - Instant Search & Filter Overlays

This document defines how to implement search inputs and query filters using Quasar components integrated with debounced API loaders.

---

## 1. Purpose

The purpose of this guide is to ensure all search views load quickly, reduce API query volume through input debouncing, and provide immediate loading feedback.

---

## 2. Core Philosophy

AQL search components are **Debounced, Local-First, and Infinite-Paged**:
*   **Input Debounce:** Text inputs must not fire backend API requests on every keystroke. Typing actions must be debounced by a minimum of 300ms.
*   **Local Cache Queries:** Before querying remote databases, search logic must filter local in-memory collections (`useDataStore` cache) or IndexedDB (IDB) caches.
*   **Progressive Loading:** Match search results lists to `QVirtualScroll` containers to allow smooth scrolling.

---

## 3. Golden Rules

1.  **Mandatory Input Debouncing:** All dynamic search input fields must use a debounced update function: `debounce(onQuerySubmit, 300)`.
2.  **Display Search Loading States:** Always show a clear loading indicator (such as `<q-spinner>` inside inputs or cards) while query transitions are active.
3.  **Ensure Clearable Controls:** Search inputs must define the `clearable` attribute to allow users to reset filters instantly.
4.  **No Monolithic Payloads:** Remote searches must request paginated slices rather than returning complete database logs.

---

## 4. QInput Search & Filtering Setup

```html
<!-- FRONTENT/src/components/Operations/OutletSearchOverlay.vue -->
<template>
  <div class="search-overlay column no-wrap">
    <!-- Debounced input field -->
    <q-input
      v-model="searchQuery"
      outlined
      dense
      clearable
      placeholder="Search SKU code or name..."
      :loading="isSearching"
      @update:model-value="onSearchInput"
    >
      <template v-slot:prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <!-- Search output listing -->
    <div class="col scroll q-mt-sm">
      <q-list separator v-if="results.length > 0">
        <q-item v-for="item in results" :key="item.id" clickable v-ripple>
          <q-item-section avatar>
            <q-avatar icon="inventory_2" color="blue-1" text-color="primary" />
          </q-item-section>
          
          <q-item-section>
            <q-item-label class="text-weight-bold">{{ item.name }}</q-item-label>
            <q-item-label caption>SKU: {{ item.sku }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            <span class="text-subtitle2 text-weight-bold">
              {{ _C(item.price, true) }}
            </span>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Empty state placeholder -->
      <div v-else-if="searchQuery && !isSearching" class="text-center q-pa-lg text-grey">
        <q-icon name="info" size="30px" class="q-mb-sm" />
        <div>No matching items found</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { debounce } from 'quasar'
import { useCurrency } from 'src/composables/useCurrency'
import { useSkuSearch } from 'src/composables/operations/useSkuSearch'

const searchQuery = ref('')
const { _C } = useCurrency()
const { isSearching, results, triggerSearch } = useSkuSearch()

// Debounced input handler (300ms)
const onSearchInput = debounce(async (val) => {
  if (!val) {
    results.value = []
    return
  }
  await triggerSearch(val)
}, 300)
</script>
```

---

## 5. Best Practices

*   **Prefix/Suffix Controls:** Add filter badges or tags (`QChip`) near search bars to let users switch filter scopes quickly.
*   **Search Field Autofocus:** Enable autofocus only on dedicated, full-screen search sub-routes, not on standard modal popups.

---

## 6. Mobile First Rules

*   **Thumb-Comfortable Clear:** Enforce `clearable` buttons. Users must not be forced to backspace 15 times to reset a query on a virtual keyboard.
*   **Soft Keyboard Dismissals:** Close virtual keyboards programmatically on selection events by blurring the active input element.

---

## 7. Common Patterns

### Paginated Search Composable Pattern

```javascript
// FRONTENT/src/composables/operations/useSkuSearch.js
import { ref } from 'vue'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useSkuSearch() {
  const ioStore = useResourceIoStore()
  const isSearching = ref(false)
  const results = ref([])

  const triggerSearch = async (queryText) => {
    isSearching.value = true
    try {
      const response = await ioStore.createRecord('skuSearch', {
        query: queryText,
        limit: 15
      })
      if (response.success) {
        results.value = response.data
      }
    } finally {
      isSearching.value = false
    }
  }

  return {
    isSearching,
    results,
    triggerSearch
  }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlSearchBar`: Reusable search bar incorporating debounces, status indicators, and collapsible filter options.

---

## 9. Accessibility Notes

*   Verify search buttons define clear ARIA descriptors (e.g. `aria-label="Search order databases"`).

---

## 10. Dark Mode Notes

*   Ensure list results dividers match theme variables so they scale cleanly to dark mode.

---

## 11. Performance Notes

*   **Avoid Deep Watchers on Query String:** Watchers firing API checks without debounces will freeze mobile UI threads during rapid typing.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Querying remote APIs on every keystroke.
    *   *Correction:* Add a minimum debounce threshold of 300ms.
*   **Anti-Pattern:** Retaining search loading indicators indefinitely if transactions fail.
    *   *Correction:* Manage states in a `finally` block.

---

## 13. AI Agent Rules

1.  **Validate Input Debouncing:** Confirm search update handlers are wrapped with a debounce timer.
2.  **Confirm Search Loaders:** Ensure inputs expose progress markers when query states are active.

---

## 14. Decision Matrix

| Query Scope size | Cache Availability | Recommended Location | Query Routing |
| :--- | :--- | :--- | :--- |
| **< 50 items** | Yes (Pinia store) | Client-side memory | Filter array locally inside script |
| **> 100 items** | Yes (IndexedDB) | Client-side database | Query local IDB storage indices |
| **Thousands of items**| No | Remote database API | Paginated debounced query |

---

## 15. Final Rule

All search views must apply input debounces, display explicit loading spinners, utilize clear actions, filter local caches first, and paginate query results lists.
