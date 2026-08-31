<template>
  <div :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!requisition" class="text-center q-py-lg">
        <q-icon name="request_quote" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Requisition not found</div>
        <div :class="ui.emptyCaptionClass">The record may have been removed since this link was opened.</div>
      </q-card-section>

      <q-card-section v-else>
        <div class="row items-center no-wrap q-gutter-sm q-mb-sm">
          <q-badge rounded :color="progressColor(requisition.Progress)" :label="progressLabel(requisition.Progress)" />
          <span class="text-caption text-grey-7">{{ requisition.Code }}</span>
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

    <q-card v-if="!pending && requisition" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Items requested</div>

        <div v-if="!lines.length" class="text-center q-py-lg">
          <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No items</div>
          <div :class="ui.emptyCaptionClass">Nothing has been requested, so there is nothing to approve.</div>
        </div>

        <div v-else :class="ui.detailGridClass">
          <div
            v-for="(line, index) in lines"
            :key="line.code"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">
              {{ line.primary }}
              <span v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6 block">
                {{ line.secondary }}
              </span>
            </span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.quantity }} {{ line.uom }}
            </span>
          </div>
        </div>

        <template v-if="lines.length">
          <q-separator class="q-my-sm" />
          <div class="row items-center justify-between text-weight-bold">
            <span>{{ totals.lines }} lines</span>
            <span>{{ totals.quantity }} units</span>
          </div>
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRequisitionReviewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewSummary', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  requisition,
  pending,
  lines,
  totals,
  warehouseName,
  progressLabel,
  progressColor,
  typeMeta,
  priorityMeta
} = useRequisitionReviewContext()

const facts = computed(() => {
  const record = requisition.value
  if (!record) return []
  return [
    { label: 'Type', value: typeMeta(record.Type).label },
    { label: 'Priority', value: priorityMeta(record.Priority).label },
    { label: 'Raised', value: record.PRDate },
    { label: 'Required By', value: record.RequiredDate },
    { label: 'Warehouse', value: warehouseName.value },
    { label: 'Reference', value: record.TypeReferenceCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
