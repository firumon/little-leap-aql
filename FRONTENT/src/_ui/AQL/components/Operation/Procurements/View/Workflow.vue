<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!events.length" class="text-center q-py-lg">
        <q-icon name="history" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing recorded yet</div>
        <div :class="ui.emptyCaptionClass">Stages appear here as the procurement moves.</div>
      </q-card-section>

      <q-card-section v-else>
        <q-timeline color="primary" layout="dense">
          <q-timeline-entry
            v-for="(event, index) in events"
            :key="event.state"
            :icon="event.icon"
            :color="event.color"
            :class="ui.detailRowClass"
            :style="rowDelay(index)"
          >
            <template #title>
              <div class="row items-center no-wrap q-gutter-x-xs">
                <q-badge rounded :color="event.color" :label="event.label" />
              </div>
            </template>

            <template #subtitle>
              <span v-if="event.at" class="text-caption text-grey-7">{{ formatStampDate(event.at) }}</span>
            </template>
          </q-timeline-entry>
        </q-timeline>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Stages the procurement has actually walked. Nothing ahead of it is drawn.
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useProcurementView } from 'src/_ui/AQL/composables/Operation/Procurements/View/useProcurementView'
import { useProcurementViewContext } from 'src/_ui/AQL/composables/Operation/Procurements/View/useProcurementViewContext'

defineOptions({ name: 'ProcurementsViewWorkflow', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Lifecycle' }
})

const { evaluate, ui } = useProcurementViewContext()
const { events, pending, formatStampDate } = useProcurementView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
