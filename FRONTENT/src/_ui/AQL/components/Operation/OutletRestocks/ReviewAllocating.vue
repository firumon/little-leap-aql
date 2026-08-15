<template>
  <div v-if="visible" :class="gutterClass">
    <!-- What is about to move. Always open and first: this is the list the
         approver is signing off on, and every line here becomes a negative stock
         movement the moment Approve is pressed. -->
    <SectionDividerLabel label="Moving to Allocated" />

    <AqlGroupedList
      :items="lines"
      item-key="key"
      group-key="productCode"
      header-label="productName"
      empty-text="No stock has been allocated yet."
      empty-icon="inventory_2"
      :card-class="ui.cardClass"
      :layout="['caption','label']"
      :content="[(item) => `${item.warehouseName}: ${item.storageName}`,(item) => item.skuLabel]"
      :chip="item => `${ item.quantity } ${ item.uom }`"
      meta-color="positive"
    >
      <!-- Product total on the right in plain, slightly larger text — a chip here
           reads as a status badge rather than the figure it actually is. -->
      <template #header-right="{ group }">
        <div class="text-subtitle1 text-weight-bold text-positive q-px-md">{{ groupTotal(group) }} {{ group.items[0]?.uom }}</div>
      </template>
    </AqlGroupedList>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="row no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-caption text-grey-7">Total allocated</div>
          <div class="text-body1">
            <div class="text-h6 text-weight-bold text-positive">{{ totalAllocated }} {{ allocatedUom }}</div>
            <div class="text-caption text-grey-6">{{ itemCount }} Item{{ itemCount === 1 ? '' : 's' }} · {{ binCount }} Location{{ binCount === 1 ? '' : 's' }}</div>
          </div>
        </div>

        <!-- The warehouses actually DRAWN FROM, not the ones that were selected
             while deciding — this states what the batch will touch. -->
        <div class="col-auto text-right" :class="ui.flexWrapTextClass">
          <div class="text-caption text-grey-7">Warehouses included</div>
          <div
            v-for="warehouse in allocatedWarehouses"
            :key="warehouse.code"
            class="text-body2 text-weight-medium"
          >
            {{ warehouse.name }}
          </div>
          <div v-if="!allocatedWarehouses.length" class="text-body2 text-grey-6">—</div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 2a of the restock approval: what is being committed.
 *
 * Read-only throughout. It reuses `useRestockApproval`'s projection rather than
 * recomputing anything, so the numbers here are the same arithmetic step 1
 * showed and cannot drift from what `Approve/PageAction.js` submits.
 *
 * Grouped by PRODUCT rather than by warehouse: the approver is confirming a
 * decision made per product, and regrouping by location would scatter a single
 * product's split across the page.
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import { useRestockApproval } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApproval'
import { useRestockApprovalContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApprovalContext'

defineOptions({ name: 'OutletRestocksApproveReviewAllocating', inheritAttrs: false })

const props = defineProps({
  step: { type: Number, default: 2 }
})

const attrs = useAttrs()
const { pageState, ui } = useRestockApprovalContext()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || ui.gutterFallback || 'sm'}`)

const { allocatingRows, totalAllocated, allocatedWarehouses, allocatedUom } = useRestockApproval()

const visible = computed(() => pageState?.meta.currentStep === props.step)

// Flattened to one entry per (SKU, bin) so `AqlGroupedList` can group them back
// under the product — one row per physical movement, which is what is actually
// being approved.
const lines = computed(() => allocatingRows.value.flatMap((row) =>
  row.lines.map((line) => ({
    key: `${row.code}:${line.key}`,
    productCode: row.productCode,
    productName: row.productName,
    skuLabel: row.variantLabel,
    uom: row.uom,
    warehouseName: line.warehouseName,
    warehouseCode: line.warehouseCode,
    storageName: line.storageName,
    quantity: line.quantity
  }))
))

function groupTotal (group) {
  return (group?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

const itemCount = computed(() => allocatingRows.value.length)
const binCount = computed(() => new Set(lines.value.map((line) => `${line.warehouseCode}|${line.storageName}`)).size)
</script>
