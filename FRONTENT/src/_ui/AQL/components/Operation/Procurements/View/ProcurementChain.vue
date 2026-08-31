<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!chain.length" class="text-center q-py-lg">
        <q-icon name="link_off" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing linked yet</div>
        <div :class="ui.emptyCaptionClass">Requisitions, RFQs and orders appear here as they are raised.</div>
      </q-card-section>

      <q-card-section v-else :class="gutterClass">
        <div v-for="group in chain" :key="group.title">
          <div class="text-caption text-weight-bold text-grey-7 q-mb-xs">{{ group.title }}</div>
          <div :class="ui.detailGridClass">
            <div v-for="entry in group.entries" :key="entry.code" class="items-center" :class="ui.detailLineClass">
              <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">{{ entry.code }}</span>
              <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
                <q-badge rounded :color="entry.color" :label="entry.label" />
              </span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useProcurementView } from 'src/_ui/AQL/composables/Operation/Procurements/View/useProcurementView'
import { useProcurementViewContext } from 'src/_ui/AQL/composables/Operation/Procurements/View/useProcurementViewContext'

defineOptions({ name: 'ProcurementsViewProcurementChain', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Linked Records' },
  gutter: { type: String, default: 'sm' }
})

const attrs = useAttrs()
const { evaluate, ui } = useProcurementViewContext()
const { chain, pending } = useProcurementView()

const gutterClass = computed(() => `q-gutter-y-${props.gutter || attrs.gutter || 'sm'}`)
const finalTitle = computed(() => evaluate(props.title))
</script>
