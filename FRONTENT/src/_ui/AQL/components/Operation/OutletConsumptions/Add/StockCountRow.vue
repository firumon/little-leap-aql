<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section>
      <!-- Details left, counter right, so a scan of the cards reads down one column. -->
      <div class="row items-center no-wrap q-col-gutter-md">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle2 text-weight-medium q-px-sm">{{ label.primary }}</div>
          <div class="text-caption text-grey-7 q-px-sm">{{ label.secondary }}</div>
          <div class="column q-mt-sm">
            <q-chip
              v-for="chip in chips"
              :key="chip.key"
              square
              :color="chip.value > 0 ? chip.color : 'grey-3'"
              :text-color="chip.value > 0 ? 'white' : 'grey-7'"
              :label="`${chip.label}: ${chip.value}`"
              class="q-ma-none"
            />
          </div>
        </div>

        <!-- A vertical stepper: a phone is counted one-handed with a thumb, and a
             horizontal pair puts the buttons on opposite sides of the number. -->
        <div class="col-auto column items-center">
          <q-btn
            flat
            round
            size="lg"
            icon="keyboard_arrow_up"
            color="primary"
            aria-label="Increase counted quantity"
            :disable="!returnsAllowed && fields.sold.value <= 0"
            @click="step(1)"
          />
          <div style="width: 84px">
            <component
              :is="NumberField"
              v-model="fields.counted.value"
              :record="{ SKU: sku }"
              :config="{ dense: true, inputClass: 'text-center text-weight-bold text-h6' }"
              header="Qty"
            />
          </div>
          <q-btn
            flat
            round
            size="lg"
            icon="keyboard_arrow_down"
            color="primary"
            aria-label="Decrease counted quantity"
            :disable="fields.counted.value <= 0"
            @click="step(-1)"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
// One SKU, counted. The card's only job is to move ONE number; what that number means for
// the sold, return and restock nodes is decided by `useConsumptionCountFields`.
import { computed } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'

defineOptions({ name: 'OutletConsumptionsAddStockCountRow', inheritAttrs: false })

const props = defineProps({
  sku: { type: String, required: true },
  count: { type: Object, required: true },
  ui: { type: Object, required: true },
  returnsAllowed: { type: Boolean, default: true },
  restocksAllowed: { type: Boolean, default: true }
})

const { skuLabelOf } = useSkuResource()

const NumberField = resolveFieldComponent('number', 'add')

const fields = props.count.fieldsFor(props.sku)
const label = computed(() => skuLabelOf(props.sku))

// Always the same chips in the same order: the card must not change height as the officer
// counts, so a zero chip renders muted rather than disappearing.
const chips = computed(() => [
  { key: 'system', label: 'System', value: fields.system.value, color: 'grey-7' },
  { key: 'sold', label: 'Sold', value: fields.sold.value, color: 'positive' },
  ...(props.restocksAllowed
    ? [{ key: 'restock', label: 'Restock', value: fields.restock.value, color: 'primary' }]
    : []),
  ...(props.returnsAllowed
    ? [{ key: 'return', label: 'Return', value: fields.returned.value, color: 'orange' }]
    : [])
])

const step = (delta) => { fields.counted.value = fields.counted.value + delta }
</script>
