<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <template v-else-if="upcoming">
        <q-list>
          <q-item clickable @click="openFollowUp(upcoming.code)">
<!--            <q-item-section side top>
              <q-icon name="event_available" :color="countdownColor(upcoming.daysUntil)" />
            </q-item-section>-->
            <q-item-section>
              <q-item-label class="text-subtitle2 text-weight-bold">{{ dateLabel }}</q-item-label>
              <q-item-label caption>{{ upcoming.Username || 'Unassigned' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge rounded :color="countdownColor(upcoming.daysUntil)" :label="countdownLabel(upcoming.daysUntil)" />
            </q-item-section>
          </q-item>
        </q-list>

        <q-separator v-if="visibleLines.length" />

        <q-card-section v-if="visibleLines.length">
          <div class="aql-detail-grid">
            <div
              v-for="(line, index) in visibleLines"
              :key="line.label"
              class="aql-detail-line items-center aql-detail-row"
              :style="rowDelay(index)"
            >
              <span class="aql-detail-key">{{ line.label }}</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                {{ line.value }}
              </span>
            </div>
          </div>
        </q-card-section>
      </template>

      <q-card-section v-else class="text-caption text-grey-7">
        {{ finalEmptyText }}
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useLeadViewContext } from 'src/_ui/AQL/composables/Master/Leads/View/useLeadViewContext'
import {
  countdownLabel,
  countdownColor
} from 'src/_ui/AQL/composables/Operation/LeadFollowUps/useFollowUpPresentation'

defineOptions({ name: 'LeadsUpcomingFollowUp', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Upcoming Follow Up' },
  emptyText: { type: [String, Function], default: 'No follow-up is scheduled for this lead yet.' },
  padding: { type: [String], default: 'sm' }
})

const { evaluate, upcoming, followUpsPending, openFollowUp } = useLeadViewContext()

const finalTitle = computed(() => evaluate(props.title))
const finalEmptyText = computed(() => evaluate(props.emptyText))
const pending = computed(() => followUpsPending.value)

const dateLabel = computed(() => upcoming.value?.Date || 'No date set')

const visibleLines = computed(() => {
  const row = upcoming.value
  if (!row) return []
  return [
    { label: 'Purpose', value: row.purpose || '' },
    { label: 'Purpose Detail', value: row.purposeDetail || '' }
  ].filter((line) => String(line.value ?? '').trim())
})

function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
