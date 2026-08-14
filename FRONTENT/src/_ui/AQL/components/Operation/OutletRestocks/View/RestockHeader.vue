<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!restock" class="text-center q-py-lg">
        <q-icon name="inventory_2" size="40px" color="grey-4" class="q-mb-sm block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-6">No restock</div>
      </q-card-section>

      <q-card-section v-else>
        <div class="aql-detail-grid">
          <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(0)">
            <span class="aql-detail-key">Progress</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </span>
          </div>

          <div
            v-for="(line, index) in lines"
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
 * `page-card aql-premium-gradient-card` shell, `.aql-detail-*` row grammar, 40ms
 * stagger — so it cannot misalign against a neighbouring framework card.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRestockView } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockView'
import { useRestockViewContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockViewContext'

defineOptions({ name: 'OutletRestocksViewRestockHeader', inheritAttrs: false })

const ROW_STAGGER_MS = 40

const props = defineProps({
  title: { type: [String, Function], default: 'Restock Details' },
  // `(record, config) => 'positive'`. Overrides the Progress-derived status colour.
  color: { type: [String, Function], default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate } = useRestockViewContext()

const { restock, pending, outletName, progressColor, progressIcon, progressLabel } = useRestockView()

const spacingClass = computed(() => `q-px-${props.padding}`)
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

const rowDelay = (index) => ({ animationDelay: `${index * ROW_STAGGER_MS}ms` })
</script>
