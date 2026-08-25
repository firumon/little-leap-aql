<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <template v-else-if="visit">
        <!-- Planned half — always shown: it is what the visit was scheduled to be. -->
        <q-card-section>
          <div class="aql-detail-grid">
            <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
              <span class="aql-detail-key">Progress</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
                <q-badge rounded :color="statusColor" :label="statusLabel" />
              </span>
            </div>

            <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(1)">
              <span class="aql-detail-key">Visit Date</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                {{ visitDateLabel }}
              </span>
            </div>

            <div
              v-for="(line, index) in plannedLines"
              :key="line.label"
              class="aql-detail-line items-center aql-detail-row"
              :style="rowDelay(index + 2)"
            >
              <span class="aql-detail-key">{{ line.label }}</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                {{ line.value }}
              </span>
            </div>
          </div>
        </q-card-section>

        <!-- Responded half — only once an action has settled the visit. -->
        <template v-if="responded">
          <q-separator />

          <q-card-section>
            <div class="text-overline text-weight-bold text-grey-6 q-mb-xs">Response</div>

            <div class="aql-detail-grid">
              <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
                <span class="aql-detail-key">Respond Date</span>
                <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                  {{ respondDateLabel }}
                </span>
              </div>

              <div
                v-if="delayText"
                class="aql-detail-line items-center aql-detail-row"
                :style="rowDelay(1)"
              >
                <span class="aql-detail-key">Response Delay</span>
                <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                  <q-badge rounded :color="delayBadgeColor" :label="delayText" />
                </span>
              </div>

              <div
                v-for="(line, index) in responseLines"
                :key="line.label"
                class="aql-detail-line items-center aql-detail-row"
                :style="rowDelay(index + 2)"
              >
                <span class="aql-detail-key">{{ line.label }}</span>
                <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                  {{ line.value }}
                </span>
              </div>
            </div>
          </q-card-section>
        </template>
      </template>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletVisits › VisitDetails — Section (tier 3: resource-level Vue override).
 *
 * The workflow half of the View page: what was planned, and — once Cancel / Postpone /
 * Complete has settled the visit — what actually happened, how late the response was,
 * who recorded it and what they said.
 *
 * Layout mirrors `contents/ViewRecord.vue`: `SectionDividerLabel` heading,
 * `page-card aql-premium-gradient-card` shell, `.aql-detail-*` row grammar, 40ms
 * stagger. The only non-framework classes are Quasar's own `q-badge rounded`, so there
 * is nothing here to blur or misalign against a neighbouring framework card.
 *
 * Outcome comment / actor columns are looked up through `PROGRESS_STAMPS` in
 * useVisitProgress.js rather than a switch here, so the three outcomes cannot drift
 * apart and the list-view presets read the same values.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import {
  progressColor,
  progressIcon,
  progressLabel,
  progressComment,
  progressBy,
  isResponded,
  respondDelayDays,
  delayColor,
  PROGRESS_STAMPS,
  PLANNED
} from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'
import { delayLabel } from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitPresentation'

defineOptions({ name: 'OutletVisitsVisitDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Visit Details' },
  // `(record, config) => 'positive'`. Overrides the Progress-derived status colour.
  color: { type: [String, Function], default: null },
  padding: { type: [String], default: 'sm' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const finalTitle = computed(() => evalProp(props.title))

const visit = computed(() => resourceRecord?.record?.value || null)
const pending = computed(() => !visit.value && resourceRecord?.loading?.value === true)

const statusColor = computed(() => evalProp(props.color) || progressColor(visit.value))
const statusIcon = computed(() => progressIcon(visit.value))
const statusLabel = computed(() => progressLabel(visit.value))

const visitDateLabel = computed(() => visit.value?.Date || '—')
// Stamped by handleExecuteAction as `YYYY-MM-DD HH:mm:ss`, so it is shown verbatim.
const respondDateLabel = computed(() => visit.value?.RespondDate || '—')

// Blank rows are dropped rather than rendered as an em dash: a detail card reads better
// short than padded with placeholders.
const plannedLines = computed(() => ([
  { label: 'Planned Comment', value: visit.value?.[PROGRESS_STAMPS[PLANNED].comment] || '' },
  { label: 'Planned By', value: visit.value?.[PROGRESS_STAMPS[PLANNED].by] || '' }
].filter((line) => String(line.value).trim())))

const responded = computed(() => isResponded(visit.value))

const responseLines = computed(() => {
  if (!responded.value) return []
  return [
    { label: `${statusLabel.value} Comment`, value: progressComment(visit.value) },
    { label: `${statusLabel.value} By`, value: progressBy(visit.value) }
  ].filter((line) => String(line.value).trim())
})

// Same date or early → positive, 1–5 days late → warning, beyond that → negative.
const delayDays = computed(() => respondDelayDays(visit.value))
const delayText = computed(() => delayLabel(delayDays.value))
const delayBadgeColor = computed(() => delayColor(delayDays.value))

// Same 40ms cadence ViewRecord.vue uses, so stacked cards animate in step.
function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
