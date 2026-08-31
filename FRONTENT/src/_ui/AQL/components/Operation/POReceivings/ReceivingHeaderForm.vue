<template>
  <div v-if="visible" :class="gutterClass">
    <q-banner v-if="!editable" dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      This receiving has been confirmed, so its counts can no longer be changed.
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Which purchase order arrived?</div>

        <FieldSelectEdit
          v-if="!form.Code"
          :model-value="form.PurchaseOrderCode"
          :record="form"
          :config="orderConfig"
          header="PurchaseOrderCode"
          @update:model-value="(value) => setFormField('PurchaseOrderCode', value)"
        />

        <div v-else :class="ui.detailGridClass">
          <div class="items-center" :class="ui.detailLineClass">
            <span :class="ui.detailKeyClass">Purchase Order</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ form.PurchaseOrderCode }}
            </span>
          </div>
        </div>

        <FieldDateEdit
          :model-value="form.InspectionDate"
          :record="form"
          :config="DATE_CONFIG"
          header="InspectionDate"
          @update:model-value="(value) => setFormField('InspectionDate', value)"
        />
        <FieldTextEdit
          :model-value="form.InspectedUserName"
          :record="form"
          :config="INSPECTOR_CONFIG"
          header="InspectedUserName"
          @update:model-value="(value) => setFormField('InspectedUserName', value)"
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
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldDateEdit from 'src/_fields/date/Edit.vue'
import FieldSelectEdit from 'src/_fields/select/Edit.vue'
import FieldTextEdit from 'src/_fields/text/Edit.vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { useReceivingFormContext } from 'src/_ui/AQL/composables/Operation/POReceivings/useReceivingFormContext'

defineOptions({ name: 'POReceivingsReceivingHeaderForm', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const DATE_CONFIG = { label: 'Inspection Date' }
const INSPECTOR_CONFIG = { label: 'Inspected By' }
const REMARKS_CONFIG = { label: 'Remarks' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, form, setFormField, eligibleOrders, editable, currentStep } = useReceivingFormContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

const orderConfig = computed(() => ({
  label: 'Purchase Order',
  options: eligibleOrders.value.map((entry) => ({ value: entry.code, label: entry.label }))
}))
</script>
