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
      :label="rowLabel"
      :caption="rowCaption"
      :chip="rowChip"
      chip-color="warning"
      clickable
      @click="openLatest"
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
 * `props.items` is deliberately ignored, as in `ListScheduledOutlets.vue` — the rows are a
 * different shape from the resource's own records. The sheet filter behind this pill
 * (`Progress = PENDING_INVOICE_GENERATION`) still drives its count and keeps a deep link
 * off settled history.
 *
 * Clicking a row opens that outlet's LATEST consumption. The row stands for several
 * records, so the tap has to resolve to one, and the newest is what the reader is asking
 * about — its View page then carries the invoice card and the "Recent Consumptions Here"
 * list, putting the rest of the backlog one tap away. Bundling itself still happens in the
 * Add wizard, which is reached from the record rather than jumped to blindly from here.
 *
 * NO ROW ACTION BUTTONS. Adding one would turn off `abstract/List.vue`'s whole-row tap and
 * force an explicit View button back on, which costs width on a phone for a row that has
 * exactly one thing to do (§7.3).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useConsumptionIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionIndexContext'

defineOptions({ name: 'OutletConsumptionsIndexListInvoiceableOutlets', inheritAttrs: false })

const { index, ui, nav } = useConsumptionIndexContext()

const rows = computed(() => index.invoiceableOutlets.value)

const rowLabel = (row) => row.outletName

/**
 * The caption states the FACT that puts this row in this queue — how long the oldest
 * unbilled audit has been sitting — rather than restating the outlet name in another form
 * (§7.2's queue-intent matrix).
 */
const rowCaption = (row) => {
  const days = row.daysSinceAudit
  if (days === null || !Number.isFinite(days)) return 'Awaiting invoice'
  if (days <= 0) return 'Counted today'
  return `Last counted ${days === 1 ? '1 day' : `${days} days`} ago`
}

const rowChip = (row) =>
  `${row.uninvoicedCount} awaiting invoice`

/**
 * Open the outlet's most recent consumption.
 *
 * The row aggregates several consumptions, so tapping it has to resolve to ONE of them.
 * The latest is the right target: it is the record the reader is asking about when they
 * pick this outlet off the queue, and its View page carries the invoice card, the sibling
 * "Recent Consumptions Here" list and the bundling context — so the rest of the backlog is
 * one tap further rather than hidden.
 *
 * The code is resolved by the shared aggregate in the same pass that computes the row's
 * age, so the record this opens is guaranteed to be the one the caption is describing.
 *
 * Fails CLOSED on a missing code rather than falling back to another destination: this
 * view only lists outlets that have at least one uninvoiced consumption, so a blank here
 * means the store has not settled yet, and navigating somewhere else would take the user
 * to a page they did not ask for.
 */
function openLatest (row) {
  const code = String(row?.latestConsumptionCode || '').trim()
  if (!code) return
  nav.goTo('view', { code })
}
</script>
