<template>
  <!-- Hidden entirely when this audit raised no restock. A card saying "no replenishment"
       on every audit that needed none is a row of noise on the common case, so it uses
       `v-if` at the root rather than an empty shell (§10.4). -->
  <div v-if="rows.length" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="ui.cardClass">
      <!-- Name LEFT, quantity and state RIGHT, in one right-aligned meta column.
           `metaLayout` is what stacks them: without it the quantity and the chip were laid
           out by the list's own defaults and drifted apart, so a long product name pushed
           the figure away from the chip that qualifies it. Declaring the column makes the
           two read as one right-hand block on every row, whatever the name's length. -->
      <q-card-section class="q-pa-none">
        <AppList
          :items="rows"
          item-key="code"
          :label="(row) => row.name"
          :caption="(row) => row.variant"
          :meta-layout="META_LAYOUT"
          :meta-label="(row) => row.qty"
          :meta-caption="(row) => relatedLabel(row.progress)"
          separator
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * View › Section 3 — the replenishment this audit raised.
 *
 * A FLAT list of restock LINE ITEMS, not a request→item tree. An audit normally raises one
 * restock, so grouping by request would put every line under a single header that repeats
 * what this card's own title already says; and a phone row has no width for two levels of
 * nesting. The request's state is carried per line instead, which is where it actually
 * differs — a partially-covered direct restock has ALLOCATED and PENDING lines in the same
 * request.
 *
 * Each line's state badge reads its colour from the ONE progress vocabulary, extended with
 * the restock item states — so a line marked "Allocated" here is the same colour it is on
 * the Restocks module's own pages (§4.5).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionView } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'

defineOptions({ name: 'OutletConsumptionsViewRestockDetails', inheritAttrs: false })

/**
 * The right-hand meta column, top to bottom: the quantity, then its state chip.
 *
 * Hoisted to a module constant rather than written inline in the template — a literal
 * array allocates a fresh identity every render, and `abstract/List.vue` watches this prop
 * by reference, so an inline value re-runs its resolvers on every keystroke elsewhere on
 * the page (§11 rule 5).
 */
const META_LAYOUT = ['label', 'caption']

const props = defineProps({
  title: { type: [String, Function], default: 'Restock' },
  items: { type: Array, default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useConsumptionViewContext()
const { restockLines, relatedColor, relatedLabel } = useConsumptionView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? restockLines.value : props.items))
</script>
