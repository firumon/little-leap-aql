<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!purchaseOrder" class="text-center q-py-lg">
        <q-icon name="receipt_long" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No purchase order</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Progress</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </span>
          </div>

          <div
            v-for="(line, index) in facts"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>

        <q-banner v-if="cancelled" dense rounded class="bg-grey-2 q-mt-sm text-caption">
          {{ purchaseOrder.ProgressCancelledComment || 'This purchase order was cancelled.' }}
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { usePurchaseOrderView } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/View/usePurchaseOrderView'
import { usePurchaseOrderViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/View/usePurchaseOrderViewContext'

defineOptions({ name: 'PurchaseOrdersViewPurchaseOrderHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Purchase Order Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = usePurchaseOrderViewContext()
const {
  purchaseOrder,
  pending,
  supplierName,
  warehouseName,
  cancelled,
  money,
  totals,
  progressColor,
  progressIcon,
  progressLabel
} = usePurchaseOrderView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(purchaseOrder.value?.Progress))
const statusIcon = computed(() => progressIcon(purchaseOrder.value?.Progress))
const statusLabel = computed(() => progressLabel(purchaseOrder.value?.Progress))

const facts = computed(() => {
  const record = purchaseOrder.value
  if (!record) return []
  return [
    { label: 'Supplier', value: supplierName.value },
    { label: 'PO Date', value: record.PODate },
    { label: 'Ship To', value: warehouseName.value },
    { label: 'Order Value', value: money(totals.value.total) },
    { label: 'Quotation', value: record.SupplierQuotationCode },
    { label: 'Procurement', value: record.ProcurementCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
