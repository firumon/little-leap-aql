<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!restock" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No restock</div>
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
 * OutletRestocks › View › RestockHeader — Section (tier 1: resource + page).
 *
 * What this request is: the outlet it is for, the day it was raised, who raised
 * it, and where it currently stands. The rest of the page elaborates on that
 * single line, so it sits first and stays short.
 *
 * Layout mirrors `contents/ViewRecord.vue`: `SectionDividerLabel` heading,
 * UI cardClass shell, `.aql-detail-*` row grammar, shared stagger — so it
 * cannot misalign against a neighbouring framework card.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRestockView } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockView'
import { useRestockViewContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockViewContext'

defineOptions({ name: 'OutletRestocksViewRestockHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Restock Details' },
  // `(record, config) => 'positive'`. Overrides the Progress-derived status colour.
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useRestockViewContext()

const { restock, pending, outletName, progressColor, progressIcon, progressLabel } = useRestockView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() =>
  evaluate(props.color) || progressColor(restock.value?.Progress))
const statusIcon = computed(() => progressIcon(restock.value?.Progress))
const statusLabel = computed(() => progressLabel(restock.value?.Progress))

// Blank rows are dropped rather than padded with em dashes — a detail card reads
// better short. The outlet and the date are the two facts that identify the
// request, so they are shown even when unresolved.
const lines = computed(() => {
  const record = restock.value
  if (!record) return []
  return [
    { label: 'Outlet', value: outletName.value || record.OutletCode || '—' },
    { label: 'Date', value: record.Date || '—' },
    { label: 'Requested By', value: record.RequestedUser || '' },
    { label: 'Approved By', value: record.ApprovedUser || '' }
  ].filter((line) => String(line.value).trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
