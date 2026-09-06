<template>
  <div>
    <q-card v-if="!rows.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <!-- Empty is GOOD NEWS here, and says so with a positive icon: every consumption
             recorded has been billed (UI_MODULE_DEVELOPER_GUIDE §10.4). -->
        <q-icon name="task_alt" :size="ui.emptyIconSize" color="positive" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Everything is invoiced</div>
        <div :class="ui.emptyCaptionClass">
          No outlet is carrying a consumption that still needs a bill.
        </div>
      </q-card-section>
    </q-card>

    <AppList
      v-else
      :items="rows"
      item-key="outletCode"
      :layout="['label', 'caption', 'caption']"
      :content="contentArray"
      :chip="rowChip"
      chip-color="warning"
      clickable
      @click="openOldest"
    />
  </div>
</template>

<script setup>
/**
 * OutletConsumptions › Index › ListInvoiceableOutlets — per-view override (tier 1).
 *
 * A PROJECTION, and the reason it is a `.vue` rather than a `Props<Identity>` block: this
 * queue lists OUTLETS, one row each, not the consumptions underneath them.
 *
 * That regrouping is the entire value of the view. The bundling feature exists so an
 * officer can put six uninvoiced audits for one outlet onto a single bill; a list showing
 * those six as six rows asks them to notice the repetition themselves and then work out
 * how many there were. One row saying "Marina Mall · 6 awaiting invoice" states the job.
 *
 * SORTED BY BACKLOG, HEAVIEST FIRST — the outlet owing six invoices is worth a trip before
 * the one owing a single line. That ordering is decided by the Layer 2 aggregate, not
 * here, so the "Uninvoiced Outlets" metric card above and this list are counting the same
 * set (§7.4).
 *
 * The rows are a different SHAPE from the resource's own records, but not a different
 * SET: `items` carries the rows this pill's filter and the search box have already
 * narrowed, so the outlets are kept to the ones those rows belong to. That is what makes
 * the pill count, the search box and this list agree instead of drifting apart.
 *
 * Clicking a row opens that outlet's OLDEST consumption that still needs a bill. Its View
 * page carries the invoice card and the "Recent Consumptions Here" list, so the rest of
 * the backlog is one tap away. Bundling still happens in the Add wizard.
 *
 * NO ROW ACTION BUTTONS. Adding one would turn off `abstract/List.vue`'s whole-row tap and
 * force an explicit View button back on, which costs width on a phone for a row that has
 * exactly one thing to do (§7.3).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useConsumptionIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionIndexContext'
import { formatRelativeAge } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionRowPresets'

defineOptions({ name: 'OutletConsumptionsIndexListInvoiceableOutlets', inheritAttrs: false })

const attrs = useAttrs()
const { index, ui, nav } = useConsumptionIndexContext()

// The outlets the already-filtered rows belong to. `null` while `items` has not been
// handed down yet, which means "do not narrow" rather than "narrow to nothing".
const filteredOutlets = computed(() => {
  const items = attrs.items
  if (!Array.isArray(items)) return null
  return new Set(items.map((row) => String(row?.OutletCode ?? '').trim()).filter(Boolean))
})

const rows = computed(() => {
  const keep = filteredOutlets.value
  const all = index.invoiceableOutlets.value
  return keep ? all.filter((entry) => keep.has(entry.outletCode)) : all
})

const ageOf = (row, key) => formatRelativeAge(row[key] || row.lastAuditDate)

// Two ages show the SPREAD of the backlog, which is what a bundling trip needs to know.
// One pending row has no spread, so it says "Consumption:" once and drops the third line.
const contentArray = [
  (row) => row.outletName,
  (row) => {
    const oldest = ageOf(row, 'oldestUninvoicedDate')
    if (row.uninvoicedCount <= 1) return oldest ? `Consumption: ${oldest}` : 'Awaiting invoice'
    return oldest ? `Oldest Consumption: ${oldest}` : ''
  },
  (row) => {
    if (row.uninvoicedCount <= 1) return false
    const newest = ageOf(row, 'newestUninvoicedDate')
    return newest ? `Newest Consumption: ${newest}` : ''
  }
]

const rowChip = (row) =>
  `${row.uninvoicedCount}x Consumption${row.uninvoicedCount === 1 ? '' : 's'}`

// The row stands for many consumptions, so a tap must pick one. Pick the oldest UNBILLED
// one: a newer row here may already be invoiced. Do nothing if no code is ready yet.
function openOldest (row) {
  const code = String(row?.oldestUninvoicedCode || row?.uninvoicedCodes?.[0] || '').trim()
  if (!code) return
  nav.goTo('view', { code })
}
</script>
