# 31_QUASAR_VIRTUAL_SCROLL.md - Infinite Scrolling & DOM Recycling

This document defines how to implement and configure high-performance lists using Quasar's virtual scrolling components (`QVirtualScroll`) and infinite scrolling utilities.

---

## 1. Purpose

The purpose of this guide is to prevent DOM bloating, memory leakage, and mobile browser crashes when rendering large ERP lists (such as ledger histories, inventory stocks, or transaction records).

---

## 2. Core Philosophy

AQL virtual lists are **Recycled and Memory-Efficient**:
*   **DOM Node Recycling:** Instead of rendering thousands of cards in the DOM, we render only the tiny fraction visible in the viewport. Quasar recycles these DOM elements during scrolls.
*   **Explicit Row Heights:** The scrolling container must know the exact height of its child card items to calculate scroll bar tracking ratios without continuous layout recalculations.
*   **Shallow Reactivity:** Large arrays returned from API sync actions are stored using shallow references (`shallowRef`) to avoid deep Vue reactive tracking overhead on nested attributes.

---

## 3. Golden Rules

1.  **Mandatory Item Height:** Always specify the average item height using the `item-size` attribute (e.g., `:item-size="90"`).
2.  **Explicit Container Height:** Virtual scroll blocks must lock to a height container, either using viewport styling (`class="col scroll"` inside flex) or declaring an inline height parameter.
3.  **Prohibit Nested Virtual Scrolls:** Never nest scroll components. Keep list layers flat and clean.
4.  **Use Dynamic Slices Size:** Scale virtual scroll buffers (`virtual-scroll-slices-size`) down to mobile settings (typically 20-30 items) to conserve memory.

---

## 4. QVirtualScroll Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletVirtualOrderFeed.vue -->
<template>
  <div class="virtual-feed-container column no-wrap" style="height: 400px;">
    <!-- Headings section -->
    <div class="text-subtitle1 text-weight-bold q-pb-sm">Transaction Logs</div>

    <!-- Virtual scroll container locking heights -->
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
import { shallowRef } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'

const props = defineProps({
  transactionLogs: { type: Array, required: true } // Managed as shallowRef in parent
})

const { _C } = useCurrency()
</script>
```

---

## 5. Best Practices

*   **Shallow State Management:** Declare massive list arrays in Pinia or composables as `shallowRef`. This blocks Vue from recursively iterating over nested JSON nodes, saving initialization time:
    `const transactions = shallowRef([])`
*   **Recycling Key Safety:** Never bind the `:key` attribute to array indices. Always bind to unique row identifiers (`item.id`).

---

## 6. Mobile First Rules

*   **Virtual Slice Thresholds:** Set small slice buffer ranges. A buffer size of `30` matches typical mobile rendering windows, providing smooth scrolls without lag.
*   **Touch Friction Tuning:** Ensure list card content lacks heavy visual filters (like CSS blur effects) that slow GPU paint operations during rapid scrolling.

---

## 7. Common Patterns

### Infinite Scroll Loader Pattern

```html
<!-- FRONTENT/src/components/Operations/OutletInfiniteLoader.vue -->
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

## 8. Reusable Component Suggestions

*   `AqlInfiniteScroll`: Standardized scrolling wrapper that integrates page loader loops, tracks network failures, and exposes clean retry options.

---

## 9. Accessibility Notes

*   Verify screen readers announce active scroll updates when infinite loader loops mount.
*   Ensure scroll actions are keyboard-accessible.

---

## 10. Dark Mode Notes

*   Ensure list scroll gutters use variable backgrounds so theme boundaries stay consistent.

---

## 11. Performance Notes

*   **Limit Child DOM Complexity:** Keep item card structures light. Heavy templates inside scroll nodes degrade rendering speeds.
*   **Reuse Image Avatars:** Do not dynamically scale avatars inside list loops.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Mounting a 500-item card loop via `v-for` inside a scroll page on mobile viewports.
    *   *Correction:* Replace with `QVirtualScroll` or paginated `QInfiniteScroll` layouts.
*   **Anti-Pattern:** Omitting the `item-size` property on virtual scroll views.
    *   *Correction:* Always define item dimensions to stabilize scroll positioning.

---

## 13. AI Agent Rules

1.  **Enforce Virtual Scrolling:** Reject any list layout representing database entities that loops records without paging limits or virtual scrolls.
2.  **Confirm Shallow Refs:** Confirm that large array payloads inside composables are declared using `shallowRef`.

---

## 14. Decision Matrix

| Dataset Row Volume | Data Fetch Method | Recommended Component | Optimizations |
| :--- | :--- | :--- | :--- |
| **< 15 items** | Loaded upfront | Standard `QList` card loop | Default `v-for` keys |
| **15 to 100 items** | Local memory cache | `QVirtualScroll` | Define `:item-size` |
| **100+ items** | Paginated API | `QInfiniteScroll` | Debounced loader actions |
| **Complex grids** | Dynamic reports | `QVirtualScroll` (Table) | ShallowRef row arrays |

---

## 15. Final Rule

All long records lists must implement element recycling using `QVirtualScroll` or infinite loaders, define fixed layout item heights, utilize shallow reactive arrays, and constrain outer wrapper heights.
