<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!rfq" class="text-center q-py-lg">
        <q-icon name="request_quote" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No RFQ</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Progress</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </span>
          </div>

          <div
            v-for="(line, index) in facts"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>

        <q-banner v-if="deadlinePassed" dense rounded class="bg-orange-2 q-mt-sm text-caption">
          The submission deadline has passed. Late quotations may still be captured.
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQView } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQView'
import { useRFQViewContext } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQViewContext'

defineOptions({ name: 'RFQsViewRFQHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'RFQ Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useRFQViewContext()
const { rfq, pending, deadlinePassed, deadlineDays, progressColor, progressIcon, progressLabel } = useRFQView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(rfq.value?.Progress))
const statusIcon = computed(() => progressIcon(rfq.value?.Progress))
const statusLabel = computed(() => progressLabel(rfq.value?.Progress))

const facts = computed(() => {
  const record = rfq.value
  if (!record) return []
  const days = deadlineDays.value
  const deadline = record.SubmissionDeadline
    ? `${record.SubmissionDeadline}${Number.isFinite(days) && days >= 0 ? ` (${days} days left)` : ''}`
    : ''
  return [
    { label: 'RFQ Date', value: record.RFQDate || '—' },
    { label: 'Deadline', value: deadline },
    { label: 'Requisition', value: record.PurchaseRequisitionCode },
    { label: 'Procurement', value: record.ProcurementCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
