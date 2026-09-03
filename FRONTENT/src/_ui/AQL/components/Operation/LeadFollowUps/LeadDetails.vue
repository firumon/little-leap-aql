<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="45%" class="q-mb-sm" />
        <q-skeleton type="text" width="70%" />
      </q-card-section>

      <template v-else-if="lead">
        <q-card-section>
          <div class="aql-detail-grid">
            <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
              <span class="aql-detail-key">{{ lead.displayName }}</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                <span class="ellipsis">{{ lead.code }}</span>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  color="primary"
                  icon="open_in_new"
                  class="q-ml-xs"
                  :aria-label="finalLinkLabel"
                  @click="openLead"
                >
                  <q-tooltip>{{ finalLinkLabel }}</q-tooltip>
                </q-btn>
              </span>
            </div>

            <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(1)">
              <span class="aql-detail-key">Progress</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                <q-icon :name="lead.progressIcon" size="16px" :color="lead.progressColor" class="q-mr-xs" />
                <q-badge rounded :color="lead.progressColor" :label="lead.progressLabel" />
              </span>
            </div>

            <div
              v-for="(line, index) in visibleLines"
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

        <template v-if="stampComment">
          <q-separator />
          <q-card-section>
            <div class="text-overline text-weight-bold text-grey-6 q-mb-xs">
              {{ lead.progressLabel }} Comment
            </div>
            <div class="text-body2">{{ stampComment }}</div>
          </q-card-section>
        </template>
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
import { useFollowUpViewContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/View/useFollowUpViewContext'
import { progressComment } from 'src/_resource/Master/Leads/composables/useLeadProgress'

defineOptions({ name: 'LeadFollowUpsLeadDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Lead' },
  linkLabel: { type: [String, Function], default: 'Open lead' },
  emptyText: { type: [String, Function], default: 'This follow-up has no linked lead record.' },
  padding: { type: [String], default: 'sm' }
})

const { evaluate, lead, leadPending, openLead } = useFollowUpViewContext()

const finalTitle = computed(() => evaluate(props.title))
const finalLinkLabel = computed(() => evaluate(props.linkLabel))
const finalEmptyText = computed(() => evaluate(props.emptyText))
const pending = computed(() => leadPending.value)

const stampComment = computed(() => progressComment(lead.value))

const visibleLines = computed(() => {
  const row = lead.value
  if (!row) return []
  return [
    { label: 'Lead Code', value: row.code || '' },
    { label: 'City', value: row.City || '' },
    { label: 'Area', value: row.Area || '' },
    { label: 'Province', value: row.Province || '' }
  ].filter((line) => String(line.value ?? '').trim())
})

function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
