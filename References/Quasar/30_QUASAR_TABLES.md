# 30_QUASAR_TABLES.md - Data Tables & Desktop Portals

This document defines how to implement and configure data tables using Quasar's table component (`QTable`) while enforcing strict mobile-first design constraints.

---

## 1. Purpose

The purpose of this guide is to restrict the usage of heavy data tables on mobile devices (95% usage), define slot configurations, map grid fallbacks, and design efficient tables for desktop portals (5% usage).

---

## 2. Core Philosophy

AQL tables are **Desktop-Restricted and Grid-Adaptive**:
*   **Desktop-Only Default:** Large multi-column tables are prohibited on mobile. Tables are reserved strictly for desktop portals, larger administration consoles, or reporting views.
*   **Grid Fallback Mode:** If a table layout is required to render on mobile viewports, it must define the `grid` property to transform rows into stacked cards automatically.
*   **Slot Customization:** We avoid plain text values in status or category columns. We customize column rendering using cell slots (`body-cell-[name]`) to map tags, buttons, and badges cleanly.

---

## 3. Golden Rules

1.  **Strict Mobile Fallback:** Never implement a raw `<q-table>` without a corresponding `<template v-if="$q.screen.lt.sm">` card loop or adding the `grid` prop.
2.  **Limit DOM Row Counts:** Always enforce pagination and limit initial page rows to a maximum of 15 records (`:pagination="{ rowsPerPage: 15 }"`) to reduce CPU overhead.
3.  **Prohibit Nested Templates inside Loops:** Avoid calling complex rendering logic or heavy computations inside body cells. Pre-format row properties in composables.
4.  **No Inline CSS Calculations:** Table grid dimensions must rely on native column widths, and cell templates must align via Quasar typography helpers.

---

## 4. QTable Configuration & Custom Cell Slots

```html
<!-- FRONTENT/src/components/Admin/SupplierPortalTable.vue -->
<template>
  <div class="supplier-table-container">
    <!-- Main data table mapping with grid fallback on mobile -->
    <q-table
      :rows="suppliers"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :grid="$q.screen.lt.sm"
      :pagination="pagination"
    >
      <!-- Customizing a status column slot -->
      <template v-slot:body-cell-status="props">
        <q-td :props="props">
          <q-chip
            :color="props.value === 'Active' ? 'positive' : 'negative'"
            text-color="white"
            dense
            size="sm"
          >
            {{ props.value }}
          </q-chip>
        </q-td>
      </template>

      <!-- Customizing actions column slot -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props" class="q-gutter-x-xs">
          <q-btn
            v-if="allowed({ suppliers: 'update' })"
            v-ripple
            size="sm"
            flat
            round
            color="primary"
            icon="edit"
            @click="emit('edit', props.row.id)"
          />
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'

defineProps({
  suppliers: { type: Array, required: true }
})
const emit = defineEmits(['edit'])

const { allowed } = useResourceConfig()

const pagination = ref({
  sortBy: 'desc',
  descending: false,
  page: 1,
  rowsPerPage: 15
})

const columns = [
  { name: 'name', align: 'left', label: 'Company Name', field: 'companyName', sortable: true },
  { name: 'code', align: 'left', label: 'Supplier Code', field: 'code', sortable: true },
  { name: 'status', align: 'center', label: 'Status', field: 'status', sortable: true },
  { name: 'actions', align: 'center', label: 'Actions', field: 'actions' }
]
</script>
```

---

## 5. Best Practices

*   **Server-side Pagination:** For tables querying databases with thousands of rows, configure server-side pagination and filter triggers using `@request` methods, rather than loading all rows into local memory.
*   **Virtual Table Rows:** For dense financial reporting tables, swap standard rendering for `QVirtualScroll` tables to support smooth scrolling.

---

## 6. Mobile First Rules

*   **Responsive Column Drops:** Avoid horizontal scrolling. When utilizing grid fallbacks, define options displaying only 3 or 4 essential columns, hiding secondary data.
*   **Card Styling:** When `grid` matches, customize details styling templates using `item` slots to layout stacked text cards nicely.

---

## 7. Common Patterns

### Grid Item Slot Customization

```html
<!-- FRONTENT/src/components/Operations/OutletGridFallback.vue -->
<template>
  <q-table
    :rows="records"
    :columns="columns"
    grid
    row-key="id"
    flat
    bordered
  >
    <!-- Custom card display for grid mode -->
    <template v-slot:item="props">
      <div class="q-pa-xs col-xs-12 col-sm-6">
        <q-card flat bordered class="q-pa-md">
          <div class="row justify-between items-center text-weight-bold">
            <span>{{ props.row.code }}</span>
            <span class="text-primary">{{ _C(props.row.total, true) }}</span>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            Client: {{ props.row.clientName }}
          </div>
        </q-card>
      </div>
    </template>
  </q-table>
</template>

<script setup>
import { useCurrency } from 'src/composables/useCurrency'

defineProps({
  records: { type: Array, required: true },
  columns: { type: Array, required: true }
})

const { _C } = useCurrency()
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlTable`: Reusable data grid that coordinates server-side filters, handles error states, and toggles mobile card loops automatically.

---

## 9. Accessibility Notes

*   Ensure that headers use semantic tables structures (`thead`, `tbody`, `tr`, `th`, `td`) so screen reader navigation is coherent.

---

## 10. Dark Mode Notes

*   Avoid setting hardcoded border styling rules. Rely on Quasar SASS variable mappings to adjust dividers.

---

## 11. Performance Notes

*   Do not bind deep computed operations or array filters inside table cells as cell rendering loops execute continuously during parent re-renders.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Forcing users to scroll horizontally on mobile screens to read 8 columns in a raw table.
    *   *Correction:* Force the `grid` prop on mobile viewports.
*   **Anti-Pattern:** Querying database sets of 500 rows and loading them into table states without pagination limits.
    *   *Correction:* Enforce server-side filters and paging.

---

## 13. AI Agent Rules

1.  **Confirm Grid Breakpoints:** Verify all table codes integrate the `:grid` layout responsive configuration key.
2.  **Verify Row Limits:** Reject any code that defines default table lists without configuring maximum page counts.

---

## 14. Decision Matrix

| Target Screen Width | Data Row Count | Recommended Layout | Configuration |
| :--- | :--- | :--- | :--- |
| **Mobile (<600px)** | < 15 items | Stacked Card Loop | `v-if` with basic cards |
| **Mobile (<600px)** | > 20 items | Adaptive Grid Table | `QTable` with `grid` prop |
| **Desktop (>1024px)**| < 50 items | Standard Data Table | Outlined table with paging |
| **Desktop (>1024px)**| > 100 items | Server-Paged Grid | Async paginated query |

---

## 15. Final Rule

All data tables must be dense and flat, apply grid configurations dynamically on mobile screens to convert rows into stacked cards, limit pagination outputs, and map cell values via slots.
