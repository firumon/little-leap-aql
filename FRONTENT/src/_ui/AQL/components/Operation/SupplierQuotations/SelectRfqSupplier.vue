<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Which RFQ is this a reply to?</div>

        <div v-if="!sentRfqs.length" class="text-center q-py-lg">
          <q-icon name="inbox" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No open RFQs</div>
          <div :class="ui.emptyCaptionClass">Send an RFQ out before capturing a supplier reply.</div>
        </div>

        <FieldSelectEdit
          v-else
          :model-value="form.RFQCode"
          :record="form"
          :config="rfqConfig"
          header="RFQCode"
          @update:model-value="selectRfq"
        />

        <FieldSelectEdit
          v-if="form.RFQCode"
          :model-value="form.SupplierCode"
          :record="form"
          :config="supplierConfig"
          header="SupplierCode"
          @update:model-value="(value) => setFormField('SupplierCode', value)"
        />

        <FieldSelectEdit
          v-if="form.SupplierCode"
          :model-value="form.ResponseType"
          :record="form"
          :config="responseConfig"
          header="ResponseType"
          @update:model-value="(value) => setFormField('ResponseType', value)"
        />

        <FieldTextareaEdit
          v-if="declined"
          :model-value="form.DeclineReason"
          :record="form"
          :config="DECLINE_CONFIG"
          header="DeclineReason"
          @update:model-value="(value) => setFormField('DeclineReason', value)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldSelectEdit from 'src/_fields/select/Edit.vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { useQuotationCaptureContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/useQuotationCaptureContext'

defineOptions({ name: 'SupplierQuotationsSelectRfqSupplier', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const DECLINE_CONFIG = { label: 'Why did the supplier decline?' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  form,
  setFormField,
  sentRfqs,
  assignedSuppliers,
  responseOptions,
  declined,
  currentStep
} = useQuotationCaptureContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

const rfqConfig = computed(() => ({
  label: 'RFQ',
  options: sentRfqs.value.map((entry) => ({ value: entry.code, label: entry.label }))
}))

const supplierConfig = computed(() => ({
  label: 'Supplier',
  options: assignedSuppliers.value.map((entry) => ({ value: entry.code, label: entry.name }))
}))

const responseConfig = computed(() => ({ label: 'Response Type', options: responseOptions.value }))

// Changing the RFQ invalidates the supplier chosen under the old one.
function selectRfq (value) {
  setFormField('RFQCode', value)
  setFormField('SupplierCode', '')
}
</script>
