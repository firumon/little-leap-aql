# Quasar Virtual Scroll: Infinite Scrolling & DOM Recycling

This reference document describes how to implement high-performance lists in Quasar using virtual scrolling (`QVirtualScroll`) and infinite scroll utilities (`QInfiniteScroll`) to manage large datasets efficiently.

---

## 1. Overview of Rendering Optimization

When lists contain hundreds or thousands of records, rendering them all as standard DOM nodes can lead to sluggish performance, particularly on mobile devices. Quasar offers two main components to address this issue:
* **QVirtualScroll:** Employs DOM recycling. It renders only a tiny fraction of items that are currently visible within the scroll container's viewport, dynamically swapping item data as the user scrolls.
* **QInfiniteScroll:** Automatically fetches and appends pages of data as the user scrolls down, allowing for progressive loading.

---

## 2. Key Properties & Options

### QVirtualScroll Configuration
* `items`: The source array of data objects.
* `item-size`: The estimated or exact size (height) of a single list item in pixels. Providing this helps stabilize scrollbar tracking and performance.
* `virtual-scroll-slices-size`: The number of items to keep rendered in the DOM slice buffer. A smaller buffer (e.g., 20–30) uses less memory, which is beneficial for mobile devices.

### QInfiniteScroll Configuration
* `offset`: The distance in pixels from the bottom of the container that triggers the loading of the next batch of data.
* `@load`: Event callback invoked when the offset threshold is reached. It passes `(index, done)` arguments where `done()` must be called to signal the loading state is complete. Passing `done(true)` stops further load attempts.

---

## 3. Implementation Examples

### QVirtualScroll Example

Below is a implementation using `QVirtualScroll` with explicit item heights and AQL's currency formatter helper `_C`:

```html
<template>
  <div class="virtual-feed-container column no-wrap" style="height: 400px;">
    <div class="text-subtitle1 text-weight-bold q-pb-sm">Transaction Logs</div>

    <!-- Virtual scroll element with item height constraints -->
    <q-virtual-scroll
      class="col scroll bg-white border-grey-3 rounded-borders"
      :items="transactionLogs"
      :item-size="80"
      virtual-scroll-slices-size="30"
      v-slot="{ item, index }"
    >
      <q-item :key="item.id" clickable v-ripple class="q-py-md">
        <q-item-section avatar>
          <q-avatar color="primary" text-color="white" icon="history" size="md" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">
            Ref: {{ item.reference }}
          </q-item-label>
          <q-item-label caption>
            Index: {{ index }} | Operator: {{ item.operator }}
          </q-item-label>
        </q-item-section>

        <!-- AQL Project Architecture Rule: Formatted output via _C currency helper -->
        <q-item-section side>
          <span class="text-weight-bold text-primary">
            {{ _C(item.amount, true) }}
          </span>
        </q-item-section>
      </q-item>
    </q-virtual-scroll>
  </div>
</template>

<script setup>
import { useCurrency } from 'src/composables/useCurrency'

defineProps({
  transactionLogs: { type: Array, required: true }
})

const { _C } = useCurrency()
</script>
```

---

### QInfiniteScroll Example

The example below shows progressive lazy-loading using the `QInfiniteScroll` component:

```html
<template>
  <q-page class="column no-wrap" style="min-height: inherit;">
    <div class="col scroll">
      <q-infinite-scroll @load="onLoadMore" :offset="250">
        <q-list separator>
          <q-item v-for="item in items" :key="item.id" clickable v-ripple>
            <q-item-section>
              <q-item-label>{{ item.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Loading spinner placeholder -->
        <template v-slot:loading>
          <div class="row justify-center q-my-md">
            <q-spinner-dots color="primary" size="40px" />
          </div>
        </template>
      </q-infinite-scroll>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'

const items = ref([])
const emit = defineEmits(['fetch-page'])

const onLoadMore = async (index, done) => {
  // Emit event to fetch next page dataset from composable
  emit('fetch-page', {
    page: index,
    callback: (newItems) => {
      if (newItems && newItems.length > 0) {
        items.value.push(...newItems)
        done()
      } else {
        done(true) // Stops the infinite scroll loading events
      }
    }
  })
}
</script>
```

---

## 4. Performance Guidelines

* **Shallow Reactivity:** For huge data arrays, utilizing Vue's `shallowRef` instead of `ref` reduces CPU initialization overhead because Vue avoids recursively wrapping nested object properties with reactive proxies.
* **Stable Keys:** Using unique IDs (e.g., `item.id`) rather than array indices for Vue `:key` attributes ensures that components are correctly remapped during DOM recycling.
* **Component Complexity:** Keeping child templates inside virtual loops simple minimizes rendering workloads during fast scrolling.
