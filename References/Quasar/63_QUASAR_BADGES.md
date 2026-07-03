# Quasar Badges (QBadge) Reference Guide

This reference guide describes the implementation and configuration of notification counters, status markers, and inline flags using Quasar's badge component (`QBadge`).

---

## 1. Component Overview

The `QBadge` component is a lightweight visual indicator used to highlight new content, display counters, or flag items. Common use cases include:

*   **Floating Counters**: Positioned relative to a parent container (such as an icon or button) to display outstanding items or alert counts.
*   **Inline Labels / Flags**: Placed alongside text (such as navigation lists or headings) to denote state (e.g., "NEW" or category counts).

---

## 2. Key Attributes & Visual Properties

*   **`floating`**: Positions the badge absolutely at the top-right corner of its parent element. The parent element must have a relative positioning context (such as a button or icon wrapper).
*   **`rounded`**: Adjusts the border-radius to display as a circular badge, useful for single-character or icon indicators.
*   **`outline`**: Configures the badge with a transparent background and a solid border.
*   **`align`**: Vertically aligns the badge relative to surrounding text (e.g., `align="middle"`, `align="top"`, `align="bottom"`).
*   **`color`**: Sets the background color of the badge using Quasar color palette keys (e.g., `primary`, `negative`, `positive`).

---

## 3. Code Examples

### Notification Badge & Inline Flag

The following example shows how to configure a floating badge over an icon button, and an inline badge placed adjacent to text labels:

```html
<template>
  <div class="row items-center q-gutter-x-lg">
    <!-- Icon button with floating notification counter -->
    <q-btn flat round dense icon="notifications" color="grey-8">
      <q-badge
        v-if="pendingCount > 0"
        floating
        color="negative"
        text-color="white"
      >
        {{ formattedCount }}
      </q-badge>
    </q-btn>

    <!-- Inline text tag with rounded badge -->
    <q-btn flat no-caps color="primary" label="Inbox" class="q-px-sm">
      <q-badge
        color="primary"
        align="middle"
        class="q-ml-sm"
      >
        New: {{ formattedCount }}
      </q-badge>
    </q-btn>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pendingCount: { type: Number, default: 0 }
})

const formattedCount = computed(() => {
  return props.pendingCount > 99 ? '99+' : props.pendingCount
})
</script>
```

### Route Tab Integration

Floating badges can be nested inside navigation components like tabs:

```html
<template>
  <q-route-tab to="/operation" label="Orders">
    <!-- Floating badge nested inside route tab -->
    <q-badge
      v-if="ordersCount > 0"
      floating
      color="orange"
      text-color="white"
    >
      {{ ordersCount }}
    </q-badge>
  </q-route-tab>
</template>

<script setup>
defineProps({
  ordersCount: { type: Number, default: 0 }
})
</script>
```

---

## 4. Technical Considerations

*   **Handling Large Numbers**: Truncating high numeric values (e.g., converting values greater than 99 to `'99+'`) helps keep the badge container from expanding excessively and overlapping adjacent content.
*   **Aria Labels**: Screen readers may skip floating badges or read them out of context. Applying an `aria-label` or `aria-describedby` attribute to the parent component describing the badge count ensures proper accessibility mapping.
*   **Background High Contrast**: Selecting colors that stand out from both light and dark backgrounds ensures legibility under varying theme configurations.

