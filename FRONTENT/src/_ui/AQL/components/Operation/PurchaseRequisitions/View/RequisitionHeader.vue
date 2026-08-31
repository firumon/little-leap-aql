<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!requisition" class="text-center q-py-lg">
        <q-icon name="request_quote" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No requisition</div>
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
            v-for="(line, index) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 1)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'

defineOptions({ name: 'PurchaseRequisitionsViewRequisitionHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Requisition Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useRequisitionViewContext()
const {
  requisition,
  pending,
  warehouseName,
  referenceRequired,
  progressColor,
  progressIcon,
  progressLabel,
  typeMeta,
  priorityMeta
} = useRequisitionView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(requisition.value?.Progress))
const statusIcon = computed(() => progressIcon(requisition.value?.Progress))
const statusLabel = computed(() => progressLabel(requisition.value?.Progress))

// Blank rows are dropped rather than padded. Type and date identify the record, so
// they are shown even when unresolved.
const lines = computed(() => {
  const record = requisition.value
  if (!record) return []
  return [
    { label: 'Type', value: typeMeta(record.Type).label || '—' },
    { label: 'Priority', value: priorityMeta(record.Priority).label },
    { label: 'PR Date', value: record.PRDate || '—' },
    { label: 'Required By', value: record.RequiredDate },
    { label: 'Warehouse', value: warehouseName.value },
    ...(referenceRequired.value ? [{ label: 'Reference', value: record.TypeReferenceCode }] : []),
    { label: 'Procurement', value: record.ProcurementCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
