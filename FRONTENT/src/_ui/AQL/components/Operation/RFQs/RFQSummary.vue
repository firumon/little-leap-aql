<template>
  <div :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!rfq" class="text-center q-py-lg">
        <q-icon name="request_quote" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">RFQ not found</div>
        <div :class="ui.emptyCaptionClass">The record may have been removed since this link was opened.</div>
      </q-card-section>

      <q-card-section v-else>
        <div class="row items-center no-wrap q-gutter-sm q-mb-sm">
          <q-badge rounded :color="progressColor(rfq.Progress)" :label="progressLabel(rfq.Progress)" />
          <span class="text-caption text-grey-7">{{ rfq.Code }}</span>
        </div>

        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in facts"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQSupplierFlowContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQSupplierFlowContext'

defineOptions({ name: 'RFQsRFQSummary', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, rfq, pending, assignedDetails, progressLabel, progressColor } = useRFQSupplierFlowContext()

const facts = computed(() => {
  const record = rfq.value
  if (!record) return []
  return [
    { label: 'RFQ Date', value: record.RFQDate },
    { label: 'Deadline', value: record.SubmissionDeadline },
    { label: 'Requisition', value: record.PurchaseRequisitionCode },
    { label: 'Suppliers Assigned', value: assignedDetails.value.length || '' }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
