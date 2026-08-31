<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Delivery and dates</div>
        <FieldDateEdit
          :model-value="form.PODate"
          :record="form"
          :config="PO_DATE_CONFIG"
          header="PODate"
          @update:model-value="(value) => setFormField('PODate', value)"
        />
        <FieldSelectEdit
          :model-value="form.ShipToWarehouseCode"
          :record="form"
          :config="warehouseConfig"
          header="ShipToWarehouseCode"
          @update:model-value="(value) => setFormField('ShipToWarehouseCode', value)"
        />
        <FieldTextareaEdit
          :model-value="form.Remarks"
          :record="form"
          :config="REMARKS_CONFIG"
          header="Remarks"
          @update:model-value="(value) => setFormField('Remarks', value)"
        />
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Extra charges</div>
        <div class="row q-col-gutter-sm">
          <div v-for="key in chargeKeys" :key="key" :class="binColumnClass">
            <FieldNumberEdit
              :model-value="charges[key]"
              :record="form"
              :config="chargeConfig(key)"
              :header="key"
              @update:model-value="(value) => setCharge(key, value)"
            />
          </div>
        </div>

        <q-separator />

        <div class="row items-center justify-between">
          <span class="text-subtitle2 text-weight-bold">
            Total
            <span v-if="totals.charges" class="text-caption text-grey-7 q-ml-xs">
              ({{ money(totals.subtotal) }} + {{ money(totals.charges) }})
            </span>
          </span>
          <span class="text-subtitle1 text-weight-bold">{{ money(totals.total) }}</span>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="closeRfqOffered" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">Close the source RFQ</div>
            <div class="text-caption text-grey-8">
              This order covers every quoted line, so the RFQ has nothing left to collect.
            </div>
          </div>
          <div class="col-auto">
            <q-toggle :model-value="closeRfq" color="primary" @update:model-value="setCloseRfq" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Lines being ordered</div>
        <div v-if="!selectedLines.length" class="text-center q-py-lg">
          <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing selected</div>
          <div :class="ui.emptyCaptionClass">Go back and pick the lines this order covers.</div>
        </div>
        <div v-else :class="ui.detailGridClass">
          <div v-for="line in selectedLines" :key="line.key" class="items-center" :class="ui.detailLineClass">
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">{{ line.primary }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.OrderedQuantity }} {{ line.UOM }} · {{ money(line.lineTotal) }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldDateEdit from 'src/_fields/date/Edit.vue'
import FieldNumberEdit from 'src/_fields/number/Edit.vue'
import FieldSelectEdit from 'src/_fields/select/Edit.vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { usePurchaseOrderAddContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/Add/usePurchaseOrderAddContext'

defineOptions({ name: 'PurchaseOrdersAddOrderReview', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const PO_DATE_CONFIG = { label: 'PO Date' }
const REMARKS_CONFIG = { label: 'Remarks' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  form,
  setFormField,
  setCharge,
  chargeKeys,
  chargeLabel,
  warehouseOptions,
  totals,
  money,
  selectedLines,
  closeRfqOffered,
  closeRfq,
  setCloseRfq,
  currentStep
} = usePurchaseOrderAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
const charges = computed(() => form.value.ExtraChargesBreakup || {})
const warehouseConfig = computed(() => ({ label: 'Ship To Warehouse', options: warehouseOptions.value }))

// 1 -> col-12, 2 or 4 -> col-6, 3 or 5+ -> col-4, so the last row is never a stub.
const binColumnClass = computed(() => {
  const count = chargeKeys.length
  if (count <= 1) return 'col-12'
  if (count === 2 || count === 4) return 'col-6'
  return 'col-4'
})

function chargeConfig (key) {
  return { label: chargeLabel(key), dense: true }
}
</script>
