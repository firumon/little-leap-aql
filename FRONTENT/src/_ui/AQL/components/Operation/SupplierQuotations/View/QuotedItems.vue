<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon :name="declined ? 'do_not_disturb' : 'inventory_2'" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">{{ declined ? 'Nothing quoted' : 'No items' }}</div>
        <div :class="ui.emptyCaptionClass">
          {{ declined ? 'The supplier declined, so no prices were given.' : 'This quotation carries no priced lines.' }}
        </div>
      </q-card-section>

      <q-card-section v-else>
        <div v-for="(line, index) in rows" :key="line.code" :class="ui.detailRowClass" :style="rowDelay(index)">
          <div class="row items-start no-wrap q-mb-xs">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
              <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
                {{ line.secondary }}
              </div>
              <div class="text-caption text-grey-7">
                {{ line.quantity }} × {{ money(line.unitPrice) }}
                <template v-if="line.leadTimeDays !== null"> • {{ line.leadTimeDays }} days</template>
              </div>
            </div>
            <div class="col-auto text-body2 text-weight-bold">{{ money(line.totalPrice) }}</div>
          </div>
          <q-separator v-if="index < rows.length - 1" class="q-mb-sm" />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useQuotationView } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/View/useQuotationView'
import { useQuotationViewContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/View/useQuotationViewContext'

defineOptions({ name: 'SupplierQuotationsViewQuotedItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Quoted Items' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = useQuotationViewContext()
const { lines, pending, declined, money } = useQuotationView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? lines.value : props.items))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
