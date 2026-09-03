<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card v-if="pending" flat bordered class="page-card">
      <q-card-section>
        <q-skeleton type="text" width="35%" class="q-mb-sm" />
        <q-skeleton type="text" width="85%" />
      </q-card-section>
    </q-card>

    <q-card v-else-if="!rows.length" flat bordered class="page-card">
      <q-card-section class="text-caption text-grey-7">{{ finalEmptyText }}</q-card-section>
    </q-card>

    <template v-else>
      <q-card
        v-for="(row, index) in rows"
        :key="row.code"
        flat
        bordered
        class="page-card aql-premium-gradient-card aql-detail-row"
        :class="'q-mb-'.concat(gutter)"
        :style="rowDelay(index)"
        @click="openFollowUp(row.code)"
      >
        <q-card-section>
          <div class="row items-center justify-between no-wrap">
            <span class="text-subtitle2 text-weight-bold">{{ row.Date || 'No date set' }}</span>
            <span class="text-caption text-grey-7">{{ row.Username || 'Unassigned' }}</span>
          </div>

          <div class="text-center text-body2 q-my-md">{{ commentOf(row) }}</div>

          <div class="row items-center justify-between no-wrap">
            <q-badge rounded :color="row.progressColor" :label="row.progressLabel" />
            <q-badge
              v-if="timelinessLabel(row.respondDelayDays)"
              rounded
              outline
              :color="timelinessColor(row.respondDelayDays)"
              :label="timelinessLabel(row.respondDelayDays)"
            />
          </div>
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useLeadViewContext } from 'src/_ui/AQL/composables/Master/Leads/View/useLeadViewContext'
import {
  timelinessLabel,
  timelinessColor
} from 'src/_ui/AQL/composables/Operation/LeadFollowUps/useFollowUpPresentation'
import { progressComment } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpProgress'

defineOptions({ name: 'LeadsRecentFollowUps', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Recent Follow Ups' },
  limit: { type: [Number, String, Function], default: 6 },
  emptyText: { type: [String, Function], default: 'No follow-up has been answered for this lead yet.' },
  padding: { type: [String], default: 'sm' },
  gutter: { type: [String], default: 'sm' }
})

const { evaluate, responded, followUpsPending, openFollowUp } = useLeadViewContext()

const finalTitle = computed(() => evaluate(props.title))
const finalEmptyText = computed(() => evaluate(props.emptyText))
const pending = computed(() => followUpsPending.value)

// Coerced loosely: a limit arriving from a sheet-authored props block is a string.
const finalLimit = computed(() => {
  const raw = Number(evaluate(props.limit))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6
})

const rows = computed(() => responded.value.slice(0, finalLimit.value))

// A completed follow-up shows what came of it; any other outcome shows why it moved.
function commentOf (row) {
  return row.outcome || progressComment(row) || '—'
}

function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
