<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Which quotation are you ordering from?</div>

        <div v-if="!eligibleQuotations.length" class="text-center q-py-lg">
          <q-icon name="inbox" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing to order from</div>
          <div :class="ui.emptyCaptionClass">No quotation is open for a purchase order right now.</div>
        </div>

        <q-list v-else separator>
          <q-item
            v-for="option in eligibleQuotations"
            :key="option.code"
            clickable
            :active="option.code === form.QuotationCode"
            active-class="bg-blue-1"
            @click="select(option.code)"
          >
            <q-item-section side top>
              <q-radio
                :model-value="form.QuotationCode"
                :val="option.code"
                :style="ui.tapTargetStyle"
                :aria-label="`Select ${option.label}`"
                @update:model-value="select"
              />
            </q-item-section>
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ option.label }}</q-item-label>
              <q-item-label caption>{{ option.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-banner v-if="quotation && !partialAllowed" dense rounded class="bg-grey-2 text-caption">
      This supplier does not allow partial orders, so every remaining line must be included.
    </q-banner>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { usePurchaseOrderAddContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/Add/usePurchaseOrderAddContext'

defineOptions({ name: 'PurchaseOrdersAddSelectQuotation', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, form, setFormField, eligibleQuotations, quotation, partialAllowed, currentStep } = usePurchaseOrderAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

// Changing the quotation invalidates every line quantity typed against the old one.
function select (value) {
  setFormField('QuotationCode', value)
}
</script>
