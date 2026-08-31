<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Response</div>
        <FieldDateEdit
          :model-value="form.ResponseDate"
          :record="form"
          :config="RESPONSE_DATE_CONFIG"
          header="ResponseDate"
          @update:model-value="(value) => setFormField('ResponseDate', value)"
        />
        <FieldTextEdit
          :model-value="form.SupplierQuotationReference"
          :record="form"
          :config="REFERENCE_CONFIG"
          header="SupplierQuotationReference"
          @update:model-value="(value) => setFormField('SupplierQuotationReference', value)"
        />
        <FieldNumberEdit
          :model-value="form.QuotationValidityDays"
          :record="form"
          :config="VALIDITY_CONFIG"
          header="QuotationValidityDays"
          @update:model-value="(value) => setFormField('QuotationValidityDays', value)"
        />
        <FieldDateEdit
          :model-value="form.ValidUntilDate"
          :record="form"
          :config="VALID_UNTIL_CONFIG"
          header="ValidUntilDate"
          @update:model-value="(value) => setFormField('ValidUntilDate', value)"
        />
      </q-card-section>
    </q-card>

    <q-card v-if="!declined" flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Terms</div>
        <FieldNumberEdit
          :model-value="form.LeadTimeDays"
          :record="form"
          :config="LEAD_CONFIG"
          header="LeadTimeDays"
          @update:model-value="(value) => setFormField('LeadTimeDays', value)"
        />
        <FieldTextEdit
          :model-value="form.ShippingTerm"
          :record="form"
          :config="SHIPPING_CONFIG"
          header="ShippingTerm"
          @update:model-value="(value) => setFormField('ShippingTerm', value)"
        />
        <FieldTextEdit
          :model-value="form.PaymentTerm"
          :record="form"
          :config="PAYMENT_CONFIG"
          header="PaymentTerm"
          @update:model-value="(value) => setFormField('PaymentTerm', value)"
        />
        <FieldTextareaEdit
          :model-value="form.PaymentTermDetail"
          :record="form"
          :config="PAYMENT_DETAIL_CONFIG"
          header="PaymentTermDetail"
          @update:model-value="(value) => setFormField('PaymentTermDetail', value)"
        />
        <FieldToggleEdit
          :model-value="form.AllowPartialPO"
          :record="form"
          :config="PARTIAL_PO_CONFIG"
          header="AllowPartialPO"
          @update:model-value="(value) => setFormField('AllowPartialPO', value)"
        />
      </q-card-section>
    </q-card>

    <q-card v-if="!declined" flat bordered :class="ui.cardClass">
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
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldDateEdit from 'src/_fields/date/Edit.vue'
import FieldNumberEdit from 'src/_fields/number/Edit.vue'
import FieldTextEdit from 'src/_fields/text/Edit.vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import FieldToggleEdit from 'src/_fields/toggle/Edit.vue'
import { useQuotationCaptureContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/useQuotationCaptureContext'

defineOptions({ name: 'SupplierQuotationsQuotationTerms', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const RESPONSE_DATE_CONFIG = { label: 'Response Date' }
const REFERENCE_CONFIG = { label: 'Supplier Reference' }
const VALIDITY_CONFIG = { label: 'Validity (days)' }
const VALID_UNTIL_CONFIG = { label: 'Valid Until' }
const LEAD_CONFIG = { label: 'Lead Time (days)' }
const SHIPPING_CONFIG = { label: 'Shipping Term' }
const PAYMENT_CONFIG = { label: 'Payment Term' }
const PAYMENT_DETAIL_CONFIG = { label: 'Payment Term Detail' }
const PARTIAL_PO_CONFIG = { label: 'Allow partial purchase orders' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  form,
  setFormField,
  setCharge,
  chargeKeys,
  chargeLabel,
  declined,
  totals,
  money,
  currentStep
} = useQuotationCaptureContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
const charges = computed(() => form.value.ExtraChargesBreakup || {})

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
