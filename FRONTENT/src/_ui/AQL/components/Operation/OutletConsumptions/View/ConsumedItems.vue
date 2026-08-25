<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <!-- The two non-list states keep a card SHELL, because there is no row for the card to
         land on — a bare skeleton or a floating icon on the page background reads as a
         layout fault rather than as a state. -->
    <q-card v-if="pending" flat bordered :class="ui.cardClass">
      <q-card-section>
        <q-skeleton type="text" width="60%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>
    </q-card>

    <q-card v-else-if="!rows.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing consumed</div>
        <!-- Names both remaining possibilities. A restock-only audit is now a supported
             outcome, so a caption offering "returns only" as the sole explanation would
             read as though something had gone missing. -->
        <div :class="ui.emptyCaptionClass">
          This audit found no stock had sold — it may have recorded a restock or returns only.
        </div>
      </q-card-section>
    </q-card>

    <!-- UN-NESTED: each row IS a card (`itemClass`), rather than a list of separated rows
         inside one outer card. Standardised across all four list sections on this page —
         a card-per-row and a card-of-rows next to each other read as two different kinds
         of content when they are the same kind (§8 Registry Check & Reuse).

         `gutter` is forwarded rather than left to `List.vue`'s own `xs` default, so the
         page's spacing rhythm is set in ONE place and travels down. -->
    <AppList
      v-else
      :items="rows"
      item-key="code"
      :label="(row) => row.name"
      :caption="(row) => row.variant"
      :meta-layout="META_LAYOUT"
      :meta-label="(row) => row.qtyWithUom"
      :itemClass="ui.cardClass"
      :gutter="gutter"
    />
  </div>
</template>

<script setup>
/**
 * View › Section 2 — what this audit consumed.
 *
 * A FLAT list of SKUs and quantities. No grouping by product: a consumption has one line
 * per SKU and nothing beneath it, so a second level would be a container holding exactly
 * one child on every row.
 *
 * Empty here is a legitimate outcome rather than a failure — an audit that found only
 * damage records returns and no sales — and the caption is what says so (§10.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionView } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'

defineOptions({ name: 'OutletConsumptionsViewConsumedItems', inheritAttrs: false })

const META_LAYOUT = ['label']

const props = defineProps({
  title: { type: [String, Function], default: 'Consumed Items' },
  items: { type: Array, default: null },
  // Vertical rhythm BETWEEN the row cards. `'none'` turns it off for a caller that owns
  // its own spacing; see `List.vue`'s `gutterClass`.
  gutter: { type: String, default: 'sm' }
})

const { evaluate, ui } = useConsumptionViewContext()
const { consumedItems, pending } = useConsumptionView()

const finalTitle = computed(() => evaluate(props.title))
// `null` means "use my own projection"; `[]` means "a caller handed me nothing" — the two
// are deliberately not collapsed, or the card could not be narrowed by a caller (§7.5).
const rows = computed(() => (props.items === null ? consumedItems.value : props.items))
</script>
