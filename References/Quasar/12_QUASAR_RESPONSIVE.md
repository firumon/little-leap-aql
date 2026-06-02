# 12_QUASAR_RESPONSIVE.md - Responsive Design & Adaptive Layouts

This document defines how to implement responsive layouts using Quasar's breakpoint grid system, visibility classes, and the programmatic Screen plugin.

---

## 1. Purpose

The purpose of this guide is to ensure components adapt smoothly across all viewport widths, maintaining focus on mobile ergonomics (95% usage) while scaling to desktop layouts (5% usage) without code redundancy.

---

## 2. Core Philosophy

AQL responsive design is **Mobile-First and Fluid**:
*   **Mobile-First Scaling:** All grid templates start with full-width classes (`col-12`). Desktop column limits (e.g. `col-md-3`) are layered as secondary overrides.
*   **Programmatic Adaptability:** Slices of the DOM that are complex (like tables vs cards) should be conditionally rendered using the Quasar `Screen` plugin in JS setups rather than just hidden with CSS. This reduces DOM footprints on low-spec phones.
*   **Logical Breakpoints:** Use Quasar's default media thresholds:
    *   `xs` (< 600px) - Handsets (95% target)
    *   `sm` (600px - 1019px) - Tablets
    *   `md` (1020px - 1439px) - Laptop/Desktop (5% target)

---

## 3. Golden Rules

1.  **Grid Base is `col-12`:** Never write a layout grid element without declaring a base class mapping (usually `col-12`).
2.  **Toggle with Visibility Classes:** For quick, lightweight display adjustments (e.g. hiding an icon on small screens), use Quasar CSS classes (`gt-xs`, `lt-md`, `gt-sm`).
3.  **Split Trees for Complex Views:** If the mobile view structure is fundamentally different from desktop, run dynamic template switches using `$q.screen.lt.sm` rather than complex CSS overrides.
4.  **No Custom Media Breakpoints:** Never declare custom pixel thresholds in media queries inside CSS blocks. Use Quasar layout variable maps.

---

## 4. CSS Grid & JS Breakpoint Setup

### Default Breakpoints (Quasar Engine)
*   **Extra Small (xs):** 0px to 599px
*   **Small (sm):** 600px to 1019px
*   **Medium (md):** 1020px to 1439px
*   **Large (lg):** 1440px to 1919px
*   **Extra Large (xl):** 1920px+

---

## 5. Best Practices

*   **Avoid CSS Hidden Bloat:** While CSS visibility classes (`gt-xs`, etc.) are efficient, rendering massive tables and then hiding them on mobile via `class="gt-sm"` forces the mobile browser to parse and load elements it will never show.
*   **Coordinate Margins Dynamically:** Use `$q.screen.lt.sm` to adjust spacing properties. On mobile, set spacing to `q-pa-sm`; on desktop, scale it up to `q-pa-lg` dynamically.

---

## 6. Mobile First Rules

*   **Scrollbars Isolation:** Verify that layouts on mobile do not trigger horizontal scrolls. Set column sizing limits to sum to exactly 12 inside every `row`.
*   **Action Drawer collapsing:** Side menus must collapse completely under mobile viewports and toggled via hamburger button click overlays.

---

## 7. Common Patterns

### Responsive Adaptive List View

```html
<!-- FRONTENT/src/components/Operations/OutletResponsiveFeed.vue -->
<template>
  <q-page class="q-pa-md" style="min-height: inherit;">
    <!-- Section Title Block -->
    <div class="row justify-between items-center q-mb-md">
      <h5 class="text-h5 q-my-none text-weight-bold">Outlet Orders</h5>
      <!-- Compact action on mobile, full label on desktop -->
      <q-btn
        v-ripple
        v-if="allowed({ orders: 'create' })"
        color="primary"
        :round="$q.screen.lt.sm"
        :icon="orderIcon"
        :label="$q.screen.gt.xs ? 'New Order' : ''"
      />
    </div>

    <!-- Conditional rendering split: Cards list (mobile) vs Data Grid (desktop) -->
    <template v-if="$q.screen.lt.sm">
      <q-virtual-scroll :items="orders" item-size="80" class="col scroll">
        <template v-slot="{ item }">
          <q-card class="q-mb-sm" flat bordered :key="item.id">
            <q-card-section class="q-pa-sm">
              <div class="row justify-between text-weight-medium">
                <span>#{{ item.code }}</span>
                <span>{{ _C(item.total, true) }}</span>
              </div>
              <div class="text-caption text-grey-7">Date: {{ item.date }}</div>
            </q-card-section>
          </q-card>
        </template>
      </q-virtual-scroll>
    </template>
    
    <template v-else>
      <q-table
        :rows="orders"
        :columns="columns"
        row-key="id"
        flat
        bordered
      />
    </template>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceConfig } from 'src/composables/useResourceConfig'

defineProps({
  orders: { type: Array, required: true },
  columns: { type: Array, required: true }
})

const { _C } = useCurrency()
const { allowed } = useResourceConfig()

const orderIcon = computed(() => {
  return 'add'
})
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlResponsiveGrid`: Grid layout wrapper that automatically calculates children width partitions based on screen properties.
*   `AqlResponsiveAction`: Action button wrapper that switches dynamically between a round FAB button (on mobile) and a text button (on desktop).

---

## 9. Accessibility Notes

*   Never hide essential navigation links on mobile viewports. If they are removed from screen view, they must exist in the navigation drawer panel.
*   Keep tab orders logical when elements wrap inside column blocks.

---

## 10. Dark Mode Notes

*   Ensure that adaptive components use standard theme colors so they shift cleanly.

---

## 11. Performance Notes

*   Do not bind heavy watchers to `$q.screen.width` as it fires continuously on browser resize actions. Bind calculations to boolean flags like `$q.screen.lt.sm`.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using absolute pixel media selectors inside components: `@media(max-width: 599px)`.
    *   *Correction:* Bind to Quasar breakpoints (`$q.screen.lt.sm` or SASS media mixins: `@media (max-width: $breakpoint-xs-max)`).
*   **Anti-Pattern:** Running heavy table scripts on mobile when only hidden by `class="gt-xs"`.
    *   *Correction:* Control execution using `v-if="$q.screen.gt.xs"`.

---

## 13. AI Agent Rules

1.  **Validate Grid Columns:** Ensure that column structures summing to 12 always specify mobile margins first (`col-12`).
2.  **Enforce Dynamic Render Trees:** Reject any code block that hides massive data grids using CSS utility classes (`class="hidden"`) on mobile screens without a `v-if` directive.

---

## 14. Decision Matrix

| User View Requirement | Device Category | DOM Component Design | Render Strategy |
| :--- | :--- | :--- | :--- |
| **Simple details badge** | Handset (<600px) | CSS visible badge tag | `class="gt-xs"` visibility |
| **Invoice layout** | Handset (<600px) | Custom Card list | `v-if="$q.screen.lt.sm"` |
| **Audit Log Table** | Desktop (>1024px) | Full Table element | `v-if="$q.screen.gt.xs"` |
| **Supplier select** | All viewports | Select field overlay | Dynamic dropdown modal |

---

## 15. Final Rule

All layouts must default to mobile-first widths (`col-12`) and use `v-if` with Quasar's `Screen` properties to partition heavy components between mobile and desktop devices.
