<template>
  <div v-if="responded">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid">
          <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
            <span class="aql-detail-key">Progress</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              <q-icon :name="followUp.progressIcon" size="16px" :color="followUp.progressColor" class="q-mr-xs" />
              <q-badge rounded :color="followUp.progressColor" :label="followUp.progressLabel" />
            </span>
          </div>

          <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(1)">
            <span class="aql-detail-key">Respond Date</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              {{ followUp.RespondDate || '—' }}
            </span>
          </div>

          <div v-if="timeliness" class="aql-detail-line items-center aql-detail-row" :style="rowDelay(2)">
            <span class="aql-detail-key">Timeliness</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              <q-badge rounded :color="timelinessColor(followUp.respondDelayDays)" :label="timeliness" />
            </span>
          </div>

          <div v-if="respondedBy" class="aql-detail-line items-center aql-detail-row" :style="rowDelay(3)">
            <span class="aql-detail-key">Responded By</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              {{ respondedBy }}
            </span>
          </div>
        </div>
      </q-card-section>

      <template v-if="outcomeText">
        <q-separator />
        <q-card-section>
          <div class="text-overline text-weight-bold text-grey-6 q-mb-xs">{{ outcomeLabel }}</div>
          <div class="text-body2">{{ outcomeText }}</div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useFollowUpViewContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/View/useFollowUpViewContext'
import {
  timelinessLabel,
  timelinessColor
} from 'src/_ui/AQL/composables/Operation/LeadFollowUps/useFollowUpPresentation'
import {
  COMPLETED,
  progressComment,
  progressBy
} from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpProgress'

defineOptions({ name: 'LeadFollowUpsFollowUpResponse', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Response' },
  padding: { type: [String], default: 'sm' }
})

const { evaluate, followUp } = useFollowUpViewContext()

const finalTitle = computed(() => evaluate(props.title))

// The whole card is skipped until the follow-up has actually been answered.
const responded = computed(() => !!followUp.value?.isResponded)

const timeliness = computed(() => timelinessLabel(followUp.value?.respondDelayDays))
const respondedBy = computed(() => progressBy(followUp.value))

const isCompleted = computed(() => followUp.value?.progress === COMPLETED)
const outcomeLabel = computed(() => (isCompleted.value ? 'Outcome' : `${followUp.value?.progressLabel} Comment`))
const outcomeText = computed(() => (isCompleted.value
  ? (followUp.value?.outcome || progressComment(followUp.value))
  : progressComment(followUp.value)))

function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
