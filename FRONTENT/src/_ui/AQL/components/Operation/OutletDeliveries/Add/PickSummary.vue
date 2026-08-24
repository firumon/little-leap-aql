<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="Warehouse Pick List" />

    <AqlGroupedList
      :items="pickRows"
      item-key="key"
      group-key="storageName"
      :gutter="attrs.gutter || 'sm'"
      :dense="false"
      empty-text="Nothing picked yet. Go back and tick the items for this run."
      empty-icon="inventory_2"
      :card-class="ui.cardClass"
    >
      <template #item="{ item }">
        <q-item-section :class="ui.flexWrapTextClass">
          <q-item-label class="text-weight-medium">{{ item.productName }}</q-item-label>
          <q-item-label v-if="item.skuVariant" caption>{{ item.skuVariant }}</q-item-label>
          <!-- A line rather than chips: a chip clips its own label, and an outlet name
               clipped to "Top Care Pharmacy Al Jad…" is the one thing the picker needs. -->
          <q-item-label
            v-for="outlet in item.outlets"
            :key="outlet.code"
            caption
            class="text-secondary"
          >
            {{ outlet.name }} · {{ outlet.quantity }} {{ item.uom }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-chip square color="primary" text-color="white" :label="item.quantityLabel" />
        </q-item-section>
      </template>
    </AqlGroupedList>
  </div>
</template>

<script setup>
// Step 2: the ticked lines re-sorted by storage bin, so the picker walks the floor
// shelf by shelf instead of outlet by outlet.
import { computed, useAttrs } from 'vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useDeliverySelection } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliverySelection'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'

defineOptions({ name: 'OutletDeliveriesAddPickSummary', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: 2 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, pageState } = useDeliveryFormContext()
const { pickRows } = useDeliverySelection()

const currentStep = computed(() => pageState?.meta?.currentStep || 1)
const isActive = computed(() => props.step == null || Number(props.step) === currentStep.value)
</script>
