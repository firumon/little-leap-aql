<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="60%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing consumed</div>
        <div :class="ui.emptyCaptionClass">
          This audit found no stock had sold — it may have recorded returns only.
        </div>
      </q-card-section>

      <!-- `AppList`, not a hand-rolled `q-list`. The three lists on this page were each
           built by hand with slightly different density and side sections, which is
           exactly the drift the shared list component exists to prevent — it owns the row
           rhythm, the avatar treatment and the transitions for all of them (§8 Registry
           Check & Reuse). -->
      <q-card-section v-else class="q-pa-none">
        <AppList
          :items="rows"
          item-key="code"
          :label="(row) => row.name"
          :caption="(row) => row.variant"
          :chip="(row) => row.qty"
          chip-color="positive"
          separator
        />
      </q-card-section>
    </q-card>
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

const props = defineProps({
  title: { type: [String, Function], default: 'Consumed Items' },
  items: { type: Array, default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useConsumptionViewContext()
const { consumedItems, pending } = useConsumptionView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))
// `null` means "use my own projection"; `[]` means "a caller handed me nothing" — the two
// are deliberately not collapsed, or the card could not be narrowed by a caller (§7.5).
const rows = computed(() => (props.items === null ? consumedItems.value : props.items))
</script>
