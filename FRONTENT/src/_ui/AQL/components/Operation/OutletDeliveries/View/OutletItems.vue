<template>
  <div v-if="pending || rows.length">
    <SectionDividerLabel :label="finalTitle" />

    <q-card v-if="pending" flat bordered :class="ui.cardClass">
      <q-card-section>
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="70%" />
      </q-card-section>
    </q-card>

    <AqlGroupedList
      v-else
      :items="rows"
      item-key="Code"
      group-key="outletName"
      :gutter="attrs.gutter || 'sm'"
      :dense="false"
      :card-class="ui.cardClass"
      empty-text="This run carries no items."
      empty-icon="local_shipping"
    >
      <template #item="{ item }">
        <q-item-section :class="ui.flexWrapTextClass">
          <q-item-label :class="item.delivered ? 'text-grey-7' : ''">{{ item.productName }}</q-item-label>
          <q-item-label v-if="itemCaption(item)" caption>{{ itemCaption(item) }}</q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-chip
            square
            :color="item.delivered ? 'positive' : 'primary'"
            text-color="white"
            :label="item.quantityLabel"
          />
        </q-item-section>
      </template>
    </AqlGroupedList>
  </div>
</template>

<script setup>
// The run, grouped by stop — a driver reads a manifest one outlet at a time.
// Delivered lines stay visible in positive green: the whole load must be readable,
// including what is already off the van.
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'
import { useDeliveryViewContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryViewContext'

defineOptions({ name: 'OutletDeliveriesViewOutletItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Outlets & Items' }
})

const attrs = useAttrs()
const { evaluate, ui } = useDeliveryViewContext()
const { pending, outletGroups } = useDeliveryView()

const finalTitle = computed(() => evaluate(props.title))

// Flattened, but still in outlet order, so `AqlGroupedList` regroups it exactly as it came.
const rows = computed(() => outletGroups.value.flatMap((group) => group.items))

// Warehouse and bin are established once on the manifest summary; repeating them per line
// pushed the variant that actually tells two SKUs apart out of view.
function itemCaption (item) {
  if (item.missing) return 'This item could not be resolved'
  return item.skuVariant === item.productName ? item.skuCode : item.skuVariant
}
</script>
