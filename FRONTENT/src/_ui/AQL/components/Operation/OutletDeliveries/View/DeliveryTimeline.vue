<template>
  <div v-if="pending || timeline.length" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="55%" class="q-mb-sm" />
        <q-skeleton type="text" width="40%" />
      </q-card-section>

      <q-card-section v-else>
        <q-timeline color="primary">
          <q-timeline-entry
            v-for="(event, index) in timeline"
            :key="event.state"
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
// Event history, ordered by the timestamp actually recorded. Stages never reached are absent.
// Names and dates arrive already resolved from `useDeliveryView`.
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'
import { useDeliveryViewContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryViewContext'

defineOptions({ name: 'OutletDeliveriesViewDeliveryTimeline', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'History' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useDeliveryViewContext()
const { pending, timeline } = useDeliveryView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
