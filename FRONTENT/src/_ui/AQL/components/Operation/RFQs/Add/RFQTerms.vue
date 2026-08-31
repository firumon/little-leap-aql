<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Dates</div>
        <FieldDateEdit
          :model-value="form.RFQDate"
          :record="form"
          :config="RFQ_DATE_CONFIG"
          header="RFQDate"
          @update:model-value="(value) => setFormField('RFQDate', value)"
        />
        <FieldDateEdit
          :model-value="form.SubmissionDeadline"
          :record="form"
          :config="DEADLINE_CONFIG"
          header="SubmissionDeadline"
          @update:model-value="(value) => setFormField('SubmissionDeadline', value)"
        />
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Lead time and validity</div>
        <FieldNumberEdit
          :model-value="form.LeadTimeDays"
          :record="form"
          :config="LEAD_DAYS_CONFIG"
          header="LeadTimeDays"
          @update:model-value="(value) => setFormField('LeadTimeDays', value)"
        />
        <FieldSelectEdit
          :model-value="form.LeadTimeType"
          :record="form"
          :config="leadTypeConfig"
          header="LeadTimeType"
          @update:model-value="(value) => setFormField('LeadTimeType', value)"
        />
        <FieldNumberEdit
          :model-value="form.QuotationValidityDays"
          :record="form"
          :config="VALIDITY_DAYS_CONFIG"
          header="QuotationValidityDays"
          @update:model-value="(value) => setFormField('QuotationValidityDays', value)"
        />
        <FieldSelectEdit
          :model-value="form.QuotationValidityMode"
          :record="form"
          :config="validityModeConfig"
          header="QuotationValidityMode"
          @update:model-value="(value) => setFormField('QuotationValidityMode', value)"
        />
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Shipping and payment</div>
        <FieldSelectEdit
          :model-value="form.ShippingTermMode"
          :record="form"
          :config="shippingModeConfig"
          header="ShippingTermMode"
          @update:model-value="(value) => setFormField('ShippingTermMode', value)"
        />
        <FieldSelectEdit
          v-if="form.ShippingTermMode === 'FIXED'"
          :model-value="form.ShippingTerm"
          :record="form"
          :config="shippingTermConfig"
          header="ShippingTerm"
          @update:model-value="(value) => setFormField('ShippingTerm', value)"
        />
        <FieldSelectEdit
          :model-value="form.PaymentTermMode"
          :record="form"
          :config="paymentModeConfig"
          header="PaymentTermMode"
          @update:model-value="(value) => setFormField('PaymentTermMode', value)"
        />
        <FieldSelectEdit
          v-if="form.PaymentTermMode === 'FIXED'"
          :model-value="form.PaymentTerm"
          :record="form"
          :config="paymentTermConfig"
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
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Delivery</div>
        <FieldSelectEdit
          :model-value="form.DeliveryMode"
          :record="form"
          :config="deliveryModeConfig"
          header="DeliveryMode"
          @update:model-value="(value) => setFormField('DeliveryMode', value)"
        />
        <FieldToggleEdit
          :model-value="form.AllowPartialDelivery"
          :record="form"
          :config="PARTIAL_CONFIG"
          header="AllowPartialDelivery"
          @update:model-value="(value) => setFormField('AllowPartialDelivery', value)"
        />
        <FieldToggleEdit
          :model-value="form.AllowSplitShipment"
          :record="form"
          :config="SPLIT_CONFIG"
          header="AllowSplitShipment"
          @update:model-value="(value) => setFormField('AllowSplitShipment', value)"
        />
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
import FieldToggleEdit from 'src/_fields/toggle/Edit.vue'
import { useRFQAddContext } from 'src/_ui/AQL/composables/Operation/RFQs/Add/useRFQAddContext'

defineOptions({ name: 'RFQsAddRFQTerms', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const RFQ_DATE_CONFIG = { label: 'RFQ Date' }
const DEADLINE_CONFIG = { label: 'Submission Deadline' }
const LEAD_DAYS_CONFIG = { label: 'Lead Time (days)' }
const VALIDITY_DAYS_CONFIG = { label: 'Quotation Validity (days)' }
const PAYMENT_DETAIL_CONFIG = { label: 'Payment Term Detail' }
const PARTIAL_CONFIG = { label: 'Allow partial delivery' }
const SPLIT_CONFIG = { label: 'Allow split shipment' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, form, setFormField, currentStep, termOptions } = useRFQAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

const leadTypeConfig = computed(() => ({ label: 'Lead Time Type', options: termOptions('leadTimeTypes') }))
const validityModeConfig = computed(() => ({ label: 'Validity Mode', options: termOptions('quotationValidityModes') }))
const shippingModeConfig = computed(() => ({ label: 'Shipping Term Mode', options: termOptions('shippingTermModes') }))
const shippingTermConfig = computed(() => ({ label: 'Shipping Term', options: termOptions('shippingTerms') }))
const paymentModeConfig = computed(() => ({ label: 'Payment Term Mode', options: termOptions('paymentTermModes') }))
const paymentTermConfig = computed(() => ({ label: 'Payment Term', options: termOptions('paymentTerms') }))
const deliveryModeConfig = computed(() => ({ label: 'Delivery Mode', options: termOptions('deliveryModes') }))
</script>
