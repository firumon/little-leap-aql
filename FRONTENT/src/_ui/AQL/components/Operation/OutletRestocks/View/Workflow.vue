<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!events.length" class="text-center q-py-lg">
        <q-icon name="history" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing recorded yet</div>
        <div :class="ui.emptyCaptionClass">Workflow events appear here once the request moves.</div>
      </q-card-section>

      <q-card-section v-else>
        <!-- QTimeline draws the connecting rail, so the vertical line between two
             consecutive events is Quasar's own rather than a custom rule
             (ARCHITECTURE RULES §7). -->
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
                <span class="text-body2 text-weight-medium text-grey-8">{{ event.title }}</span>
              </div>
            </template>

            <template #subtitle>
              <span class="text-caption text-grey-7">
                By {{ event.by }}<template v-if="event.at"> at {{ formatStampDate(event.at) }}</template>
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
/**
 * OutletRestocks › View › Workflow — Section (tier 1: resource + page).
 *
 * The request's history: every workflow stamp that was actually written, oldest
 * first, with who wrote it and what they said.
 *
 * Ordered by the recorded TIMESTAMP rather than by the canonical state order, so a
 * request that went out for revision and came back reads in the order it actually
 * happened rather than in the order the states are declared. Stages the request
 * never reached are absent, not greyed out — this is history, not a checklist.
 *
 * Which columns hold those stamps is `WORKFLOW_STAMPS` in `useRestockView`, not a
 * lookup written here: the stamp prefix and the state genuinely differ (submitting
 * stamps `ProgressSubmitted*` but moves the request to `PENDING_APPROVAL`).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRestockView } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockView'
import { useRestockViewContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockViewContext'

defineOptions({ name: 'OutletRestocksViewWorkflow', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Workflow Timeline' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useRestockViewContext()

const { events, pending, formatStampDate } = useRestockView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
