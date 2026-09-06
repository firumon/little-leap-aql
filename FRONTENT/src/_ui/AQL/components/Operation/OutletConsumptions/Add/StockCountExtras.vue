<template>
  <template v-if="options.length">
    <SectionDividerLabel label="FOUND SOMETHING ELSE?" />
    <AqlAddItemsExpansion
      :items="options"
      icon="assignment_return"
      label="Add extra items"
      search-label="Search items"
      header-class="text-orange-9 text-weight-medium"
      :caption="`${options.length} item(s) available`"
      :card-class="ui.cardClass"
    >
      <template #row="{ option }">
        <div class="row items-center no-wrap q-gutter-sm">
          <div style="width: 64px">
            <component
              :is="NumberField"
              :model-value="pendingQty[option.value] ?? 1"
              :record="{}"
              :config="{ dense: true, inputClass: 'text-center' }"
              header="Qty"
              @update:model-value="(value) => (pendingQty[option.value] = value)"
            />
          </div>
          <q-btn
            dense
            round
            no-caps
            color="orange"
            icon="add"
            :aria-label="`Add ${option.label}`"
            @click="add(option.value)"
          />
        </div>
      </template>
    </AqlAddItemsExpansion>
  </template>
</template>

<script setup>
// Anything found on the shelf that the shelf does not carry. One job: add an unlisted
// item. Inline, not a dialog, so the counts stay on screen while it is used.
import { computed, reactive } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'

defineOptions({ name: 'OutletConsumptionsAddStockCountExtras', inheritAttrs: false })

const props = defineProps({
  listed: { type: Set, required: true },
  count: { type: Object, required: true },
  ui: { type: Object, required: true }
})

const { activeSkus, skuLabelText } = useSkuResource()

const NumberField = resolveFieldComponent('number', 'add')

const text = (value) => (value == null ? '' : String(value).trim())

// SKUs no card already carries.
const options = computed(() => activeSkus.value
  .filter((row) => !props.listed.has(text(row.code)))
  .map((row) => ({ value: text(row.code), label: skuLabelText(row.code) })))

const pendingQty = reactive({})

function add (sku) {
  const code = text(sku)
  if (!code) return
  props.count.addFoundItem(code, pendingQty[code] ?? 1)
  delete pendingQty[code]
}
</script>
