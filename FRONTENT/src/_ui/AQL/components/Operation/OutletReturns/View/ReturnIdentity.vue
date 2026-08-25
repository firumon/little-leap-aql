<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!record" class="text-center q-py-lg">
        <q-icon name="assignment_return" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No return</div>
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
/**
 * OutletReturns › View › ReturnIdentity — Section (tier 1: resource + page).
 *
 * What this return IS: the outlet it came from, the day it was logged, who logged it, and
 * where it currently stands. The rest of the page elaborates on that one line, so it sits
 * first and stays short.
 *
 * Blank rows are dropped rather than padded with em dashes — a detail card reads better
 * short, and a `Logged By: —` row states nothing while looking like it does (§7.4). The
 * outlet and the date are the two facts that IDENTIFY the return, so they are shown even
 * when unresolved.
 *
 * Layout mirrors `contents/ViewRecord.vue`: `SectionDividerLabel` heading, UI `cardClass`
 * shell, `.aql-detail-*` row grammar, shared stagger — so it cannot misalign against a
 * neighbouring framework card.
 *
 * Self-guards its own loading and empty states: View cards are declared in `sections`,
 * which render outside `<AqlContentWrapper>` (§7.4, §10.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewReturnIdentity', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Return Details' },
  // `(record, config) => 'positive'`. Overrides the Progress-derived status colour.
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useReturnViewContext()
const { record, pending, outletName, progressColor, progressIcon, progressLabel } = useReturnView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(record.value?.Progress))
const statusIcon = computed(() => progressIcon(record.value?.Progress))
const statusLabel = computed(() => progressLabel(record.value?.Progress))

const lines = computed(() => {
  const row = record.value
  if (!row) return []
  return [
    { label: 'Return', value: row.Code || '—' },
    { label: 'Outlet', value: outletName.value || row.OutletCode || '—' },
    { label: 'Date', value: row.Date || '—' },
    { label: 'Logged By', value: row.Username || '' }
  ].filter((line) => String(line.value).trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
