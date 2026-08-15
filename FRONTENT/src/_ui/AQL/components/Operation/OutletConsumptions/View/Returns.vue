<template>
  <!-- ALWAYS present, unlike the restock and invoice cards. A return that was recorded and
       then not shown is indistinguishable from one that was never recorded, and this is
       the page a dispute gets settled on — so the empty state is part of the answer here
       rather than noise (§10.4). -->
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="!rows.length" class="text-center q-py-lg">
        <q-icon name="assignment_return" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No returns</div>
        <div :class="ui.emptyCaptionClass">Nothing was returned or written off on this visit.</div>
      </q-card-section>

      <q-card-section v-else>
        <q-list separator dense>
          <q-item v-for="row in rows" :key="row.code">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ row.name }}</q-item-label>
              <q-item-label caption>
                {{ row.variant }} · {{ row.reason }}
                <template v-if="row.warehouseCode"> · to {{ row.warehouseCode }}</template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row items-center no-wrap q-gutter-xs">
                <span class="text-weight-medium">{{ row.qty }}</span>
                <q-badge rounded :color="relatedColor(row.progress)" :label="relatedLabel(row.progress)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
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
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionView } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'

defineOptions({ name: 'OutletConsumptionsViewReturns', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Returns' },
  items: { type: Array, default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useConsumptionViewContext()
const { outletReturns, relatedColor, relatedLabel } = useConsumptionView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? outletReturns.value : props.items))
</script>
