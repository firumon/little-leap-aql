# Quasar Tables: Data Tables & Grid Adaptations

This reference document describes how to implement and configure data grids using Quasar's `QTable` component, detailing slot customisation, mobile-responsive grid modes, and pagination.

---

## 1. Overview of QTable

The `QTable` component is designed to render tabular datasets. It supports custom headers, cell templates, client or server-side sorting/filtering, and automatic layout transformation.

### Key Capabilities
* **Adaptive Grid Layouts:** When the `grid` property is active, `QTable` converts rows into stacked cards, which is useful on smaller screens or touch devices where horizontal table scrolling is less ideal.
* **Custom Cell Injection:** Developers can target specific columns using dynamic slot names (e.g. `body-cell-[colName]`) to render custom elements like chips, buttons, and status tags.
* **Pagination & Sorting:** Built-in controls manage current page offsets, page limits, and sort keys.

---

## 2. Key Properties & Slots

### Props
* `columns`: An array of column configuration objects defining header titles, alignment, sorting behavior, and target row properties.
* `rows`: An array of data objects representing table rows.
* `row-key`: A string designating the unique ID property of each row (e.g., `'id'`).
* `grid`: A boolean that shifts the table layout from rows to stacked card modules.
* `pagination`: A reactive object controlling sorting column, descending order, current page, and records per page.

### Columns Schema Options
* `name`: Unique column identifier used for targeting body cell slots.
* `field`: The key in the row object containing the cell's raw data.
* `align`: Column alignment (`'left'`, `'center'`, or `'right'`).
* `sortable`: Boolean indicating if the column supports sorting.

---

## 3. Implementation Example

The example below shows a `QTable` configuration utilizing responsive grid attributes, custom status cell slots, and permission-gated action buttons.

```html
<template>
  <div class="supplier-table-container">
    <!-- Table adapting to grid layout on small screens -->
    <q-table
      :rows="suppliers"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :grid="$q.screen.lt.sm"
      :pagination="pagination"
    >
      <!-- Custom rendering for status column -->
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

      <!-- Custom actions column with permission gating -->
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

// AQL Project Architecture Rule: Verify operations using permission helpers
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

## 4. Customizing Mobile Grid Formats

When `grid` mode is active, default table structures are replaced by cards. Developers can customize this layout using the `item` slot:

```html
<template>
  <q-table
    :rows="records"
    :columns="columns"
    grid
    row-key="id"
    flat
    bordered
  >
    <!-- Card layout overlay replacing standard row display -->
    <template v-slot:item="props">
      <div class="q-pa-xs col-xs-12 col-sm-6">
        <q-card flat bordered class="q-pa-md">
          <div class="row justify-between items-center text-weight-bold">
            <span>{{ props.row.code }}</span>
            <!-- AQL Project Architecture Rule: Render currency using _C helper -->
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

## 5. Performance and Architecture Guidelines

* **Avoid QTable on Mobile Viewports:** Since large multi-column tables are difficult to parse on narrow screens, AQL layout rules prefer card list loops (`v-for`) or using the table's `grid` attribute to display data as stacked cards.
* **Server-side Queries:** For database tables containing larger record counts, fetching data dynamically via server-side pagination (using the `@request` event handler) reduces client memory consumption.
* **Limiting Row Complexity:** Keeping item counts per page bounded (e.g., between 10 to 15 items per page) avoids inflating the DOM node count, maintaining smoother rendering transitions.
