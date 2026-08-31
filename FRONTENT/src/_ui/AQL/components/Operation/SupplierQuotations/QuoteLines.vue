<template>
  <div v-if="visible" :class="gutterClass">
    <q-banner v-if="declined" dense rounded class="bg-grey-2">
      <template #avatar>
        <q-icon name="do_not_disturb" color="grey-8" />
      </template>
      The supplier declined, so no prices are collected.
    </q-banner>

    <template v-else>
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-subtitle1 text-weight-medium">Quoted total</div>
            <div class="text-subtitle1 text-weight-bold">{{ money(totals.subtotal) }}</div>
          </div>
          <div class="text-caption text-grey-7">{{ quotedCount }} of {{ lines.length }} lines priced</div>
        </q-card-section>
      </q-card>

      <q-card v-if="!lines.length" flat bordered :class="ui.cardClass">
        <q-card-section class="text-center q-py-lg">
          <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No lines to quote</div>
          <div :class="ui.emptyCaptionClass">Pick an RFQ that names requisition lines.</div>
        </q-card-section>
      </q-card>

      <QuoteLineCard
        v-for="line in lines"
        :key="line.key"
        :line="line"
        :money="money"
        @update="onUpdate"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import QuoteLineCard from './QuoteLineCard.vue'
import { useQuotationCaptureContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/useQuotationCaptureContext'

defineOptions({ name: 'SupplierQuotationsQuoteLines', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, lines, setLineField, declined, totals, money, currentStep } = useQuotationCaptureContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)
const quotedCount = computed(() => lines.value.filter((line) => line.Quantity > 0 || line.UnitPrice > 0).length)

function onUpdate ({ key, field, value }) {
  setLineField(key, field, value)
}
</script>
