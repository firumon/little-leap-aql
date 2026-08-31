<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between">
          <div class="text-subtitle1 text-weight-medium">Order subtotal</div>
          <div class="text-subtitle1 text-weight-bold">{{ money(totals.subtotal) }}</div>
        </div>
        <div class="text-caption text-grey-7">{{ selectedLines.length }} of {{ lines.length }} lines selected</div>
      </q-card-section>
    </q-card>

    <q-card v-if="!lines.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No lines</div>
        <div :class="ui.emptyCaptionClass">Pick a quotation that carries priced items.</div>
      </q-card-section>
    </q-card>

    <OrderLineCard
      v-for="line in lines"
      :key="line.key"
      :line="line"
      :money="money"
      :partial-allowed="partialAllowed"
      @update="onUpdate"
    />
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import OrderLineCard from './OrderLineCard.vue'
import { usePurchaseOrderAddContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/Add/usePurchaseOrderAddContext'

defineOptions({ name: 'PurchaseOrdersAddOrderLines', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, lines, selectedLines, setLineField, totals, money, partialAllowed, currentStep } = usePurchaseOrderAddContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

function onUpdate ({ key, field, value }) {
  setLineField(key, field, value)
}
</script>
