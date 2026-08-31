<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">What will be sent</div>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in summary"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Items</div>
        <div v-if="!selectedItems.length" class="text-center q-py-lg">
          <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing selected</div>
          <div :class="ui.emptyCaptionClass">Go back and pick the lines this RFQ should cover.</div>
        </div>
        <div v-else :class="ui.detailGridClass">
          <div
            v-for="item in selectedItems"
            :key="item.code"
            class="items-center"
            :class="ui.detailLineClass"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">{{ item.primary }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ item.quantity }} {{ item.uom }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-expansion-item
      v-if="terms.length"
      dense
      icon="tune"
      label="Commercial terms"
      :caption="`${terms.length} terms set`"
    >
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div :class="ui.detailGridClass">
            <div v-for="line in terms" :key="line.label" class="items-center" :class="ui.detailLineClass">
              <span :class="ui.detailKeyClass">{{ line.label }}</span>
              <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddReviewRFQ', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  form,
  requisition,
  selectedItems,
  selectedSupplierCodes,
  totals,
  currentStep,
  termLabel
} = useRFQAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

const summary = computed(() => [
  { label: 'Requisition', value: requisition.value?.Code || '—' },
  { label: 'Items', value: `${totals.value.lines} lines · ${totals.value.quantity} units` },
  { label: 'Suppliers', value: selectedSupplierCodes.value.length || 'None yet' },
  { label: 'RFQ Date', value: form.value.RFQDate },
  { label: 'Deadline', value: form.value.SubmissionDeadline }
].filter((line) => String(line.value ?? '').trim()))

const terms = computed(() => [
  { label: 'Lead Time', value: `${form.value.LeadTimeDays} days · ${termLabel(form.value.LeadTimeType)}` },
  { label: 'Validity', value: `${form.value.QuotationValidityDays} days · ${termLabel(form.value.QuotationValidityMode)}` },
  { label: 'Shipping', value: `${termLabel(form.value.ShippingTermMode)}${form.value.ShippingTerm ? ` · ${termLabel(form.value.ShippingTerm)}` : ''}` },
  { label: 'Payment', value: `${termLabel(form.value.PaymentTermMode)}${form.value.PaymentTerm ? ` · ${termLabel(form.value.PaymentTerm)}` : ''}` },
  { label: 'Delivery', value: termLabel(form.value.DeliveryMode) },
  { label: 'Partial Delivery', value: form.value.AllowPartialDelivery ? 'Yes' : 'No' },
  { label: 'Split Shipment', value: form.value.AllowSplitShipment ? 'Yes' : 'No' }
].filter((line) => String(line.value ?? '').trim()))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
