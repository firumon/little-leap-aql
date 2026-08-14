<template>
  <div v-if="pageState?.meta.currentStep === 3" :class="gutterClass">
    <!-- Section 1 — the actual request. Always open, because this is the list the
         user is signing off on; nothing here is optional reading. Restock
         quantities only: mixing in current stock invites misreading the request
         as larger than it is. -->
    <SectionDividerLabel label="Items Being Restocked" />

    <AqlGroupedList
      :items="restockingRows"
      item-key="SKU"
      group-key="productCode"
      header-label="productName"
      empty-text="No items requested yet."
      empty-icon="production_quantity_limits"
      card-class="aql-premium-card aql-card-gradient-subtle q-mb-sm"
      label="variantLabel"
      :header-chip="(group) => `${groupTotal(group, 'restockQuantity')}`"
      header-chip-color="primary"
      metaLabel="restockQuantity"
    />

    <!-- Section 2 — the consequence of the request, one level removed. Collapsed
         by default: it is a confirmation aid, not a second thing to approve.
         Scope is wider than section 1 on purpose — every SKU the outlet will hold
         afterwards, including untouched lines, so the projection reads as a
         stock sheet rather than a repeat of the order. -->
    <SectionDividerLabel label="Projected Outlet Inventory" />

    <q-card class="aql-premium-card" flat>
      <q-card-section class="q-px-sm">
        <q-expansion-item
          icon="inventory_2"
          label="Projected stock after this restock"
          :caption="`${projectedRows.length} SKU${projectedRows.length === 1 ? '' : 's'} in stock afterwards`"
          header-class="text-weight-medium"
          :default-opened="false"
        >
          <q-separator spaced class="q-pb-xs" color="transparent" />

            <AqlGroupedList
              :items="projectedRows"
              item-key="SKU"
              group-key="productCode"
              header-label="productName"
              empty-text="This outlet will hold no stock."
              card-class="q-mb-sm"
              label="variantLabel"
              :caption="(item) => `Existing ${item.outletQuantity} + Restocking ${item.restockQuantity}`"
              :metaLabel="(item) => String(item.finalQuantity)"
            >
              <template #header-right="{ group }">
                <span class="text-h6 text-weight-bold q-px-sm text-primary">{{ groupTotal(group, 'finalQuantity') }}</span>
              </template>
            </AqlGroupedList>

        </q-expansion-item>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 3a of the restock wizard: what is about to be submitted.
 *
 * Read-only throughout — it reuses `useRestockStockMatch`'s aggregate rather than
 * recomputing quantities, so the numbers here are the same arithmetic step 2
 * showed and cannot drift from it.
 *
 * Two lists, deliberately different in scope:
 *   1. Items Being Restocked — only `restockQuantity > 0`, restock figures only.
 *      This is the request itself, so it is always visible.
 *   2. Projected Outlet Inventory — every line the outlet will hold afterwards
 *      (`outletQuantity + restockQuantity > 0`), showing existing + restocking =
 *      final. A consequence of the request, so it is collapsed by default.
 *
 * Submission itself belongs to the sticky bar (`Add/PageAction.js`); a content
 * card never submits on its own or it would double-fire against the dispatcher.
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import { useRestockStockMatch } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockStockMatch'
import { useRestockAddContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Add/useRestockAddContext'

defineOptions({ name: 'OutletRestocksReview', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — UI_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, resource } = useRestockAddContext()
const outlets = resource('Outlets')
const warehouses = resource('Warehouses')
const { rows: allRows, isDirect, warehouseCode } = useRestockStockMatch()
const parent = pageState.useNode('OutletRestocks')

// Section 1 + the summary counts: strictly what the user asked for.
const restockingRows = computed(() => allRows.value.filter((row) => row.restockQuantity > 0))
const totalItems = computed(() => restockingRows.value.length)
const totalUnits = computed(() => restockingRows.value.reduce((sum, row) => sum + row.restockQuantity, 0))

// Section 2: everything the outlet ends up holding — untouched lines included,
// zero-balance lines excluded so the projection is not padded with SKUs the
// outlet neither stocks nor is receiving.
const projectedRows = computed(() => allRows.value.filter((row) => row.outletQuantity + row.restockQuantity > 0))

const outletName = computed(() => {
  const code = parent.record.value.OutletCode
  return outlets.items.value.find((row) => row.Code === code)?.Name || code || '—'
})
const warehouseName = computed(() => {
  const code = warehouseCode.value
  return warehouses.items.value.find((row) => row.Code === code)?.Name || code || '—'
})

function groupTotal (group, key) {
  return (group?.items || []).reduce((sum, row) => sum + Number(row[key] || 0), 0)
}
</script>
