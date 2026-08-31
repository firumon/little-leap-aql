<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!procurement" class="text-center q-py-lg">
        <q-icon name="shopping_cart" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No procurement</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Stage</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </span>
          </div>

          <div
            v-for="(line, index) in facts"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useProcurementView } from 'src/_ui/AQL/composables/Operation/Procurements/View/useProcurementView'
import { useProcurementViewContext } from 'src/_ui/AQL/composables/Operation/Procurements/View/useProcurementViewContext'

defineOptions({ name: 'ProcurementsViewProcurementHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Procurement Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useProcurementViewContext()
const { procurement, pending, progressColor, progressIcon, progressLabel } = useProcurementView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(procurement.value?.Progress))
const statusIcon = computed(() => progressIcon(procurement.value?.Progress))
const statusLabel = computed(() => progressLabel(procurement.value?.Progress))

const facts = computed(() => {
  const record = procurement.value
  if (!record) return []
  return [
    { label: 'Initiated', value: record.InitiatedDate },
    { label: 'Raised By', value: record.CreatedUser },
    { label: 'Role', value: record.CreatedRole }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
