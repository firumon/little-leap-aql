<template>
  <div v-if="pending || record" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="60%" class="q-mb-sm" />
        <q-skeleton type="text" width="35%" />
      </q-card-section>

      <q-card-section v-else>
        <div class="q-pb-sm" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">{{ productName || '—' }}</div>
          <div class="text-caption text-grey-8">{{ record?.SKU || '' }}</div>
        </div>

        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>

      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewReturnedItem', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Returned Item' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useReturnViewContext()
const { record, pending, skuName, creditValue, reasonLabel } = useReturnView()
const { _C } = useCurrency()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const quantity = computed(() => Math.abs(Number(record.value?.Qty) || 0))
const reasonText = computed(() => reasonLabel(record.value?.Reason))
const reasonComment = computed(() => String(record.value?.ReasonComment ?? '').trim())

const productName = computed(() => {
  const sku = record.value?.$sku
  return String(sku?.$product?.Name || sku?.Name || skuName.value || '').trim()
})

const lines = computed(() => {
  const row = record.value
  if (!row) return []
  return [
    { label: 'Quantity', value: quantity.value },
    { label: 'Unit Credit', value: _C(Number(row.Price) || 0) },
    { label: 'Credit Value', value: _C(creditValue.value) },
    { label: 'Reason', value: reasonText.value },
    { label: 'Reason Comment', value: reasonComment.value }
  ].filter((line) => String(line.value).trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
