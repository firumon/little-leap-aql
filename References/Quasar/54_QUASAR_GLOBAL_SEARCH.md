# 54_QUASAR_GLOBAL_SEARCH.md - Instant Search & Filter Overlays

This document is an educational reference guide covering the design, configuration, and optimization of search and query filtering components in Quasar.

---

## 1. Concept Overview

Search interfaces enable users to quickly locate specific records (such as SKU items, orders, or accounts) from local datasets or remote databases. Effective search configurations balance user responsiveness with server efficiency by employing input debouncing, showing loading feedback, utilizing local caches, and paginating remote query results.

---

## 2. Key Components & Features

*   **`QInput`**: The foundational text input component, often customized with prefix icons (e.g. `search`) and loading indicators.
*   **`debounce`**: A utility function (available in Quasar or via lodash) that delays invoking a search handler until a specified period of inactivity has elapsed.
*   **`clearable`**: A property on `QInput` that automatically appends an icon button to clear the input field, which helps users reset their search queries quickly.
*   **`loading`**: A boolean property on `QInput` that replaces the append/prepend icon with a progress spinner to signal an active query.

---

## 3. Usage Examples

### Debounced Search Input Component

This component handles text input, debounces search requests by 300ms, renders a loading spinner during API requests, and formats currency using the AQL architectural currency helper (`_C`).

```html
<template>
  <div class="search-overlay column no-wrap">
    <!-- Debounced search input -->
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

    <!-- Search Results List -->
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
            <!-- Currency utility formatting -->
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

// Debounce query submissions by 300ms to reduce backend load
const onSearchInput = debounce(async (val) => {
  if (!val) {
    results.value = []
    return
  }
  await triggerSearch(val)
}, 300)
</script>
```

### Paginated Search Composable

This composable manages the asynchronous search state and makes requests to the database store.

```javascript
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

## 4. Performance & Usability Guidelines

*   **Keystroke Debouncing**: Wiring search requests to fire immediately on every keystroke can lead to high server load and UI stuttering on low-powered mobile devices. A debounce delay (such as 300ms) minimizes unnecessary requests.
*   **Local Filtering vs. Remote Querying**: For smaller datasets (typically under 100 items), filtering in-memory arrays (e.g. from Pinia stores) locally is faster and avoids network latency. Larger catalog queries are generally routed to remote endpoints with pagination.
*   **Finally Block State Cleanup**: Wrapping active search states in a `finally` block ensures that loading indicators disappear even if a network request fails or times out.
*   **Virtual Scrolling**: For high-volume search results, using `QVirtualScroll` or virtual listing structures keeps the DOM count low, which maintains rendering responsiveness.
