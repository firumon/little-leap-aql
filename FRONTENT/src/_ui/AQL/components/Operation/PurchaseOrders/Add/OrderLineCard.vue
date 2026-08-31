<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section :class="gutterClass">
      <div class="row items-start no-wrap q-gutter-sm">
        <q-checkbox
          :model-value="line.Selected"
          :disable="!partialAllowed"
          :style="ui.tapTargetStyle"
          :aria-label="`Include ${line.primary}`"
          @update:model-value="(value) => emitUpdate('Selected', value)"
        />
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
          <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
            {{ line.secondary }}
          </div>
          <div class="text-caption text-grey-7">
            Quoted {{ line.QuotedQuantity }} • {{ line.RemainingQuantity }} left • {{ money(line.UnitPrice) }} each
          </div>
        </div>
        <div class="col-auto text-body2 text-weight-bold">{{ money(line.lineTotal) }}</div>
      </div>

      <FieldNumberEdit
        :model-value="line.OrderedQuantity"
        :record="line"
        :config="QTY_CONFIG"
        header="OrderedQuantity"
        @update:model-value="(value) => emitUpdate('OrderedQuantity', value)"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldNumberEdit from 'src/_fields/number/Edit.vue'
import { usePurchaseOrderAddContext } from 'src/_ui/AQL/composables/Operation/PurchaseOrders/Add/usePurchaseOrderAddContext'

defineOptions({ name: 'PurchaseOrdersAddOrderLineCard', inheritAttrs: false })

const QTY_CONFIG = { label: 'Order quantity', dense: true }

const props = defineProps({
  line: { type: Object, required: true },
  money: { type: Function, required: true },
  partialAllowed: { type: Boolean, default: true }
})

const emit = defineEmits(['update'])

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui } = usePurchaseOrderAddContext()

function emitUpdate (field, value) {
  emit('update', { key: props.line.key, field, value })
}
</script>
