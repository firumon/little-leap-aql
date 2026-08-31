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
        <div :class="ui.emptyCaptionClass">Workflow events appear here once the record moves.</div>
      </q-card-section>

      <q-card-section v-else>
        <q-timeline color="primary" layout="dense">
          <q-timeline-entry
            v-for="(event, index) in events"
            :key="`${event.state}-${event.at}`"
            :icon="event.icon"
            :color="event.color"
            :class="ui.detailRowClass"
            :style="rowDelay(index)"
          >
            <template #title>
              <div class="row items-center no-wrap q-gutter-x-xs">
                <q-badge rounded :color="event.color" :label="event.label" />
                <span class="text-body2 text-weight-medium text-grey-8">{{ event.title }}</span>
              </div>
            </template>

            <template #subtitle>
              <span class="text-caption text-grey-7">
                <template v-if="event.by">By {{ event.by }}</template>
                <template v-if="event.at"> at {{ formatStampDate(event.at) }}</template>
              </span>
            </template>

            <div v-if="event.comment" class="text-caption text-italic text-grey-7">
              {{ event.comment }}
            </div>
          </q-timeline-entry>
        </q-timeline>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// History, oldest first. Stages never reached are absent, not greyed out.
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useGoodsReceiptView } from 'src/_ui/AQL/composables/Operation/GoodsReceipts/View/useGoodsReceiptView'
import { useGoodsReceiptViewContext } from 'src/_ui/AQL/composables/Operation/GoodsReceipts/View/useGoodsReceiptViewContext'

defineOptions({ name: 'GoodsReceiptsViewWorkflow', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Workflow Timeline' }
})

const { evaluate, ui } = useGoodsReceiptViewContext()
const { events, pending, formatStampDate } = useGoodsReceiptView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
