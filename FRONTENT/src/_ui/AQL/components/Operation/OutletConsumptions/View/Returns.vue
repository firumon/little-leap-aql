<template>
  <!-- ALWAYS present, unlike the restock and invoice cards. A return that was recorded and
       then not shown is indistinguishable from one that was never recorded, and this is
       the page a dispute gets settled on — so the empty state is part of the answer here
       rather than noise (§10.4). -->
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <q-card v-if="!rows.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="assignment_return" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No returns</div>
        <div :class="ui.emptyCaptionClass">Nothing was returned or written off on this visit.</div>
      </q-card-section>
    </q-card>

    <!-- Was the one hand-rolled `q-list` left on this page — its own density, its own side
         section, its own badge markup, all drifting from the three `AppList` sections
         around it. The routing that made the hand-rolled caption worth keeping survives as
         a joined caption; the quantity and state move into the shared meta column, so this
         row now has exactly the rhythm the restock rows do. -->
    <AppList
      v-else
      :items="rows"
      item-key="code"
      :label="(row) => row.name"
      :caption="captionOf"
      :meta-layout="META_LAYOUT"
      :meta-label="(row) => row.qtyWithUom"
      :chip="(row) => relatedLabel(row.progress)"
      :chip-color="(row) => relatedColor(row.progress)"
      :itemClass="ui.cardClass"
      :gutter="gutter"
    />
  </div>
</template>

<script setup>
/**
 * View › Section 5 — returns recorded on this visit.
 *
 * Matched by outlet AND date rather than by a foreign key, because `OutletReturns` carries
 * no consumption code: a return is a fact about the outlet on a day, and the same visit
 * may produce one without a consumption ever being saved. The join is therefore the
 * honest one available, and it is stated here so a reader is not left assuming a link that
 * does not exist in the schema.
 *
 * The caption carries the routing that actually varies per row — the reason, and the
 * warehouse the units were sent to when they left the outlet at all.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionView } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'

defineOptions({ name: 'OutletConsumptionsViewReturns', inheritAttrs: false })

/**
 * The right-hand meta column, top to bottom: the quantity, then its state BADGE.
 *
 * A badge rather than a caption, for two reasons this page makes visible. It carries the
 * progress COLOUR — the same vocabulary the header chip and the Index rows use (§4.5) — so
 * "awaiting warehouse receipt" is distinguishable from "completed" at a glance instead of
 * being another line of grey text. And it stays a compact token when the row is narrow: on
 * a phone the joined caption already wraps to three lines, and a long grey state string
 * beside it reads as more caption rather than as a separate column.
 *
 * Hoisted to a module constant for the same reason `RestockDetails` hoists its own — an
 * inline array allocates a fresh identity every render and `abstract/List.vue` watches this
 * prop by reference (§11 rule 5).
 */
const META_LAYOUT = ['label', 'chip']

const props = defineProps({
  title: { type: [String, Function], default: 'Returns' },
  items: { type: Array, default: null },
  padding: { type: String, default: 'sm' },
  gutter: { type: String, default: 'sm' }
})

const { evaluate, ui } = useConsumptionViewContext()
const { outletReturns, relatedColor, relatedLabel } = useConsumptionView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? outletReturns.value : props.items))

/**
 * The routing that actually varies per row, as one caption.
 *
 * A named function rather than an inline arrow: the parts are conditional (a return that
 * never left the outlet has no warehouse), and `filter(Boolean)` before the join is what
 * stops a missing part leaving a dangling separator — the hand-rolled markup this replaced
 * handled that with a `v-if` on the separator itself.
 */
function captionOf (row) {
  return [row.variant, row.reason, row.warehouseCode ? `to ${row.warehouseCode}` : '']
    .filter(Boolean)
    .join(' · ')
}
</script>
