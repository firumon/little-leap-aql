# 63_QUASAR_BADGES.md - Notification Badges & Visual Counters

This document defines how to implement and configure notification counters and status markers using Quasar's badge component (`QBadge`).

---

## 1. Purpose

The purpose of this guide is to explain badge positioning parameters, detail floating badge overlays, and standardize badge text alignments.

---

## 2. Core Philosophy

AQL badges are **Floating, Numeric-Only, and High-Contrast**:
*   **Floating Counters:** Badges serve as overlays on buttons or icons (like navigation items) to display dynamic counts (e.g. pending alerts or cart quantities).
*   **Minimalist Lengths:** Badge labels must be extremely short. Avoid placing text descriptors inside badges. Use numeric values or a single warning symbol.
*   **Overage Management:** High counts (exceeding 99) are represented using truncated formatting (e.g. `99+`) to prevent size overflow.

---

## 3. Golden Rules

1.  **Strict Floating Alignment:** Nest badges directly inside buttons or icons and apply the `floating` attribute: `<q-badge floating color="red">`.
2.  **Ensure Overage Truncations:** Numeric counts must be formatted to prevent container stretches: `count > 99 ? '99+' : count`.
3.  **No Arbitrary Accent Colors:** Use standard color variables mapping. Success uses `positive` green, alert counters use `negative` red.
4.  **Keep Borders Transparent:** Floating badges must clear parent margins. Do not declare custom CSS borders that clip boundaries.

---

## 4. QBadge Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Navigation/OutletAlertBadge.vue -->
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

---

## 5. Best Practices

*   **Align Properties:** Use the `align` attribute (e.g. `align="top"`, `align="middle"`) to match text offsets when badges are displayed inline next to text.
*   **Rounded Borders:** For single-digit counters, apply the `rounded` attribute to make the badge circular.

---

## 6. Mobile First Rules

*   **Avoid Badge Overlapping:** Verify that floating badges do not cover the icon's primary shape. Use standard sizes (`size="xs"` properties are not needed as default sizes fit mobile buttons).
*   **Keep Alerts Visible:** Floating indicators must clear surrounding buttons by using standard gutters (`q-mr-md`).

---

## 7. Common Patterns

### Responsive Route Tab Badge Pattern

Add dynamic notification badges to navigation route tabs:

```html
<!-- FRONTENT/src/layouts/NavigationRouteBadge.vue -->
<template>
  <q-route-tab to="/operations" label="Orders">
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

## 8. Reusable Component Suggestions

*   `AqlBadgeBtn`: Custom icon button wrapping a dynamic floating counter, complete with visibility logic filters.

---

## 9. Accessibility Notes

*   Verify screen readers announce badge totals. Add structural attributes (`aria-label="3 pending notifications"`) on parent nodes.

---

## 10. Dark Mode Notes

*   Ensure background colors maintain high contrast limits (`color="negative"` or `color="warning"`) to remain readable against dark card panels.

---

## 11. Performance Notes

*   Avoid linking complex array filters directly inside badge render expressions. Pre-compile counts in script setups.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting long description strings inside badges: `<q-badge>AQL Update Pending</q-badge>`.
    *   *Correction:* Replace badge with `QChip` or inline captions.
*   **Anti-Pattern:** Writing custom CSS absolute position values (`top: -5px; right: -5px`) to overlay badges on icons.
    *   *Correction:* Apply Quasar's native `floating` prop.

---

## 13. AI Agent Rules

1.  **Validate Floating Settings:** Ensure all button-overlay badges declare the `floating` attribute.
2.  **Confirm Truncation Calculations:** Reject counts lists lacking overage format limits.

---

## 14. Decision Matrix

| Badge Label Type | Visual Scope | Primary Alignment | Layout Strategy |
| :--- | :--- | :--- | :--- |
| **Pending notifications**| Numeric Count | Floating overlay | Nested inside icon button |
| **New features flag** | Text (e.g. `NEW`) | Middle alignment | Inline next to list item labels |
| **Category Count** | Static number | Right aligned list | Side item section placement |

---

## 15. Final Rule

All notification indicators must use absolute floating structures when nested in buttons, enforce numeric limits, and map alert colors to standard transaction states.
