<template>
  <div v-if="rows.length" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="ui.cardClass">
      <!-- Standardised on `AppList`, which also restores whole-row tap navigation and the
           row transitions the hand-built list did not have. -->
      <q-card-section class="q-pa-none">
        <AppList
          :items="rows"
          item-key="code"
          :label="(row) => formatDate(row.date)"
          :caption="(row) => row.username"
          :chip="(row) => progressLabel(row.progress)"
          :chip-color="(row) => progressColor(row.progress)"
          separator
          clickable
          @click="open"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * View › Section 6 — the outlet's recent audit history.
 *
 * Up to five other audits at the same outlet, newest first. This is the context that makes
 * one audit interpretable: a large consumption reads very differently when the previous
 * visit was three days ago than when it was three months ago.
 *
 * Capped at five deliberately. This is a sidebar on someone else's page, not a list view —
 * the full history is the Index page's job, and an uncapped list here would push the
 * cancellation action off the bottom of a phone screen.
 *
 * The date carries the row rather than the record code, for the same reason the Index rows
 * omit it: `OC-000412` identifies the row to the database and to nobody else (§7.2).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionView, formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'

defineOptions({ name: 'OutletConsumptionsViewRecentConsumptions', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Recent Consumptions Here' },
  items: { type: Array, default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui, nav } = useConsumptionViewContext()
const { recentConsumptions, progressColor, progressLabel } = useConsumptionView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? recentConsumptions.value : props.items))

function open (row) {
  nav.goTo('view', { code: row.code })
}
</script>
