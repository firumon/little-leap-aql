<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!record" class="text-center q-py-lg">
        <q-icon name="point_of_sale" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No consumption</div>
        <div :class="ui.emptyCaptionClass">This consumption record could not be loaded.</div>
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
          <div v-for="(line, i) in lines" :key="line.label" class="items-center"
               :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(i + 1)">
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
/**
 * View › Section 1 — the identity card.
 *
 * What this audit is: the outlet, the day, who made it, and where it stands. The rest of
 * the page elaborates on that one line, so it sits first and stays short.
 *
 * Blank rows are DROPPED rather than padded with em dashes — a detail card reads better
 * short, and `Cancelled: —` states nothing while looking like it does. The outlet and the
 * date are the two facts that IDENTIFY the record and are shown even when unresolved (§7.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionView, formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'

defineOptions({ name: 'OutletConsumptionsViewConsumptionHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Consumption Details' },
  color: { type: [String, Function], default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useConsumptionViewContext()
const { record, pending, outletName, consumedTotal, progressColor, progressIcon, progressLabel } = useConsumptionView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(record.value?.Progress))
const statusIcon = computed(() => progressIcon(record.value?.Progress))
const statusLabel = computed(() => progressLabel(record.value?.Progress))

const lines = computed(() => {
  const row = record.value
  if (!row) return []
  return [
    { label: 'Outlet', value: outletName.value || row.OutletCode || '—' },
    { label: 'Date', value: formatDate(row.Date) || '—' },
    { label: 'Recorded by', value: row.Username || '' },
    { label: 'Units consumed', value: consumedTotal.value || '' },
    // Only present on a cancelled record, and the single most important thing to say
    // about one — so it is stated here rather than left to the timeline.
    { label: 'Cancellation reason', value: row.ProgressCancelledComment || '' }
  ].filter((line) => String(line.value).trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
