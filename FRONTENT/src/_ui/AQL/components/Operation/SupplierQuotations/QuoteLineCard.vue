<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section :class="gutterClass">
      <div class="row items-start no-wrap">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
          <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
            {{ line.secondary }}
          </div>
          <div class="text-caption text-grey-7">Requested {{ line.requestedQuantity }} {{ line.uom }}</div>
        </div>
        <div class="col-auto text-body2 text-weight-bold">{{ money(line.TotalPrice) }}</div>
      </div>

      <div class="row q-col-gutter-sm">
        <div class="col-6">
          <FieldNumberEdit
            :model-value="line.Quantity"
            :record="line"
            :config="QTY_CONFIG"
            header="Quantity"
            @update:model-value="(value) => emitUpdate('Quantity', value)"
          />
        </div>
        <div class="col-6">
          <FieldNumberEdit
            :model-value="line.UnitPrice"
            :record="line"
            :config="PRICE_CONFIG"
            header="UnitPrice"
            @update:model-value="(value) => emitUpdate('UnitPrice', value)"
          />
        </div>
      </div>

      <q-expansion-item dense icon="more_horiz" label="Lead time and notes">
        <div :class="gutterClass">
          <FieldNumberEdit
            :model-value="line.LeadTimeDays"
            :record="line"
            :config="LEAD_CONFIG"
            header="LeadTimeDays"
            @update:model-value="(value) => emitUpdate('LeadTimeDays', value)"
          />
          <FieldDateEdit
            :model-value="line.DeliveryDate"
            :record="line"
            :config="DELIVERY_CONFIG"
            header="DeliveryDate"
            @update:model-value="(value) => emitUpdate('DeliveryDate', value)"
          />
          <FieldTextEdit
            :model-value="line.Remarks"
            :record="line"
            :config="REMARKS_CONFIG"
            header="Remarks"
            @update:model-value="(value) => emitUpdate('Remarks', value)"
          />
        </div>
      </q-expansion-item>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldNumberEdit from 'src/_fields/number/Edit.vue'
import FieldDateEdit from 'src/_fields/date/Edit.vue'
import FieldTextEdit from 'src/_fields/text/Edit.vue'
import { useQuotationCaptureContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/useQuotationCaptureContext'

defineOptions({ name: 'SupplierQuotationsQuoteLineCard', inheritAttrs: false })

const QTY_CONFIG = { label: 'Quantity', dense: true }
const PRICE_CONFIG = { label: 'Unit Price', dense: true }
const LEAD_CONFIG = { label: 'Lead time (days)', dense: true }
const DELIVERY_CONFIG = { label: 'Delivery date', dense: true }
const REMARKS_CONFIG = { label: 'Remarks', dense: true }

const props = defineProps({
  line: { type: Object, required: true },
  money: { type: Function, required: true }
})

const emit = defineEmits(['update'])

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui } = useQuotationCaptureContext()

function emitUpdate (field, value) {
  emit('update', { key: props.line.key, field, value })
}
</script>
