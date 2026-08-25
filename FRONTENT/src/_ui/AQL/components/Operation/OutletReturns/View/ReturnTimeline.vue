<template>
  <div v-if="pending || timeline.length">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="55%" class="q-mb-sm" />
        <q-skeleton type="text" width="40%" />
      </q-card-section>

      <q-card-section v-else>
        <q-timeline layout="dense" color="primary">
          <q-timeline-entry
            v-for="(event, index) in timeline"
            :key="event.key"
            :title="event.title"
            :subtitle="event.at"
            :icon="event.icon"
            :color="event.color"
            :style="rowDelay(index)"
          >
            <div class="text-body2">{{ event.by }}</div>
            <div v-if="event.comment" class="text-caption text-grey-8" style="white-space: pre-line">
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
 * OutletReturns › View › ReturnTimeline — Section (tier 1: resource + page).
 *
 * Chronological event history, not a checklist: events are ordered by the timestamp
 * actually recorded, and stages never reached are ABSENT rather than greyed out (§7.4).
 * The whole projection is built by Layer 2's `workflowStamps`, so which column holds which
 * stamp is decided once, in the vocabulary file, not restated in this card.
 *
 * ── WHY THIS TIMELINE IS SHORTER THAN OTHER MODULES' ──
 * `OutletReturns` declares NO `Progress<State>` stamp columns — its headers end at
 * `Progress, Status, AccessRegion` plus the four common audit columns
 * (`GAS/setupOperationSheets.gs`). There is nothing on this sheet recording when a return
 * was completed or cancelled, or by whom. The timeline therefore reports what genuinely
 * exists: creation, the warehouse disposition, and the last touch.
 *
 * A consequence worth knowing while reading a cancelled return: the cancellation reason IS
 * collected and sent, but `buildNewResourceRow` (`GAS/resourceApi.gs`) iterates the sheet's
 * own headers and silently drops any key that is not one of them — so no reason has ever
 * persisted on this resource. Adding the stamp columns is a schema change; the payload
 * already writes them for the day it lands. See `useReturnProgress.workflowStamps`.
 *
 * The whole card hides when there is no history rather than rendering an empty shell
 * (§10.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewReturnTimeline', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'History' }
})

const { evaluate, ui } = useReturnViewContext()
const { pending, timeline } = useReturnView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
