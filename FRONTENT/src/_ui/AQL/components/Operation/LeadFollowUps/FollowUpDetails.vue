<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="followUp">
        <div class="aql-detail-grid">
          <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
            <span class="aql-detail-key">Progress</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              <q-icon :name="followUp.progressIcon" size="16px" :color="followUp.progressColor" class="q-mr-xs" />
              <q-badge rounded :color="followUp.progressColor" :label="followUp.progressLabel" />
            </span>
          </div>

          <div
            v-for="(line, index) in visibleLines"
            :key="line.label"
            class="aql-detail-line items-center aql-detail-row"
            :style="rowDelay(index + 1)"
          >
            <span class="aql-detail-key">{{ line.label }}</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>

      <q-card-section v-else class="text-caption text-grey-7">
        This follow-up record could not be loaded.
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useFollowUpViewContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/View/useFollowUpViewContext'

defineOptions({ name: 'LeadFollowUpsFollowUpDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Follow Up Details' },
  padding: { type: [String], default: 'sm' }
})

const { evaluate, followUp, pending } = useFollowUpViewContext()

const finalTitle = computed(() => evaluate(props.title))

const visibleLines = computed(() => {
  const row = followUp.value
  if (!row) return []
  return [
    { label: 'Date', value: row.Date || '' },
    { label: 'Assigned To', value: row.Username || '' },
    { label: 'Purpose', value: row.purpose || '' },
    { label: 'Purpose Detail', value: row.purposeDetail || '' }
  ].filter((line) => String(line.value ?? '').trim())
})

function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
